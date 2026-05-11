import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { asyncHandler } from '../middleware/async.middleware';
import { createError } from '../middleware/error.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { parsePractitionerInvoice } from '../services/practitionerParser.service';
import { recalcInvoice } from '../services/reconciliation.service';
import { PractitionerInvoice } from '../models/PractitionerInvoice.model';
import { ReconciliationMonth } from '../models/ReconciliationMonth.model';
import { AuthenticatedRequest } from '../types';
import { env } from '../config/env';
import { Types } from 'mongoose';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .xls files are accepted'));
    }
  },
});

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ProposedMatch {
  invoiceNo: string;
  qboClientName: string;
  parsedClientName: string;
  sessionGroups: { sessionLength: number; sessionDates: string[] }[];
}

export interface UnmatchedGroup {
  parsedClientName: string;
  sessionLength: number;
  sessionDates: string[];
}

export interface PreviewResult {
  fileName: string;
  practitionerName: string;
  sessionCount: number;
  matches: ProposedMatch[];
  unmatched: UnmatchedGroup[];
  warnings: string[];
}

// ─── Matching helper ──────────────────────────────────────────────────────────

function fuzzyNameMatch(a: string, b: string): boolean {
  return a === b || a.includes(b) || b.includes(a);
}

function buildProposedMatches(
  practitionerName: string,
  parsedSessions: { clientName: string; sessionLength: number; sessionDate: string; billable: boolean }[],
  invoices: { invoiceNo: string; clientName: string; practitioner: string }[],
): { matches: ProposedMatch[]; unmatched: UnmatchedGroup[] } {
  const billable = parsedSessions.filter((s) => s.billable && s.sessionLength > 0);

  // Group parsed sessions by clientName + sessionLength
  const grouped = new Map<string, string[]>();
  for (const s of billable) {
    const key = `${s.clientName}|${s.sessionLength}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s.sessionDate);
  }

  const practitionerNameNorm = practitionerName.toLowerCase().replace(/\s+/g, '');

  // Only consider invoices attributed to this practitioner
  const ownedInvoices = invoices.filter((inv) => {
    const invPractNorm = inv.practitioner.toLowerCase().replace(/\s+/g, '');
    return fuzzyNameMatch(invPractNorm, practitionerNameNorm);
  });

  const matches: ProposedMatch[] = [];
  const matchedKeys = new Set<string>();

  for (const invoice of ownedInvoices) {
    const invoiceNameNorm = invoice.clientName.toLowerCase().replace(/\s+/g, '');
    const sessionGroups: { sessionLength: number; sessionDates: string[] }[] = [];

    for (const [key, dates] of grouped.entries()) {
      const [parsedClient, lenStr] = key.split('|');
      const parsedNameNorm = parsedClient.toLowerCase().replace(/\s+/g, '');

      if (fuzzyNameMatch(invoiceNameNorm, parsedNameNorm)) {
        sessionGroups.push({
          sessionLength: parseInt(lenStr),
          sessionDates: [...new Set(dates)].sort((a, b) => parseInt(a) - parseInt(b)),
        });
        matchedKeys.add(key);
      }
    }

    if (sessionGroups.length > 0) {
      matches.push({
        invoiceNo: invoice.invoiceNo,
        qboClientName: invoice.clientName,
        parsedClientName: grouped.keys().next().value?.split('|')[0] ?? invoice.clientName,
        sessionGroups,
      });

      // Store the actual parsed client name properly
      const firstKey = [...grouped.keys()].find((k) => {
        const [parsedClient] = k.split('|');
        const parsedNameNorm = parsedClient.toLowerCase().replace(/\s+/g, '');
        return fuzzyNameMatch(invoiceNameNorm, parsedNameNorm);
      });
      if (firstKey) {
        matches[matches.length - 1].parsedClientName = firstKey.split('|')[0];
      }
    }
  }

  // Remaining grouped entries that had no invoice match
  const unmatched: UnmatchedGroup[] = [];
  for (const [key, dates] of grouped.entries()) {
    if (!matchedKeys.has(key)) {
      const [parsedClient, lenStr] = key.split('|');
      unmatched.push({
        parsedClientName: parsedClient,
        sessionLength: parseInt(lenStr),
        sessionDates: [...new Set(dates)].sort((a, b) => parseInt(a) - parseInt(b)),
      });
    }
  }

  return { matches, unmatched };
}

// ─── POST /api/practitioners/preview/:reconciliationMonthId ───────────────────
// Parse files and return proposed matches — does NOT write to invoices.

router.post(
  '/preview/:reconciliationMonthId',
  upload.array('files', 20),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reconciliationMonthId } = req.params;

    if (!Types.ObjectId.isValid(reconciliationMonthId)) {
      throw createError('Invalid reconciliation ID', 400);
    }

    const reconciliation = await ReconciliationMonth.findById(reconciliationMonthId);
    if (!reconciliation) throw createError('Reconciliation not found', 404);
    if (reconciliation.status === 'approved') {
      throw createError('Approved reconciliations are locked', 403);
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) throw createError('No files provided', 400);

    const previews: PreviewResult[] = [];

    for (const file of files) {
      const { practitionerName, parsedSessions, parseWarnings } =
        parsePractitionerInvoice(file.buffer, file.originalname);

      // Persist parsed data (safe to re-upload)
      await PractitionerInvoice.findOneAndUpdate(
        { reconciliationMonthId: new Types.ObjectId(reconciliationMonthId), practitionerName },
        {
          $set: {
            month: reconciliation.month,
            year: reconciliation.year,
            rawFileName: file.originalname,
            parsedSessions,
            parseWarnings,
            uploadedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      const billableCount = parsedSessions.filter((s) => s.billable && s.sessionLength > 0).length;
      const { matches, unmatched } = buildProposedMatches(
        practitionerName,
        parsedSessions,
        reconciliation.invoices.map((inv) => ({
          invoiceNo: inv.invoiceNo,
          clientName: inv.clientName,
          practitioner: inv.practitioner,
        })),
      );

      previews.push({
        fileName: file.originalname,
        practitionerName,
        sessionCount: billableCount,
        matches,
        unmatched,
        warnings: parseWarnings,
      });
    }

    res.json({ success: true, data: { previews } });
  }),
);

// ─── POST /api/practitioners/apply/:reconciliationMonthId ─────────────────────
// Write confirmed matches to invoice rows and recalc.

const applySchema = z.object({
  applications: z.array(
    z.object({
      invoiceNo: z.string().min(1),
      sessionGroups: z.array(
        z.object({
          sessionLength: z.number().positive(),
          sessionDates: z.array(z.string()),
        }),
      ),
    }),
  ),
});

router.post(
  '/apply/:reconciliationMonthId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reconciliationMonthId } = req.params;

    if (!Types.ObjectId.isValid(reconciliationMonthId)) {
      throw createError('Invalid reconciliation ID', 400);
    }

    const result = applySchema.safeParse(req.body);
    if (!result.success) throw createError(result.error.errors[0].message, 400);

    const reconciliation = await ReconciliationMonth.findById(reconciliationMonthId);
    if (!reconciliation) throw createError('Reconciliation not found', 404);
    if (reconciliation.status === 'approved') {
      throw createError('Approved reconciliations are locked', 403);
    }

    const { applications } = result.data;
    const updatedInvoiceNos: string[] = [];

    for (const app of applications) {
      const invoice = reconciliation.invoices.find((inv) => inv.invoiceNo === app.invoiceNo);
      if (!invoice) continue;

      recalcInvoice({
        invoice,
        sessionGroups: app.sessionGroups.map((sg) => ({ ...sg, qboDescription: '' })),
        supervisorDetails: env.DEFAULT_SUPERVISOR,
        month: reconciliation.month,
      });

      updatedInvoiceNos.push(app.invoiceNo);
    }

    await reconciliation.save();

    res.json({ success: true, data: { updatedInvoiceNos } });
  }),
);

// ─── GET /api/practitioners/parsed/:reconciliationMonthId ─────────────────────

router.get(
  '/parsed/:reconciliationMonthId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const docs = await PractitionerInvoice.find({
      reconciliationMonthId: req.params.reconciliationMonthId,
    }).sort({ practitionerName: 1 });

    res.json({ success: true, data: { practitioners: docs } });
  }),
);

export default router;

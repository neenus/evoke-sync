import { Router, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/async.middleware';
import { createError } from '../middleware/error.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { parsePractitionerInvoice } from '../services/practitionerParser.service';
import { PractitionerInvoice } from '../models/PractitionerInvoice.model';
import { ReconciliationMonth } from '../models/ReconciliationMonth.model';
import { AuthenticatedRequest } from '../types';
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

// ─── POST /api/practitioners/upload/:reconciliationMonthId ────────────────────

router.post(
  '/upload/:reconciliationMonthId',
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

    const results: Array<{
      fileName: string;
      practitionerName: string;
      sessionCount: number;
      warnings: string[];
    }> = [];

    for (const file of files) {
      const { practitionerName, parsedSessions, parseWarnings } =
        parsePractitionerInvoice(file.buffer, file.originalname);

      // Upsert — safe to re-upload
      await PractitionerInvoice.findOneAndUpdate(
        {
          reconciliationMonthId: new Types.ObjectId(reconciliationMonthId),
          practitionerName,
        },
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

      // ─── Match sessions to invoice rows ─────────────────────────────────────

      const billableSessions = parsedSessions.filter((s) => s.billable && s.sessionLength > 0);

      // Group by clientName + sessionLength
      const grouped = new Map<string, string[]>();
      for (const session of billableSessions) {
        const key = `${session.clientName}|${session.sessionLength}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(session.sessionDate);
      }

      // Update matching invoice rows (fuzzy client name match)
      for (const invoice of reconciliation.invoices) {
        const invoiceNameLower = invoice.clientName.toLowerCase().replace(/\s+/g, '');
        const sessionGroups: typeof invoice.sessionGroups = [];

        for (const [key, dates] of grouped.entries()) {
          const [parsedClient, lenStr] = key.split('|');
          const parsedNameLower = parsedClient.toLowerCase().replace(/\s+/g, '');

          if (
            invoiceNameLower === parsedNameLower ||
            invoiceNameLower.includes(parsedNameLower) ||
            parsedNameLower.includes(invoiceNameLower)
          ) {
            sessionGroups.push({
              sessionLength: parseInt(lenStr),
              sessionDates: [...new Set(dates)].sort((a, b) => parseInt(a) - parseInt(b)),
              qboDescription: '',
            });
          }
        }

        if (sessionGroups.length > 0) {
          invoice.sessionGroups = sessionGroups as typeof invoice.sessionGroups;
        }
      }

      await reconciliation.save();

      results.push({
        fileName: file.originalname,
        practitionerName,
        sessionCount: billableSessions.length,
        warnings: parseWarnings,
      });
    }

    res.json({ success: true, data: { parsed: results } });
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

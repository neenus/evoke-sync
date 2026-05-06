import { Router, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async.middleware';
import { createError } from '../middleware/error.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { ReconciliationMonth } from '../models/ReconciliationMonth.model';
import { QBOToken } from '../models/QBOToken.model';
import { qboService } from '../services/qbo.service';
import { recalcInvoice } from '../services/reconciliation.service';
import { env } from '../config/env';
import { AuthenticatedRequest, Company, SessionGroup } from '../types';

const router = Router();

router.use(requireAuth);

const startSchema = z.object({
  company: z.enum(['york_region', 'consulting']),
  month: z.string().min(1),
  year: z.string().regex(/^\d{4}$/),
});

const notesSchema = z.object({
  billingNotesHtml: z.string(),
});

const invoiceUpdateSchema = z.object({
  sessionGroups: z.array(
    z.object({
      sessionLength: z.number(),
      sessionDates: z.array(z.string()),
    }),
  ),
  notes: z.string().optional(),
});

function isApproved(status: string): boolean {
  return status === 'approved';
}

// ─── POST /api/reconciliation/start ──────────────────────────────────────────

router.post(
  '/start',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = startSchema.safeParse(req.body);
    if (!result.success) {
      throw createError(result.error.errors[0].message, 400);
    }

    const { company, month, year } = result.data;

    const tokenDoc = await QBOToken.findByCompany(company as Company);
    if (!tokenDoc) {
      throw createError(`QBO not connected for ${company} — connect it in Settings`, 400);
    }

    const invoices = await qboService.fetchInvoicesForMonth(tokenDoc, month, year);

    const doc = await ReconciliationMonth.create({
      month,
      year,
      company,
      status: 'in_progress',
      billingNotesHtml: '',
      invoices,
    });

    res.status(201).json({
      success: true,
      data: { reconciliationMonthId: doc.id },
    });
  }),
);

// ─── GET /api/reconciliation/history ─────────────────────────────────────────

router.get(
  '/history',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const docs = await ReconciliationMonth.find(
      {},
      {
        month: 1,
        year: 1,
        company: 1,
        status: 1,
        approvedBy: 1,
        approvedAt: 1,
        createdAt: 1,
        'invoices.delta': 1,
      },
    ).sort({ year: -1, createdAt: -1 });

    res.json({ success: true, data: { history: docs } });
  }),
);

// ─── GET /api/reconciliation/:id ─────────────────────────────────────────────

router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const doc = await ReconciliationMonth.findById(req.params.id);
    if (!doc) throw createError('Reconciliation not found', 404);

    res.json({ success: true, data: { reconciliation: doc } });
  }),
);

// ─── PATCH /api/reconciliation/:id/notes ─────────────────────────────────────

router.patch(
  '/:id/notes',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const doc = await ReconciliationMonth.findById(req.params.id);
    if (!doc) throw createError('Reconciliation not found', 404);
    if (isApproved(doc.status)) throw createError('Approved reconciliations are locked', 403);

    const result = notesSchema.safeParse(req.body);
    if (!result.success) throw createError('billingNotesHtml is required', 400);

    doc.billingNotesHtml = result.data.billingNotesHtml;
    await doc.save();

    res.json({ success: true, data: { billingNotesHtml: doc.billingNotesHtml } });
  }),
);

// ─── PATCH /api/reconciliation/:id/invoice/:invoiceNo ─────────────────────────

router.patch(
  '/:id/invoice/:invoiceNo',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const doc = await ReconciliationMonth.findById(req.params.id);
    if (!doc) throw createError('Reconciliation not found', 404);
    if (isApproved(doc.status)) throw createError('Approved reconciliations are locked', 403);

    const result = invoiceUpdateSchema.safeParse(req.body);
    if (!result.success) throw createError(result.error.errors[0].message, 400);

    const invoice = doc.invoices.find((inv) => inv.invoiceNo === req.params.invoiceNo);
    if (!invoice) throw createError(`Invoice ${req.params.invoiceNo} not found`, 404);

    const { sessionGroups, notes } = result.data;

    if (notes !== undefined) invoice.notes = notes;

    recalcInvoice({
      invoice,
      sessionGroups: sessionGroups as SessionGroup[],
      supervisorDetails: env.DEFAULT_SUPERVISOR,
      month: doc.month,
    });

    await doc.save();
    res.json({ success: true, data: { invoice } });
  }),
);

export default router;

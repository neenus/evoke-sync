import { Router, Response } from 'express';
import { asyncHandler } from '../middleware/async.middleware';
import { createError } from '../middleware/error.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { qboService } from '../services/qbo.service';
import { QBOToken } from '../models/QBOToken.model';
import { AuthenticatedRequest, Company } from '../types';

const router = Router();

router.use(requireAuth);

function isValidCompany(c: string): c is Company {
  return c === 'york_region' || c === 'consulting';
}

async function getTokenOrThrow(company: Company) {
  const tokenDoc = await QBOToken.findByCompany(company);
  if (!tokenDoc) throw createError(`QBO not connected for ${company} — connect it in Settings`, 400);
  return tokenDoc;
}

// ─── GET /api/qbo/invoices/:company/:month/:year ──────────────────────────────

router.get(
  '/invoices/:company/:month/:year',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { company, month, year } = req.params;
    if (!isValidCompany(company)) throw createError('Invalid company', 400);

    const tokenDoc = await getTokenOrThrow(company);
    const invoices = await qboService.fetchInvoicesForMonth(tokenDoc, month, year);

    res.json({ success: true, data: { invoices } });
  }),
);

// ─── GET /api/qbo/invoice/:company/:invoiceNo ─────────────────────────────────

router.get(
  '/invoice/:company/:invoiceNo',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { company, invoiceNo } = req.params;
    if (!isValidCompany(company)) throw createError('Invalid company', 400);

    const tokenDoc = await getTokenOrThrow(company);
    const rows = await qboService.fetchInvoiceByNumber(tokenDoc, invoiceNo);

    if (rows.length === 0) throw createError(`Invoice ${invoiceNo} not found`, 404);
    // One row per sales line; `invoice` kept for backward compatibility.
    res.json({ success: true, data: { invoice: rows[0], invoices: rows } });
  }),
);

// ─── GET /api/qbo/customers/:company ──────────────────────────────────────────

router.get(
  '/customers/:company',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { company } = req.params;
    if (!isValidCompany(company)) throw createError('Invalid company', 400);

    const tokenDoc = await getTokenOrThrow(company);
    const customers = await qboService.fetchCustomerNames(tokenDoc);

    res.json({ success: true, data: { customers } });
  }),
);

// ─── GET /api/qbo/items/:company ──────────────────────────────────────────────

router.get(
  '/items/:company',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { company } = req.params;
    if (!isValidCompany(company)) throw createError('Invalid company', 400);

    const tokenDoc = await getTokenOrThrow(company);
    const items = await qboService.fetchServiceItemNames(tokenDoc);

    res.json({ success: true, data: { items } });
  }),
);

export default router;

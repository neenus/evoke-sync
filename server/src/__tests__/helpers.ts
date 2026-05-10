import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { ReconciliationMonth, IReconciliationMonthDocument } from '../models/ReconciliationMonth.model';
import { InvoiceRow } from '../types';

export function authCookie(): string {
  const token = jwt.sign(
    { userId: new Types.ObjectId().toHexString(), email: 'test@example.com', role: 'admin' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );
  return `token=${token}`;
}

export function makeInvoice(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    invoiceNo: '1001',
    clientName: 'Alex Smith',
    practitioner: 'Jane Doe',
    serviceType: 'Reading Remediation',
    hoursBilled: 10,
    rate: 100,
    amountBilled: 1000,
    isInsurance: false,
    actualHours: 0,
    actualAmount: 0,
    delta: 0,
    action: 'awaiting_data',
    sessionGroups: [],
    parseWarnings: [],
    notes: '',
    excluded: false,
    description: '',
    isManual: false,
    practitionerOverridden: false,
    ...overrides,
  };
}

export async function makeReconciliation(
  invoices: InvoiceRow[] = [],
  status: 'in_progress' | 'approved' = 'in_progress',
): Promise<IReconciliationMonthDocument> {
  return ReconciliationMonth.create({
    month: 'April',
    year: '2026',
    company: 'york_region',
    status,
    billingNotesHtml: '',
    invoices,
  });
}

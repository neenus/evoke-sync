import { IInvoiceRow, ISessionGroup, IReconciliationMonthDocument } from '../models/ReconciliationMonth.model';
import { InvoiceAction, InvoiceRow, SessionGroup } from '../types';
import { generateDescription } from './descriptionGenerator.service';
import { qboService, getRowKey } from './qbo.service';

export { getRowKey };
import { IQBOTokenDocument } from '../models/QBOToken.model';

export interface RecalcInput {
  invoice: IInvoiceRow;
  sessionGroups?: SessionGroup[];
  practitioner?: string;
  rate?: number;
  supervisorDetails: string;
  month: string;
}

export function recalcInvoice(input: RecalcInput): void {
  const { invoice, sessionGroups, practitioner, rate, supervisorDetails, month } = input;

  if (practitioner !== undefined) {
    invoice.practitioner = practitioner;
    invoice.practitionerOverridden = true;
  }

  if (rate !== undefined) {
    invoice.rate = rate;
  }

  if (sessionGroups !== undefined) {
    invoice.sessionGroups = sessionGroups.map((sg) => ({
      sessionLength: sg.sessionLength,
      sessionDates: [...sg.sessionDates].sort((a, b) => parseInt(a) - parseInt(b)),
      qboDescription: '',
    })) as ISessionGroup[];
  }

  for (const sg of invoice.sessionGroups) {
    sg.qboDescription = invoice.isInsurance
      ? generateDescription({
          serviceType: invoice.serviceType,
          practitionerName: invoice.practitioner,
          supervisorDetails,
          sessionLength: sg.sessionLength,
          sessionDates: sg.sessionDates,
          month,
        })
      : '';
  }

  const actualHours = invoice.sessionGroups.reduce((sum, sg) => {
    return sum + (sg.sessionLength / 60) * sg.sessionDates.length;
  }, 0);

  invoice.actualHours = Math.round(actualHours * 100) / 100;
  invoice.actualAmount = Math.round(invoice.actualHours * invoice.rate * 100) / 100;
  invoice.delta = Math.round((invoice.actualAmount - invoice.amountBilled) * 100) / 100;

  const action: InvoiceAction =
    invoice.actualHours === 0
      ? 'awaiting_data'
      : invoice.delta === 0
        ? 'no_change'
        : invoice.delta > 0
          ? 'additional_charge'
          : 'credit_memo';

  invoice.action = action;
}

export interface ManualInvoiceInput {
  clientName: string;
  practitioner: string;
  serviceType: string;
  rate: number;
  isInsurance?: boolean;
}

export function createManualInvoice(input: ManualInvoiceInput): InvoiceRow {
  const invoiceNo = `MANUAL-${Date.now()}`;
  return {
    invoiceNo,
    rowKey: invoiceNo,
    clientName: input.clientName.trim(),
    practitioner: input.practitioner.trim(),
    serviceType: input.serviceType,
    hoursBilled: 0,
    rate: input.rate,
    amountBilled: 0,
    isInsurance: input.isInsurance ?? false,
    actualHours: 0,
    actualAmount: 0,
    delta: 0,
    action: 'awaiting_data',
    sessionGroups: [],
    parseWarnings: [],
    notes: '',
    excluded: false,
    description: '',
    isManual: true,
    practitionerOverridden: false,
  };
}

export async function refetchInvoiceFromQBO(
  doc: IReconciliationMonthDocument,
  rowKey: string,
  tokenDoc: IQBOTokenDocument,
  supervisorDetails: string,
): Promise<IInvoiceRow> {
  const existing = doc.invoices.find((inv) => getRowKey(inv) === rowKey);
  if (!existing) throw new Error(`Invoice ${rowKey} not found in reconciliation`);
  if (existing.isManual) throw new Error('Cannot refetch a manual invoice from QBO');

  const today = new Date().toISOString().slice(0, 10);
  const freshRows = await qboService.fetchInvoiceByNumber(tokenDoc, existing.invoiceNo);

  if (freshRows.length === 0) {
    existing.excluded = true;
    existing.parseWarnings.push(
      `Invoice ${existing.invoiceNo} not found in QBO on ${today} — auto-excluded`,
    );
    return existing;
  }

  // Match this row's line; a legacy single row still matches a single-line invoice.
  const fresh =
    freshRows.find((r) => getRowKey(r) === getRowKey(existing)) ??
    (freshRows.length === 1 ? freshRows[0] : undefined);

  if (!fresh) {
    existing.excluded = true;
    existing.parseWarnings.push(
      `Invoice ${existing.invoiceNo} line ${existing.lineId ?? '?'} not found in QBO on ${today} ` +
        `(invoice now has ${freshRows.length} lines) — auto-excluded; start a new pull to import all lines`,
    );
    return existing;
  }

  existing.rowKey = fresh.rowKey;
  existing.lineId = fresh.lineId;
  existing.clientName = fresh.clientName;
  existing.serviceType = fresh.serviceType;
  existing.hoursBilled = fresh.hoursBilled;
  existing.rate = fresh.rate;
  existing.amountBilled = fresh.amountBilled;
  existing.isInsurance = fresh.isInsurance;
  existing.description = fresh.description;

  if (!existing.practitionerOverridden) {
    existing.practitioner = fresh.practitioner;
  }

  recalcInvoice({
    invoice: existing,
    supervisorDetails,
    month: doc.month,
  });

  return existing;
}

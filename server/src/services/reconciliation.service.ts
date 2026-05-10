import { IInvoiceRow, ISessionGroup } from '../models/ReconciliationMonth.model';
import { InvoiceAction, InvoiceRow, SessionGroup } from '../types';
import { generateDescription } from './descriptionGenerator.service';

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
  return {
    invoiceNo: `MANUAL-${Date.now()}`,
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

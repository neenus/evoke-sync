import { IInvoiceRow, ISessionGroup } from '../models/ReconciliationMonth.model';
import { InvoiceAction, SessionGroup } from '../types';
import { generateDescription } from './descriptionGenerator.service';

export interface RecalcInput {
  invoice: IInvoiceRow;
  sessionGroups: SessionGroup[];
  supervisorDetails: string;
  month: string;
}

export function recalcInvoice(input: RecalcInput): void {
  const { invoice, sessionGroups, supervisorDetails, month } = input;

  invoice.sessionGroups = sessionGroups.map((sg) => ({
    sessionLength: sg.sessionLength,
    sessionDates: [...sg.sessionDates].sort((a, b) => parseInt(a) - parseInt(b)),
    qboDescription: invoice.isInsurance
      ? generateDescription({
          serviceType: invoice.serviceType,
          practitionerName: invoice.practitioner,
          supervisorDetails,
          sessionLength: sg.sessionLength,
          sessionDates: sg.sessionDates,
          month,
        })
      : '',
  })) as ISessionGroup[];

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

import { describe, it, expect } from 'vitest';
import { recalcInvoice } from '../reconciliation.service';
import { makeInvoice } from '../../__tests__/helpers';
import type { IInvoiceRow } from '../../models/ReconciliationMonth.model';

function asMutableInvoice(): IInvoiceRow {
  return makeInvoice() as unknown as IInvoiceRow;
}

describe('recalcInvoice', () => {
  it('recomputes actualAmount and delta when rate is overridden', () => {
    const invoice = asMutableInvoice();
    invoice.amountBilled = 1000;
    invoice.sessionGroups = [
      { sessionLength: 60, sessionDates: ['1', '2', '3', '4', '5'], qboDescription: '' },
    ] as IInvoiceRow['sessionGroups'];

    recalcInvoice({
      invoice,
      rate: 120,
      supervisorDetails: 'Test Supervisor',
      month: 'April',
    });

    expect(invoice.rate).toBe(120);
    expect(invoice.actualHours).toBe(5);
    expect(invoice.actualAmount).toBe(600);
    expect(invoice.delta).toBe(-400);
    expect(invoice.action).toBe('credit_memo');
  });

  it('sets practitionerOverridden and regenerates description on practitioner override', () => {
    const invoice = asMutableInvoice();
    invoice.isInsurance = true;
    invoice.practitioner = 'Old Name';
    invoice.serviceType = 'Reading Remediation';
    invoice.sessionGroups = [
      { sessionLength: 60, sessionDates: ['1', '2'], qboDescription: 'old desc' },
    ] as IInvoiceRow['sessionGroups'];

    recalcInvoice({
      invoice,
      practitioner: 'New Name',
      supervisorDetails: 'Your Supervising Clinician Name, Credentials',
      month: 'April',
    });

    expect(invoice.practitioner).toBe('New Name');
    expect(invoice.practitionerOverridden).toBe(true);
    expect(invoice.sessionGroups[0].qboDescription).toContain('New Name');
    expect(invoice.sessionGroups[0].qboDescription).toContain('April');
  });

  it('preserves existing values when no overrides are passed', () => {
    const invoice = asMutableInvoice();
    invoice.rate = 150;
    invoice.practitioner = 'Original';
    invoice.amountBilled = 750;
    invoice.sessionGroups = [
      { sessionLength: 60, sessionDates: ['1', '2', '3', '4', '5'], qboDescription: '' },
    ] as IInvoiceRow['sessionGroups'];

    recalcInvoice({
      invoice,
      supervisorDetails: 'Test Supervisor',
      month: 'April',
    });

    expect(invoice.rate).toBe(150);
    expect(invoice.practitioner).toBe('Original');
    expect(invoice.practitionerOverridden).toBe(false);
    expect(invoice.actualAmount).toBe(750);
    expect(invoice.delta).toBe(0);
    expect(invoice.action).toBe('no_change');
  });

  it('transitions action correctly across delta zero/positive/negative', () => {
    const invoice = asMutableInvoice();
    invoice.amountBilled = 600;
    invoice.rate = 100;
    invoice.sessionGroups = [
      { sessionLength: 60, sessionDates: ['1', '2', '3', '4', '5', '6'], qboDescription: '' },
    ] as IInvoiceRow['sessionGroups'];

    recalcInvoice({ invoice, supervisorDetails: 'X', month: 'April' });
    expect(invoice.action).toBe('no_change');

    recalcInvoice({
      invoice,
      sessionGroups: [{ sessionLength: 60, sessionDates: ['1', '2', '3', '4', '5', '6', '7'], qboDescription: '' }],
      supervisorDetails: 'X',
      month: 'April',
    });
    expect(invoice.action).toBe('additional_charge');

    recalcInvoice({
      invoice,
      sessionGroups: [{ sessionLength: 60, sessionDates: ['1', '2'], qboDescription: '' }],
      supervisorDetails: 'X',
      month: 'April',
    });
    expect(invoice.action).toBe('credit_memo');

    recalcInvoice({
      invoice,
      sessionGroups: [],
      supervisorDetails: 'X',
      month: 'April',
    });
    expect(invoice.action).toBe('awaiting_data');
  });
});

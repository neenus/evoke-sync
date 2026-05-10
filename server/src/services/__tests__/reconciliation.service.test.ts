import { describe, it, expect } from 'vitest';
import { recalcInvoice, createManualInvoice } from '../reconciliation.service';
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

describe('createManualInvoice', () => {
  it('returns a row with isManual true and zeroed billed/actual fields', () => {
    const inv = createManualInvoice({
      clientName: 'Alex Smith',
      practitioner: 'Jane Doe',
      serviceType: 'Reading Remediation',
      rate: 150,
    });

    expect(inv.isManual).toBe(true);
    expect(inv.invoiceNo).toMatch(/^MANUAL-\d+$/);
    expect(inv.clientName).toBe('Alex Smith');
    expect(inv.practitioner).toBe('Jane Doe');
    expect(inv.rate).toBe(150);
    expect(inv.hoursBilled).toBe(0);
    expect(inv.amountBilled).toBe(0);
    expect(inv.actualHours).toBe(0);
    expect(inv.actualAmount).toBe(0);
    expect(inv.delta).toBe(0);
    expect(inv.action).toBe('awaiting_data');
    expect(inv.excluded).toBe(false);
    expect(inv.isInsurance).toBe(false);
    expect(inv.practitionerOverridden).toBe(false);
    expect(inv.sessionGroups).toEqual([]);
    expect(inv.parseWarnings).toEqual([]);
    expect(inv.notes).toBe('');
    expect(inv.description).toBe('');
  });

  it('honors isInsurance when supplied', () => {
    const inv = createManualInvoice({
      clientName: 'A',
      practitioner: 'B',
      serviceType: 'Math Remediation',
      rate: 100,
      isInsurance: true,
    });
    expect(inv.isInsurance).toBe(true);
  });

  it('produces unique invoiceNo across rapid successive calls', async () => {
    const a = createManualInvoice({ clientName: 'A', practitioner: 'B', serviceType: 'X', rate: 1 });
    await new Promise((r) => setTimeout(r, 2));
    const b = createManualInvoice({ clientName: 'A', practitioner: 'B', serviceType: 'X', rate: 1 });
    expect(a.invoiceNo).not.toBe(b.invoiceNo);
  });
});

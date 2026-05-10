import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { authCookie, makeInvoice, makeReconciliation } from '../../__tests__/helpers';

describe('PATCH /api/reconciliation/:id/invoice/:invoiceNo', () => {
  it('applies practitioner override and sets practitionerOverridden', async () => {
    const doc = await makeReconciliation([
      makeInvoice({ invoiceNo: '1', practitioner: 'Old', isInsurance: true, serviceType: 'Reading Remediation' }),
    ]);

    const res = await request(app)
      .patch(`/api/reconciliation/${doc.id}/invoice/1`)
      .set('Cookie', authCookie())
      .send({ practitioner: 'New Person', sessionGroups: [{ sessionLength: 60, sessionDates: ['1', '2'] }] });

    expect(res.status).toBe(200);
    expect(res.body.data.invoice.practitioner).toBe('New Person');
    expect(res.body.data.invoice.practitionerOverridden).toBe(true);
    expect(res.body.data.invoice.sessionGroups[0].qboDescription).toContain('New Person');
  });

  it('applies rate override and recomputes actualAmount', async () => {
    const doc = await makeReconciliation([
      makeInvoice({
        invoiceNo: '1',
        rate: 100,
        amountBilled: 500,
        sessionGroups: [],
      }),
    ]);

    const res = await request(app)
      .patch(`/api/reconciliation/${doc.id}/invoice/1`)
      .set('Cookie', authCookie())
      .send({ rate: 150, sessionGroups: [{ sessionLength: 60, sessionDates: ['1', '2', '3', '4'] }] });

    expect(res.status).toBe(200);
    expect(res.body.data.invoice.rate).toBe(150);
    expect(res.body.data.invoice.actualHours).toBe(4);
    expect(res.body.data.invoice.actualAmount).toBe(600);
    expect(res.body.data.invoice.delta).toBe(100);
    expect(res.body.data.invoice.action).toBe('additional_charge');
  });

  it('returns 403 on approved reconciliation', async () => {
    const doc = await makeReconciliation([makeInvoice({ invoiceNo: '1' })], 'approved');

    const res = await request(app)
      .patch(`/api/reconciliation/${doc.id}/invoice/1`)
      .set('Cookie', authCookie())
      .send({ rate: 200, sessionGroups: [] });

    expect(res.status).toBe(403);
  });
});

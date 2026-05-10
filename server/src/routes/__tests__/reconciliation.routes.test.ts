import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { authCookie, makeInvoice, makeReconciliation } from '../../__tests__/helpers';
import { qboService } from '../../services/qbo.service';
import { QBOToken } from '../../models/QBOToken.model';

async function seedToken() {
  return QBOToken.create({
    company: 'york_region',
    companyId: 'realm-1',
    companyName: 'Test Company',
    environment: 'sandbox',
    tokenData: {
      token_type: 'bearer',
      access_token: 'test-access',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      x_refresh_token_expires_in: 8726400,
    },
    accessTokenExpiry: new Date(Date.now() + 3600_000),
    refreshTokenExpiry: new Date(Date.now() + 86400_000 * 90),
  });
}

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

describe('POST /api/reconciliation/:id/invoice', () => {
  it('creates a manual invoice and returns 201', async () => {
    const doc = await makeReconciliation([]);

    const res = await request(app)
      .post(`/api/reconciliation/${doc.id}/invoice`)
      .set('Cookie', authCookie())
      .send({
        clientName: 'New Student',
        practitioner: 'Jane Doe',
        serviceType: 'Reading Remediation',
        rate: 120,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.invoice.isManual).toBe(true);
    expect(res.body.data.invoice.invoiceNo).toMatch(/^MANUAL-\d+$/);
    expect(res.body.data.invoice.clientName).toBe('New Student');
    expect(res.body.data.invoice.practitioner).toBe('Jane Doe');
    expect(res.body.data.invoice.rate).toBe(120);
    expect(res.body.data.invoice.amountBilled).toBe(0);
  });

  it('returns 400 when required fields are missing', async () => {
    const doc = await makeReconciliation([]);

    const res = await request(app)
      .post(`/api/reconciliation/${doc.id}/invoice`)
      .set('Cookie', authCookie())
      .send({ clientName: 'Only This' });

    expect(res.status).toBe(400);
  });

  it('returns 403 on approved reconciliation', async () => {
    const doc = await makeReconciliation([], 'approved');

    const res = await request(app)
      .post(`/api/reconciliation/${doc.id}/invoice`)
      .set('Cookie', authCookie())
      .send({
        clientName: 'X',
        practitioner: 'Y',
        serviceType: 'Reading Remediation',
        rate: 100,
      });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/reconciliation/:id/invoice/:invoiceNo/refetch', () => {
  it('overwrites QBO-source fields and returns updated invoice', async () => {
    await seedToken();
    const doc = await makeReconciliation([
      makeInvoice({ invoiceNo: '1001', clientName: 'Old', rate: 80, amountBilled: 400 }),
    ]);

    vi.spyOn(qboService, 'fetchInvoiceByNumber').mockResolvedValue(
      makeInvoice({
        invoiceNo: '1001',
        clientName: 'New',
        rate: 100,
        amountBilled: 500,
        description: 'fresh',
      }),
    );

    const res = await request(app)
      .post(`/api/reconciliation/${doc.id}/invoice/1001/refetch`)
      .set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body.data.invoice.clientName).toBe('New');
    expect(res.body.data.invoice.rate).toBe(100);
    expect(res.body.data.invoice.amountBilled).toBe(500);
    vi.restoreAllMocks();
  });

  it('returns 400 when called on a manual invoice', async () => {
    await seedToken();
    const doc = await makeReconciliation([
      makeInvoice({ invoiceNo: 'MANUAL-1', isManual: true }),
    ]);

    const res = await request(app)
      .post(`/api/reconciliation/${doc.id}/invoice/MANUAL-1/refetch`)
      .set('Cookie', authCookie());

    expect(res.status).toBe(400);
  });

  it('marks invoice excluded with warning when QBO returns null', async () => {
    await seedToken();
    const doc = await makeReconciliation([
      makeInvoice({ invoiceNo: '999' }),
    ]);

    vi.spyOn(qboService, 'fetchInvoiceByNumber').mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/reconciliation/${doc.id}/invoice/999/refetch`)
      .set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body.data.invoice.excluded).toBe(true);
    expect(res.body.data.invoice.parseWarnings.some((w: string) => w.includes('not found'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('returns 403 on approved reconciliation', async () => {
    await seedToken();
    const doc = await makeReconciliation([makeInvoice({ invoiceNo: '1' })], 'approved');

    const res = await request(app)
      .post(`/api/reconciliation/${doc.id}/invoice/1/refetch`)
      .set('Cookie', authCookie());

    expect(res.status).toBe(403);
  });

  it('returns 400 when QBO is not connected for the company', async () => {
    const doc = await makeReconciliation([makeInvoice({ invoiceNo: '1' })]);

    const res = await request(app)
      .post(`/api/reconciliation/${doc.id}/invoice/1/refetch`)
      .set('Cookie', authCookie());

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/QBO not connected/i);
  });
});

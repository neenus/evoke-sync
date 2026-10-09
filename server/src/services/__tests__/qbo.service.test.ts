import { describe, it, expect } from 'vitest';
import { normalizeQBOInvoice, resolveServiceType, detectServiceType, getRowKey } from '../qbo.service';
import type { QBOInvoice, QBOInvoiceLine } from '../../types';

function salesLine(
  id: string,
  item: string | undefined,
  qty: number,
  unitPrice: number,
  description?: string,
): QBOInvoiceLine {
  return {
    Id: id,
    DetailType: 'SalesItemLineDetail',
    Amount: qty * unitPrice,
    Description: description,
    SalesItemLineDetail: {
      ItemRef: item ? { value: `item-${id}`, name: item } : undefined,
      Qty: qty,
      UnitPrice: unitPrice,
    },
  };
}

function invoice(lines: QBOInvoiceLine[], overrides: Partial<QBOInvoice> = {}): QBOInvoice {
  const total = lines.filter((l) => l.SalesItemLineDetail).reduce((s, l) => s + l.Amount, 0);
  return {
    Id: 'qbo-1',
    DocNumber: '5001',
    TxnDate: '2026-04-30',
    TotalAmt: total,
    CurrencyRef: { value: 'CAD' },
    CustomerRef: { value: 'c1', name: 'Alex Smith' },
    Line: lines,
    SyncToken: '0',
    MetaData: { CreateTime: '', LastUpdatedTime: '' },
    ...overrides,
  };
}

describe('resolveServiceType', () => {
  it('uses the QBO item name verbatim', () => {
    expect(resolveServiceType('Social Work', 'Sessions with Jane Doe for the month')).toBe('Social Work');
    expect(resolveServiceType('Speech Language Assessment', '')).toBe('Speech Language Assessment');
  });

  it('does not keyword-map an item name (Math Diagnostic Assessment stays as-is)', () => {
    expect(resolveServiceType('Math Diagnostic Assessment', '')).toBe('Math Diagnostic Assessment');
  });

  it('keeps the leaf of a hierarchical item name', () => {
    expect(resolveServiceType('Services:Social Work', '')).toBe('Social Work');
  });

  it('falls back to keyword detection when no item name is present', () => {
    expect(resolveServiceType(undefined, 'Reading sessions with Jane Doe')).toBe('Reading Remediation');
    expect(resolveServiceType('', 'ADHD coaching')).toBe('Executive Function Coaching');
    expect(resolveServiceType(undefined, 'nothing recognisable')).toBe('Academic Strategies');
  });

  it('detectServiceType keeps build-plan ordering', () => {
    expect(detectServiceType('Math Recovery')).toBe('Math Remediation');
    expect(detectServiceType('Postsecondary')).toBe('Academic Strategies');
  });
});

describe('normalizeQBOInvoice', () => {
  it('returns one row keyed by invoiceNo for a single-line invoice', () => {
    const rows = normalizeQBOInvoice(
      invoice([salesLine('1', 'Social Work', 4, 150, 'Sessions with Jane Doe for the month of April')]),
    );
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.invoiceNo).toBe('5001');
    expect(row.rowKey).toBe('5001');
    expect(getRowKey(row)).toBe('5001');
    expect(row.serviceType).toBe('Social Work');
    expect(row.practitioner).toBe('Jane Doe');
    expect(row.hoursBilled).toBe(4);
    expect(row.rate).toBe(150);
    expect(row.amountBilled).toBe(600);
  });

  it('returns one row per sales line for a multi-line invoice', () => {
    const rows = normalizeQBOInvoice(
      invoice([
        salesLine('1', 'Reading Remediation', 3, 100, 'Reading with Jane Doe for the month of April'),
        salesLine('2', 'Speech Language Assessment', 2, 200, 'Assessment with John Smith for the month of April'),
        { Id: '3', DetailType: 'SubTotalLineDetail', Amount: 700 },
      ]),
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.rowKey)).toEqual(['5001:1', '5001:2']);
    expect(rows.map((r) => r.invoiceNo)).toEqual(['5001', '5001']);
    expect(rows.map((r) => r.lineId)).toEqual(['1', '2']);
    expect(rows.map((r) => r.serviceType)).toEqual(['Reading Remediation', 'Speech Language Assessment']);
    expect(rows.map((r) => r.practitioner)).toEqual(['Jane Doe', 'John Smith']);
    expect(rows.map((r) => r.amountBilled)).toEqual([300, 400]);
    expect(rows.map((r) => r.hoursBilled)).toEqual([3, 2]);
    expect(rows.map((r) => r.rate)).toEqual([100, 200]);
    expect(rows[0].description).not.toContain('John Smith');
  });

  it('shares memo and description-only line text across all rows', () => {
    const rows = normalizeQBOInvoice(
      invoice(
        [
          { Id: '0', DetailType: 'DescriptionOnly', Amount: 0, Description: 'Insurance receipt' },
          salesLine('1', 'Social Work', 1, 100, 'with Jane Doe for the month of April'),
          salesLine('2', 'Math Remediation', 1, 100, 'with Jane Doe for the month of April'),
        ],
        { CustomerMemo: { value: 'Thank you' } },
      ),
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.isInsurance).toBe(true);
      expect(row.description.startsWith('Thank you')).toBe(true);
    }
  });

  it('still returns a row when an invoice has no sales lines', () => {
    const rows = normalizeQBOInvoice(invoice([], { TotalAmt: 0 }));
    expect(rows).toHaveLength(1);
    expect(rows[0].serviceType).toBe('Academic Strategies');
    expect(rows[0].practitioner).toBe('Unknown');
  });
});

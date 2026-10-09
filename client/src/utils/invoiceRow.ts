import type { InvoiceRow } from '../types';

/**
 * Unique key for an invoice row. Equals `invoiceNo` for single-line and manual
 * invoices; `${invoiceNo}:${lineId}` for each line of a multi-line QBO invoice.
 * Rows saved before `rowKey` existed fall back to `invoiceNo`.
 */
export function getRowKey(row: Pick<InvoiceRow, 'invoiceNo' | 'rowKey'>): string {
  return row.rowKey || row.invoiceNo;
}

/** URL-safe row key for use in API paths (keys may contain ':'). */
export function rowKeyParam(row: Pick<InvoiceRow, 'invoiceNo' | 'rowKey'>): string {
  return encodeURIComponent(getRowKey(row));
}

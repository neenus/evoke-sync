import axios from 'axios';
import { env } from '../config/env';
import { IQBOTokenDocument } from '../models/QBOToken.model';
import { oauthService } from './oauth.service';
import { QBOInvoice, QBOQueryResponse, QBOCompanyInfo, QBOCustomer, QBOItem, InvoiceRow } from '../types';

const QBO_BASE_URLS = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
} as const;

const MINOR_VERSION = env.QBO_MINOR_VERSION;

// ─── Regex patterns (from build plan) ────────────────────────────────────────

const PRACTITIONER_REGEX = /with ([A-Z][a-zA-Z\-]+(?: [A-Z][a-zA-Z\-]+)+) for the month/i;
const INSURANCE_REGEX = /Insurance re[ck]ip[ie]t|Insurance receipt/i;

/**
 * Keyword fallback used only when a QBO line carries no service item name.
 * Order matters (from build plan).
 */
export function detectServiceType(description: string): string {
  if (/Reading/i.test(description)) return 'Reading Remediation';
  if (/Math Recovery/i.test(description)) return 'Math Remediation';
  if (/Math/i.test(description)) return 'Math Remediation';
  if (/ADHD|Executive/i.test(description)) return 'Executive Function Coaching';
  if (/Postsecondary/i.test(description)) return 'Academic Strategies';
  return 'Academic Strategies';
}

/**
 * The QBO service item on the line is the source of truth for service type
 * (e.g. "Social Work", "Speech Language Assessment"). Sub-items come back as
 * "Parent:Child" — keep the leaf. Only fall back to keyword detection on the
 * description text when the line has no item name at all.
 */
export function resolveServiceType(itemName: string | undefined, text: string): string {
  const leaf = (itemName ?? '').split(':').pop()?.trim() ?? '';
  return leaf || detectServiceType(text);
}

function extractPractitioner(description: string): string {
  const match = PRACTITIONER_REGEX.exec(description);
  return match ? match[1] : 'Unknown';
}

/** Resolve the unique row key, tolerating rows persisted before `rowKey` existed. */
export function getRowKey(row: Pick<InvoiceRow, 'invoiceNo' | 'rowKey'>): string {
  return row.rowKey || row.invoiceNo;
}

function baseRow(inv: QBOInvoice, text: string): Omit<InvoiceRow, 'serviceType' | 'hoursBilled' | 'rate' | 'amountBilled'> {
  return {
    invoiceNo: inv.DocNumber,
    rowKey: inv.DocNumber,
    clientName: inv.CustomerRef.name ?? inv.CustomerRef.value,
    practitioner: extractPractitioner(text),
    isInsurance: INSURANCE_REGEX.test(text),
    actualHours: 0,
    actualAmount: 0,
    delta: 0,
    action: 'awaiting_data',
    sessionGroups: [],
    parseWarnings: [],
    notes: '',
    excluded: false,
    description: text,
    isManual: false,
    practitionerOverridden: false,
  };
}

/**
 * Normalize one QBO invoice into reconciliation rows — one row per sales line.
 *
 * A single-line invoice yields one row keyed by its DocNumber (unchanged
 * behaviour, amountBilled = TotalAmt). A multi-line invoice yields one row per
 * SalesItemLineDetail line, each keyed `${DocNumber}:${Line.Id}` with its own
 * service type, practitioner, qty, rate and line amount. Subtotal/discount
 * lines are skipped; description-only lines contribute text to every row.
 */
export function normalizeQBOInvoice(inv: QBOInvoice): InvoiceRow[] {
  const memo = inv.CustomerMemo?.value?.trim() ?? '';
  const lines = inv.Line ?? [];
  const salesLines = lines.filter((l) => l.SalesItemLineDetail);
  const sharedText = lines
    .filter((l) => !l.SalesItemLineDetail)
    .map((l) => (l.Description ?? '').trim())
    .filter(Boolean);

  const textFor = (lineDescs: string[]) =>
    [memo, ...sharedText, ...lineDescs].filter(Boolean).join('\n');

  if (salesLines.length <= 1) {
    const allLineDescs = lines.map((l) => (l.Description ?? '').trim()).filter(Boolean);
    const text = [memo, ...allLineDescs].filter(Boolean).join('\n');
    const mainLine = salesLines[0];
    return [
      {
        ...baseRow(inv, text),
        lineId: mainLine?.Id,
        serviceType: resolveServiceType(mainLine?.SalesItemLineDetail?.ItemRef?.name, text),
        hoursBilled: mainLine?.SalesItemLineDetail?.Qty ?? 0,
        rate: mainLine?.SalesItemLineDetail?.UnitPrice ?? 0,
        amountBilled: inv.TotalAmt,
      },
    ];
  }

  return salesLines.map((line, idx) => {
    const lineId = line.Id ?? String(idx + 1);
    const text = textFor([(line.Description ?? '').trim()]);
    return {
      ...baseRow(inv, text),
      rowKey: `${inv.DocNumber}:${lineId}`,
      lineId,
      serviceType: resolveServiceType(line.SalesItemLineDetail?.ItemRef?.name, text),
      hoursBilled: line.SalesItemLineDetail?.Qty ?? 0,
      rate: line.SalesItemLineDetail?.UnitPrice ?? 0,
      amountBilled: line.Amount,
    };
  });
}

// ─── QBOService ───────────────────────────────────────────────────────────────

class QBOService {
  private baseUrl(tokenDoc: IQBOTokenDocument): string {
    return QBO_BASE_URLS[tokenDoc.environment];
  }

  private buildQueryUrl(realmId: string, baseUrl: string, query: string): string {
    return `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=${MINOR_VERSION}`;
  }

  private async qboGet<T>(tokenDoc: IQBOTokenDocument, url: string): Promise<T> {
    const attempt = async (token: string) => {
      const http = axios.create({
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      });
      return http.get<T>(url);
    };

    let accessToken: string;
    try {
      accessToken = await oauthService.getValidAccessToken(tokenDoc);
    } catch (err) {
      console.error(`[QBO] token refresh failed for ${tokenDoc.company}:`, err);
      throw new Error(
        `QBO token for "${tokenDoc.company}" is invalid — disconnect and reconnect in Settings.`,
      );
    }

    console.log(`[QBO] GET ${url.replace(/access_token=[^&]+/, 'access_token=***')}`);
    console.log(`[QBO] company=${tokenDoc.company} realmId=${tokenDoc.companyId} env=${tokenDoc.environment}`);

    try {
      const { data } = await attempt(accessToken);
      return data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error(
          `[QBO] ${err.response?.status} for ${tokenDoc.company} — URL: ${url}`,
          `\nQBO error body: ${JSON.stringify(err.response?.data, null, 2)}`,
        );
        if (err.response?.status === 401) {
          try {
            console.log(`[QBO] attempting token refresh for ${tokenDoc.company}...`);
            const refreshed = await oauthService.refreshTokens(tokenDoc);
            console.log(`[QBO] refresh succeeded — new expiry: ${refreshed.accessTokenExpiry}`);
            const { data } = await attempt(refreshed.tokenData.access_token);
            return data;
          } catch (retryErr) {
            if (axios.isAxiosError(retryErr)) {
              console.error(
                `[QBO] ${retryErr.response?.status} after refresh for ${tokenDoc.company}.`,
                `\nQBO error body: ${JSON.stringify(retryErr.response?.data, null, 2)}`,
              );
            } else {
              console.error(`[QBO] refresh failed for ${tokenDoc.company}:`, retryErr);
            }
            throw new Error(
              `QBO token for "${tokenDoc.company}" is invalid — disconnect and reconnect in Settings.`,
            );
          }
        }
      }
      throw err;
    }
  }

  async getCompanyInfo(tokenDoc: IQBOTokenDocument): Promise<QBOCompanyInfo> {
    const url = `${this.baseUrl(tokenDoc)}/v3/company/${tokenDoc.companyId}/companyinfo/${tokenDoc.companyId}?minorversion=${MINOR_VERSION}`;
    const data = await this.qboGet<{ CompanyInfo: QBOCompanyInfo }>(tokenDoc, url);
    return data.CompanyInfo;
  }

  // ─── Fetch invoices for a given month ─────────────────────────────────────────

  async fetchInvoicesForMonth(
    tokenDoc: IQBOTokenDocument,
    month: string,
    year: string,
  ): Promise<InvoiceRow[]> {
    const monthIndex = new Date(`${month} 1, ${year}`).getMonth() + 1;
    const paddedMonth = String(monthIndex).padStart(2, '0');
    const startDate = `${year}-${paddedMonth}-01`;
    const lastDay = new Date(Number(year), monthIndex, 0).getDate();
    const endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;

    const query = `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' MAXRESULTS 1000`;
    const url = this.buildQueryUrl(tokenDoc.companyId, this.baseUrl(tokenDoc), query);

    const data = await this.qboGet<QBOQueryResponse<QBOInvoice>>(tokenDoc, url);
    const invoices = (data.QueryResponse['Invoice'] as QBOInvoice[]) ?? [];

    return invoices.flatMap((inv) => normalizeQBOInvoice(inv));
  }

  /** All reconciliation rows for one QBO invoice (one per sales line); empty if not found. */
  async fetchInvoiceByNumber(
    tokenDoc: IQBOTokenDocument,
    invoiceNo: string,
  ): Promise<InvoiceRow[]> {
    const query = `SELECT * FROM Invoice WHERE DocNumber = '${invoiceNo}'`;
    const url = this.buildQueryUrl(tokenDoc.companyId, this.baseUrl(tokenDoc), query);

    const data = await this.qboGet<QBOQueryResponse<QBOInvoice>>(tokenDoc, url);
    const invoices = (data.QueryResponse['Invoice'] as QBOInvoice[]) ?? [];

    return invoices[0] ? normalizeQBOInvoice(invoices[0]) : [];
  }

  // ─── Fetch customers / service items for typeahead fields ────────────────────

  async fetchCustomerNames(tokenDoc: IQBOTokenDocument): Promise<string[]> {
    const query = "SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000";
    const url = this.buildQueryUrl(tokenDoc.companyId, this.baseUrl(tokenDoc), query);

    const data = await this.qboGet<QBOQueryResponse<QBOCustomer>>(tokenDoc, url);
    const customers = (data.QueryResponse['Customer'] as QBOCustomer[]) ?? [];

    return [...new Set(customers.map((c) => c.DisplayName).filter(Boolean))].sort();
  }

  async fetchServiceItemNames(tokenDoc: IQBOTokenDocument): Promise<string[]> {
    const query = "SELECT * FROM Item WHERE Active = true AND Type = 'Service' MAXRESULTS 1000";
    const url = this.buildQueryUrl(tokenDoc.companyId, this.baseUrl(tokenDoc), query);

    const data = await this.qboGet<QBOQueryResponse<QBOItem>>(tokenDoc, url);
    const items = (data.QueryResponse['Item'] as QBOItem[]) ?? [];

    return [...new Set(items.map((i) => i.Name).filter(Boolean))].sort();
  }
}

export const qboService = new QBOService();

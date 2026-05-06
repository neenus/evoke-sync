import axios from 'axios';
import { env } from '../config/env';
import { IQBOTokenDocument } from '../models/QBOToken.model';
import { oauthService } from './oauth.service';
import { QBOInvoice, QBOQueryResponse, QBOCompanyInfo, InvoiceRow } from '../types';

const QBO_BASE_URLS = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
} as const;

const MINOR_VERSION = env.QBO_MINOR_VERSION;

// ─── Regex patterns (from build plan) ────────────────────────────────────────

const PRACTITIONER_REGEX = /with ([A-Z][a-zA-Z\-]+(?: [A-Z][a-zA-Z\-]+)+) for the month/i;
const INSURANCE_REGEX = /Insurance re[ck]ip[ie]t|Insurance receipt/i;

function detectServiceType(description: string): string {
  if (/Reading/i.test(description)) return 'Reading Remediation';
  if (/Math Recovery/i.test(description)) return 'Math Remediation';
  if (/Math/i.test(description)) return 'Math Remediation';
  if (/ADHD|Executive/i.test(description)) return 'Executive Function Coaching';
  if (/Postsecondary/i.test(description)) return 'Academic Strategies';
  return 'Academic Strategies';
}

function extractPractitioner(description: string): string {
  const match = PRACTITIONER_REGEX.exec(description);
  return match ? match[1] : 'Unknown';
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

    const accessToken = await oauthService.getValidAccessToken(tokenDoc);

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

    return invoices.map((inv) => this.normalizeInvoice(inv));
  }

  async fetchInvoiceByNumber(
    tokenDoc: IQBOTokenDocument,
    invoiceNo: string,
  ): Promise<InvoiceRow | null> {
    const query = `SELECT * FROM Invoice WHERE DocNumber = '${invoiceNo}'`;
    const url = this.buildQueryUrl(tokenDoc.companyId, this.baseUrl(tokenDoc), query);

    const data = await this.qboGet<QBOQueryResponse<QBOInvoice>>(tokenDoc, url);
    const invoices = (data.QueryResponse['Invoice'] as QBOInvoice[]) ?? [];

    return invoices[0] ? this.normalizeInvoice(invoices[0]) : null;
  }

  // ─── Normalize QBO Invoice → InvoiceRow ──────────────────────────────────────

  private normalizeInvoice(inv: QBOInvoice): InvoiceRow {
    const lineDescriptions = inv.Line.map((l) => l.Description ?? '').join(' ');
    const allText = `${inv.CustomerMemo?.value ?? ''} ${lineDescriptions}`;

    const mainLine = inv.Line.find((l) => l.Amount > 0 && l.SalesItemLineDetail);
    const rate = mainLine?.SalesItemLineDetail?.UnitPrice ?? 0;
    const hoursBilled = mainLine?.SalesItemLineDetail?.Qty ?? 0;
    const amountBilled = inv.TotalAmt;

    return {
      invoiceNo: inv.DocNumber,
      clientName: inv.CustomerRef.name ?? inv.CustomerRef.value,
      practitioner: extractPractitioner(allText),
      serviceType: detectServiceType(allText),
      hoursBilled,
      rate,
      amountBilled,
      isInsurance: INSURANCE_REGEX.test(allText),
      actualHours: 0,
      actualAmount: 0,
      delta: 0,
      action: 'awaiting_data',
      sessionGroups: [],
      parseWarnings: [],
      notes: '',
    };
  }
}

export const qboService = new QBOService();

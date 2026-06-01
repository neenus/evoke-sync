import { Request } from 'express';
export type { AuthenticatedRequest } from '@nr/auth-middleware';

// ─── OAuth / Token ────────────────────────────────────────────────────────────

export interface OAuthTokenData {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  createdAt?: number;
}

// ─── QBO API ──────────────────────────────────────────────────────────────────

export interface QBORef {
  value: string;
  name?: string;
}

export interface QBOInvoiceLine {
  Id?: string;
  Amount: number;
  DetailType: string;
  Description?: string;
  SalesItemLineDetail?: {
    ItemRef?: QBORef;
    Qty?: number;
    UnitPrice?: number;
    ServiceDate?: string;
  };
}

export interface QBOInvoice {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate?: string;
  TotalAmt: number;
  Balance?: number;
  CurrencyRef: QBORef;
  CustomerRef: QBORef;
  BillEmail?: { Address?: string };
  Line: QBOInvoiceLine[];
  PrivateNote?: string;
  CustomerMemo?: { value?: string };
  SyncToken: string;
  MetaData: { CreateTime: string; LastUpdatedTime: string };
}

export interface QBOQueryResponse<T> {
  QueryResponse: Record<string, T[] | number | undefined>;
  time: string;
}

export interface QBOCompanyInfo {
  Id: string;
  CompanyName: string;
  Country: string;
}

// ─── Evoke Sync domain types ──────────────────────────────────────────────────

export type Company = 'york_region' | 'consulting';

export type ReconciliationStatus = 'draft' | 'in_progress' | 'pending_approval' | 'approved';

export type InvoiceAction = 'no_change' | 'additional_charge' | 'credit_memo' | 'awaiting_data';

export interface SessionGroup {
  sessionLength: number;
  sessionDates: string[];
  qboDescription: string;
}

export interface InvoiceRow {
  invoiceNo: string;
  clientName: string;
  practitioner: string;
  serviceType: string;
  hoursBilled: number;
  rate: number;
  amountBilled: number;
  isInsurance: boolean;
  actualHours: number;
  actualAmount: number;
  delta: number;
  action: InvoiceAction;
  sessionGroups: SessionGroup[];
  parseWarnings: string[];
  notes: string;
  excluded: boolean;
  description: string;
  isManual: boolean;
  practitionerOverridden: boolean;
}


// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

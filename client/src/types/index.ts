export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  appAccess: string[];
  isActive: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

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

export interface ReconciliationMonth {
  _id: string;
  month: string;
  year: string;
  company: Company;
  status: ReconciliationStatus;
  billingNotesHtml: string;
  invoices: InvoiceRow[];
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

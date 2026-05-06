import { Schema, model, Document, Model } from 'mongoose';
import {
  Company,
  ReconciliationStatus,
  InvoiceAction,
  SessionGroup,
  InvoiceRow,
} from '../types';

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface ISessionGroup extends SessionGroup, Document {}
export interface IInvoiceRow extends InvoiceRow, Document {}

// ─── Document interface ───────────────────────────────────────────────────────

export interface IReconciliationMonthBase {
  month: string;
  year: string;
  company: Company;
  status: ReconciliationStatus;
  billingNotesHtml: string;
  invoices: IInvoiceRow[];
  approvedBy?: string;
  approvedAt?: Date;
}

export interface IReconciliationMonthDocument
  extends IReconciliationMonthBase,
    Document {
  createdAt: Date;
  updatedAt: Date;
}

interface IReconciliationMonthModel extends Model<IReconciliationMonthDocument> {}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const sessionGroupSchema = new Schema<ISessionGroup>(
  {
    sessionLength: { type: Number, required: true },
    sessionDates: [{ type: String }],
    qboDescription: { type: String, default: '' },
  },
  { _id: false },
);

const invoiceRowSchema = new Schema<IInvoiceRow>(
  {
    invoiceNo: { type: String, required: true },
    clientName: { type: String, required: true, trim: true },
    practitioner: { type: String, required: true, trim: true },
    serviceType: { type: String, required: true },
    hoursBilled: { type: Number, required: true, default: 0 },
    rate: { type: Number, required: true, default: 0 },
    amountBilled: { type: Number, required: true, default: 0 },
    isInsurance: { type: Boolean, default: false },
    actualHours: { type: Number, default: 0 },
    actualAmount: { type: Number, default: 0 },
    delta: { type: Number, default: 0 },
    action: {
      type: String,
      enum: ['no_change', 'additional_charge', 'credit_memo', 'awaiting_data'],
      default: 'awaiting_data',
    } as unknown as { type: StringConstructor; enum: InvoiceAction[]; default: InvoiceAction },
    sessionGroups: [sessionGroupSchema],
    parseWarnings: [{ type: String }],
    notes: { type: String, default: '' },
  },
  { _id: false },
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const reconciliationMonthSchema = new Schema<
  IReconciliationMonthDocument,
  IReconciliationMonthModel
>(
  {
    month: { type: String, required: true },
    year: { type: String, required: true },
    company: {
      type: String,
      enum: ['york_region', 'consulting'],
      required: true,
    } as unknown as { type: StringConstructor; enum: Company[]; required: true },
    status: {
      type: String,
      enum: ['draft', 'in_progress', 'pending_approval', 'approved'],
      default: 'draft',
    } as unknown as {
      type: StringConstructor;
      enum: ReconciliationStatus[];
      default: ReconciliationStatus;
    },
    billingNotesHtml: { type: String, default: '' },
    invoices: [invoiceRowSchema],
    approvedBy: { type: String },
    approvedAt: { type: Date },
  },
  { timestamps: true, collection: 'reconciliationmonths' },
);

export const ReconciliationMonth = model<
  IReconciliationMonthDocument,
  IReconciliationMonthModel
>('ReconciliationMonth', reconciliationMonthSchema);

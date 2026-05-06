import { Schema, model, Document, Types } from 'mongoose';

export interface IParsedSession {
  clientName: string;
  sessionDate: string;
  sessionLength: number;
  billable: boolean;
  notes: string;
}

export interface IPractitionerInvoiceDocument extends Document {
  reconciliationMonthId: Types.ObjectId;
  practitionerName: string;
  month: string;
  year: string;
  rawFileName: string;
  parsedSessions: IParsedSession[];
  parseWarnings: string[];
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const parsedSessionSchema = new Schema<IParsedSession>(
  {
    clientName: { type: String, required: true },
    sessionDate: { type: String, required: true },
    sessionLength: { type: Number, required: true },
    billable: { type: Boolean, default: true },
    notes: { type: String, default: '' },
  },
  { _id: false },
);

const practitionerInvoiceSchema = new Schema<IPractitionerInvoiceDocument>(
  {
    reconciliationMonthId: { type: Schema.Types.ObjectId, required: true, ref: 'ReconciliationMonth' },
    practitionerName: { type: String, required: true, trim: true },
    month: { type: String, required: true },
    year: { type: String, required: true },
    rawFileName: { type: String, required: true },
    parsedSessions: [parsedSessionSchema],
    parseWarnings: [{ type: String }],
    uploadedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'practitionerinvoices',
  },
);

// Compound index for upsert: one record per practitioner per reconciliation
practitionerInvoiceSchema.index(
  { reconciliationMonthId: 1, practitionerName: 1 },
  { unique: true },
);

export const PractitionerInvoice = model<IPractitionerInvoiceDocument>(
  'PractitionerInvoice',
  practitionerInvoiceSchema,
);

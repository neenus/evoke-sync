import { Schema, model, Document, Types } from 'mongoose';

export interface IApprovalRecordDocument extends Document {
  reconciliationMonthId: Types.ObjectId;
  approvedBy: string;
  approvedAt: Date;
  totalBilled: number;
  totalActual: number;
  totalDelta: number;
  actionsRequired: {
    additionalCharges: number;
    creditMemos: number;
    noChange: number;
  };
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const approvalRecordSchema = new Schema<IApprovalRecordDocument>(
  {
    reconciliationMonthId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'ReconciliationMonth',
      unique: true,
    },
    approvedBy: { type: String, required: true },
    approvedAt: { type: Date, required: true },
    totalBilled: { type: Number, required: true },
    totalActual: { type: Number, required: true },
    totalDelta: { type: Number, required: true },
    actionsRequired: {
      additionalCharges: { type: Number, default: 0 },
      creditMemos: { type: Number, default: 0 },
      noChange: { type: Number, default: 0 },
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'approvalrecords' },
);

export const ApprovalRecord = model<IApprovalRecordDocument>(
  'ApprovalRecord',
  approvalRecordSchema,
);

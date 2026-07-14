import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { ApprovalRecord } from '../ApprovalRecord.model';

function baseRecord(overrides: Partial<Parameters<typeof ApprovalRecord.create>[0]> = {}) {
  return {
    reconciliationMonthId: new Types.ObjectId(),
    approvedBy: 'Neenus',
    approvedAt: new Date(),
    totalBilled: 1000,
    totalActual: 1000,
    totalDelta: 0,
    actionsRequired: { additionalCharges: 0, creditMemos: 0, noChange: 1 },
    notes: '',
    ...overrides,
  };
}

describe('ApprovalRecord model', () => {
  it('defaults action to "approved" when not specified', async () => {
    const record = await ApprovalRecord.create(baseRecord());
    expect(record.action).toBe('approved');
  });

  it('allows multiple records for the same reconciliationMonthId', async () => {
    const reconciliationMonthId = new Types.ObjectId();
    await ApprovalRecord.create(baseRecord({ reconciliationMonthId, action: 'approved' } as any));
    const second = await ApprovalRecord.create(
      baseRecord({ reconciliationMonthId, action: 'unapproved' } as any),
    );
    expect(second.action).toBe('unapproved');

    const all = await ApprovalRecord.find({ reconciliationMonthId });
    expect(all).toHaveLength(2);
  });
});

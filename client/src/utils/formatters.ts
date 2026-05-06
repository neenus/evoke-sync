export function formatCAD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatDelta(delta: number): string {
  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${formatCAD(delta)}`;
}

export function formatMonth(month: string, year: string): string {
  return `${month} ${year}`;
}

export function companyLabel(company: string): string {
  return company === 'york_region' ? 'York Region' : 'Consulting';
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'draft': return 'Draft';
    case 'in_progress': return 'In Progress';
    case 'pending_approval': return 'Pending Approval';
    case 'approved': return 'Approved';
    default: return status;
  }
}

export function actionLabel(action: string): string {
  switch (action) {
    case 'no_change': return 'No Change';
    case 'additional_charge': return 'Additional Charge';
    case 'credit_memo': return 'Credit Memo';
    default: return 'Awaiting Data';
  }
}

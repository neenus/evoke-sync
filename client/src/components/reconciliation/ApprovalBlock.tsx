import { useState } from 'react';
import axios from 'axios';
import { InvoiceRow } from '../../types';

interface Props {
  reconciliationId: string;
  invoices: InvoiceRow[];
  onApproved: () => void;
}

export function ApprovalBlock({ reconciliationId, invoices, onApproved }: Props) {
  const [approvedBy, setApprovedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const awaitingCount = invoices.filter((i) => i.action === 'awaiting_data').length;
  const canApprove = awaitingCount === 0 && approvedBy.trim() !== '';

  async function handleApprove() {
    setError('');
    setLoading(true);
    try {
      await axios.post(
        `/api/reconciliation/${reconciliationId}/approve`,
        { approvedBy, notes },
        { withCredentials: true },
      );
      onApproved();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Approval failed';
      setError(String(msg ?? 'Approval failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">Approve & Lock</h3>

      {awaitingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-700">
            ⚠️ {awaitingCount} invoice{awaitingCount > 1 ? 's' : ''} still awaiting session data.
            All invoices must be completed before approval.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Approved by</label>
        <input
          type="text"
          value={approvedBy}
          onChange={(e) => setApprovedBy(e.target.value)}
          placeholder="Your name"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleApprove}
        disabled={!canApprove || loading}
        className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {loading ? 'Approving…' : '✅ Approve & Lock Reconciliation'}
      </button>
    </div>
  );
}

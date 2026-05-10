import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmModal } from '../components/shared/ConfirmModal';
import { companyLabel, formatMonth } from '../utils/formatters';
import { ReconciliationMonth } from '../types';

type HistoryItem = Pick<ReconciliationMonth, '_id' | 'month' | 'year' | 'company' | 'status' | 'approvedBy' | 'approvedAt' | 'createdAt'>;
type ConfirmState = { id: string; period: string } | null;

export function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState({ company: '', year: '', status: '' });
  const [confirmDelete, setConfirmDelete] = useState<ConfirmState>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    axios.get<{ success: boolean; data: { history: HistoryItem[] } }>(
      '/api/reconciliation/history',
      { withCredentials: true },
    ).then(({ data }) => setItems(data.data.history)).catch(() => null);
  }, []);

  const filtered = items.filter((item) => {
    if (filter.company && item.company !== filter.company) return false;
    if (filter.year && item.year !== filter.year) return false;
    if (filter.status && item.status !== filter.status) return false;
    return true;
  });

  const years = [...new Set(items.map((i) => i.year))].sort((a, b) => b.localeCompare(a));

  function downloadExport(id: string) {
    window.open(`/api/reconciliation/${id}/export`, '_blank');
  }

  async function confirmAndDelete() {
    if (!confirmDelete) return;
    setDeleteError('');
    try {
      await axios.delete(`/api/reconciliation/${confirmDelete.id}`, { withCredentials: true });
      setItems((prev) => prev.filter((item) => item._id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch {
      setConfirmDelete(null);
      setDeleteError('Failed to delete. Please try again.');
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reconciliation History</h1>

      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700">{deleteError}</p>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete reconciliation"
          message={`Delete reconciliation for ${confirmDelete.period}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmAndDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filter.company}
          onChange={(e) => setFilter((f) => ({ ...f, company: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All companies</option>
          <option value="york_region">York Region</option>
          <option value="consulting">Consulting</option>
        </select>
        <select
          value={filter.year}
          onChange={(e) => setFilter((f) => ({ ...f, year: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="in_progress">In Progress</option>
          <option value="approved">Approved</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-5 py-3">Period</th>
              <th className="px-5 py-3">Company</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Approved By</th>
              <th className="px-5 py-3">Approved At</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">
                  No reconciliations found.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link to={`/history/${item._id}`} className="font-medium text-blue-600 hover:text-blue-800">
                      {formatMonth(item.month, item.year)}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{companyLabel(item.company)}</td>
                  <td className="px-5 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-5 py-3 text-gray-600">{item.approvedBy ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {item.approvedAt ? new Date(item.approvedAt).toLocaleDateString('en-CA') : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => downloadExport(item._id)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Download ↓
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ id: item._id, period: formatMonth(item.month, item.year) })}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

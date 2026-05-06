import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { StatusBadge } from '../components/shared/StatusBadge';
import { companyLabel, formatMonth } from '../utils/formatters';

interface QBOStatus {
  connected: boolean;
  companyName?: string;
  refreshTokenExpired?: boolean;
}

interface HistoryItem {
  _id: string;
  month: string;
  year: string;
  company: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [qboStatus, setQboStatus] = useState<{ york_region: QBOStatus; consulting: QBOStatus } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    axios.get<{ success: boolean; data: { york_region: QBOStatus; consulting: QBOStatus } }>(
      '/api/auth/qbo/status',
      { withCredentials: true },
    ).then(({ data }) => setQboStatus(data.data)).catch(() => null);

    axios.get<{ success: boolean; data: { history: HistoryItem[] } }>(
      '/api/reconciliation/history',
      { withCredentials: true },
    ).then(({ data }) => setHistory(data.data.history.slice(0, 3))).catch(() => null);
  }, []);

  function connectCompany(company: string) {
    window.location.href = `/api/auth/qbo/connect/${company}`;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={() => navigate('/reconciliation')}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Begin Month-End Reconciliation
        </button>
      </div>

      {/* QBO Connection Cards */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          QuickBooks Online Connections
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {(['york_region', 'consulting'] as const).map((co) => {
            const status = qboStatus?.[co];
            return (
              <div key={co} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{companyLabel(co)}</p>
                    {status?.companyName && (
                      <p className="text-xs text-gray-400 mt-0.5">{status.companyName}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      status?.connected && !status.refreshTokenExpired
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {status?.connected && !status.refreshTokenExpired ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <button
                  onClick={() => connectCompany(co)}
                  className="mt-4 w-full text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 transition-colors"
                >
                  {status?.connected ? (status.refreshTokenExpired ? 'Reconnect' : 'Reconnect') : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent History */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Recent Reconciliations
          </h2>
          <Link to="/history" className="text-sm text-blue-600 hover:text-blue-800">
            View all
          </Link>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No reconciliations yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {history.map((item) => (
              <Link
                key={item._id}
                to={`/history/${item._id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatMonth(item.month, item.year)} — {companyLabel(item.company)}
                  </p>
                  {item.approvedBy && (
                    <p className="text-xs text-gray-400">Approved by {item.approvedBy}</p>
                  )}
                </div>
                <StatusBadge status={item.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

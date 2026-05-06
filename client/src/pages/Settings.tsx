import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthContext } from '../context/AuthContext';

interface QBOStatus {
  connected: boolean;
  companyName?: string;
  refreshTokenExpired?: boolean;
}

export function Settings() {
  const { user } = useAuthContext();
  const [searchParams] = useSearchParams();
  const [qboStatus, setQboStatus] = useState<{ york_region: QBOStatus; consulting: QBOStatus } | null>(null);
  const [qboConnectedMsg, setQboConnectedMsg] = useState('');

  useEffect(() => {
    const connected = searchParams.get('qbo_connected');
    if (connected) {
      setQboConnectedMsg(`Successfully connected ${connected === 'york_region' ? 'York Region' : 'Consulting'}.`);
    }

    axios.get<{ success: boolean; data: { york_region: QBOStatus; consulting: QBOStatus } }>(
      '/api/auth/qbo/status',
      { withCredentials: true },
    ).then(({ data }) => setQboStatus(data.data)).catch(() => null);
  }, [searchParams]);

  function connectCompany(company: string) {
    window.location.href = `/api/auth/qbo/connect/${company}`;
  }

  async function disconnectCompany(company: string) {
    if (!window.confirm(`Disconnect ${company === 'york_region' ? 'York Region' : 'Consulting'}?`)) return;
    await axios.post(`/api/auth/qbo/disconnect/${company}`, {}, { withCredentials: true });
    setQboStatus((prev) => prev ? { ...prev, [company]: { connected: false } } : prev);
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {qboConnectedMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-sm text-green-700">✅ {qboConnectedMsg}</p>
        </div>
      )}

      {/* QBO Connections */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">QuickBooks Online Connections</h2>
        {(['york_region', 'consulting'] as const).map((co) => {
          const status = qboStatus?.[co];
          const label = co === 'york_region' ? 'York Region' : 'Consulting';
          return (
            <div key={co} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                {status?.companyName && (
                  <p className="text-xs text-gray-400">{status.companyName}</p>
                )}
                <p className={`text-xs mt-0.5 ${status?.connected ? 'text-green-600' : 'text-red-500'}`}>
                  {status?.connected ? (status.refreshTokenExpired ? '⚠️ Token expired — reconnect' : '✅ Connected') : 'Not connected'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => connectCompany(co)}
                  className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1"
                >
                  {status?.connected ? 'Reconnect' : 'Connect'}
                </button>
                {status?.connected && (
                  <button
                    onClick={() => disconnectCompany(co)}
                    className="text-sm text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Account */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Account</h2>
        <div className="text-sm text-gray-700">
          <p><span className="text-gray-400">Name:</span> {user?.name}</p>
          <p className="mt-1"><span className="text-gray-400">Email:</span> {user?.email}</p>
          <p className="mt-1"><span className="text-gray-400">Role:</span> {user?.role}</p>
        </div>
        <p className="text-xs text-gray-400">
          To change your password, update ADMIN_PASSWORD in .env and restart the server.
        </p>
      </section>
    </div>
  );
}

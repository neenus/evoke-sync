import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

type Status = 'processing' | 'success' | 'error';

export function Callback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('processing');
  const [message, setMessage] = useState('');
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);

      const error = params.get('error');
      if (error) {
        setStatus('error');
        setMessage(
          error === 'access_denied'
            ? 'Authorization was cancelled.'
            : `QuickBooks returned an error: ${error}`,
        );
        return;
      }

      if (!params.get('code')) {
        setStatus('error');
        setMessage('Missing authorization code in callback URL.');
        return;
      }

      try {
        const { data } = await axios.post<{ success: boolean; data: { company: string } }>(
          '/api/auth/qbo/exchange',
          { redirectUrl: window.location.href },
          { withCredentials: true },
        );
        setStatus('success');
        setTimeout(() => navigate(`/settings?qbo_connected=${data.data.company}`), 1500);
      } catch (err) {
        setStatus('error');
        setMessage(
          axios.isAxiosError(err)
            ? (err.response?.data as { error?: string })?.error ?? err.message
            : 'An unexpected error occurred.',
        );
      }
    }

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-sm w-full text-center space-y-4">
        {status === 'processing' && (
          <>
            <div className="text-3xl">⏳</div>
            <p className="text-sm text-gray-500">Connecting to QuickBooks...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-3xl">✅</div>
            <p className="text-sm text-gray-700 font-medium">Connected successfully!</p>
            <p className="text-xs text-gray-400">Redirecting to settings...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-3xl">❌</div>
            <p className="text-sm text-red-600">{message}</p>
            <button
              onClick={() => navigate('/settings')}
              className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-4 py-2"
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, FormEvent } from 'react';
import axios from 'axios';
import { InvoiceRow } from '../../types';

interface Props {
  reconciliationId: string;
  practitionerOptions: string[];
  onClose: () => void;
  onCreated: () => void;
}

const SERVICE_TYPES = [
  'Reading Remediation',
  'Math Remediation',
  'Executive Function Coaching',
  'Academic Strategies',
] as const;

export function AddManualInvoiceModal({
  reconciliationId,
  practitionerOptions,
  onClose,
  onCreated,
}: Props) {
  const [clientName, setClientName] = useState('');
  const [practitioner, setPractitioner] = useState('');
  const [serviceType, setServiceType] = useState<string>(SERVICE_TYPES[0]);
  const [rate, setRate] = useState('');
  const [isInsurance, setIsInsurance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const rateNum = parseFloat(rate);
    if (!clientName || !practitioner || !serviceType || !rateNum || rateNum <= 0) {
      setError('All fields are required and rate must be > 0.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post<{ success: boolean; data: { invoice: InvoiceRow } }>(
        `/api/reconciliation/${reconciliationId}/invoice`,
        { clientName, practitioner, serviceType, rate: rateNum, isInsurance },
        { withCredentials: true },
      );

      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Failed to create invoice';
      setError(String(msg ?? 'Failed to create invoice'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Add Manual Invoice</h2>
        <p className="text-xs text-gray-500">
          This row is local-only — you'll still need to create the invoice in QBO.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">Client name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">Practitioner</label>
            <input
              type="text"
              list="manual-practitioner-options"
              value={practitioner}
              onChange={(e) => setPractitioner(e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
            <datalist id="manual-practitioner-options">
              {practitionerOptions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="text-xs text-gray-600">Service type</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm"
            >
              {SERVICE_TYPES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600">Rate ($/hr)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isInsurance}
              onChange={(e) => setIsInsurance(e.target.checked)}
            />
            Insurance receipt
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

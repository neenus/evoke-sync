import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ProgressBar } from '../components/shared/ProgressBar';
import { MonthSelector } from '../components/reconciliation/MonthSelector';
import { BillingNotesEditor } from '../components/reconciliation/BillingNotesEditor';
import { PractitionerUpload } from '../components/reconciliation/PractitionerUpload';
import { ReconciliationRow } from '../components/reconciliation/ReconciliationRow';
import { SummaryPanel } from '../components/reconciliation/SummaryPanel';
import { ApprovalBlock } from '../components/reconciliation/ApprovalBlock';
import { AddManualInvoiceModal } from '../components/reconciliation/AddManualInvoiceModal';
import { ReconciliationMonth, InvoiceRow } from '../types';

const STEPS = ['Setup', 'Billing Notes', 'Upload', 'Reconcile', 'Approve'];

export function Reconciliation() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isResume = Boolean(id);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ month: 'March', year: String(new Date().getFullYear()), company: 'york_region' });
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState('');
  const [reconciliation, setReconciliation] = useState<ReconciliationMonth | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(isResume);
  const [expandedInvoiceNo, setExpandedInvoiceNo] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoadingExisting(true);
    axios.get<{ success: boolean; data: { reconciliation: ReconciliationMonth } }>(
      `/api/reconciliation/${id}`,
      { withCredentials: true },
    )
      .then(({ data }) => {
        const rec = data.data.reconciliation;
        setReconciliation(rec);
        setStep(rec.status === 'approved' ? 4 : 3);
      })
      .catch(() => setPullError('Failed to load reconciliation. It may have been deleted.'))
      .finally(() => setLoadingExisting(false));
  }, [id]);

  function handleFormChange(field: 'month' | 'year' | 'company', value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handlePullInvoices() {
    setPullError('');
    setPulling(true);
    try {
      const { data } = await axios.post<{ success: boolean; data: { reconciliationMonthId: string } }>(
        '/api/reconciliation/start',
        form,
        { withCredentials: true },
      );
      const { data: recData } = await axios.get<{ success: boolean; data: { reconciliation: ReconciliationMonth } }>(
        `/api/reconciliation/${data.data.reconciliationMonthId}`,
        { withCredentials: true },
      );
      setReconciliation(recData.data.reconciliation);
      setStep(1);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Failed to pull invoices';
      setPullError(String(msg ?? 'Failed to pull invoices'));
    } finally {
      setPulling(false);
    }
  }

  async function handleSaveNotes(html: string) {
    if (!reconciliation) return;
    await axios.patch(
      `/api/reconciliation/${reconciliation._id}/notes`,
      { billingNotesHtml: html },
      { withCredentials: true },
    );
    setReconciliation((prev) => prev ? { ...prev, billingNotesHtml: html } : prev);
  }

  const refreshReconciliation = useCallback(async () => {
    if (!reconciliation) return;
    const { data } = await axios.get<{ success: boolean; data: { reconciliation: ReconciliationMonth } }>(
      `/api/reconciliation/${reconciliation._id}`,
      { withCredentials: true },
    );
    setReconciliation(data.data.reconciliation);
  }, [reconciliation]);

  function handleInvoiceUpdate(updated: InvoiceRow) {
    setReconciliation((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        invoices: prev.invoices.map((inv) =>
          inv.invoiceNo === updated.invoiceNo ? updated : inv,
        ),
      };
    });
  }

  function handleApproved() {
    refreshReconciliation().then(() => {
      // Trigger export download
      if (reconciliation) {
        window.open(`/api/reconciliation/${reconciliation._id}/export`, '_blank');
      }
      navigate('/history');
    });
  }

  const isApproved = reconciliation?.status === 'approved';

  // Group invoices by practitioner for Step 4
  const byPractitioner = reconciliation
    ? reconciliation.invoices.reduce<Record<string, InvoiceRow[]>>((acc, inv) => {
        if (!acc[inv.practitioner]) acc[inv.practitioner] = [];
        acc[inv.practitioner].push(inv);
        return acc;
      }, {})
    : {};

  const practitionerOptions = reconciliation
    ? [...new Set(reconciliation.invoices.map((i) => i.practitioner).filter(Boolean))].sort()
    : [];

  if (loadingExisting) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <p className="text-gray-500 text-sm">Loading reconciliation…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Month-End Reconciliation</h1>

      <ProgressBar step={step} total={STEPS.length} labels={STEPS} />

      {/* Step 0: Setup */}
      {step === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">Step 1 — Setup</h2>
          <MonthSelector
            month={form.month}
            year={form.year}
            company={form.company}
            onChange={handleFormChange}
          />
          {pullError && <p className="text-sm text-red-600">{pullError}</p>}
          <button
            onClick={handlePullInvoices}
            disabled={pulling || !form.month || !form.year}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {pulling ? 'Pulling invoices from QBO…' : 'Pull Invoices from QBO'}
          </button>
        </div>
      )}

      {/* Step 1: Billing Notes */}
      {step === 1 && reconciliation && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Step 2 — Billing Notes</h2>
          <p className="text-sm text-gray-500">Month-End Notes & Changes from Evoke</p>
          <BillingNotesEditor
            value={reconciliation.billingNotesHtml}
            onBlur={handleSaveNotes}
            readOnly={isApproved}
          />
          <div className="flex justify-between">
            {!isResume && (
              <button onClick={() => setStep(0)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                ← Back
              </button>
            )}
            <div className="ml-auto">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Next: Upload Invoices →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Upload */}
      {step === 2 && reconciliation && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Step 3 — Upload Practitioner Invoices</h2>
          {!isApproved && (
            <PractitionerUpload
              reconciliationMonthId={reconciliation._id}
              onUploaded={refreshReconciliation}
            />
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Next: Reconcile →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Reconciliation view */}
      {step === 3 && reconciliation && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Step 4 — Reconciliation</h2>
            <div className="flex items-center gap-3">
              {isApproved && (
                <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                  🔒 Approved — Read Only
                </span>
              )}
              {!isApproved && (
                <button
                  onClick={() => setManualModalOpen(true)}
                  className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  + Add Manual Invoice
                </button>
              )}
            </div>
          </div>

          {Object.entries(byPractitioner).map(([practitioner, invoices]) => (
            <div key={practitioner} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-800">{practitioner}</span>
                <span className="text-xs text-gray-500">
                  {invoices.length} invoice{invoices.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="p-4 space-y-2">
                {invoices.map((inv) => (
                  <ReconciliationRow
                    key={inv.invoiceNo}
                    invoice={inv}
                    reconciliationId={reconciliation._id}
                    readOnly={isApproved}
                    expanded={expandedInvoiceNo === inv.invoiceNo}
                    onToggle={() => setExpandedInvoiceNo((prev) => (prev === inv.invoiceNo ? null : inv.invoiceNo))}
                    practitionerOptions={practitionerOptions}
                    onUpdate={handleInvoiceUpdate}
                    onRefresh={refreshReconciliation}
                  />
                ))}
              </div>
            </div>
          ))}

          {manualModalOpen && reconciliation && (
            <AddManualInvoiceModal
              reconciliationId={reconciliation._id}
              practitionerOptions={practitionerOptions}
              onClose={() => setManualModalOpen(false)}
              onCreated={refreshReconciliation}
            />
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Next: Summary & Approve →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Summary & Approve */}
      {step === 4 && reconciliation && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">Step 5 — Summary & Approval</h2>
          <SummaryPanel invoices={reconciliation.invoices} />
          {!isApproved ? (
            <ApprovalBlock
              reconciliationId={reconciliation._id}
              invoices={reconciliation.invoices}
              onApproved={handleApproved}
            />
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => window.open(`/api/reconciliation/${reconciliation._id}/export`, '_blank')}
                className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
              >
                Download Excel Export
              </button>
            </div>
          )}
          <div className="flex justify-start">
            <button onClick={() => setStep(3)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

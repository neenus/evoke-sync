import { useState, useCallback } from 'react';
import axios from 'axios';
import { InvoiceRow, SessionGroup } from '../../types';
import { formatCAD, formatDelta } from '../../utils/formatters';

interface Props {
  invoice: InvoiceRow;
  reconciliationId: string;
  readOnly: boolean;
  onUpdate: (updated: InvoiceRow) => void;
}

const ACTION_STYLE: Record<string, string> = {
  no_change: 'bg-green-50 text-green-700',
  additional_charge: 'bg-orange-50 text-orange-700',
  credit_memo: 'bg-red-50 text-red-700',
  awaiting_data: 'bg-gray-50 text-gray-500',
};

const ACTION_LABEL: Record<string, string> = {
  no_change: '✅ No Change',
  additional_charge: '🔶 Additional Charge',
  credit_memo: '🔴 Credit Memo',
  awaiting_data: '⏳ Awaiting Data',
};

export function ReconciliationRow({ invoice, reconciliationId, readOnly, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>(invoice.sessionGroups);
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (groups: SessionGroup[]) => {
      if (readOnly) return;
      setSaving(true);
      try {
        const { data } = await axios.patch<{ success: boolean; data: { invoice: InvoiceRow } }>(
          `/api/reconciliation/${reconciliationId}/invoice/${invoice.invoiceNo}`,
          { sessionGroups: groups },
          { withCredentials: true },
        );
        onUpdate(data.data.invoice);
        setSessionGroups(data.data.invoice.sessionGroups);
      } catch (err) {
        console.error('Save failed', err);
      } finally {
        setSaving(false);
      }
    },
    [reconciliationId, invoice.invoiceNo, readOnly, onUpdate],
  );

  function updateGroup(idx: number, field: keyof SessionGroup, value: unknown) {
    const updated = sessionGroups.map((sg, i) =>
      i === idx ? { ...sg, [field]: value } : sg,
    );
    setSessionGroups(updated);
    return updated;
  }

  async function addGroup() {
    const updated = [...sessionGroups, { sessionLength: 60, sessionDates: [], qboDescription: '' }];
    setSessionGroups(updated);
  }

  async function removeGroup(idx: number) {
    const updated = sessionGroups.filter((_, i) => i !== idx);
    await save(updated);
  }

  function handleDatesChange(idx: number, raw: string) {
    // Parse comma-separated day numbers
    const dates = raw.split(/[,\s]+/).map((d) => d.trim()).filter((d) => /^\d+$/.test(d));
    updateGroup(idx, 'sessionDates', dates);
  }

  const actionStyle = ACTION_STYLE[invoice.action] ?? ACTION_STYLE.awaiting_data;
  const deltaStyle = invoice.delta > 0 ? 'text-orange-600' : invoice.delta < 0 ? 'text-red-600' : 'text-gray-500';

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div
        className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 grid grid-cols-6 gap-2 text-sm">
          <span className="font-medium text-gray-900 col-span-2">{invoice.clientName}</span>
          <span className="text-gray-500 text-xs">{invoice.serviceType}</span>
          <span className="text-gray-600">
            {invoice.hoursBilled}h → {invoice.actualHours}h
          </span>
          <span className={`font-medium ${deltaStyle}`}>
            {formatDelta(invoice.delta)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionStyle}`}>
            {ACTION_LABEL[invoice.action]}
          </span>
        </div>
        <span className="text-gray-400 ml-2">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          <div className="grid grid-cols-4 gap-4 text-xs text-gray-500">
            <div>Invoice # <strong className="text-gray-800">{invoice.invoiceNo}</strong></div>
            <div>Rate <strong className="text-gray-800">{formatCAD(invoice.rate)}/hr</strong></div>
            <div>Billed <strong className="text-gray-800">{formatCAD(invoice.amountBilled)}</strong></div>
            <div>Actual <strong className="text-gray-800">{formatCAD(invoice.actualAmount)}</strong></div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600 uppercase">Session Groups</p>
              {!readOnly && (
                <button
                  onClick={addGroup}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  + Add Group
                </button>
              )}
            </div>

            {sessionGroups.map((sg, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Session Length (min)</label>
                    <input
                      type="number"
                      value={sg.sessionLength}
                      disabled={readOnly}
                      onChange={(e) => updateGroup(i, 'sessionLength', parseInt(e.target.value) || 0)}
                      onBlur={() => save(sessionGroups)}
                      className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Dates (day numbers, comma-separated)</label>
                    <input
                      type="text"
                      value={sg.sessionDates.join(', ')}
                      disabled={readOnly}
                      onChange={(e) => handleDatesChange(i, e.target.value)}
                      onBlur={() => save(sessionGroups)}
                      className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100"
                      placeholder="3, 8, 10, 24"
                    />
                  </div>
                </div>

                {sg.qboDescription && (
                  <div className="bg-white rounded border border-gray-200 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-gray-600 whitespace-pre-line flex-1">{sg.qboDescription}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(sg.qboDescription)}
                        className="text-xs text-blue-600 hover:text-blue-800 shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                {!readOnly && (
                  <button
                    onClick={() => removeGroup(i)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove group
                  </button>
                )}
              </div>
            ))}

            {sessionGroups.length === 0 && !readOnly && (
              <p className="text-xs text-gray-400 italic">No session groups. Click "Add Group" to start.</p>
            )}
          </div>

          {saving && <p className="text-xs text-blue-500">Saving…</p>}

          {invoice.parseWarnings.length > 0 && (
            <div className="space-y-1">
              {invoice.parseWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">{w}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

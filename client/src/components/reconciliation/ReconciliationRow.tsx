import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { InvoiceRow, SessionGroup } from '../../types';
import { formatCAD, formatDelta } from '../../utils/formatters';

interface Props {
  invoice: InvoiceRow;
  reconciliationId: string;
  readOnly: boolean;
  expanded: boolean;
  onToggle: () => void;
  practitionerOptions: string[];
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

export function ReconciliationRow({ invoice, reconciliationId, readOnly, expanded, onToggle, practitionerOptions, onUpdate }: Props) {
  const [excluded, setExcluded] = useState(Boolean(invoice.excluded));
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>(invoice.sessionGroups);
  const [rawDates, setRawDates] = useState<string[]>(() =>
    invoice.sessionGroups.map((sg) => sg.sessionDates.join(', ')),
  );
  const [saving, setSaving] = useState(false);

  const [practitionerDraft, setPractitionerDraft] = useState(invoice.practitioner);
  const [rateDraft, setRateDraft] = useState(String(invoice.rate));
  const [notesDraft, setNotesDraft] = useState(invoice.notes);

  useEffect(() => {
    setPractitionerDraft(invoice.practitioner);
    setRateDraft(String(invoice.rate));
    setNotesDraft(invoice.notes);
  }, [invoice.practitioner, invoice.rate, invoice.notes]);

  async function toggleExclude() {
    if (readOnly) return;
    const next = !excluded;
    try {
      const { data } = await axios.patch<{ success: boolean; data: { invoice: InvoiceRow } }>(
        `/api/reconciliation/${reconciliationId}/invoice/${invoice.invoiceNo}/exclude`,
        { excluded: next },
        { withCredentials: true },
      );
      setExcluded(next);
      onUpdate(data.data.invoice);
    } catch (err) {
      console.error('Exclude toggle failed', err);
    }
  }

  const savePartial = useCallback(
    async (patch: Partial<{ practitioner: string; rate: number; notes: string; sessionGroups: SessionGroup[] }>) => {
      if (readOnly) return;
      setSaving(true);
      try {
        const { data } = await axios.patch<{ success: boolean; data: { invoice: InvoiceRow } }>(
          `/api/reconciliation/${reconciliationId}/invoice/${invoice.invoiceNo}`,
          patch,
          { withCredentials: true },
        );
        onUpdate(data.data.invoice);
      } catch (err) {
        console.error('Save failed', err);
      } finally {
        setSaving(false);
      }
    },
    [reconciliationId, invoice.invoiceNo, readOnly, onUpdate],
  );

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
        setRawDates(data.data.invoice.sessionGroups.map((sg) => sg.sessionDates.join(', ')));
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
    setRawDates((prev) => [...prev, '']);
  }

  async function removeGroup(idx: number) {
    const updated = sessionGroups.filter((_, i) => i !== idx);
    setRawDates((prev) => prev.filter((_, i) => i !== idx));
    await save(updated);
  }

  function handleDatesRawChange(idx: number, value: string) {
    setRawDates((prev) => prev.map((r, i) => (i === idx ? value : r)));
  }

  function handleDatesBlur(idx: number) {
    const raw = rawDates[idx] ?? '';
    const dates = raw.split(/[,\s]+/).map((d) => d.trim()).filter((d) => /^\d+$/.test(d));
    const updated = updateGroup(idx, 'sessionDates', dates);
    save(updated);
  }

  const actionStyle = ACTION_STYLE[invoice.action] ?? ACTION_STYLE.awaiting_data;
  const deltaStyle = invoice.delta > 0 ? 'text-orange-600' : invoice.delta < 0 ? 'text-red-600' : 'text-gray-500';

  return (
    <div className={`border rounded-lg ${excluded ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-200 bg-white'}`}>
      <div
        className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-100"
        onClick={onToggle}
      >
        <div className="flex-1 grid grid-cols-6 gap-2 text-sm">
          <span className={`font-medium col-span-2 ${excluded ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {invoice.clientName}
            {invoice.notes && (
              <span title="Has notes" className="text-xs text-blue-500 ml-2">📝</span>
            )}
          </span>
          <span className="text-gray-500 text-xs">{invoice.serviceType}</span>
          <span className="text-gray-600">
            {invoice.hoursBilled}h → {invoice.actualHours}h
          </span>
          <span className={`font-medium ${excluded ? 'text-gray-400' : deltaStyle}`}>
            {excluded ? '—' : formatDelta(invoice.delta)}
          </span>
          {excluded ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-500">
              ⊘ Excluded
            </span>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionStyle}`}>
              {ACTION_LABEL[invoice.action]}
            </span>
          )}
        </div>
        {!readOnly && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleExclude(); }}
            className={`text-xs ml-3 shrink-0 ${excluded ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-red-500'}`}
          >
            {excluded ? 'Include' : 'Exclude'}
          </button>
        )}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">Practitioner</label>
              <input
                type="text"
                list={`practitioners-${invoice.invoiceNo}`}
                value={practitionerDraft}
                disabled={readOnly}
                onChange={(e) => setPractitionerDraft(e.target.value)}
                onBlur={() => {
                  if (practitionerDraft.trim() && practitionerDraft !== invoice.practitioner) {
                    savePartial({ practitioner: practitionerDraft.trim() });
                  }
                }}
                className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100"
              />
              <datalist id={`practitioners-${invoice.invoiceNo}`}>
                {practitionerOptions.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-gray-500">Rate ($/hr)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rateDraft}
                disabled={readOnly}
                onChange={(e) => setRateDraft(e.target.value)}
                onBlur={() => {
                  const n = parseFloat(rateDraft);
                  if (!Number.isNaN(n) && n >= 0 && n !== invoice.rate) {
                    savePartial({ rate: n });
                  }
                }}
                className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100"
              />
            </div>
          </div>

          {invoice.description && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-blue-700 mb-1">QBO Description</p>
              <p className="text-xs text-gray-700 whitespace-pre-line">{invoice.description}</p>
            </div>
          )}

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
                    <label className="text-xs text-gray-500">Session Length</label>
                    <select
                      value={sg.sessionLength}
                      disabled={readOnly}
                      onChange={(e) => {
                        const updated = updateGroup(i, 'sessionLength', parseInt(e.target.value));
                        save(updated);
                      }}
                      className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100"
                    >
                      {[15, 30, 40, 45, 60, 90, 120].map((min) => (
                        <option key={min} value={min}>{min} min</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Dates (day numbers, comma-separated)</label>
                    <input
                      type="text"
                      value={rawDates[i] ?? ''}
                      disabled={readOnly}
                      onChange={(e) => handleDatesRawChange(i, e.target.value)}
                      onBlur={() => handleDatesBlur(i)}
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

          <div>
            <label className="text-xs text-gray-500">Notes (private — not synced to QBO)</label>
            <textarea
              value={notesDraft}
              disabled={readOnly}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={() => {
                if (notesDraft !== invoice.notes) savePartial({ notes: notesDraft });
              }}
              rows={3}
              className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100"
              placeholder="Optional notes for your reference"
            />
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

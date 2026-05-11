import { useState } from 'react';
import axios from 'axios';
import { FileDropZone } from '../shared/FileDropZone';

interface SessionGroup {
  sessionLength: number;
  sessionDates: string[];
}

interface ProposedMatch {
  invoiceNo: string;
  qboClientName: string;
  parsedClientName: string;
  sessionGroups: SessionGroup[];
}

interface UnmatchedGroup {
  parsedClientName: string;
  sessionLength: number;
  sessionDates: string[];
}

interface PreviewResult {
  fileName: string;
  practitionerName: string;
  sessionCount: number;
  matches: ProposedMatch[];
  unmatched: UnmatchedGroup[];
  warnings: string[];
}

interface Props {
  reconciliationMonthId: string;
  onUploaded: () => void;
}

type Stage = 'idle' | 'parsing' | 'reviewing' | 'applying' | 'done';

export function PractitionerUpload({ reconciliationMonthId, onUploaded }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [previews, setPreviews] = useState<PreviewResult[]>([]);
  // Set of "invoiceNo" strings that the user has checked ON (confirmed)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [expandedWarnings, setExpandedWarnings] = useState<Set<string>>(new Set());
  const [applyError, setApplyError] = useState('');

  async function handleFiles(files: FileList) {
    setStage('parsing');
    setApplyError('');
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append('files', f));

    try {
      const { data } = await axios.post<{ success: boolean; data: { previews: PreviewResult[] } }>(
        `/api/practitioners/preview/${reconciliationMonthId}`,
        formData,
        { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } },
      );

      const results = data.data.previews;

      // Pre-check all matched invoices so user sees what will happen by default
      const allMatched = new Set<string>(
        results.flatMap((r) => r.matches.map((m) => m.invoiceNo)),
      );

      setPreviews((prev) => {
        const next = [...prev];
        for (const r of results) {
          const idx = next.findIndex((x) => x.fileName === r.fileName);
          if (idx >= 0) next[idx] = r;
          else next.push(r);
        }
        return next;
      });
      setConfirmed((prev) => new Set([...prev, ...allMatched]));
      setStage('reviewing');
    } catch (err) {
      console.error('Parse failed', err);
      setStage('idle');
    }
  }

  function toggleConfirmed(invoiceNo: string) {
    setConfirmed((prev) => {
      const next = new Set(prev);
      next.has(invoiceNo) ? next.delete(invoiceNo) : next.add(invoiceNo);
      return next;
    });
  }

  function toggleWarnings(key: string) {
    setExpandedWarnings((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleApply() {
    const applications = previews
      .flatMap((r) => r.matches)
      .filter((m) => confirmed.has(m.invoiceNo))
      .map((m) => ({ invoiceNo: m.invoiceNo, sessionGroups: m.sessionGroups }));

    if (applications.length === 0) {
      setApplyError('No matches selected — check at least one invoice to apply.');
      return;
    }

    setStage('applying');
    setApplyError('');
    try {
      await axios.post(
        `/api/practitioners/apply/${reconciliationMonthId}`,
        { applications },
        { withCredentials: true },
      );
      setStage('done');
      onUploaded();
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Apply failed';
      setApplyError(String(msg ?? 'Apply failed'));
      setStage('reviewing');
    }
  }

  function handleReset() {
    setStage('idle');
    setApplyError('');
  }

  const totalConfirmed = previews.flatMap((r) => r.matches).filter((m) => confirmed.has(m.invoiceNo)).length;
  const totalMatches = previews.flatMap((r) => r.matches).length;
  const totalUnmatched = previews.flatMap((r) => r.unmatched).length;

  return (
    <div className="space-y-4">
      {/* Drop zone — always visible unless done */}
      {stage !== 'done' && (
        <FileDropZone onFiles={handleFiles} />
      )}

      {stage === 'parsing' && (
        <p className="text-sm text-blue-600">Parsing files…</p>
      )}

      {/* Review stage */}
      {(stage === 'reviewing' || stage === 'applying') && previews.length > 0 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-blue-800">
              <span className="font-medium">{totalMatches} match{totalMatches !== 1 ? 'es' : ''} found</span>
              {totalUnmatched > 0 && (
                <span className="ml-2 text-blue-600">· {totalUnmatched} unmatched</span>
              )}
              <span className="ml-2 text-blue-600">· {totalConfirmed} selected</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={stage === 'applying'}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
              >
                Upload different files
              </button>
              <button
                onClick={handleApply}
                disabled={stage === 'applying' || totalConfirmed === 0}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {stage === 'applying' ? 'Applying…' : `Apply ${totalConfirmed} match${totalConfirmed !== 1 ? 'es' : ''}`}
              </button>
            </div>
          </div>

          {applyError && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{applyError}</p>
          )}

          {previews.map((preview) => (
            <div key={preview.fileName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* File header */}
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{preview.practitionerName}</p>
                  <p className="text-xs text-gray-400">{preview.fileName} · {preview.sessionCount} billable sessions</p>
                </div>
                {preview.warnings.length > 0 && (
                  <button
                    onClick={() => toggleWarnings(preview.fileName)}
                    className="text-xs text-amber-600 hover:text-amber-800"
                  >
                    ⚠️ {preview.warnings.length} warning{preview.warnings.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>

              {expandedWarnings.has(preview.fileName) && (
                <ul className="px-4 py-2 space-y-1 border-b border-gray-100">
                  {preview.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{w}</li>
                  ))}
                </ul>
              )}

              {/* Matched invoices */}
              {preview.matches.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {preview.matches.map((match) => {
                    const isChecked = confirmed.has(match.invoiceNo);
                    const namesDiffer = match.parsedClientName.toLowerCase().replace(/\s+/g, '') !==
                      match.qboClientName.toLowerCase().replace(/\s+/g, '');
                    const totalSessions = match.sessionGroups.reduce(
                      (s, sg) => s + sg.sessionDates.length, 0,
                    );

                    return (
                      <label
                        key={match.invoiceNo}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          isChecked ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 opacity-60 hover:opacity-80'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleConfirmed(match.invoiceNo)}
                          className="mt-0.5 accent-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{match.qboClientName}</span>
                            <span className="text-xs text-gray-400">#{match.invoiceNo}</span>
                            {namesDiffer && (
                              <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                file: "{match.parsedClientName}"
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {match.sessionGroups.map((sg, i) => (
                              <span key={i} className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">
                                {sg.sessionLength} min · {sg.sessionDates.length} session{sg.sessionDates.length !== 1 ? 's' : ''} · days {sg.sessionDates.join(', ')}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0 mt-0.5">
                          {totalSessions} session{totalSessions !== 1 ? 's' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Unmatched clients */}
              {preview.unmatched.length > 0 && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-1">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    No matching QBO invoice found
                  </p>
                  {preview.unmatched.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="text-red-400">✗</span>
                      <span>{u.parsedClientName}</span>
                      <span className="text-gray-300">·</span>
                      <span>{u.sessionLength} min · days {u.sessionDates.join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}

              {preview.matches.length === 0 && preview.unmatched.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400 italic">No billable sessions found in this file.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {stage === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-green-700 font-medium">✅ Sessions applied to invoice rows.</p>
          <button onClick={handleReset} className="text-xs text-green-600 hover:text-green-800">
            Upload more
          </button>
        </div>
      )}
    </div>
  );
}

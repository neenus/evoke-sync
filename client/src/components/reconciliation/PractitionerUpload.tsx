import { useState } from 'react';
import axios from 'axios';
import { FileDropZone } from '../shared/FileDropZone';

interface UploadResult {
  fileName: string;
  practitionerName: string;
  sessionCount: number;
  warnings: string[];
}

interface Props {
  reconciliationMonthId: string;
  onUploaded: () => void;
}

export function PractitionerUpload({ reconciliationMonthId, onUploaded }: Props) {
  const [results, setResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [expandedWarnings, setExpandedWarnings] = useState<Set<string>>(new Set());

  async function handleFiles(files: FileList) {
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append('files', f));

    try {
      const { data } = await axios.post<{ success: boolean; data: { parsed: UploadResult[] } }>(
        `/api/practitioners/upload/${reconciliationMonthId}`,
        formData,
        { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setResults((prev) => {
        const next = [...prev];
        for (const r of data.data.parsed) {
          const idx = next.findIndex((x) => x.fileName === r.fileName);
          if (idx >= 0) next[idx] = r;
          else next.push(r);
        }
        return next;
      });
      onUploaded();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  }

  function toggleWarnings(fileName: string) {
    setExpandedWarnings((prev) => {
      const next = new Set(prev);
      next.has(fileName) ? next.delete(fileName) : next.add(fileName);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <FileDropZone onFiles={handleFiles} />
      {uploading && <p className="text-sm text-blue-600">Uploading and parsing…</p>}
      {results.map((r) => (
        <div key={r.fileName} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{r.practitionerName}</p>
              <p className="text-xs text-gray-400">{r.fileName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-green-600 font-medium">
                ✅ {r.sessionCount} sessions parsed
              </p>
              {r.warnings.length > 0 && (
                <button
                  onClick={() => toggleWarnings(r.fileName)}
                  className="text-xs text-amber-600 hover:text-amber-800"
                >
                  ⚠️ {r.warnings.length} warning{r.warnings.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
          {expandedWarnings.has(r.fileName) && (
            <ul className="mt-3 space-y-1">
              {r.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{w}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

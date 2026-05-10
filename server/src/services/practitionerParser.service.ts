import * as XLSX from 'xlsx';
import { IParsedSession } from '../models/PractitionerInvoice.model';

export interface ParseResult {
  practitionerName: string;
  parsedSessions: IParsedSession[];
  parseWarnings: string[];
}

// ─── Non-billable service keywords ───────────────────────────────────────────

const NON_BILLABLE_KEYWORDS = [
  'progress & assessment',
  'assessment summar',
  'supervision meeting',
  'supervison meeting',
  'monthly supervision',
  'prep & amin',
  'prep & admin',
];

function isNonBillableService(service: string): boolean {
  const lower = service.toLowerCase();
  return NON_BILLABLE_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Client name normalization ────────────────────────────────────────────────

function normalizeClientName(raw: string): string {
  const trimmed = raw.trim();
  // "Last, First" → "First Last"
  if (/^[A-Z][a-zA-Z]+,\s*[A-Z]/.test(trimmed)) {
    const [last, ...firstParts] = trimmed.split(',').map((p) => p.trim());
    return `${firstParts.join(' ')} ${last}`;
  }
  return trimmed;
}

// ─── Session length normalization ─────────────────────────────────────────────

function parseSessionLength(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  const str = String(raw).trim();
  // "45 minutes", "30 minutes", "45", "0.75" (hours), "0:45" (HH:MM)
  const minuteMatch = str.match(/^(\d+)\s*min/i);
  if (minuteMatch) return parseInt(minuteMatch[1]);

  const decimalMatch = str.match(/^(0?\.\d+)$/);
  if (decimalMatch) return Math.round(parseFloat(decimalMatch[1]) * 60);

  const colonMatch = str.match(/^(\d+):(\d{2})$/);
  if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);

  const numOnly = str.match(/^(\d+)$/);
  if (numOnly) {
    const n = parseInt(numOnly[1]);
    // If it looks like a whole-hour value (≤ 8), convert to minutes
    return n <= 8 ? n * 60 : n;
  }

  return 0;
}

// ─── Day number extraction from date cell ─────────────────────────────────────

function extractDayNumbers(raw: unknown): string[] {
  if (raw === null || raw === undefined || raw === '') return [];

  // Excel serial date → convert to actual date
  if (typeof raw === 'number') {
    const date = XLSX.SSF.parse_date_code(raw);
    return date ? [String(date.d)] : [];
  }

  const str = String(raw);

  // Extract all 1-2 digit numbers that could be day-of-month
  const allNums = str.match(/\b(\d{1,2})\b/g) ?? [];
  const days = allNums
    .map((n) => parseInt(n))
    .filter((n) => n >= 1 && n <= 31)
    .map(String);

  // Deduplicate and sort ascending
  return [...new Set(days)].sort((a, b) => parseInt(a) - parseInt(b));
}

// ─── Practitioner name extraction ─────────────────────────────────────────────

function extractPractitionerName(rows: unknown[][], fileName: string): string {
  // Row 0 typically contains the practitioner's name in column 0
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const cell = rows[r]?.[0];
    if (typeof cell === 'string' && cell.trim().length > 2 && /[A-Z]/.test(cell)) {
      const candidate = cell.split('\n')[0].trim();
      // Must look like a name (2+ words, no URL/address markers)
      if (/^[A-Z][a-zA-Z\-]+(?: [A-Z][a-zA-Z\-]+)+$/.test(candidate)) {
        return candidate;
      }
    }
  }

  // Fall back to file name — strip extensions and common suffixes
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/(Invoice|York|Region|Office|Consulting|March|April|May|June|July|August|Sept|Oct|Nov|Dec|\d{4})/gi, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parsePractitionerInvoice(buffer: Buffer, fileName: string): ParseResult {
  const warnings: string[] = [];
  const sessions: IParsedSession[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  } catch {
    return {
      practitionerName: fileName,
      parsedSessions: [],
      parseWarnings: [`Could not open file: ${fileName}`],
    };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  const practitionerName = extractPractitionerName(rows, fileName);

  // ─── Find header row ────────────────────────────────────────────────────────
  // Look for a row containing "Student" or "Client" in the first few columns.
  // Build plan says header is at row ~11; scan rows 8-15 to be safe.

  let headerRowIdx = -1;
  const HEADER_KEYWORDS = ['student', 'client', 'date', 'duration', 'length', 'session'];

  for (let r = 8; r < Math.min(18, rows.length); r++) {
    const row = rows[r] as unknown[];
    const rowText = row
      .filter((c): c is string => typeof c === 'string')
      .map((c) => c.toLowerCase())
      .join(' ');
    if (HEADER_KEYWORDS.some((kw) => rowText.includes(kw))) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx === -1) {
    warnings.push('Could not find header row — no data parsed');
    return { practitionerName, parsedSessions: [], parseWarnings: warnings };
  }

  const headerRow = rows[headerRowIdx] as unknown[];

  // ─── Map column indices ─────────────────────────────────────────────────────

  let colStudent = 0;
  let colService = 3;
  let colDates = 4;
  let colLength = 5;
  let colNonBillable = 6;

  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? '').toLowerCase();
    if (/student|client name/.test(h)) colStudent = c;
    else if (/service|description/.test(h)) colService = c;
    else if (/make.?up/.test(h)) colNonBillable = c;
    else if (/billable.+date|session.+date|meeting.+date|regular.+date/.test(h)) colDates = c;
    else if (/length|duration/.test(h)) colLength = c;
  }

  // ─── Parse data rows ────────────────────────────────────────────────────────

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];

    // Skip empty rows
    const rawStudent = row[colStudent];
    if (rawStudent === null || rawStudent === undefined || String(rawStudent).trim() === '') {
      continue;
    }

    const clientName = normalizeClientName(String(rawStudent));
    const serviceRaw = String(row[colService] ?? '');
    const datesRaw = row[colDates];
    const lengthRaw = row[colLength];
    const nonBillableNote = String(row[colNonBillable] ?? '').trim();

    const sessionLength = parseSessionLength(lengthRaw);
    const dayNumbers = extractDayNumbers(datesRaw);

    // Determine if this row is a non-billable service type
    const isNonBillable = isNonBillableService(serviceRaw);

    if (isNonBillable) {
      // Still parse non-billable supervision/progress rows as non-billable sessions
      if (dayNumbers.length > 0) {
        for (const day of dayNumbers) {
          sessions.push({
            clientName,
            sessionDate: day,
            sessionLength: sessionLength || 60,
            billable: false,
            notes: serviceRaw,
          });
        }
      }
      continue;
    }

    // Check for non-billable makeup note in the non-billable column
    if (nonBillableNote && (datesRaw === null || dayNumbers.length === 0)) {
      // Row represents non-billable makeups — skip for billable count
      sessions.push({
        clientName,
        sessionDate: '0',
        sessionLength: 0,
        billable: false,
        notes: `Non-billable: ${nonBillableNote}`,
      });
      continue;
    }

    if (dayNumbers.length === 0) {
      if (datesRaw !== null && datesRaw !== undefined) {
        warnings.push(
          `Row ${r + 1} (${clientName}): Could not extract session dates from "${String(datesRaw).slice(0, 50)}"`,
        );
      }
      continue;
    }

    if (sessionLength === 0) {
      warnings.push(
        `Row ${r + 1} (${clientName}): Could not parse session length from "${String(lengthRaw)}"`,
      );
    }

    // One parsedSession per date
    for (const day of dayNumbers) {
      sessions.push({
        clientName,
        sessionDate: day,
        sessionLength,
        billable: true,
        notes: nonBillableNote ? `Non-billable makeup: ${nonBillableNote}` : '',
      });
    }
  }

  return {
    practitionerName,
    parsedSessions: sessions,
    parseWarnings: warnings,
  };
}

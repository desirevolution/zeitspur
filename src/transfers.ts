import type { CategorySuggestion, Session, Snapshot, Theme, LanguagePreference } from './types.js';
import { isCategoryList } from './categories.js';
import { dayBounds, intersectsRecordedSession, pauseMilliseconds } from './records.js';
import { dateKey, workingMilliseconds } from './time.js';

export interface BackupV2 { format: 'zeitspur-backup'; version: 2; exportedAt: string; sessions: Session[]; theme: Theme; categories: CategorySuggestion[]; language?: LanguagePreference; }

export function createBackup(state: Snapshot, now = Date.now()): BackupV2 {
  // A running timer is captured at export time; restore deliberately freezes it.
  return { format: 'zeitspur-backup', version: 2, exportedAt: new Date(now).toISOString(),
    sessions: structuredClone(state.sessions), theme: state.theme, categories: structuredClone(state.categories), language: state.language ?? 'auto' };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function finiteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
}
const VALID_STATES = ['running', 'paused', 'pending', 'completed'];

function verifySession(raw: unknown, exportedAt: number): Session {
  if (!isObject(raw)) throw new Error('Ungültiger Eintrag im Backup.');
  const { id, status, startedAt, stoppedAt, segments, category, description, createdAt, updatedAt, revision } = raw;
  if (typeof id !== 'string' || id.length < 1 || id.length > 128 || !VALID_STATES.includes(String(status)) ||
    !finiteTimestamp(startedAt) || !Array.isArray(segments) || segments.length > 10000 ||
    !finiteTimestamp(createdAt) || !finiteTimestamp(updatedAt) || !Number.isSafeInteger(revision) || (revision as number) < 1 ||
    (category !== null && (typeof category !== 'string' || category.length > 90)) ||
    (description !== null && (typeof description !== 'string' || description.length > 2000))) {
    throw new Error('Ein Backup-Eintrag enthält ungültige Felder.');
  }
  const active = status === 'running' || status === 'paused';
  const endTime = active ? Math.max(startedAt, exportedAt) : stoppedAt;
  if (!finiteTimestamp(endTime) || endTime < startedAt || (active && stoppedAt !== null) || (!active && stoppedAt === null)) {
    throw new Error('Ungültiger Stop-Zeitpunkt im Backup.');
  }
  let lastEnd = startedAt;
  const safeSegments = segments.map((part: unknown, idx: number) => {
    if (!isObject(part) || !finiteTimestamp(part.start) || part.start < lastEnd || part.start < startedAt || part.start > endTime) {
      throw new Error('Arbeitsintervalle im Backup sind ungültig.');
    }
    const partEnd = part.end === null && active && status === 'running' && idx === segments.length - 1 ? exportedAt : part.end;
    if (!finiteTimestamp(partEnd) || partEnd < part.start || partEnd > endTime) throw new Error('Arbeitsintervalle im Backup sind ungültig.');
    lastEnd = partEnd;
    return { start: part.start, end: partEnd };
  });
  if (active && (!safeSegments.length || (status === 'running' && segments.at(-1)?.end !== null) ||
      (status === 'paused' && segments.some((part: unknown) => isObject(part) && part.end === null)))) {
    throw new Error('Aktiver Eintrag im Backup hat ungültige Intervalle.');
  }
  if (!active && segments.some((part: unknown) => isObject(part) && part.end === null)) throw new Error('Offene Arbeitsintervalle im Backup.');
  if (!safeSegments.length && endTime > startedAt) throw new Error('Arbeitsintervalle fehlen im Backup.');
  const fieldsDone = typeof category === 'string' && category.trim() && typeof description === 'string' && description.trim();
  if (status === 'completed' && !fieldsDone) throw new Error('Abgeschlossener Eintrag ohne Pflichtfelder im Backup.');
  return { id, status: active ? 'pending' : status as Session['status'], startedAt, stoppedAt: endTime,
    segments: safeSegments, category: category as string | null, description: description as string | null,
    createdAt, updatedAt, revision: revision as number };
}

export function parseBackup(data: unknown): { sessions: Session[]; theme: Theme; categories: CategorySuggestion[]; language: LanguagePreference } {
  if (!isObject(data) || data.format !== 'zeitspur-backup' || data.version !== 2 ||
    typeof data.exportedAt !== 'string' || !Number.isFinite(Date.parse(data.exportedAt)) ||
    !Array.isArray(data.sessions) || data.sessions.length > 100000 || !['system', 'light', 'dark'].includes(String(data.theme))) {
    throw new Error('Datei ist kein unterstütztes Zeitspur-Backup (Version 2).');
  }
  const at = Date.parse(data.exportedAt);
  const sessions = data.sessions.map((item) => verifySession(item, at));
  const seen = new Set<string>();
  for (const session of sessions) {
    if (seen.has(session.id)) throw new Error('Doppelte Eintrags-ID im Backup.');
    seen.add(session.id);
  }
  if (!isCategoryList(data.categories)) {
    throw new Error('Ungültige gespeicherte Kategorien im Backup.');
  }
  const language = data.language === undefined ? 'auto' : data.language;
  if (!['auto', 'de', 'en'].includes(String(language))) throw new Error('Ungültige Sprache im Backup.');
  return { sessions, theme: data.theme as Theme, categories: data.categories, language: language as LanguagePreference };
}

function csvCell(value: string): string {
  // Protect spreadsheet applications against formulas when opening exported files.
  const protectedValue = /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
  return '"' + protectedValue.replace(/"/g, '""') + '"';
}
/** Format a CSV timestamp as local wall-clock date/time without a time-zone suffix.
 * A space between date and time improves import into Excel and Google Sheets.
 * Seconds are retained, milliseconds are omitted. Around DST transitions,
 * different instants can have the same wall-clock value; JSON backups retain
 * precise absolute epoch timestamps for lossless restoration.
 */
export function formatLocalCsvTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Round nonnegative durations to full minutes; at exactly 30 seconds, round up. */
export function roundDurationMinutes(milliseconds: number): number {
  return Math.round(milliseconds / 60_000);
}

/** The CSV file contains completed or pending (stopped) entries only. */
function isCsvExportable(session: Session): session is Session & { stoppedAt: number } {
  return session.status !== 'running' && session.status !== 'paused' && session.stoppedAt !== null;
}

/**
 * Preserve the selected CSV date range in the filename. For an unfiltered
 * full-history export, derive its actual span from the exported records,
 * rather than using only the current download date.
 *
 * A filtered CSV includes whole entries overlapping the selected range;
 * therefore its filename denotes the FILTER, not necessarily every row's
 * exact starting/ending date.
 */
export function csvFileName(sessions: Session[], from?: string, to?: string, now = Date.now()): string {
  if (from && to && from > to) throw new Error('Das Enddatum muss nach dem Startdatum liegen.');
  if (from || to) return `zeitspur-${from ?? 'start'}-to-${to ?? 'today'}.csv`;

  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  for (const session of sessions) {
    if (!isCsvExportable(session)) continue;
    earliest = Math.min(earliest, session.startedAt);
    latest = Math.max(latest, session.stoppedAt);
  }
  if (earliest === Number.POSITIVE_INFINITY) return `zeitspur-all-empty-${dateKey(now)}.csv`;
  return `zeitspur-all-${dateKey(earliest)}-to-${dateKey(latest)}.csv`;
}

export function createCsv(sessions: Session[], from?: string, to?: string): string {
  if (from && to && from > to) throw new Error('Das Enddatum muss nach dem Startdatum liegen.');
  const begin = from ? dayBounds(from).start : Number.NEGATIVE_INFINITY;
  const end = to ? dayBounds(to).end : Number.POSITIVE_INFINITY;
  const rows = [['id', 'started_at', 'stopped_at', 'category', 'description', 'status', 'paused_minutes', 'worked_minutes']];
  for (const session of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    if (!isCsvExportable(session)) continue;
    if (begin !== Number.NEGATIVE_INFINITY || end !== Number.POSITIVE_INFINITY) {
      if (!intersectsRecordedSession(session, begin, end)) continue;
    }
    rows.push([
      session.id, formatLocalCsvTimestamp(session.startedAt), formatLocalCsvTimestamp(session.stoppedAt),
      session.category ?? '', session.description ?? '', session.status,
      String(roundDurationMinutes(pauseMilliseconds(session))), String(roundDurationMinutes(workingMilliseconds(session))),
    ]);
  }
  return '\uFEFF' + rows.map((cells) => cells.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

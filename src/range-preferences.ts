import type { CsvPreset } from './time.js';

export type RangeContext = 'export' | 'delete';

export interface RangePreference {
  preset: CsvPreset;
  from: string;
  to: string;
}

/** These are UI-only choices, intentionally excluded from JSON backups. */
const PREFIX = 'zeitspur-range-choice-v1-';
const PRESETS: ReadonlyArray<CsvPreset> = ['all', 'week', 'last-week', 'month', 'last-month', 'custom'];
const DEFAULT: RangePreference = { preset: 'all', from: '', to: '' };

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Browser privacy policies may prohibit localStorage; the UI still works.
    return null;
  }
}

function safeDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return '';
  const [year, month, day] = value.split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day ? value : '';
}

/** Reads the last selection for this origin + browser profile only. */
export function loadRangePreference(context: RangeContext, storage: KeyValueStorage | null = browserStorage()): RangePreference {
  try {
    const raw = storage?.getItem(`${PREFIX}${context}`);
    if (!raw) return { ...DEFAULT };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || !parsed || Array.isArray(parsed)) return { ...DEFAULT };
    const value = parsed as Record<string, unknown>;
    return {
      preset: PRESETS.includes(value.preset as CsvPreset) ? value.preset as CsvPreset : 'all',
      from: safeDate(value.from),
      to: safeDate(value.to),
    };
  } catch {
    return { ...DEFAULT };
  }
}

/** Saves export and deletion independently; does not affect the time-entry database. */
export function saveRangePreference(context: RangeContext, value: RangePreference, storage: KeyValueStorage | null = browserStorage()): void {
  try {
    if (storage) storage.setItem(`${PREFIX}${context}`, JSON.stringify({
      preset: PRESETS.includes(value.preset) ? value.preset : 'all',
      from: safeDate(value.from),
      to: safeDate(value.to),
    }));
  } catch {
    // Quota/security errors must not block exporting or deleting records.
  }
}

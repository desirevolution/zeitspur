/** Clock-only pause editing. Calendar dates are chosen separately only for multi-day entries. */
export interface PausePeriod { start: number; end: number }
export interface PauseInputPoint { date: string; time: string; original: number }

export function localPauseDate(value: number): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function localPauseTime(value: number): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Keep original seconds and the exact DST fold when a previously stored clock is unchanged. */
export function parsePausePoint({ date, time, original }: PauseInputPoint): number {
  if (Number.isFinite(original) && date === localPauseDate(original) && time === localPauseTime(original)) return original;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Ungültige Pausenzeit.');
  }
  const parsed = new Date(`${date}T${time}:00`).getTime();
  // Date silently changes nonexistent times at the start of daylight saving time.
  if (!Number.isFinite(parsed) || localPauseDate(parsed) !== date || localPauseTime(parsed) !== time) {
    throw new Error('Diese Uhrzeit existiert an diesem Datum nicht.');
  }
  return parsed;
}

/** Inclusive dates in an interval, or [] when a compact dropdown would be unwieldy. */
export function pauseDayOptions(start: number, end: number, limit = 31): string[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const days: string[] = [];
  const d = new Date(start);
  d.setHours(12, 0, 0, 0);
  const last = localPauseDate(end);
  while (days.length <= limit) {
    const key = localPauseDate(d.getTime());
    days.push(key);
    if (key === last) return days;
    d.setDate(d.getDate() + 1);
  }
  return [];
}

/** Prefill a 15-minute pause inside the largest available work gap. Never overlap a break. */
export function suggestPause(start: number, end: number, existing: PausePeriod[]): PausePeriod | null {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const ordered = [...existing].filter(p => Number.isFinite(p.start) && Number.isFinite(p.end) && p.start < p.end)
    .sort((a, b) => a.start - b.start);
  const gaps: PausePeriod[] = [];
  let cursor = start;
  for (const pause of ordered) {
    if (pause.start > cursor) gaps.push({ start: cursor, end: Math.min(pause.start, end) });
    cursor = Math.max(cursor, pause.end);
  }
  if (cursor < end) gaps.push({ start: cursor, end });
  const minute = 60_000;
  const aligned = gaps.map(g => ({ start: Math.ceil(g.start / minute) * minute, end: Math.floor(g.end / minute) * minute }))
    .filter(g => g.end - g.start >= minute).sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const largest = aligned[0];
  if (!largest) return null;
  const duration = Math.min(15 * minute, largest.end - largest.start);
  const from = Math.floor(((largest.start + largest.end - duration) / 2) / minute) * minute;
  return { start: from, end: from + duration };
}

/** One error per row, in visual order; the persistence layer validates again on save. */
export function validatePausePeriods(start: number, end: number, pauses: PausePeriod[]): (string | null)[] {
  const errors: (string | null)[] = pauses.map(p => {
    if (!Number.isFinite(p.start) || !Number.isFinite(p.end)) return 'Ungültige Pausenzeit.';
    if (p.end <= p.start) return 'Das Pausenende muss nach dem Pausenbeginn liegen.';
    if (p.start < start || p.end > end) return 'Pause liegt außerhalb der Erfassung.';
    return null;
  });
  const ordered = pauses.map((p, i) => ({ ...p, i })).sort((a, b) => a.start - b.start);
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].start < ordered[i - 1].end) {
      if (!errors[ordered[i].i]) errors[ordered[i].i] = 'Pausen dürfen sich nicht überschneiden.';
      if (!errors[ordered[i - 1].i]) errors[ordered[i - 1].i] = 'Pausen dürfen sich nicht überschneiden.';
    }
  }
  return errors;
}

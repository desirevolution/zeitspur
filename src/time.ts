import type { DayGroup, Session } from './types.js';
import { intlLocale, tr } from './i18n.js';

export function workingMilliseconds(session: Session, now: number = Date.now()): number {
  return session.segments.reduce((sum, segment) => sum + Math.max(0, (segment.end ?? now) - segment.start), 0);
}

export function formatClock(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.round(Math.max(0, milliseconds) / 60000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} h ${String(remainder).padStart(2, '0')} min` : `${remainder} min`;
}

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

export function dateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function nextLocalMidnight(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

// Split actual worked intervals by calendar day: pauses don't count, DST is handled
// by constructing each *local* midnight rather than adding 24 hours.
export function groupSessionsByDay(sessions: Session[], now: number = Date.now()): DayGroup[] {
  const days = new Map<string, DayGroup>();
  const add = (key: string, session: Session, milliseconds: number) => {
    let day = days.get(key);
    if (!day) {
      day = { key, durationMs: 0, entries: [] };
      days.set(key, day);
    }
    day.durationMs += milliseconds;
    const entry = day.entries.find((item) => item.session.id === session.id);
    if (entry) entry.dayMs += milliseconds;
    else day.entries.push({ session, dayMs: milliseconds });
  };

  for (const session of sessions) {
    if (session.status === 'running' || session.status === 'paused') continue;
    let accountedFor = false;
    for (const segment of session.segments) {
      const end = segment.end ?? now;
      let current = segment.start;
      while (current < end) {
        const boundary = nextLocalMidnight(current);
        const pieceEnd = Math.min(boundary, end);
        if (pieceEnd <= current) break;
        add(dateKey(current), session, pieceEnd - current);
        current = pieceEnd;
        accountedFor = true;
      }
    }
    if (!accountedFor) add(dateKey(session.startedAt), session, 0);
  }

  return [...days.values()].sort((a, b) => b.key.localeCompare(a.key)).map((day) => ({
    ...day,
    entries: day.entries.sort((a, b) => b.session.startedAt - a.session.startedAt),
  }));
}

export function formatDayLabel(key: string): string {
  if (key === dateKey(Date.now())) return tr('Heute');
  const [year, month, day] = key.split('-').map(Number);
  const value = new Date(year, month - 1, day);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dateKey(yesterday.getTime())) return tr('Gestern');
  return new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(value);
}

/** ISO-style local weeks start on Monday. Use calendar dates, not fixed hours, across DST. */
export function localWeekBounds(timestamp: number): { start: number; end: number; startKey: string; endKey: string } {
  const date = new Date(timestamp);
  const dow = (date.getDay() + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dow);
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: monday.getTime(), end: nextMonday.getTime(), startKey: dateKey(monday.getTime()), endKey: dateKey(sunday.getTime()) };
}
export function localMonthBounds(timestamp: number): { startKey: string; endKey: string } {
  const date = new Date(timestamp);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { startKey: dateKey(first.getTime()), endKey: dateKey(last.getTime()) };
}
export type CsvPreset = 'all' | 'week' | 'last-week' | 'month' | 'last-month' | 'custom';
export function presetRange(preset: CsvPreset, now: number = Date.now()): { from?: string; to?: string } {
  if (preset === 'week' || preset === 'last-week') {
    const current = localWeekBounds(now);
    const target = preset === 'week' ? current : localWeekBounds(new Date(current.start - 1).getTime());
    return { from: target.startKey, to: target.endKey };
  }
  if (preset === 'month' || preset === 'last-month') {
    const target = new Date(now);
    if (preset === 'last-month') target.setMonth(target.getMonth() - 1, 1);
    const bounds = localMonthBounds(target.getTime());
    return { from: bounds.startKey, to: bounds.endKey };
  }
  return {};
}

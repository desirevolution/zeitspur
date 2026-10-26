import type { Session, WorkSegment } from './types.js';
import { dateKey, workingMilliseconds } from './time.js';

export interface PausePeriod { start: number; end: number }
export interface EditValues { startedAt: number; stoppedAt: number; pauses: PausePeriod[]; category: string; description: string }

export function getPauses(session: Session): PausePeriod[] {
  const sorted = [...session.segments].sort((a, b) => a.start - b.start);
  const pauses: PausePeriod[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const previousEnd = sorted[i - 1].end;
    if (previousEnd !== null && previousEnd < sorted[i].start) pauses.push({ start: previousEnd, end: sorted[i].start });
  }
  // If stop occurred during a pause, the last gap is also time paused.
  const last = sorted.at(-1);
  if (last?.end !== null && last?.end !== undefined && session.stoppedAt !== null && last.end < session.stoppedAt) {
    pauses.push({ start: last.end, end: session.stoppedAt });
  }
  return pauses;
}

export function normalizeCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').normalize('NFC');
}

export function buildEditedSession(session: Session, values: EditValues, now = Date.now()): Session {
  if (session.status !== 'pending' && session.status !== 'completed') throw new Error('Aktive Timer können nicht nachträglich bearbeitet werden.');
  const { startedAt, stoppedAt } = values;
  if (![startedAt, stoppedAt].every((n) => Number.isSafeInteger(n)) || stoppedAt < startedAt) {
    throw new Error('Ende muss nach dem Beginn liegen.');
  }
  const pauses = [...values.pauses].sort((a, b) => a.start - b.start);
  let cursor = startedAt;
  const segments: WorkSegment[] = [];
  for (const pause of pauses) {
    if (!Number.isSafeInteger(pause.start) || !Number.isSafeInteger(pause.end) || pause.start < cursor || pause.end <= pause.start || pause.end > stoppedAt) {
      throw new Error('Pausen dürfen sich nicht überschneiden und müssen innerhalb der Erfassung liegen.');
    }
    if (cursor < pause.start) segments.push({ start: cursor, end: pause.start });
    cursor = pause.end;
  }
  if (cursor < stoppedAt) segments.push({ start: cursor, end: stoppedAt });
  if (!segments.length && startedAt === stoppedAt && !pauses.length) segments.push({ start: startedAt, end: stoppedAt });
  if (!segments.length) throw new Error('Die gesamte Zeit kann nicht aus Pausen bestehen.');
  const category = normalizeCategory(values.category);
  const description = values.description.trim();
  // Only a completed entry requires both fields. Clearing either makes it pending.
  return {
    ...session, startedAt, stoppedAt, segments,
    category: category || null, description: description || null,
    status: category && description ? 'completed' : 'pending',
    updatedAt: now, revision: session.revision + 1,
  };
}

function localDayBounds(key: string): { start: number; end: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Ungültiges Tagesdatum.');
  const [y, m, d] = key.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  if (dateKey(start) !== key) throw new Error('Ungültiges Tagesdatum.');
  return { start, end: new Date(y, m - 1, d + 1).getTime() };
}

export function dayBounds(key: string): { start: number; end: number } {
  return localDayBounds(key);
}

/** Subtract a local day from worked segments, preserving surviving intervals.
 * Split into two sessions when work exists on both sides of the erased day. */
export function cutDayFromSession(session: Session, day: string, now = Date.now()): Session[] {
  const { start, end } = localDayBounds(day);
  return cutRangeFromSession(session, start, end, now);
}

/** Cut an arbitrary [start,end) interval from a stopped entry, preserving work on either side. */
export function cutRangeFromSession(session: Session, start: number, end: number, now = Date.now()): Session[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Ungültiger Löschzeitraum.');
  if (session.status === 'running' || session.status === 'paused') throw new Error('Aktive Einträge können nicht gelöscht werden.');
  const before: WorkSegment[] = [];
  const after: WorkSegment[] = [];
  for (const segment of session.segments) {
    if (segment.end === null) throw new Error('Unerwartetes offenes Zeitintervall.');
    if (segment.start < start) {
      const segmentEnd = Math.min(segment.end, start);
      if (segment.start < segmentEnd) before.push({ start: segment.start, end: segmentEnd });
    }
    if (segment.end > end) {
      const segmentStart = Math.max(segment.start, end);
      if (segmentStart < segment.end) after.push({ start: segmentStart, end: segment.end });
    }
  }
  const make = (segments: WorkSegment[], id: string): Session => ({
    ...session, id, segments,
    startedAt: segments[0].start,
    stoppedAt: segments[segments.length - 1].end,
    updatedAt: now, revision: session.revision + 1,
  });
  const out: Session[] = [];
  if (before.length) out.push(make(before, session.id));
  if (after.length) out.push(make(after, before.length ? crypto.randomUUID() : session.id));
  return out;
}

export function intersectsWork(session: Session, begin: number, end: number, now = Date.now()): boolean {
  return session.segments.some((s) => s.start < end && (s.end ?? now) > begin);
}

/** Includes a zero-length entry on its start date (e.g. a timer stopped immediately). */
export function intersectsRecordedSession(session: Session, begin: number, end: number, now = Date.now()): boolean {
  return intersectsWork(session, begin, end, now) ||
    (workingMilliseconds(session, now) === 0 && session.startedAt >= begin && session.startedAt < end);
}

export function pauseMilliseconds(session: Session): number {
  const stopped = session.stoppedAt;
  return stopped === null ? 0 : Math.max(0, stopped - session.startedAt - workingMilliseconds(session));
}

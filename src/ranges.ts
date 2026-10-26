import type { Session } from './types.js';
import { dayBounds, intersectsRecordedSession } from './records.js';
import { presetRange } from './time.js';
import type { CsvPreset } from './time.js';

export interface SelectedRange {
  from?: string;
  to?: string;
  start: number;
  end: number;
}

/** A custom range must specify both calendar dates; deletion must never silently become 'all'. */
export function selectedRange(preset: CsvPreset, customFrom = '', customTo = '', now = Date.now()): SelectedRange {
  let from: string | undefined;
  let to: string | undefined;
  if (preset === 'custom') {
    if (!customFrom || !customTo) throw new Error('Bitte Beginn und Ende des Zeitraums wählen.');
    from = customFrom;
    to = customTo;
  } else {
    ({ from, to } = presetRange(preset, now));
  }
  if (from && to && from > to) throw new Error('Das Enddatum muss nach dem Startdatum liegen.');
  return {
    from, to,
    start: from ? dayBounds(from).start : Number.NEGATIVE_INFINITY,
    end: to ? dayBounds(to).end : Number.POSITIVE_INFINITY,
  };
}

/** Counts original records and the *net* work actually within the selected dates. */
export function deletionImpact(sessions: Session[], range: SelectedRange): { count: number; durationMs: number } {
  let count = 0;
  let durationMs = 0;
  for (const session of sessions) {
    if (session.status === 'running' || session.status === 'paused') continue;
    if (!intersectsRecordedSession(session, range.start, range.end)) continue;
    count++;
    for (const segment of session.segments) {
      const overlapStart = Math.max(range.start, segment.start);
      const overlapEnd = Math.min(range.end, segment.end ?? Date.now());
      if (overlapEnd > overlapStart) durationMs += overlapEnd - overlapStart;
    }
  }
  return { count, durationMs };
}

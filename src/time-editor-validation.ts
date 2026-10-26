/** Validation and picker boundaries for editable work and break intervals. */
export function validateEntryOrder(start: number, end: number): string | null {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Ungültiges Datum oder Uhrzeit.';
  // Zero-length tracked entries are supported when a timer is stopped immediately.
  return start > end ? 'Der Beginn darf nicht nach dem Ende liegen.' : null;
}

function timeOffset(time: string, minutes: number): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return '';
  const [hours, mins] = time.split(':').map(Number);
  const next = hours * 60 + mins + minutes;
  if (next < 0 || next >= 1440) return '';
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

/** Empty means no possible clock in the requested direction on this calendar day. */
export function timeOneMinuteBefore(time: string): string { return timeOffset(time, -1); }
export function timeOneMinuteAfter(time: string): string { return timeOffset(time, 1); }

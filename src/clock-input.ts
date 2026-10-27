/** Shared minute-precision input helpers; never alter a field while its user is typing. */
export function normalizeClock(value: string): string | null {
  const raw = value.trim();
  let hours: number;
  let minutes: number;
  if (/^\d{1,2}:\d{1,2}$/.test(raw)) {
    [hours, minutes] = raw.split(':').map(Number);
  } else if (/^\d{1,4}$/.test(raw)) {
    if (raw.length < 3) { hours = Number(raw); minutes = 0; }
    else { hours = Number(raw.slice(0, -2)); minutes = Number(raw.slice(-2)); }
  } else return null;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function shiftClock(value: string, deltaMinutes: number): string | null {
  const clock = normalizeClock(value);
  if (!clock) return null;
  const [hours, minutes] = clock.split(':').map(Number);
  const next = hours * 60 + minutes + deltaMinutes;
  if (next < 0 || next >= 24 * 60) return null;
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

export function addCalendarDay(value: string): string {
  const match = /^(\d{4})-(\d\d)-(\d\d)$/.exec(value);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1, 12);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dayChoice(startDate: string, endDate: string): 'same' | 'next' | 'other' {
  if (endDate === startDate) return 'same';
  if (endDate === addCalendarDay(startDate)) return 'next';
  return 'other';
}

export function durationMinutes(start: number, end: number): number {
  return Math.round((end - start) / 60_000);
}

export function durationValue(input: string): number | null {
  const cleaned = input.trim();
  if (!/^\d{1,7}$/.test(cleaned)) return null;
  const minutes = Number(cleaned);
  return Number.isSafeInteger(minutes) && minutes <= 525600 ? minutes : null;
}

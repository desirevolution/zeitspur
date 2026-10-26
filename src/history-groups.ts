import type { DayGroup } from './types.js';
import { dateKey, localWeekBounds } from './time.js';

export interface HistoryWeek {
  key: string;
  start: number;
  end: number;
  endKey: string;
  days: DayGroup[];
  durationMs: number;
  monthKey: string;
}

export interface HistoryMonth {
  key: string;
  weeks: HistoryWeek[];
  durationMs: number;
}

export interface HistorySections {
  currentWeekKey: string;
  lastWeekKey: string;
  recentWeeks: HistoryWeek[];
  currentMonthWeeks: HistoryWeek[];
  archivedMonths: HistoryMonth[];
}

/**
 * One complete Monday–Sunday week is assigned to the month of its Thursday.
 * This avoids splitting or duplicating a week in the history accordion.
 * Monthly values here are sums of the *assigned weeks*, not calendar-month totals.
 */
export function historyWeekMonthKey(weekStart: number): string {
  const monday = new Date(weekStart);
  const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3, 12);
  return dateKey(thursday.getTime()).slice(0, 7);
}

export function buildHistorySections(days: DayGroup[], now: number = Date.now()): HistorySections {
  const currentBounds = localWeekBounds(now);
  const lastWeekKey = localWeekBounds(currentBounds.start - 1).startKey;
  const currentMonthKey = dateKey(now).slice(0, 7);
  const indexed = new Map<string, HistoryWeek>();
  for (const day of days) {
    // Noon is always well away from a DST midnight transition.
    const [year, month, date] = day.key.split('-').map(Number);
    const week = localWeekBounds(new Date(year, month - 1, date, 12).getTime());
    let group = indexed.get(week.startKey);
    if (!group) {
      group = {
        key: week.startKey, start: week.start, end: week.end, endKey: week.endKey,
        days: [], durationMs: 0, monthKey: historyWeekMonthKey(week.start),
      };
      indexed.set(week.startKey, group);
    }
    group.days.push(day);
    group.durationMs += day.durationMs;
  }
  const weeks = [...indexed.values()].sort((a, b) => b.key.localeCompare(a.key));
  const recentWeeks: HistoryWeek[] = [];
  const currentMonthWeeks: HistoryWeek[] = [];
  const months = new Map<string, HistoryMonth>();
  for (const week of weeks) {
    if (week.key === currentBounds.startKey || week.key === lastWeekKey) {
      recentWeeks.push(week);
    } else if (week.monthKey === currentMonthKey) {
      currentMonthWeeks.push(week);
    } else {
      let month = months.get(week.monthKey);
      if (!month) {
        month = { key: week.monthKey, weeks: [], durationMs: 0 };
        months.set(week.monthKey, month);
      }
      month.weeks.push(week);
      month.durationMs += week.durationMs;
    }
  }
  return {
    currentWeekKey: currentBounds.startKey,
    lastWeekKey,
    recentWeeks,
    currentMonthWeeks,
    archivedMonths: [...months.values()].sort((a, b) => b.key.localeCompare(a.key)),
  };
}

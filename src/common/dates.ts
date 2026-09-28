/**
 * Calendar days as `YYYY-MM-DD` strings, in the server's time zone. A due
 * date is a day, not an instant, so there is no time zone to get wrong once
 * it's stored. `today()` is the one place that asks the clock.
 */
export type Day = string;

const pad = (n: number) => String(n).padStart(2, '0');

export const toDay = (date: Date): Day =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const fromDay = (day: Day): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const today = (now = new Date()): Day => toDay(now);

export function addDays(day: Day, days: number): Day {
  const date = fromDay(day);
  date.setDate(date.getDate() + days);
  return toDay(date);
}

export function addMonths(day: Day, months: number): Day {
  const date = fromDay(day);
  const wanted = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  // Jan 31 plus a month is the last day of February, not March 3.
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(wanted, last));
  return toDay(date);
}

/** 0 for Sunday, as `Date#getDay()`. */
export const weekday = (day: Day) => fromDay(day).getDay();

/** Whole days from `a` to `b`. */
export const daysBetween = (a: Day, b: Day) =>
  Math.round((fromDay(b).getTime() - fromDay(a).getTime()) / 86_400_000);

/** The next day after `from` (or `from` itself) that falls on `weekday`. */
export function nextWeekday(from: Day, day: number, includeFrom = false): Day {
  const offset = (day - weekday(from) + 7) % 7;
  return addDays(from, offset === 0 && !includeFrom ? 7 : offset);
}

export const isDay = (value: unknown): value is Day =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  toDay(fromDay(value)) === value;

import {
  type Day,
  addDays,
  addMonths,
  nextWeekday,
  weekday,
} from '../common/dates.js';

/**
 * Recurring tasks, the Todoist way: "every day", "every monday", "every 3
 * days". Completing one doesn't complete it, it moves it to the next date.
 */
export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const RULE =
  /^every\s+(?:(other)\s+)?(?:(\d+)\s+)?(day|days|weekday|workday|week|weeks|month|months|year|years|sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)$/i;

interface Rule {
  unit: 'day' | 'weekday' | 'week' | 'month' | 'year' | 'on';
  every: number;
  /** For `on`: which day of the week. */
  day?: number;
}

function parse(rule: string): Rule | null {
  const match = RULE.exec(rule.trim().replace(/\s+/g, ' '));
  if (!match) return null;
  const [, other, count, word] = match;
  const every = other ? 2 : count ? Number(count) : 1;
  if (every < 1 || every > 365) return null;
  const unit = word.toLowerCase().replace(/s$/, '');
  if (unit === 'workday' || unit === 'weekday')
    return { unit: 'weekday', every: 1 };
  if (['day', 'week', 'month', 'year'].includes(unit))
    return { unit: unit as Rule['unit'], every };
  const day = WEEKDAYS.findIndex((name) => name.startsWith(unit.slice(0, 3)));
  return { unit: 'on', every: 1, day };
}

export const isRecurrence = (rule: string) => parse(rule) !== null;

/** The normal spelling, as shown on the task: "every Monday", "every 3 days". */
export function describeRecurrence(rule: string): string {
  const parsed = parse(rule);
  if (!parsed) return rule;
  if (parsed.unit === 'on') {
    const name = WEEKDAYS[parsed.day!];
    return `every ${name[0].toUpperCase()}${name.slice(1)}`;
  }
  if (parsed.unit === 'weekday') return 'every weekday';
  return parsed.every === 1
    ? `every ${parsed.unit}`
    : `every ${parsed.every} ${parsed.unit}s`;
}

/** The first date on or after `from` the rule lands on, for a new recurring task. */
export function firstOccurrence(rule: string, from: Day): Day {
  const parsed = parse(rule);
  if (parsed?.unit === 'on') return nextWeekday(from, parsed.day!, true);
  if (parsed?.unit === 'weekday') {
    let day = from;
    while ([0, 6].includes(weekday(day))) day = addDays(day, 1);
    return day;
  }
  return from;
}

/**
 * The date after `due`. Never on or before `today`: a daily task that was
 * left for a week moves to tomorrow, not to the day after it was due.
 */
export function nextOccurrence(rule: string, due: Day, today: Day): Day | null {
  const parsed = parse(rule);
  if (!parsed) return null;
  let next = due;
  do {
    switch (parsed.unit) {
      case 'day':
        next = addDays(next, parsed.every);
        break;
      case 'week':
        next = addDays(next, 7 * parsed.every);
        break;
      case 'month':
        next = addMonths(next, parsed.every);
        break;
      case 'year':
        next = addMonths(next, 12 * parsed.every);
        break;
      case 'on':
        next = nextWeekday(next, parsed.day!);
        break;
      case 'weekday':
        do next = addDays(next, 1);
        while ([0, 6].includes(weekday(next)));
        break;
    }
  } while (next <= today);
  return next;
}

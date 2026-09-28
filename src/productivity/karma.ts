import { type Day, addDays, weekday } from '../common/dates.js';

/**
 * Karma and streaks, from the days tasks were completed on. Pure functions
 * over "how many on which day", so they're easy to test and cheap to run.
 */
export const LEVELS = [
  { name: 'Beginner', from: 0 },
  { name: 'Novice', from: 500 },
  { name: 'Intermediate', from: 2500 },
  { name: 'Professional', from: 5000 },
  { name: 'Expert', from: 7500 },
  { name: 'Master', from: 10000 },
  { name: 'Grand Master', from: 20000 },
  { name: 'Enlightened', from: 50000 },
] as const;

/** Points for one completed task: a p1 is worth more than a p4. */
export const points = (priority: number) => 5 + (4 - priority) * 2;

export function level(karma: number) {
  const index = LEVELS.findLastIndex((l) => karma >= l.from);
  const next = LEVELS[index + 1];
  return {
    name: LEVELS[index].name,
    next: next
      ? { name: next.name, from: next.from, left: next.from - karma }
      : null,
  };
}

/**
 * Days in a row, up to today, with at least `goal` tasks done. Days off and
 * a vacation neither break a streak nor add to it; today only counts once
 * it's reached (an unfinished today doesn't break it either).
 */
export function streak(
  counts: Map<Day, number>,
  goal: number,
  today: Day,
  daysOff: number[],
  since: Day,
) {
  let current = 0;
  let running = 0;
  let longest = 0;
  let broken = false;
  for (let day = today; day >= since; day = addDays(day, -1)) {
    const done = (counts.get(day) ?? 0) >= goal;
    const off = daysOff.includes(weekday(day));
    if (done) {
      running++;
      if (!broken) current = running;
    } else if (!off && day !== today) {
      broken = true;
      running = 0;
    }
    longest = Math.max(longest, running);
  }
  return { current, longest };
}

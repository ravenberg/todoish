/**
 * Dates as Todoist shows them. Due dates are days (`YYYY-MM-DD`) and the
 * server says which day today is (the shared `today` prop), so "overdue"
 * means the same on every device.
 */
const parse = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (day: string, n: number) => {
  const date = parse(day);
  date.setDate(date.getDate() + n);
  return toDay(date);
};

export const toDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const daysBetween = (a: string, b: string) =>
  Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);

/** "Today", "Tomorrow", "Friday", "12 Mar", "12 Mar 2027". */
export function dueLabel(day: string, today: string): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const date = parse(day);
  if (diff > 1 && diff < 7)
    return date.toLocaleDateString('en-GB', { weekday: 'long' });
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== parse(today).getFullYear()
      ? { year: 'numeric' }
      : {}),
  });
}

/** Todoist's date colours: red overdue, green today, orange tomorrow, purple this week. */
export function dueColor(day: string, today: string): string {
  const diff = daysBetween(today, day);
  if (diff < 0) return '#d1453b';
  if (diff === 0) return '#058527';
  if (diff === 1) return '#ad6200';
  if (diff < 7) return '#692ec2';
  return 'var(--mantine-color-dimmed)';
}

/** "14:00" stays "14:00": Todoish is European about time. */
export const timeLabel = (time: string) => time;

export function dayHeading(day: string, today: string) {
  const date = parse(day);
  const short = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
  const diff = daysBetween(today, day);
  if (diff === 0) return `${short} · Today · ${weekday}`;
  if (diff === 1) return `${short} · Tomorrow · ${weekday}`;
  return `${short} · ${weekday}`;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 hours ago", "yesterday". */
export function relative(iso: string, now = Date.now()): string {
  const seconds = (Date.parse(iso) - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size)
      return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

export const fileSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} kB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const firstName = (name: string) => name.split(' ')[0];

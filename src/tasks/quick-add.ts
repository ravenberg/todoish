import {
  type Day,
  addDays,
  addMonths,
  fromDay,
  nextWeekday,
  toDay,
} from '../common/dates.js';
import { WEEKDAYS, firstOccurrence } from './recurrence.js';

/**
 * Reads a task the way Todoist's quick add does:
 *
 *   Submit report fri 4pm p1 @work #Work
 *
 * becomes "Submit report", due Friday at 16:00, priority 1, labelled "work",
 * in the Work project. The same function runs while you type (to highlight
 * what it understood) and when you press Add, so what you see is what you get.
 */
export type TokenKind =
  'date' | 'time' | 'recurrence' | 'priority' | 'label' | 'project';

export interface Token {
  kind: TokenKind;
  /** Offsets into the text, end exclusive. */
  start: number;
  end: number;
  text: string;
}

export interface Parsed {
  title: string;
  dueDate: Day | null;
  dueTime: string | null;
  recurrence: string | null;
  priority: 1 | 2 | 3 | 4 | null;
  /** Label names, as typed; new ones are created. */
  labels: string[];
  projectId: number | null;
  tokens: Token[];
}

export interface Context {
  today: Day;
  projects: { id: number; name: string }[];
}

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

const MONTH =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAY =
  '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)';

/** Each pattern must match whole words; `(?<![\w@#])` keeps `@today` a label. */
const B = '(?<![\\w@#/])';
const E = '(?![\\w])';

const PATTERNS: { kind: TokenKind; re: RegExp }[] = [
  {
    kind: 'recurrence',
    re: new RegExp(
      `${B}every\\s+(?:other\\s+)?(?:\\d+\\s+)?(?:days?|weekdays?|workdays?|weeks?|months?|years?|${WEEKDAY})${E}`,
      'gi',
    ),
  },
  { kind: 'priority', re: new RegExp(`${B}p[1-4]${E}`, 'gi') },
  { kind: 'label', re: /(?<![\w@])@([\p{L}\p{N}_-]+)/gu },
  {
    kind: 'time',
    re: new RegExp(
      `${B}(?:at\\s+)?(?:noon|midnight|(?:[01]?\\d|2[0-3]):[0-5]\\d(?:\\s?[ap]m)?|(?:1[0-2]|0?[1-9])\\s?[ap]m)${E}`,
      'gi',
    ),
  },
  {
    kind: 'date',
    re: new RegExp(
      `${B}(?:(?:on|by)\\s+)?(?:today|tod|tonight|tomorrow|tmr|tom|next\\s+(?:week|month|year)|this\\s+weekend|next\\s+weekend|in\\s+\\d+\\s+(?:days?|weeks?|months?)|(?:next\\s+)?${WEEKDAY}|${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH})${E}`,
      'gi',
    ),
  },
];

function parseTime(text: string): string {
  const t = text
    .toLowerCase()
    .replace(/^at\s+/, '')
    .replace(/\s/g, '');
  if (t === 'noon') return '12:00';
  if (t === 'midnight') return '00:00';
  const match = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/.exec(t)!;
  let hours = Number(match[1]);
  const minutes = match[2] ?? '00';
  if (match[3] === 'pm' && hours < 12) hours += 12;
  if (match[3] === 'am' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

const weekdayIndex = (word: string) =>
  WEEKDAYS.findIndex((name) => name.startsWith(word.slice(0, 3).toLowerCase()));

function parseDate(text: string, today: Day): { day: Day; time?: string } {
  const t = text
    .toLowerCase()
    .replace(/^(on|by)\s+/, '')
    .replace(/\s+/g, ' ');
  if (t === 'today' || t === 'tod') return { day: today };
  if (t === 'tonight') return { day: today, time: '19:00' };
  if (['tomorrow', 'tmr', 'tom'].includes(t)) return { day: addDays(today, 1) };
  if (t === 'next week') return { day: nextWeekday(today, 1) };
  if (t === 'next month')
    return { day: addMonths(today, 1).slice(0, 8) + '01' };
  if (t === 'next year')
    return { day: `${Number(today.slice(0, 4)) + 1}-01-01` };
  if (t === 'this weekend') return { day: nextWeekday(today, 6, true) };
  if (t === 'next weekend')
    return { day: addDays(nextWeekday(today, 6, true), 7) };
  let match = /^in (\d+) (day|week|month)s?$/.exec(t);
  if (match) {
    const n = Number(match[1]);
    if (match[2] === 'day') return { day: addDays(today, n) };
    if (match[2] === 'week') return { day: addDays(today, 7 * n) };
    return { day: addMonths(today, n) };
  }
  match = /^(next )?([a-z]+)$/.exec(t);
  if (match && weekdayIndex(match[2]) >= 0) {
    const day = nextWeekday(today, weekdayIndex(match[2]), !match[1]);
    // "next friday" is the one after this week's.
    return {
      day:
        match[1] && day === nextWeekday(today, weekdayIndex(match[2]), true)
          ? addDays(day, 7)
          : day,
    };
  }
  const parts = t.replace(/(st|nd|rd|th)\b/, '').split(' ');
  const monthWord = /\d/.test(parts[0]) ? parts[1] : parts[0];
  const dayNumber = Number(/\d/.test(parts[0]) ? parts[0] : parts[1]);
  const month = MONTHS.indexOf(monthWord.slice(0, 3));
  let year = Number(today.slice(0, 4));
  // Clamp, so "feb 31" is the end of February rather than March 3.
  const clamp = (y: number) =>
    Math.min(dayNumber, new Date(y, month + 1, 0).getDate());
  let day = toDay(new Date(year, month, clamp(year)));
  // A date that has passed this year means next year's.
  if (day < today) {
    year += 1;
    day = toDay(new Date(year, month, clamp(year)));
  }
  return { day };
}

/** `#` followed by the longest project name that fits, spaces and all. */
function findProjects(text: string, projects: Context['projects']): Token[] {
  const tokens: Token[] = [];
  const byLength = [...projects].sort((a, b) => b.name.length - a.name.length);
  for (let i = text.indexOf('#'); i !== -1; i = text.indexOf('#', i + 1)) {
    if (i > 0 && /[\w#]/.test(text[i - 1])) continue;
    const rest = text.slice(i + 1).toLowerCase();
    const project = byLength.find(
      (p) =>
        rest.startsWith(p.name.toLowerCase()) &&
        !/[\p{L}\p{N}_]/u.test(rest[p.name.length] ?? ''),
    );
    if (project)
      tokens.push({
        kind: 'project',
        start: i,
        end: i + 1 + project.name.length,
        text: text.slice(i, i + 1 + project.name.length),
      });
  }
  return tokens;
}

export function parseQuickAdd(text: string, context: Context): Parsed {
  const found: Token[] = findProjects(text, context.projects);
  const taken = (start: number, end: number) =>
    found.some((t) => start < t.end && end > t.start);

  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    for (const match of text.matchAll(re)) {
      const start = match.index;
      const end = start + match[0].length;
      if (!taken(start, end)) found.push({ kind, start, end, text: match[0] });
    }
  }
  found.sort((a, b) => a.start - b.start);

  // The first of each kind counts (the rest stay in the title), except labels.
  const tokens: Token[] = [];
  for (const token of found) {
    const first = !tokens.some((t) => t.kind === token.kind);
    // A date with "every" already there, or a recurrence after a date, conflicts.
    const clashes =
      (token.kind === 'date' && tokens.some((t) => t.kind === 'recurrence')) ||
      (token.kind === 'recurrence' && tokens.some((t) => t.kind === 'date'));
    if ((token.kind === 'label' || first) && !clashes) tokens.push(token);
  }

  const result: Parsed = {
    title: '',
    dueDate: null,
    dueTime: null,
    recurrence: null,
    priority: null,
    labels: [],
    projectId: null,
    tokens,
  };
  for (const token of tokens) {
    switch (token.kind) {
      case 'priority':
        result.priority = Number(token.text[1]) as Parsed['priority'];
        break;
      case 'label': {
        const name = token.text.slice(1);
        if (!result.labels.some((l) => l.toLowerCase() === name.toLowerCase()))
          result.labels.push(name);
        break;
      }
      case 'project': {
        const name = token.text.slice(1).toLowerCase();
        result.projectId =
          context.projects.find((p) => p.name.toLowerCase() === name)?.id ??
          null;
        break;
      }
      case 'time':
        result.dueTime = parseTime(token.text);
        break;
      case 'date': {
        const { day, time } = parseDate(token.text, context.today);
        result.dueDate = day;
        if (time && !result.dueTime) result.dueTime = time;
        break;
      }
      case 'recurrence':
        result.recurrence = token.text.toLowerCase().replace(/\s+/g, ' ');
        result.dueDate = firstOccurrence(result.recurrence, context.today);
        break;
    }
  }
  // A time on its own is today at that time.
  if (result.dueTime && !result.dueDate) result.dueDate = context.today;

  let title = '';
  let at = 0;
  for (const token of tokens) {
    title += text.slice(at, token.start);
    at = token.end;
  }
  result.title = (title + text.slice(at)).replace(/\s+/g, ' ').trim();
  return result;
}

/** How a due date reads on a task: "Today", "Tomorrow", "Fri", "12 Mar". */
export function dueLabel(day: Day, today: Day): string {
  const diff = Math.round(
    (fromDay(day).getTime() - fromDay(today).getTime()) / 86_400_000,
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const date = fromDay(day);
  if (diff > 1 && diff < 7)
    return date.toLocaleDateString('en-GB', { weekday: 'long' });
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== fromDay(today).getFullYear()
      ? { year: 'numeric' }
      : {}),
  });
}

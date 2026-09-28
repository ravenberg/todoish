import { type Day, addDays } from '../common/dates.js';

/**
 * Todoist's filter language, the useful part of it:
 *
 *   (today | overdue) & #Work & !@waiting
 *
 * Terms: today, tomorrow, overdue, no date, N days (the next N days), p1 to
 * p4, @label, #project, assigned to me, assigned to others, shared,
 * recurring, no labels, search: text. Combine with & (and), | (or), ! (not)
 * and parentheses. `parseQuery` checks the syntax, which is what the filter
 * form's live validation asks the server about.
 */
export type Node =
  | { op: 'and' | 'or'; left: Node; right: Node }
  | { op: 'not'; node: Node }
  | { op: 'term'; term: Term };

export type Term =
  | { kind: 'today' | 'tomorrow' | 'overdue' | 'no date' | 'recurring' }
  | { kind: 'no labels' | 'shared' | 'assigned to me' | 'assigned to others' }
  | { kind: 'days'; days: number }
  | { kind: 'priority'; priority: number }
  | { kind: 'label'; name: string }
  | { kind: 'project'; name: string }
  | { kind: 'search'; text: string };

export class QueryError extends Error {}

const FIXED = [
  'today',
  'tomorrow',
  'overdue',
  'no date',
  'recurring',
  'no labels',
  'shared',
  'assigned to me',
  'assigned to others',
] as const;

function term(raw: string): Term {
  const text = raw.trim().replace(/\s+/g, ' ');
  const lower = text.toLowerCase();
  if (!text)
    throw new QueryError('Something is missing between two operators.');
  if (lower === 'od') return { kind: 'overdue' };
  if (lower === 'no due date') return { kind: 'no date' };
  const fixed = FIXED.find((word) => word === lower);
  if (fixed) return { kind: fixed };
  let match = /^(?:next )?(\d{1,3}) days$/.exec(lower);
  if (match) return { kind: 'days', days: Number(match[1]) };
  match = /^(?:p|priority )([1-4])$/.exec(lower);
  if (match) return { kind: 'priority', priority: Number(match[1]) };
  if (text.startsWith('@') && text.length > 1)
    return { kind: 'label', name: text.slice(1) };
  if (text.startsWith('#') && text.length > 1)
    return { kind: 'project', name: text.replace(/^#+/, '') };
  match = /^search:\s*(.+)$/i.exec(text);
  if (match) return { kind: 'search', text: match[1].trim() };
  throw new QueryError(
    `“${text}” isn't something a filter knows. Try today, p1, @label or #project.`,
  );
}

type Piece = '&' | '|' | '!' | '(' | ')' | { term: string };

function tokenize(query: string): Piece[] {
  const pieces: Piece[] = [];
  let current = '';
  const flush = () => {
    if (current.trim()) pieces.push({ term: current });
    current = '';
  };
  for (const char of query) {
    if ('&|!()'.includes(char)) {
      flush();
      pieces.push(char as Piece);
    } else current += char;
  }
  flush();
  return pieces;
}

export function parseQuery(query: string): Node {
  const pieces = tokenize(query);
  if (!pieces.length) throw new QueryError('Type a query, like today & p1.');
  let at = 0;

  const expect = (piece: Piece) => {
    if (pieces[at] !== piece)
      throw new QueryError(
        piece === ')'
          ? 'A bracket is opened but never closed.'
          : `Expected ${piece}.`,
      );
    at++;
  };

  const or = (): Node => {
    let left = and();
    while (pieces[at] === '|') {
      at++;
      left = { op: 'or', left, right: and() };
    }
    return left;
  };
  const and = (): Node => {
    let left = not();
    while (pieces[at] === '&') {
      at++;
      left = { op: 'and', left, right: not() };
    }
    return left;
  };
  const not = (): Node => {
    if (pieces[at] === '!') {
      at++;
      return { op: 'not', node: not() };
    }
    return primary();
  };
  const primary = (): Node => {
    const piece = pieces[at];
    if (piece === '(') {
      at++;
      const node = or();
      expect(')');
      return node;
    }
    if (piece === undefined || typeof piece === 'string')
      throw new QueryError(
        piece === ')'
          ? 'A bracket is closed that was never opened.'
          : 'Something is missing between two operators.',
      );
    at++;
    return { op: 'term', term: term(piece.term) };
  };

  const node = or();
  if (at < pieces.length)
    throw new QueryError(
      pieces[at] === ')'
        ? 'A bracket is closed that was never opened.'
        : 'Two terms need an & or a | between them.',
    );
  return node;
}

/** What `matches` needs to know about a task. */
export interface Candidate {
  title: string;
  description: string;
  dueDate: Day | null;
  recurrence: string | null;
  priority: number;
  labels: string[];
  project: string;
  shared: boolean;
  assigneeId: number | null;
}

export function matches(
  node: Node,
  task: Candidate,
  context: { today: Day; userId: number },
): boolean {
  switch (node.op) {
    case 'and':
      return (
        matches(node.left, task, context) && matches(node.right, task, context)
      );
    case 'or':
      return (
        matches(node.left, task, context) || matches(node.right, task, context)
      );
    case 'not':
      return !matches(node.node, task, context);
  }
  const { term } = node;
  const due = task.dueDate;
  const lower = (s: string) => s.toLowerCase();
  switch (term.kind) {
    case 'today':
      return due === context.today;
    case 'tomorrow':
      return due === addDays(context.today, 1);
    case 'overdue':
      return !!due && due < context.today;
    case 'no date':
      return !due;
    case 'recurring':
      return !!task.recurrence;
    case 'no labels':
      return task.labels.length === 0;
    case 'shared':
      return task.shared;
    case 'assigned to me':
      return task.assigneeId === context.userId;
    case 'assigned to others':
      return task.assigneeId !== null && task.assigneeId !== context.userId;
    case 'days':
      return (
        !!due &&
        due <= addDays(context.today, term.days - 1) &&
        due >= context.today
      );
    case 'priority':
      return task.priority === term.priority;
    case 'label':
      return task.labels.some((l) => lower(l) === lower(term.name));
    case 'project':
      return lower(task.project) === lower(term.name);
    case 'search':
      return `${task.title} ${task.description}`
        .toLowerCase()
        .includes(lower(term.text));
  }
}

/** Whether a query parses, and why not. For the schema's refine. */
export function queryProblem(query: string): string | null {
  try {
    parseQuery(query);
    return null;
  } catch (error) {
    if (error instanceof QueryError) return error.message;
    throw error;
  }
}

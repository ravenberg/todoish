import { type Candidate, matches, parseQuery, queryProblem } from './query.js';

const today = '2026-09-30';
const task = (patch: Partial<Candidate> = {}): Candidate => ({
  title: 'Write the report',
  description: '',
  dueDate: today,
  recurrence: null,
  priority: 1,
  labels: ['work'],
  project: 'Work',
  shared: false,
  assigneeId: null,
  ...patch,
});
const check = (query: string, candidate = task()) =>
  matches(parseQuery(query), candidate, { today, userId: 1 });

describe('filter queries', () => {
  it('combines terms with & | ! and brackets, & before |', () => {
    expect(check('today & p1')).toBe(true);
    expect(check('today & p2')).toBe(false);
    expect(check('p2 | p1 & today')).toBe(true);
    expect(check('(p2 | p3) & today')).toBe(false);
    expect(check('!@waiting & #work')).toBe(true);
    expect(check('!!today')).toBe(true);
  });

  it('knows about dates', () => {
    expect(check('overdue', task({ dueDate: '2026-09-29' }))).toBe(true);
    expect(check('od', task({ dueDate: today }))).toBe(false);
    expect(check('tomorrow', task({ dueDate: '2026-10-01' }))).toBe(true);
    expect(check('7 days', task({ dueDate: '2026-10-06' }))).toBe(true);
    expect(check('next 7 days', task({ dueDate: '2026-10-07' }))).toBe(false);
    expect(check('no date', task({ dueDate: null }))).toBe(true);
  });

  it('knows about people and text', () => {
    expect(check('assigned to me', task({ assigneeId: 1 }))).toBe(true);
    expect(check('assigned to others', task({ assigneeId: 2 }))).toBe(true);
    expect(check('search: report')).toBe(true);
    expect(check('no labels')).toBe(false);
  });

  it('says what is wrong with a query', () => {
    expect(queryProblem('today & p1')).toBeNull();
    expect(queryProblem('today &')).toMatch(/missing/);
    expect(queryProblem('(today | p1')).toMatch(/never closed/);
    expect(queryProblem('today p1')).toMatch(/isn't something/);
    expect(queryProblem('today)')).toMatch(/never opened/);
    expect(queryProblem('')).toMatch(/Type a query/);
  });
});

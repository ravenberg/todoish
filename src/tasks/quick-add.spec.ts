import { parseQuickAdd } from './quick-add.js';

// A Wednesday.
const today = '2026-09-30';
const projects = [
  { id: 1, name: 'Inbox' },
  { id: 2, name: 'Work' },
  { id: 3, name: 'Moving house' },
];
const parse = (text: string) => parseQuickAdd(text, { today, projects });

describe('parseQuickAdd', () => {
  it('takes priority, labels, project, date and time out of the title', () => {
    const task = parse('Submit report fri 4pm p1 @work @urgent #Work');
    expect(task).toMatchObject({
      title: 'Submit report',
      dueDate: '2026-10-02',
      dueTime: '16:00',
      priority: 1,
      labels: ['work', 'urgent'],
      projectId: 2,
    });
    expect(task.tokens.map((t) => t.kind)).toEqual([
      'date',
      'time',
      'priority',
      'label',
      'label',
      'project',
    ]);
  });

  it('knows the usual ways to say a day', () => {
    expect(parse('a today').dueDate).toBe('2026-09-30');
    expect(parse('a tomorrow').dueDate).toBe('2026-10-01');
    expect(parse('a next week').dueDate).toBe('2026-10-05');
    expect(parse('a this weekend').dueDate).toBe('2026-10-03');
    expect(parse('a in 3 days').dueDate).toBe('2026-10-03');
    expect(parse('a wednesday').dueDate).toBe('2026-09-30');
    expect(parse('a next wed').dueDate).toBe('2026-10-07');
    expect(parse('a 12 oct').dueDate).toBe('2026-10-12');
    expect(parse('a jan 5th').dueDate).toBe('2027-01-05');
    expect(parse('a feb 31').dueDate).toBe('2027-02-28');
  });

  it('reads times, and a time alone means today', () => {
    expect(parse('call at 9:30').dueTime).toBe('09:30');
    expect(parse('call 12am')).toMatchObject({
      dueTime: '00:00',
      dueDate: today,
    });
    expect(parse('call noon').dueTime).toBe('12:00');
    expect(parse('call tonight')).toMatchObject({
      dueDate: today,
      dueTime: '19:00',
    });
  });

  it('starts a recurring task on its first occurrence', () => {
    expect(parse('Water plants every monday')).toMatchObject({
      title: 'Water plants',
      recurrence: 'every monday',
      dueDate: '2026-10-05',
    });
    expect(parse('Stand-up every weekday 9am')).toMatchObject({
      recurrence: 'every weekday',
      dueDate: today,
      dueTime: '09:00',
    });
  });

  it('finds project names with spaces, the longest first', () => {
    expect(parse('Buy tape #Moving house')).toMatchObject({
      title: 'Buy tape',
      projectId: 3,
    });
    expect(parse('#Nope stays').projectId).toBeNull();
  });

  it('leaves words that only look like tokens alone', () => {
    expect(parse('email@today.com p5 tomorrowland')).toMatchObject({
      title: 'email@today.com p5 tomorrowland',
      dueDate: null,
      priority: null,
    });
  });

  it('uses the first of each kind and keeps the rest in the title', () => {
    expect(parse('p1 then p2')).toMatchObject({
      title: 'then p2',
      priority: 1,
    });
  });

  it('gives offsets that point at the words it used', () => {
    const text = 'Pay rent tomorrow p2';
    for (const token of parse(text).tokens)
      expect(text.slice(token.start, token.end)).toBe(token.text);
  });
});

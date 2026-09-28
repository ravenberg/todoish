import {
  describeRecurrence,
  firstOccurrence,
  isRecurrence,
  nextOccurrence,
} from './recurrence.js';

describe('recurrence', () => {
  it('moves each rule to its next date', () => {
    const today = '2026-09-30'; // a Wednesday
    expect(nextOccurrence('every day', today, today)).toBe('2026-10-01');
    expect(nextOccurrence('every 3 days', today, today)).toBe('2026-10-03');
    expect(nextOccurrence('every week', today, today)).toBe('2026-10-07');
    expect(nextOccurrence('every monday', today, today)).toBe('2026-10-05');
    expect(nextOccurrence('every month', '2026-01-31', '2026-01-31')).toBe(
      '2026-02-28',
    );
    expect(nextOccurrence('every weekday', '2026-10-02', '2026-10-02')).toBe(
      '2026-10-05',
    );
  });

  it('never lands in the past when the task was left for a while', () => {
    expect(nextOccurrence('every day', '2026-09-01', '2026-09-30')).toBe(
      '2026-10-01',
    );
  });

  it('knows what it can read', () => {
    expect(isRecurrence('every other week')).toBe(true);
    expect(isRecurrence('every blue moon')).toBe(false);
    expect(describeRecurrence('every fri')).toBe('every Friday');
    expect(describeRecurrence('every 2 weeks')).toBe('every 2 weeks');
    expect(firstOccurrence('every sat', '2026-09-30')).toBe('2026-10-03');
  });
});

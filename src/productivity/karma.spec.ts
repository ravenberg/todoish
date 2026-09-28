import { level, points, streak } from './karma.js';

describe('karma', () => {
  it('names the level and what is left to the next', () => {
    expect(level(0)).toEqual({
      name: 'Beginner',
      next: { name: 'Novice', from: 500, left: 500 },
    });
    expect(level(2600).name).toBe('Intermediate');
    expect(level(60000).next).toBeNull();
    expect(points(1)).toBeGreaterThan(points(4));
  });

  it('counts a streak of good days, skipping days off', () => {
    // 2026-09-30 is a Wednesday; the 26th and 27th are a weekend.
    const counts = new Map([
      ['2026-09-29', 5],
      ['2026-09-28', 6],
      ['2026-09-25', 5],
      ['2026-09-24', 1],
      ['2026-09-23', 5],
      ['2026-09-22', 5],
      ['2026-09-21', 5],
    ]);
    const result = streak(counts, 5, '2026-09-30', [0, 6], '2026-09-01');
    // Today isn't done yet but doesn't break it; the weekend is skipped.
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
  });
});

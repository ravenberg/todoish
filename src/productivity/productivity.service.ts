import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { type Day, addDays, toDay, today, weekday } from '../common/dates.js';
import { Activity, type User } from '../database/entities/index.js';
import { level, points, streak } from './karma.js';

const HISTORY_DAYS = 120;

@Injectable()
export class ProductivityService {
  constructor(
    @InjectRepository(Activity) private readonly activity: Repository<Activity>,
  ) {}

  /** Completions per day, and their karma, for the last few months. */
  private async history(user: User) {
    const since = addDays(today(), -HISTORY_DAYS);
    const rows = await this.activity
      .createQueryBuilder('a')
      .where('a.actorId = :id', { id: user.id })
      .andWhere("a.kind = 'completed'")
      .andWhere('a.createdAt >= :since', { since })
      .getMany();
    const counts = new Map<Day, number>();
    const karma = new Map<Day, number>();
    for (const row of rows) {
      const day = toDay(row.createdAt);
      counts.set(day, (counts.get(day) ?? 0) + 1);
      karma.set(day, (karma.get(day) ?? 0) + points(row.priority));
    }
    return { counts, karma, since };
  }

  async daily(user: User) {
    const { counts, since } = await this.history(user);
    const now = today();
    const off = user.vacation ? [0, 1, 2, 3, 4, 5, 6] : user.daysOff;
    return {
      done: counts.get(now) ?? 0,
      goal: user.dailyGoal,
      streak: streak(counts, user.dailyGoal, now, off, since),
      week: Array.from({ length: 7 }, (_, i) => {
        const day = addDays(now, i - 6);
        return { day, count: counts.get(day) ?? 0 };
      }),
    };
  }

  async weekly(user: User) {
    const { counts } = await this.history(user);
    const now = today();
    // Weeks start on Monday.
    const monday = addDays(now, -((weekday(now) + 6) % 7));
    const weekTotal = (start: Day) =>
      Array.from(
        { length: 7 },
        (_, i) => counts.get(addDays(start, i)) ?? 0,
      ).reduce((a, b) => a + b, 0);
    const weeks = Array.from({ length: 4 }, (_, i) => {
      const start = addDays(monday, -7 * (3 - i));
      return { week: start, count: weekTotal(start) };
    });
    let current = 0;
    for (
      let start = addDays(monday, -7);
      weekTotal(start) >= user.weeklyGoal;
      start = addDays(start, -7)
    )
      current++;
    if (weekTotal(monday) >= user.weeklyGoal) current++;
    return {
      done: weekTotal(monday),
      goal: user.weeklyGoal,
      weeks,
      streak: current,
    };
  }

  async karma(user: User) {
    const { karma } = await this.history(user);
    const now = today();
    // Everyone starts with a little, for signing up.
    let total = 50;
    const byDay = [...karma.entries()].sort(([a], [b]) => a.localeCompare(b));
    const before = addDays(now, -13);
    for (const [day, value] of byDay) if (day < before) total += value;
    const trend = Array.from({ length: 14 }, (_, i) => {
      const day = addDays(before, i);
      total += karma.get(day) ?? 0;
      return { day, karma: total };
    });
    return { karma: total, level: level(total), trend };
  }
}

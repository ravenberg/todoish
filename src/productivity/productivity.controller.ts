import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, ViewService, defer } from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { User } from '../database/entities/index.js';
import { ProductivityService } from './productivity.service.js';

export const GoalsSchema = z
  .object({
    dailyGoal: z
      .number({ error: 'How many tasks make a good day?' })
      .int()
      .min(1, 'At least one. Zero is a day off.')
      .max(100, 'A hundred a day is plenty, even for you.'),
    weeklyGoal: z
      .number({ error: 'How many tasks make a good week?' })
      .int()
      .min(1, 'At least one.')
      .max(700, 'That many? Let’s say 700 at most.'),
    daysOff: z.array(z.number().int().min(0).max(6)).max(6, 'Keep one day on.'),
    vacation: z.boolean(),
  })
  .refine((goals) => goals.weeklyGoal >= goals.dailyGoal, {
    message:
      'A week has at least one good day in it, so at least the daily goal.',
    path: ['weeklyGoal'],
  });

/**
 * Productivity: the page paints with your goals at once, and each block of
 * numbers comes in its own `defer()` group straight after, in parallel.
 * Karma is `rescue`d: when it can't be worked out, the rest of the page
 * still loads and the block says so. Add `?nap=1` to see that happen.
 */
@Controller('productivity')
export class ProductivityController {
  constructor(
    private readonly productivity: ProductivityService,
    private readonly view: ViewService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get()
  @View('Productivity/Index')
  index(@CurrentUser() user: User, @Query('nap') nap: string | undefined) {
    return {
      goals: {
        dailyGoal: user.dailyGoal,
        weeklyGoal: user.weeklyGoal,
        daysOff: user.daysOff,
        vacation: user.vacation,
      },
      daily: defer(() => this.productivity.daily(user), 'daily'),
      weekly: defer(() => this.productivity.weekly(user), 'weekly'),
      karma: defer(
        async () => {
          if (nap) throw new Error('Karma is taking a nap.');
          return this.productivity.karma(user);
        },
        { group: 'karma', rescue: true },
      ),
    };
  }

  @Put('goals')
  async goals(
    @CurrentUser() user: User,
    @Body({ schema: GoalsSchema }) body: z.infer<typeof GoalsSchema>,
  ) {
    await this.users.update(user.id, body);
    return this.view.flash('success', 'Goals saved. Go get them.').back();
  }
}

import { Controller, Get, Query, Req } from '@nestjs/common';
import { type AnyRequest, View, scroll } from 'nestjs-mvc';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { addDays, today } from '../common/dates.js';
import type { User } from '../database/entities/index.js';
import { TaskDetail } from '../tasks/task-detail.js';
import { TasksService } from '../tasks/tasks.service.js';

/**
 * Upcoming: day after day, as far as you scroll. A page is a week counted
 * from today (page 0 is today and the six days after it), so jumping to a
 * date is `?page=n`, and scrolling up from there loads the weeks before.
 */
@Controller('upcoming')
export class UpcomingController {
  constructor(
    private readonly tasks: TasksService,
    private readonly detail: TaskDetail,
  ) {}

  @Get()
  @View('Upcoming/Index')
  index(
    @CurrentUser() user: User,
    @Query('page') page: string | undefined,
    @Req() req: AnyRequest,
  ) {
    const now = today();
    const week = Math.min(52, Math.max(0, Math.floor(Number(page)) || 0));
    return {
      overdue: () => this.tasks.dueBy(user, addDays(now, -1)),
      days: scroll(
        async () => {
          const from = addDays(now, 7 * week);
          const to = addDays(from, 6);
          const tasks = await this.tasks.between(user, from, to);
          return {
            // Every day, with or without tasks: an empty day gets "Add task" too.
            data: Array.from({ length: 7 }, (_, i) => {
              const date = addDays(from, i);
              return {
                date,
                tasks: tasks.filter((t) => t.dueDate === date),
              };
            }),
            currentPage: week,
            previousPage: week > 0 ? week - 1 : null,
            nextPage: week < 52 ? week + 1 : null,
          };
        },
        { matchOn: 'date' },
      ),
      ...this.detail.props(req, user),
    };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { type AnyRequest, View, ViewService } from 'nestjs-mvc';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { today } from '../common/dates.js';
import type { User } from '../database/entities/index.js';
import { ProjectsService } from '../projects/projects.service.js';
import { parseQuickAdd } from './quick-add.js';
import { TaskDetail } from './task-detail.js';
import {
  CreateTaskSchema,
  MoveTaskSchema,
  RescheduleSchema,
  UpdateTaskSchema,
} from './tasks.schemas.js';
import { TasksService } from './tasks.service.js';

@Controller()
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly projects: ProjectsService,
    private readonly detail: TaskDetail,
    private readonly view: ViewService,
  ) {}

  @Get('inbox')
  @View('Tasks/Inbox')
  async inbox(@CurrentUser() user: User, @Req() req: AnyRequest) {
    const inbox = await this.projects.inbox(user);
    return {
      project: { id: inbox.id, name: inbox.name },
      tasks: () => this.tasks.inbox(user),
      ...this.detail.props(req, user),
    };
  }

  /** Today's tasks and the ones that should have been done already. */
  @Get('today')
  @View('Tasks/Today')
  today(@CurrentUser() user: User, @Req() req: AnyRequest) {
    return {
      tasks: () => this.tasks.dueBy(user, today()),
      ...this.detail.props(req, user),
    };
  }

  /**
   * What quick add understood so far, asked with useHttp while you type: a
   * plain JSON answer, no page. The same parser runs again on submit.
   */
  @Get('tasks/parse')
  async parse(@CurrentUser() user: User, @Query('text') text = '') {
    const input = text.slice(0, 500);
    const parsed = parseQuickAdd(input, {
      today: today(),
      projects: await this.projects.forUser(user),
    });
    // The text it read, so the page can tell a stale answer from a fresh one.
    return { text: input, ...parsed };
  }

  @Post('tasks')
  async create(
    @CurrentUser() user: User,
    @Body({ schema: CreateTaskSchema }) body: z.infer<typeof CreateTaskSchema>,
  ) {
    const task = await this.tasks.create(user, body);
    return this.view
      .flash('added', {
        id: task.id,
        title: task.title,
        project: task.project.isInbox ? 'Inbox' : task.project.name,
        projectId: task.project.id,
      })
      .back();
  }

  /** Today's "Reschedule": every overdue task to a day, in one go. */
  @Post('tasks/reschedule')
  async reschedule(
    @CurrentUser() user: User,
    @Body({ schema: RescheduleSchema }) body: z.infer<typeof RescheduleSchema>,
  ) {
    for (const id of body.ids)
      await this.tasks.update(await this.tasks.find(id, user), user, {
        dueDate: body.dueDate,
      });
    return this.view
      .flash(
        'success',
        `${body.ids.length} task${body.ids.length === 1 ? '' : 's'} rescheduled. Fresh start.`,
      )
      .back();
  }

  @Patch('tasks/:id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: UpdateTaskSchema }) body: z.infer<typeof UpdateTaskSchema>,
  ) {
    await this.tasks.update(await this.tasks.find(id, user), user, body);
    return this.view.back();
  }

  /** The circle. The flash carries an Undo, which reopens it. */
  @Post('tasks/:id/complete')
  async complete(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const { task, next } = await this.tasks.complete(
      await this.tasks.find(id, user, { completed: false }),
      user,
    );
    return this.view
      .flash('completed', { id: task.id, title: task.title, next })
      .back();
  }

  @Post('tasks/:id/reopen')
  async reopen(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.tasks.reopen(await this.tasks.find(id, user), user);
    return this.view.back();
  }

  @Post('tasks/:id/move')
  async move(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: MoveTaskSchema }) body: z.infer<typeof MoveTaskSchema>,
  ) {
    await this.tasks.move(await this.tasks.find(id, user), user, body);
    return this.view.back();
  }

  @Delete('tasks/:id')
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const task = await this.tasks.find(id, user);
    await this.tasks.remove(task, user);
    return this.view.flash('success', `“${task.title}” deleted.`).back();
  }
}

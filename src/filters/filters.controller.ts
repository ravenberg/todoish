import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AnyRequest,
  ValidationException,
  View,
  ViewService,
} from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { today } from '../common/dates.js';
import { Filter, Label, type User } from '../database/entities/index.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TaskDetail } from '../tasks/task-detail.js';
import { TasksService } from '../tasks/tasks.service.js';
import { FilterSchema, LabelSchema } from './filters.schemas.js';
import { matches, parseQuery } from './query.js';

@Controller()
export class FiltersController {
  constructor(
    private readonly tasks: TasksService,
    private readonly projects: ProjectsService,
    private readonly detail: TaskDetail,
    private readonly view: ViewService,
    @InjectRepository(Filter) private readonly filters: Repository<Filter>,
    @InjectRepository(Label) private readonly labels: Repository<Label>,
  ) {}

  @Get('filters-labels')
  @View('Filters/Index')
  async index(@CurrentUser() user: User) {
    const labels = await this.labels.find({
      where: { owner: { id: user.id } },
      order: { name: 'ASC' },
    });
    const open = await this.tasks.all(user);
    return {
      filters: (
        await this.filters.find({
          where: { owner: { id: user.id } },
          order: { position: 'ASC', id: 'ASC' },
        })
      ).map((f) => ({
        id: f.id,
        name: f.name,
        query: f.query,
        color: f.color,
      })),
      labels: labels.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
        count: open.filter((t) => t.labels.some((tl) => tl.id === l.id)).length,
      })),
    };
  }

  @Get('filters/:id')
  @View('Filters/Show')
  async show(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AnyRequest,
  ) {
    const filter = await this.filter(id, user);
    return {
      filter: {
        id: filter.id,
        name: filter.name,
        query: filter.query,
        color: filter.color,
      },
      tasks: () => this.run(user, filter.query),
      ...this.detail.props(req, user),
    };
  }

  @Post('filters')
  async create(
    @CurrentUser() user: User,
    @Body({ schema: FilterSchema }) body: z.infer<typeof FilterSchema>,
  ) {
    const last = await this.filters.maximum('position', {
      owner: { id: user.id },
    });
    const filter = await this.filters.save(
      this.filters.create({ ...body, owner: user, position: (last ?? 0) + 1 }),
    );
    this.view.refresh('sidebar');
    return this.view.redirect(`/filters/${filter.id}`);
  }

  @Patch('filters/:id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: FilterSchema }) body: z.infer<typeof FilterSchema>,
  ) {
    await this.filter(id, user);
    await this.filters.update(id, body);
    this.view.refresh('sidebar');
    return this.view.back();
  }

  @Delete('filters/:id')
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const filter = await this.filter(id, user);
    await this.filters.remove(filter);
    this.view.refresh('sidebar');
    return this.view
      .flash('success', `Filter “${filter.name}” deleted.`)
      .redirect('/filters-labels');
  }

  @Get('labels/:id')
  @View('Labels/Show')
  async label(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AnyRequest,
  ) {
    const label = await this.labelOf(id, user);
    return {
      label: { id: label.id, name: label.name, color: label.color },
      tasks: async () =>
        (await this.tasks.rows(await this.tasks.all(user))).filter((t) =>
          t.labels.some((l) => l.id === label.id),
        ),
      ...this.detail.props(req, user),
    };
  }

  @Post('labels')
  async createLabel(
    @CurrentUser() user: User,
    @Body({ schema: LabelSchema }) body: z.infer<typeof LabelSchema>,
  ) {
    await this.unique(user, body.name);
    await this.labels.save(this.labels.create({ ...body, owner: user }));
    this.view.refresh('sidebar');
    return this.view.back();
  }

  @Patch('labels/:id')
  async updateLabel(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: LabelSchema }) body: z.infer<typeof LabelSchema>,
  ) {
    await this.labelOf(id, user);
    await this.unique(user, body.name, id);
    await this.labels.update(id, body);
    this.view.refresh('sidebar');
    return this.view.back();
  }

  @Delete('labels/:id')
  async removeLabel(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const label = await this.labelOf(id, user);
    await this.labels.remove(label);
    this.view.refresh('sidebar');
    return this.view
      .flash('success', `@${label.name} deleted. The tasks stay.`)
      .redirect('/filters-labels');
  }

  /** A filter's tasks: the query is evaluated over the user's open tasks. */
  private async run(user: User, query: string) {
    const node = parseQuery(query);
    const tasks = await this.tasks.all(user);
    const shared = await this.projects.memberCounts([
      ...new Set(tasks.map((t) => t.project.id)),
    ]);
    const context = { today: today(), userId: user.id };
    return this.tasks.rows(
      tasks.filter((task) =>
        matches(
          node,
          {
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            recurrence: task.recurrence,
            priority: task.priority,
            labels: task.labels.map((l) => l.name),
            project: task.project.isInbox ? 'Inbox' : task.project.name,
            shared: (shared.get(task.project.id) ?? 1) > 1,
            assigneeId: task.assignee?.id ?? null,
          },
          context,
        ),
      ),
    );
  }

  private async filter(id: number, user: User) {
    const filter = await this.filters.findOneBy({ id, owner: { id: user.id } });
    if (!filter) throw new NotFoundException('That filter is gone.');
    return filter;
  }

  private async labelOf(id: number, user: User) {
    const label = await this.labels.findOneBy({ id, owner: { id: user.id } });
    if (!label) throw new NotFoundException('That label is gone.');
    return label;
  }

  private async unique(user: User, name: string, except?: number) {
    const labels = await this.labels.findBy({ owner: { id: user.id } });
    if (
      labels.some(
        (l) => l.id !== except && l.name.toLowerCase() === name.toLowerCase(),
      )
    )
      throw new ValidationException({ name: `You already have @${name}.` });
  }
}

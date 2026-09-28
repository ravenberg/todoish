import { Injectable, type NestMiddleware } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AnyRequest, once, requestState } from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { today } from './common/dates.js';
import { Filter, Label, type User } from './database/entities/index.js';
import { ProjectsService } from './projects/projects.service.js';
import { TasksService } from './tasks/tasks.service.js';

/** Data every page gets: the day it is, the sidebar, and its counts. */
@Injectable()
export class SharedDataMiddleware implements NestMiddleware {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
    @InjectRepository(Label) private readonly labels: Repository<Label>,
    @InjectRepository(Filter) private readonly filters: Repository<Filter>,
  ) {}

  use(req: AnyRequest & { user?: User }, _res: unknown, next: () => void) {
    // Functions, so they only run when a page renders (and after the guards).
    const shared = requestState(req).shared;
    // The server's today: due dates are days, and "overdue" is its call.
    shared.today = () => today();
    // The numbers next to Inbox, Today and each project. Cheap, and they
    // change with every task you complete, so they come fresh each time;
    // pages name `counts` in `only` when they complete one.
    shared.counts = () =>
      req.user ? this.tasks.sidebarCounts(req.user) : null;
    // Projects, labels and filters change rarely. `once()`: the browser
    // keeps its copy across visits and the server skips the queries, until
    // something calls `view.refresh('sidebar')` after changing one of them.
    shared.sidebar = once(
      async () => {
        const user = req.user;
        if (!user) return null;
        const [projects, labels, filters] = await Promise.all([
          this.projects.forUser(user),
          this.labels.find({
            where: { owner: { id: user.id } },
            order: { name: 'ASC' },
          }),
          this.filters.find({
            where: { owner: { id: user.id } },
            order: { position: 'ASC', id: 'ASC' },
          }),
        ]);
        return {
          projects,
          labels: labels.map((l) => ({
            id: l.id,
            name: l.name,
            color: l.color,
          })),
          filters: filters.map((f) => ({
            id: f.id,
            name: f.name,
            color: f.color,
          })),
        };
      },
      { as: 'sidebar' },
    );
    next();
  }
}

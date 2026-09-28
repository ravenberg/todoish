import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View } from 'nestjs-mvc';
import { Like, Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Filter, Label, type User } from '../database/entities/index.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TasksService } from '../tasks/tasks.service.js';

@Controller('search')
export class SearchController {
  constructor(
    private readonly tasks: TasksService,
    private readonly projects: ProjectsService,
    @InjectRepository(Label) private readonly labels: Repository<Label>,
    @InjectRepository(Filter) private readonly filters: Repository<Filter>,
  ) {}

  /** The search tab on a phone. The typing itself goes to `results`. */
  @Get()
  @View('Search/Index')
  page() {
    return {};
  }

  /**
   * What Cmd+K and the search tab ask while you type. No @View: useHttp
   * wants JSON, not a page, so this answers like any API endpoint would.
   */
  @Get('results')
  async results(@CurrentUser() user: User, @Query('q') q = '') {
    const term = q.trim().slice(0, 100);
    if (!term) return { tasks: [], projects: [], labels: [], filters: [] };
    const lower = term.toLowerCase();
    const [tasks, projects, labels, filters] = await Promise.all([
      this.tasks.search(user, term),
      this.projects.forUser(user),
      this.labels.find({
        where: {
          owner: { id: user.id },
          name: Like(`%${term.replace(/^@/, '')}%`),
        },
        take: 5,
      }),
      this.filters.find({
        where: { owner: { id: user.id }, name: Like(`%${term}%`) },
        take: 5,
      }),
    ]);
    return {
      tasks,
      projects: projects
        .filter((p) => p.name.toLowerCase().includes(lower.replace(/^#/, '')))
        .slice(0, 5),
      labels: labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
      filters: filters.map((f) => ({ id: f.id, name: f.name, color: f.color })),
    };
  }
}

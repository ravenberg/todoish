import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, merge } from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Activity, type User } from '../database/entities/index.js';
import { projectRef } from '../projects/projects.service.js';
import { person } from '../tasks/serializers.js';

const PAGE = 30;

/**
 * Completed, and everything else that happened in your projects. The page
 * starts with the newest 30; scrolling to the end asks for `?before=<id>`
 * with only `activity` and `older`, and `merge()` adds them under the ones
 * it has.
 */
@Controller('completed')
export class ActivityController {
  constructor(
    @InjectRepository(Activity) private readonly activity: Repository<Activity>,
  ) {}

  @Get()
  @View('Completed/Index')
  async index(
    @CurrentUser() user: User,
    @Query('before') before: string | undefined,
    @Query('project') project: string | undefined,
    @Query('kind') kind: string | undefined,
  ) {
    const load = async () => {
      const query = this.activity
        .createQueryBuilder('a')
        .innerJoinAndSelect('a.actor', 'actor')
        .innerJoinAndSelect('a.project', 'project')
        .innerJoin('project.members', 'm', 'm.userId = :uid', { uid: user.id })
        .orderBy('a.id', 'DESC')
        .take(PAGE + 1);
      if (Number(before))
        query.andWhere('a.id < :before', { before: Number(before) });
      if (Number(project))
        query.andWhere('a.projectId = :p', { p: Number(project) });
      // Completed tasks by default, like Todoist; `?kind=all` for everything.
      if (kind !== 'all') query.andWhere("a.kind = 'completed'");
      const rows = await query.getMany();
      return { rows: rows.slice(0, PAGE), more: rows.length > PAGE };
    };
    // Both props come from one query; the promise is shared between them.
    let page: ReturnType<typeof load> | undefined;
    const once = () => (page ??= load());

    return {
      filters: {
        project: Number(project) || null,
        kind: kind === 'all' ? 'all' : 'completed',
      },
      activity: merge(
        async () =>
          (await once()).rows.map((a) => ({
            id: a.id,
            kind: a.kind,
            actor: person(a.actor),
            you: a.actor.id === user.id,
            project: projectRef(a.project),
            taskId: a.taskId,
            taskTitle: a.taskTitle,
            priority: a.priority,
            at: a.createdAt.toISOString(),
          })),
        { matchOn: 'id' },
      ),
      /** The id to ask `before` next, or null at the very beginning. */
      older: async () => {
        const { rows, more } = await once();
        return more ? rows.at(-1)!.id : null;
      },
    };
  }
}

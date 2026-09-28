import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { ValidationException } from 'nestjs-mvc';
import {
  Brackets,
  DataSource,
  In,
  IsNull,
  type SelectQueryBuilder,
} from 'typeorm';
import { type Day, today } from '../common/dates.js';
import {
  Activity,
  type ActivityKind,
  Comment,
  Label,
  Project,
  Section,
  Task,
  type User,
} from '../database/entities/index.js';
import { ProjectsService } from '../projects/projects.service.js';
import { parseQuickAdd } from './quick-add.js';
import { firstOccurrence, isRecurrence, nextOccurrence } from './recurrence.js';
import { type Counts, type TaskRow, taskRow } from './serializers.js';

export interface TaskInput {
  /** Quick-add text: the title with dates, p1, @labels and #project in it. */
  text: string;
  /** Take the text as the title, as it is: for imports. */
  raw?: boolean;
  description?: string;
  projectId?: number | null;
  sectionId?: number | null;
  parentId?: number | null;
  /** Where the user was (a project, a day): used when the text doesn't say. */
  defaultProjectId?: number | null;
  defaultDueDate?: Day | null;
  /** Chosen with the buttons; wins over what the text says. */
  dueDate?: Day | null;
  dueTime?: string | null;
  recurrence?: string | null;
  priority?: number | null;
  labels?: string[];
  assigneeId?: number | null;
}

export interface TaskChanges {
  title?: string;
  description?: string;
  priority?: number;
  dueDate?: Day | null;
  dueTime?: string | null;
  recurrence?: string | null;
  projectId?: number;
  sectionId?: number | null;
  labels?: string[];
  assigneeId?: number | null;
}

/**
 * Tasks, always as seen by one user: every query starts from the projects
 * they're a member of, so a task in someone else's project is never found.
 */
@Injectable()
export class TasksService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly projects: ProjectsService,
  ) {}

  private get tasks() {
    return this.db.getRepository(Task);
  }

  /** Tasks the user can see, with what a row shows joined in. */
  visible(user: User, options: { completed?: boolean } = {}) {
    const query = this.tasks
      .createQueryBuilder('task')
      .innerJoinAndSelect('task.project', 'project')
      .innerJoin(
        'project.members',
        'membership',
        'membership.userId = :userId',
        { userId: user.id },
      )
      .leftJoinAndSelect('task.section', 'section')
      .leftJoinAndSelect('task.parent', 'parent')
      .leftJoinAndSelect('task.labels', 'label')
      .leftJoinAndSelect('task.assignee', 'assignee');
    if (!options.completed) query.andWhere('task.completedAt IS NULL');
    return query;
  }

  /** In the order lists show them: by date and time, then priority, then position. */
  private ordered(query: SelectQueryBuilder<Task>) {
    return query
      .orderBy('task.dueDate IS NULL', 'ASC')
      .addOrderBy('task.dueDate', 'ASC')
      .addOrderBy('task.dueTime IS NULL', 'ASC')
      .addOrderBy('task.dueTime', 'ASC')
      .addOrderBy('task.priority', 'ASC')
      .addOrderBy('task.position', 'ASC')
      .addOrderBy('task.id', 'ASC');
  }

  async rows(tasks: Task[]): Promise<TaskRow[]> {
    const counts = await this.counts(tasks.map((t) => t.id));
    return tasks.map((task) => taskRow(task, counts));
  }

  /** Sub-tasks done and total, and comments, for many tasks in two queries. */
  async counts(ids: number[]): Promise<Counts> {
    const counts: Counts = { subtasks: new Map(), comments: new Map() };
    if (!ids.length) return counts;
    const subtasks = await this.tasks
      .createQueryBuilder('t')
      .select('t.parentId', 'parentId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        'SUM(CASE WHEN t.completedAt IS NULL THEN 0 ELSE 1 END)',
        'done',
      )
      .where('t.parentId IN (:...ids)', { ids })
      .groupBy('t.parentId')
      .getRawMany<{ parentId: number; total: number; done: number }>();
    for (const row of subtasks)
      counts.subtasks.set(Number(row.parentId), {
        total: Number(row.total),
        done: Number(row.done),
      });
    const comments = await this.db
      .getRepository(Comment)
      .createQueryBuilder('c')
      .select('c.taskId', 'taskId')
      .addSelect('COUNT(*)', 'n')
      .where('c.taskId IN (:...ids)', { ids })
      .groupBy('c.taskId')
      .getRawMany<{ taskId: number; n: number }>();
    for (const row of comments)
      counts.comments.set(Number(row.taskId), Number(row.n));
    return counts;
  }

  async inbox(user: User) {
    const inbox = await this.projects.inbox(user);
    return this.rows(
      await this.visible(user)
        .andWhere('task.projectId = :id', { id: inbox.id })
        .orderBy('task.position', 'ASC')
        .addOrderBy('task.id', 'ASC')
        .getMany(),
    );
  }

  /** Due today or before: Today shows the overdue ones above today's. */
  async dueBy(user: User, day: Day) {
    return this.rows(
      await this.ordered(
        this.visible(user).andWhere('task.dueDate <= :day', { day }),
      ).getMany(),
    );
  }

  async between(user: User, from: Day, to: Day) {
    return this.rows(
      await this.ordered(
        this.visible(user).andWhere('task.dueDate BETWEEN :from AND :to', {
          from,
          to,
        }),
      ).getMany(),
    );
  }

  async inProject(user: User, projectId: number) {
    return this.rows(
      await this.visible(user)
        .andWhere('task.projectId = :projectId', { projectId })
        .orderBy('task.position', 'ASC')
        .addOrderBy('task.id', 'ASC')
        .getMany(),
    );
  }

  async all(user: User) {
    return this.ordered(this.visible(user)).getMany();
  }

  /** What changed in a project since `since`, deleted tasks included. */
  async changedSince(user: User, projectId: number, since: Date) {
    const tasks = await this.visible(user, { completed: true })
      .withDeleted()
      .andWhere('task.projectId = :projectId', { projectId })
      .andWhere('task.updatedAt > :since', { since: sqlTime(since) })
      .getMany();
    return this.rows(tasks);
  }

  async search(user: User, term: string, take = 8) {
    const like = `%${term}%`;
    // Sliced here rather than with take(): TypeORM can't page a query with
    // joins that is ordered by an expression, and one person's matches are
    // few enough.
    const tasks = await this.ordered(
      this.visible(user).andWhere(
        new Brackets((q) =>
          q
            .where('task.title LIKE :like', { like })
            .orWhere('task.description LIKE :like', { like }),
        ),
      ),
    ).getMany();
    return this.rows(tasks.slice(0, take));
  }

  async find(id: number, user: User, options: { completed?: boolean } = {}) {
    const task = await this.tasks.findOne({
      where: { id },
      relations: {
        project: true,
        section: true,
        parent: true,
        labels: true,
        assignee: true,
      },
    });
    if (!task) throw new NotFoundException('That task is gone. Done, maybe?');
    if (!(await this.projects.isMember(task.project.id, user.id)))
      throw new ForbiddenException('That task is in someone else’s project.');
    if (task.completedAt && options.completed === false)
      throw new BadRequestException('That task is already done.');
    return task;
  }

  /** Whether the task exists (deleted ones too) in a project the user is in. */
  async canSee(id: number, user: User) {
    return this.visible(user, { completed: true })
      .withDeleted()
      .andWhere('task.id = :id', { id })
      .getExists();
  }

  /** The task dialog: the task, its sub-tasks (done ones too) and who could do it. */
  async detail(task: Task, user: User) {
    const subtasks = await this.visible(user, { completed: true })
      .andWhere('task.parentId = :id', { id: task.id })
      .orderBy('task.completedAt IS NULL', 'DESC')
      .addOrderBy('task.position', 'ASC')
      .getMany();
    const [row] = await this.rows([task]);
    const shared = await this.projects.isShared(task.project.id);
    return {
      ...row,
      subtaskRows: await this.rows(subtasks),
      parent: task.parent
        ? { id: task.parent.id, title: task.parent.title }
        : null,
      section: task.section
        ? { id: task.section.id, name: task.section.name }
        : null,
      people: shared ? await this.projects.people(task.project.id) : [],
    };
  }

  async comments(taskId: number, after?: Date | null) {
    const query = this.db
      .getRepository(Comment)
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .leftJoinAndSelect('comment.task', 'task')
      .where('comment.taskId = :taskId', { taskId })
      .orderBy('comment.createdAt', 'DESC')
      .addOrderBy('comment.id', 'DESC');
    if (after)
      query.andWhere('comment.createdAt > :after', { after: sqlTime(after) });
    return query.getMany();
  }

  /** Quick add and the task form both land here. */
  async create(user: User, input: TaskInput) {
    const all = await this.projects.forUser(user);
    const parsed = input.raw
      ? parseQuickAdd('', { today: today(), projects: [] })
      : parseQuickAdd(input.text, { today: today(), projects: all });
    if (input.raw) parsed.title = input.text.trim();
    if (!parsed.title)
      throw new ValidationException({
        text: 'That’s all dates and labels. What’s the task?',
      });

    const parent = input.parentId
      ? await this.find(input.parentId, user)
      : null;
    const projectId =
      parent?.project.id ??
      input.projectId ??
      parsed.projectId ??
      input.defaultProjectId ??
      all.find((p) => p.isInbox)!.id;
    const project = await this.projects.find(projectId, user);
    // A section belongs to the project it was picked in; if the text sent
    // the task elsewhere, it goes there without one.
    const section =
      parent?.section ??
      (input.sectionId &&
      project.id === (input.projectId ?? input.defaultProjectId)
        ? await this.projects.section(project.id, input.sectionId)
        : null);

    const recurrence = input.recurrence ?? parsed.recurrence;
    const dueDate =
      input.dueDate !== undefined
        ? input.dueDate
        : recurrence && !parsed.dueDate
          ? firstOccurrence(recurrence, today())
          : (parsed.dueDate ?? input.defaultDueDate ?? null);

    const last = await this.tasks
      .createQueryBuilder('t')
      .select('MAX(t.position)', 'max')
      .where('t.projectId = :id', { id: project.id })
      .getRawOne<{ max: number | null }>();

    const task = await this.tasks.save(
      this.tasks.create({
        title: parsed.title,
        description: input.description?.trim() ?? '',
        priority: (input.priority ?? parsed.priority ?? 4) as Task['priority'],
        dueDate,
        dueTime: dueDate
          ? input.dueTime !== undefined
            ? input.dueTime
            : parsed.dueTime
          : null,
        recurrence: dueDate ? recurrence : null,
        project,
        section,
        parent,
        labels: await this.labels(user, [
          ...(input.labels ?? []),
          ...parsed.labels,
        ]),
        assignee: await this.assignee(project.id, input.assigneeId),
        createdBy: user,
        position: Number(last?.max ?? 0) + 1,
      }),
    );
    await this.log('added', user, task);
    return task;
  }

  async update(task: Task, user: User, changes: TaskChanges) {
    if (changes.title !== undefined) {
      if (!changes.title.trim())
        throw new ValidationException({ title: 'A task needs a name.' });
      task.title = changes.title.trim();
    }
    if (changes.description !== undefined)
      task.description = changes.description;
    if (changes.priority !== undefined)
      task.priority = changes.priority as Task['priority'];
    if (changes.dueDate !== undefined) {
      task.dueDate = changes.dueDate;
      if (!changes.dueDate) {
        task.dueTime = null;
        task.recurrence = null;
      }
    }
    if (changes.dueTime !== undefined && task.dueDate)
      task.dueTime = changes.dueTime;
    if (changes.recurrence !== undefined) {
      if (changes.recurrence && !isRecurrence(changes.recurrence))
        throw new ValidationException({
          recurrence: 'Try “every day”, “every monday” or “every 2 weeks”.',
        });
      task.recurrence = changes.recurrence;
      if (changes.recurrence && !task.dueDate)
        task.dueDate = firstOccurrence(changes.recurrence, today());
    }
    if (
      changes.projectId !== undefined &&
      changes.projectId !== task.project.id
    ) {
      if (task.parent)
        throw new ValidationException({
          projectId: 'A sub-task goes where its parent goes.',
        });
      task.project = await this.projects.find(changes.projectId, user);
      task.section = null;
      if (
        task.assignee &&
        !(await this.projects.isMember(task.project.id, task.assignee.id))
      )
        task.assignee = null;
      // Sub-tasks come along.
      await this.tasks.update(
        { parent: { id: task.id } },
        { project: task.project, section: null },
      );
    }
    if (changes.sectionId !== undefined)
      task.section = changes.sectionId
        ? await this.projects.section(task.project.id, changes.sectionId)
        : null;
    if (changes.labels !== undefined)
      task.labels = await this.labels(user, changes.labels);
    if (changes.assigneeId !== undefined)
      task.assignee = await this.assignee(task.project.id, changes.assigneeId);
    return this.tasks.save(task);
  }

  /**
   * Done. A recurring task isn't: it moves to its next date, the way a
   * daily habit comes back tomorrow. Either way it counts as completed.
   */
  async complete(task: Task, user: User) {
    await this.log('completed', user, task);
    const next =
      task.recurrence && task.dueDate
        ? nextOccurrence(task.recurrence, task.dueDate, today())
        : null;
    if (next) {
      task.dueDate = next;
      await this.tasks.save(task);
      return { task, next };
    }
    task.completedAt = new Date();
    await this.tasks.save(task);
    // Sub-tasks are done when their parent is.
    await this.tasks.update(
      { parent: { id: task.id }, completedAt: IsNull() },
      { completedAt: task.completedAt },
    );
    return { task, next: null };
  }

  async reopen(task: Task, user: User) {
    task.completedAt = null;
    await this.tasks.save(task);
    // Opening a sub-task opens its parent too.
    if (task.parent?.completedAt)
      await this.tasks.update(task.parent.id, { completedAt: null });
    await this.log('reopened', user, task);
    return task;
  }

  async remove(task: Task, user: User) {
    await this.log('deleted', user, task);
    await this.tasks.softDelete({ parent: { id: task.id } });
    await this.tasks.softDelete(task.id);
  }

  /** Drag and drop: into a section (or none), between two tasks. */
  async move(
    task: Task,
    user: User,
    to: { projectId: number; sectionId: number | null; before: number | null },
  ) {
    if (to.projectId !== task.project.id)
      await this.update(task, user, { projectId: to.projectId });
    task.section = to.sectionId
      ? await this.projects.section(task.project.id, to.sectionId)
      : null;
    const siblings = await this.tasks.find({
      where: {
        project: { id: task.project.id },
        section: to.sectionId ? { id: to.sectionId } : IsNull(),
        parent: IsNull(),
        completedAt: IsNull(),
      },
      order: { position: 'ASC', id: 'ASC' },
    });
    const others = siblings.filter((t) => t.id !== task.id);
    const index =
      to.before === null
        ? others.length
        : others.findIndex((t) => t.id === to.before);
    others.splice(index === -1 ? others.length : index, 0, task);
    // Renumber the column: a handful of rows, and positions stay whole numbers.
    await this.db.transaction(async (db) => {
      for (const [i, row] of others.entries())
        await db.getRepository(Task).update(row.id, { position: i + 1 });
      await db.getRepository(Task).update(task.id, { section: task.section });
    });
  }

  /** Labels by name: yours, and made on the spot when they're new. */
  async labels(user: User, names: string[]) {
    const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    if (!wanted.length) return [];
    const repo = this.db.getRepository(Label);
    const existing = await repo.find({ where: { owner: { id: user.id } } });
    const result: Label[] = [];
    for (const name of wanted) {
      const found = existing.find(
        (l) => l.name.toLowerCase() === name.toLowerCase(),
      );
      result.push(
        found ?? (await repo.save(repo.create({ name, owner: user }))),
      );
    }
    return result;
  }

  private async assignee(
    projectId: number,
    assigneeId: number | null | undefined,
  ) {
    if (!assigneeId) return null;
    if (!(await this.projects.isMember(projectId, assigneeId)))
      throw new ValidationException({
        assigneeId: 'Only people in this project can be assigned.',
      });
    return { id: assigneeId } as User;
  }

  /**
   * Marks a task changed without changing it, so a shared project's poll
   * picks it up: a new comment changes its comment count.
   */
  async touch(task: Task) {
    await this.tasks
      .createQueryBuilder()
      .update(Task)
      .set({ updatedAt: () => "datetime('now')" })
      .where('id = :id', { id: task.id })
      .execute();
  }

  async log(kind: ActivityKind, actor: User, task: Task) {
    await this.db.getRepository(Activity).save({
      kind,
      actor,
      project: task.project,
      taskId: task.id,
      taskTitle: task.title,
      priority: task.priority,
    });
  }

  /** Counts for the sidebar and the tab bar. */
  async sidebarCounts(user: User) {
    const day = today();
    const rows = await this.tasks
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .innerJoin(
        'project.members',
        'membership',
        'membership.userId = :userId',
        {
          userId: user.id,
        },
      )
      .select('task.projectId', 'projectId')
      .addSelect('COUNT(*)', 'open')
      .addSelect('SUM(CASE WHEN task.dueDate <= :day THEN 1 ELSE 0 END)', 'due')
      .where('task.completedAt IS NULL')
      .andWhere('task.parentId IS NULL')
      .setParameter('day', day)
      .groupBy('task.projectId')
      .getRawMany<{ projectId: number; open: number; due: number }>();
    const inbox = await this.projects.inbox(user);
    const projects: Record<number, number> = {};
    let dueToday = 0;
    for (const row of rows) {
      projects[Number(row.projectId)] = Number(row.open);
      dueToday += Number(row.due);
    }
    return { inbox: projects[inbox.id] ?? 0, today: dueToday, projects };
  }

  projectsOfTasks(ids: number[]) {
    return this.db.getRepository(Project).findBy({ id: In(ids) });
  }

  sectionRepo() {
    return this.db.getRepository(Section);
  }
}

/** SQLite stores `datetime` columns as UTC text; compare against the same shape. */
export const sqlTime = (date: Date) =>
  date.toISOString().replace('T', ' ').replace('Z', '');

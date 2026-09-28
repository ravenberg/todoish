// Brings in multer's Express.Multer.File type.
import type {} from 'multer';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AnyRequest,
  SignedUrls,
  View,
  ViewService,
  deepMerge,
  optional,
} from 'nestjs-mvc';
import { IsNull, Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { parseCsv, toCsv } from '../common/csv.js';
import { FilePipe } from '../common/file.pipe.js';
import {
  Invitation,
  Project,
  ProjectMember,
  Section,
  type User,
} from '../database/entities/index.js';
import { isRecurrence } from '../tasks/recurrence.js';
import { TaskDetail } from '../tasks/task-detail.js';
import { TasksService } from '../tasks/tasks.service.js';
import {
  ProjectSchema,
  SectionSchema,
  UpdateProjectSchema,
} from './projects.schemas.js';
import { ProjectsService } from './projects.service.js';

/** Sent by a shared project's poll: when it last heard from us. */
const SINCE_HEADER = 'x-project-since';
const WEEK = 7 * 24 * 60 * 60;
const CSV_HEADER = [
  'Title',
  'Description',
  'Priority',
  'Due date',
  'Due time',
  'Recurrence',
  'Section',
  'Labels',
];

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
    private readonly detail: TaskDetail,
    private readonly view: ViewService,
    private readonly links: SignedUrls,
    @InjectRepository(Project) private readonly repo: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    @InjectRepository(Section) private readonly sections: Repository<Section>,
    @InjectRepository(Invitation)
    private readonly invitations: Repository<Invitation>,
  ) {}

  /** "My projects": every project, with how many open tasks and people. */
  @Get()
  @View('Projects/Index')
  async index(@CurrentUser() user: User) {
    const [projects, counts] = await Promise.all([
      this.projects.forUser(user),
      this.tasks.sidebarCounts(user),
    ]);
    const people = await this.projects.memberCounts(projects.map((p) => p.id));
    return {
      projects: projects
        .filter((p) => !p.isInbox)
        .map((p) => ({
          ...p,
          open: counts.projects[p.id] ?? 0,
          people: people.get(p.id) ?? 1,
        })),
    };
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body({ schema: ProjectSchema }) body: z.infer<typeof ProjectSchema>,
  ) {
    const last = await this.repo.maximum('position', {
      owner: { id: user.id },
    });
    const project = await this.repo.save(
      this.repo.create({
        name: body.name,
        color: body.color,
        viewStyle: body.viewStyle,
        owner: user,
        position: (last ?? 0) + 1,
      }),
    );
    await this.members.save(
      this.members.create({ project, user, favorite: body.favorite }),
    );
    // The sidebar is a once() prop: tell every page's copy it changed.
    this.view.refresh('sidebar');
    return this.view.redirect(`/projects/${project.id}`);
  }

  /**
   * A project, as a list or a board. A shared project polls: the page sends
   * `cursor` back in a header, and gets `changes`, the tasks that changed
   * since, keyed by id. It's `deepMerge()`, so the client keeps one map of
   * the latest copy of each task and lays it over the list it has.
   */
  @Get(':id')
  @View('Projects/Show')
  async show(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Headers(SINCE_HEADER) sinceHeader: string | undefined,
    @Req() req: AnyRequest,
  ) {
    const project = await this.projects.find(id, user);
    if (project.isInbox) return this.view.redirect('/inbox');
    const membership = await this.members.findOneByOrFail({
      project: { id },
      user: { id: user.id },
    });
    const people = await this.projects.people(id);
    const since = sinceHeader ? new Date(sinceHeader) : null;
    const after =
      since && !Number.isNaN(since.getTime())
        ? new Date(since.getTime() - 1000)
        : null;

    return {
      project: {
        id: project.id,
        name: project.name,
        color: project.color,
        viewStyle: project.viewStyle,
        favorite: membership.favorite,
        mine: project.owner.id === user.id,
        owner: { id: project.owner.id, name: project.owner.name },
      },
      people,
      sections: async () =>
        (await this.projects.sectionsOf(id)).map((s) => ({
          id: s.id,
          name: s.name,
        })),
      tasks: () => this.tasks.inProject(user, id),
      cursor: new Date().toISOString(),
      changes: deepMerge(async () =>
        after
          ? Object.fromEntries(
              (await this.tasks.changedSince(user, id, after)).map((task) => [
                task.id,
                task,
              ]),
            )
          : {},
      ),
      // For the Share dialog, when it opens.
      share: optional(async () => ({
        people: people.map((p) => ({ ...p, owner: p.id === project.owner.id })),
        pending: await this.invitations.count({
          where: { project: { id }, acceptedAt: IsNull() },
        }),
      })),
      ...this.detail.props(req, user),
    };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: UpdateProjectSchema })
    body: z.infer<typeof UpdateProjectSchema>,
  ) {
    const project = await this.projects.find(id, user);
    const { favorite, ...changes } = body;
    if (Object.keys(changes).length) {
      if (project.isInbox)
        throw new ForbiddenException(
          'The Inbox is the Inbox. It stays as it is.',
        );
      await this.repo.update(id, changes);
    }
    if (favorite !== undefined)
      await this.members.update(
        { project: { id }, user: { id: user.id } },
        { favorite },
      );
    this.view.refresh('sidebar');
    return this.view.back();
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const project = await this.owned(id, user);
    await this.repo.remove(project);
    this.view.refresh('sidebar');
    return this.view
      .flash('success', `“${project.name}” and its tasks are gone.`)
      .redirect('/today');
  }

  @Post(':id/leave')
  async leave(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const project = await this.projects.find(id, user);
    if (project.owner.id === user.id)
      throw new ForbiddenException(
        'You own this project. Delete it instead, or it would be nobody’s.',
      );
    await this.members.delete({ project: { id }, user: { id: user.id } });
    this.view.refresh('sidebar');
    return this.view
      .flash('success', `You left “${project.name}”.`)
      .redirect('/today');
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    const project = await this.owned(id, user);
    if (userId === project.owner.id)
      throw new ForbiddenException('The owner stays.');
    await this.members.delete({ project: { id }, user: { id: userId } });
    return this.view.back();
  }

  /**
   * A link to share however you like. It's signed (nothing secret is
   * stored), valid for a week, and works once: accepting marks the
   * invitation used. It comes back to the dialog as a flash.
   */
  @Post(':id/invitations')
  async invite(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const project = await this.projects.find(id, user);
    const invitation = await this.invitations.save(
      this.invitations.create({ project, invitedBy: user }),
    );
    const url = this.links.sign(`/invitations/${invitation.id}`, {
      expiresIn: WEEK,
    });
    return this.view.flash('invitation', url).back();
  }

  @Post(':id/sections')
  async createSection(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: SectionSchema }) body: z.infer<typeof SectionSchema>,
  ) {
    const project = await this.projects.find(id, user);
    const last = await this.sections.maximum('position', { project: { id } });
    await this.sections.save(
      this.sections.create({
        name: body.name,
        project,
        position: (last ?? 0) + 1,
      }),
    );
    return this.view.back();
  }

  @Patch(':id/sections/:sectionId')
  async renameSection(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Body({ schema: SectionSchema }) body: z.infer<typeof SectionSchema>,
  ) {
    await this.projects.find(id, user);
    const section = await this.projects.section(id, sectionId);
    await this.sections.update(section.id, { name: body.name });
    return this.view.back();
  }

  @Delete(':id/sections/:sectionId')
  async removeSection(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
  ) {
    await this.projects.find(id, user);
    const section = await this.projects.section(id, sectionId);
    // Its tasks stay, without a section.
    await this.sections.remove(section);
    return this.view.back();
  }

  /**
   * "Export as CSV" is a normal link, so it's an Inertia visit, which can't
   * download a file. `location()` tells the browser to go there for real.
   */
  @Get(':id/export')
  async export(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.projects.find(id, user);
    return this.view.location(`/projects/${id}/export.csv`);
  }

  @Get(':id/export.csv')
  async exportCsv(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const project = await this.projects.find(id, user);
    const [tasks, sections] = await Promise.all([
      this.tasks.inProject(user, id),
      this.projects.sectionsOf(id),
    ]);
    const sectionName = new Map(sections.map((s) => [s.id, s.name]));
    const csv = toCsv([
      CSV_HEADER,
      ...tasks
        .filter((t) => !t.parentId)
        .map((t) => [
          t.title,
          t.description,
          `p${t.priority}`,
          t.dueDate ?? '',
          t.dueTime ?? '',
          t.recurrence ?? '',
          t.sectionId ? (sectionName.get(t.sectionId) ?? '') : '',
          t.labels.map((l) => l.name).join(' '),
        ]),
    ]);
    const filename = `${project.name.replace(/[^\w -]+/g, '').trim() || 'project'}.csv`;
    return new StreamableFile(Buffer.from(csv), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  /** The other way round: tasks from a CSV, in the columns the export writes. */
  @Post(':id/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2_000_000 } }))
  async import(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new FilePipe({
        types: [/^text\/(csv|plain)$/, /^application\/vnd\.ms-excel$/],
      }),
    )
    file: Express.Multer.File,
  ) {
    const project = await this.projects.find(id, user);
    const [header, ...rows] = parseCsv(file.buffer.toString('utf8'));
    const column = (name: string) =>
      (header ?? []).findIndex(
        (h) => h.trim().toLowerCase() === name.toLowerCase(),
      );
    const title = column('Title') === -1 ? 0 : column('Title');
    const sections = await this.projects.sectionsOf(id);
    let count = 0;
    for (const row of rows.slice(0, 500)) {
      const cell = (name: string) => {
        const index = column(name);
        return index === -1 ? '' : (row[index] ?? '').trim();
      };
      if (!row[title]?.trim()) continue;
      const sectionName = cell('Section');
      let section = sections.find((s) => s.name === sectionName);
      if (sectionName && !section) {
        section = await this.sections.save(
          this.sections.create({
            name: sectionName,
            project,
            position: sections.length + 1,
          }),
        );
        sections.push(section);
      }
      const priority = Number(/^p([1-4])$/i.exec(cell('Priority'))?.[1] ?? 4);
      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(cell('Due date'))
        ? cell('Due date')
        : null;
      await this.tasks
        .create(user, {
          // Imported titles are titles: no quick-add parsing of "fri" in them.
          text: row[title].trim(),
          raw: true,
          description: cell('Description'),
          projectId: id,
          sectionId: section?.id ?? null,
          priority,
          dueDate,
          dueTime:
            dueDate && /^\d{2}:\d{2}$/.test(cell('Due time'))
              ? cell('Due time')
              : null,
          recurrence:
            dueDate && isRecurrence(cell('Recurrence'))
              ? cell('Recurrence').toLowerCase()
              : null,
          labels: cell('Labels').split(/\s+/).filter(Boolean),
        })
        .catch(() => null);
      count++;
    }
    return this.view
      .flash(
        'success',
        `${count} task${count === 1 ? '' : 's'} imported. Nice.`,
      )
      .back();
  }

  private async owned(id: number, user: User) {
    const project = await this.projects.find(id, user);
    if (project.owner.id !== user.id)
      throw new ForbiddenException(
        `Only ${project.owner.name.split(' ')[0]}, who owns this project, can do that.`,
      );
    return project;
  }
}

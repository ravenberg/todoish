import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Project,
  ProjectMember,
  Section,
  type User,
} from '../database/entities/index.js';

export interface ProjectRef {
  id: number;
  name: string;
  color: string;
  isInbox: boolean;
}

export const projectRef = (project: Project): ProjectRef => ({
  id: project.id,
  name: project.name,
  color: project.color,
  isInbox: project.isInbox,
});

/**
 * Who sees what. A project is visible to its members, and the owner is one.
 * Anything that reads a project goes through `find`, which says 404 for a
 * project that doesn't exist and 403 for one you're not in.
 */
@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    @InjectRepository(Section) private readonly sections: Repository<Section>,
  ) {}

  async find(id: number, user: User): Promise<Project> {
    const project = await this.projects.findOneBy({ id });
    if (!project)
      throw new NotFoundException('That project doesn’t exist (anymore).');
    if (!(await this.isMember(project.id, user.id)))
      throw new ForbiddenException(
        'This project is someone else’s. Ask them for an invitation.',
      );
    return project;
  }

  isMember(projectId: number, userId: number) {
    return this.members.existsBy({
      project: { id: projectId },
      user: { id: userId },
    });
  }

  async inbox(user: User): Promise<Project> {
    return this.projects.findOneByOrFail({
      owner: { id: user.id },
      isInbox: true,
    });
  }

  /** Every project the user is in, Inbox first, then in their order. */
  async forUser(user: User) {
    const rows = await this.members.find({
      where: { user: { id: user.id } },
      relations: { project: true },
    });
    const counts = await this.memberCounts(rows.map((r) => r.project.id));
    return rows
      .map((row) => ({
        ...projectRef(row.project),
        viewStyle: row.project.viewStyle,
        favorite: row.favorite,
        shared: (counts.get(row.project.id) ?? 1) > 1,
        mine: row.project.owner.id === user.id,
        position: row.project.position,
      }))
      .sort(
        (a, b) =>
          Number(b.isInbox) - Number(a.isInbox) ||
          Number(b.mine) - Number(a.mine) ||
          a.position - b.position ||
          a.id - b.id,
      );
  }

  async memberCounts(projectIds: number[]) {
    if (!projectIds.length) return new Map<number, number>();
    const rows = await this.members
      .createQueryBuilder('m')
      .select('m.projectId', 'projectId')
      .addSelect('COUNT(*)', 'n')
      .where('m.projectId IN (:...ids)', { ids: projectIds })
      .groupBy('m.projectId')
      .getRawMany<{ projectId: number; n: number }>();
    return new Map(rows.map((r) => [Number(r.projectId), Number(r.n)]));
  }

  async people(projectId: number) {
    const rows = await this.members.find({
      where: { project: { id: projectId } },
      order: { joinedAt: 'ASC' },
    });
    return rows.map((row) => ({ id: row.user.id, name: row.user.name }));
  }

  async isShared(projectId: number) {
    return (await this.members.countBy({ project: { id: projectId } })) > 1;
  }

  sectionsOf(projectId: number) {
    return this.sections.find({
      where: { project: { id: projectId } },
      order: { position: 'ASC', id: 'ASC' },
    });
  }

  async section(projectId: number, sectionId: number) {
    const section = await this.sections.findOneBy({
      id: sectionId,
      project: { id: projectId },
    });
    if (!section) throw new NotFoundException('That section is gone.');
    return section;
  }
}

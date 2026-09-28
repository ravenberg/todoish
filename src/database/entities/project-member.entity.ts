import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Project } from './project.entity.js';
import { User } from './user.entity.js';

/** Who may see a project. The owner is a member too, so there is one check. */
@Entity()
@Unique(['project', 'user'])
export class ProjectMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, (project) => project.members, {
    onDelete: 'CASCADE',
  })
  project: Project;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  user: User;

  /** In the sidebar's Favorites, for this member only. */
  @Column('boolean', { default: false })
  favorite: boolean;

  @CreateDateColumn()
  joinedAt: Date;
}

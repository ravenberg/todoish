import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from './project.entity.js';
import { User } from './user.entity.js';

export const ACTIVITY_KINDS = [
  'added',
  'completed',
  'reopened',
  'commented',
  'deleted',
  'joined',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/**
 * Something that happened, for Completed and a project's activity. Titles are
 * copied in, so the entry still reads right after the task is gone.
 */
@Entity()
export class Activity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  kind: ActivityKind;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  actor: User;

  @ManyToOne(() => Project, { onDelete: 'CASCADE', eager: true })
  project: Project;

  @Column('integer', { nullable: true })
  taskId: number | null;

  @Column('varchar', { default: '' })
  taskTitle: string;

  @Column('integer', { default: 4 })
  priority: number;

  @CreateDateColumn()
  createdAt: Date;
}

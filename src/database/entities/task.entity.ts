import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Label } from './label.entity.js';
import { Project } from './project.entity.js';
import { Section } from './section.entity.js';
import { User } from './user.entity.js';

/** 1 is the most urgent, as in Todoist: p1 is red, p4 is no priority at all. */
export type Priority = 1 | 2 | 3 | 4;

@Entity()
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  title: string;

  @Column('text', { default: '' })
  description: string;

  @Column('integer', { default: 4 })
  priority: Priority;

  /** A calendar day, `YYYY-MM-DD`: a due date has no time zone. */
  @Column('varchar', { nullable: true })
  dueDate: string | null;

  /** `HH:mm`, only with a due date. */
  @Column('varchar', { nullable: true })
  dueTime: string | null;

  /** "every monday": completing the task moves it to the next one instead. */
  @Column('varchar', { nullable: true })
  recurrence: string | null;

  @Column('float', { default: 0 })
  position: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  project: Project;

  @ManyToOne(() => Section, { onDelete: 'SET NULL', nullable: true })
  section: Section | null;

  /** A sub-task's parent. */
  @ManyToOne(() => Task, { onDelete: 'CASCADE', nullable: true })
  parent: Task | null;

  @ManyToMany(() => Label, { onDelete: 'CASCADE' })
  @JoinTable()
  labels: Label[];

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  assignee: User | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  createdBy: User | null;

  @Column('datetime', { nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  /** What the poll on a shared project compares against. */
  @UpdateDateColumn()
  updatedAt: Date;

  /** Soft-deleted, so the poll can tell others the task is gone. */
  @DeleteDateColumn()
  deletedAt: Date | null;
}

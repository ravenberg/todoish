import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from './task.entity.js';
import { User } from './user.entity.js';

/** A comment on a task, with at most one file. */
@Entity()
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text', { default: '' })
  body: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  task: Task;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: true })
  author: User | null;

  @Column('varchar', { nullable: true })
  filename: string | null;

  @Column('varchar', { nullable: true })
  mimeType: string | null;

  @Column('integer', { nullable: true })
  size: number | null;

  /** Where the file is, under STORAGE_PATH. */
  @Column('varchar', { nullable: true })
  storageKey: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

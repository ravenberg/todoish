import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from './project.entity.js';
import { User } from './user.entity.js';

/**
 * An invitation to a project. Nothing secret is stored: the link is signed.
 * Accepting sets `acceptedAt`, and the handler refuses a link whose
 * invitation already has one, so every link works once.
 */
@Entity()
export class Invitation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE', eager: true })
  project: Project;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  invitedBy: User;

  @Column('datetime', { nullable: true })
  acceptedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

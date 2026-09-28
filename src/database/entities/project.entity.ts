import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ProjectMember } from './project-member.entity.js';
import type { Section } from './section.entity.js';
import { User } from './user.entity.js';

export const VIEW_STYLES = ['list', 'board'] as const;
export type ViewStyle = (typeof VIEW_STYLES)[number];

@Entity()
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  name: string;

  /** A key from the palette in frontend/lib/colors.ts. */
  @Column('varchar', { default: 'charcoal' })
  color: string;

  /** Everyone has exactly one: where tasks without a project go. */
  @Column('boolean', { default: false })
  isInbox: boolean;

  @Column('varchar', { default: 'list' })
  viewStyle: ViewStyle;

  @Column('integer', { default: 0 })
  position: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  owner: User;

  @OneToMany('ProjectMember', 'project')
  members: ProjectMember[];

  @OneToMany('Section', 'project')
  sections: Section[];

  @CreateDateColumn()
  createdAt: Date;
}

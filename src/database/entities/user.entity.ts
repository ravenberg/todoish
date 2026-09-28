import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  name: string;

  @Column('varchar', { unique: true })
  email: string;

  /** Left out of every query unless selected explicitly. */
  @Column('varchar', { select: false, nullable: true })
  passwordHash: string | null;

  /** Tasks a day to call it a good day, and a week to call it a good week. */
  @Column('integer', { default: 5 })
  dailyGoal: number;

  @Column('integer', { default: 25 })
  weeklyGoal: number;

  /** Days that don't break a streak, 0 for Sunday to 6 for Saturday. */
  @Column('simple-json', { default: '[0,6]' })
  daysOff: number[];

  /** On holiday: streaks stand still. */
  @Column('boolean', { default: false })
  vacation: boolean;

  /** Keep page state in browser history encrypted, for shared computers. */
  @Column('boolean', { default: false })
  encryptHistory: boolean;

  /** Goes up when the calendar feed link is reset, which kills the old one. */
  @Column('integer', { default: 1 })
  calendarVersion: number;

  /** The secret part of this user's email-to-inbox address. */
  @Column('varchar', { unique: true })
  inboxToken: string;

  @CreateDateColumn()
  createdAt: Date;
}

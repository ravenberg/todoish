import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity.js';

/** Personal: yours to put on any task you can see. */
@Entity()
export class Label {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  name: string;

  @Column('varchar', { default: 'charcoal' })
  color: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  owner: User;
}

import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity.js';

/** A saved query, like `today & p1`. See src/filters/query.ts. */
@Entity()
export class Filter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  name: string;

  @Column('varchar')
  query: string;

  @Column('varchar', { default: 'charcoal' })
  color: string;

  @Column('integer', { default: 0 })
  position: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  owner: User;
}

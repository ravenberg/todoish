import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from './project.entity.js';

@Entity()
export class Section {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  name: string;

  @Column('integer', { default: 0 })
  position: number;

  @ManyToOne(() => Project, (project) => project.sections, {
    onDelete: 'CASCADE',
  })
  project: Project;
}

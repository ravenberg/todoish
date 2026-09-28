import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseSeeder } from './database.seeder.js';
import {
  Activity,
  Comment,
  Filter,
  Invitation,
  Label,
  Project,
  ProjectMember,
  Section,
  Task,
  User,
} from './entities/index.js';

/** Every entity; tests build their in-memory databases from it too. */
export const entities = [
  User,
  Project,
  ProjectMember,
  Section,
  Label,
  Task,
  Comment,
  Filter,
  Activity,
  Invitation,
];

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DATABASE_PATH ?? 'todoish.sqlite',
      entities,
      // Demo app: TypeORM owns the schema instead of migrations.
      synchronize: true,
    }),
    TypeOrmModule.forFeature(entities),
  ],
  providers: [DatabaseSeeder],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

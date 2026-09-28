import { Global, Module } from '@nestjs/common';
import { ProductivityService } from './productivity/productivity.service.js';
import { ProjectsService } from './projects/projects.service.js';
import { TaskDetail } from './tasks/task-detail.js';
import { TasksService } from './tasks/tasks.service.js';

/** The services most controllers share. */
@Global()
@Module({
  providers: [ProjectsService, TasksService, TaskDetail, ProductivityService],
  exports: [ProjectsService, TasksService, TaskDetail, ProductivityService],
})
export class DomainModule {}

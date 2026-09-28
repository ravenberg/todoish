import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { ActivityController } from './activity/activity.controller.js';
import { CalendarController } from './calendar/calendar.controller.js';
import { CommentsController } from './comments/comments.controller.js';
import { FiltersController } from './filters/filters.controller.js';
import { HomeController } from './home/home.controller.js';
import { HooksController } from './hooks/hooks.controller.js';
import { InvitationsController } from './invitations/invitations.controller.js';
import { ProductivityController } from './productivity/productivity.controller.js';
import { ProjectsController } from './projects/projects.controller.js';
import { SearchController } from './search/search.controller.js';
import { SettingsController } from './settings/settings.controller.js';
import { TasksController } from './tasks/tasks.controller.js';
import { UpcomingController } from './upcoming/upcoming.controller.js';

/** Every page and action in Todoish. */
@Module({
  imports: [AuthModule],
  controllers: [
    HomeController,
    TasksController,
    CommentsController,
    UpcomingController,
    ProjectsController,
    InvitationsController,
    ActivityController,
    FiltersController,
    SearchController,
    ProductivityController,
    SettingsController,
    CalendarController,
    HooksController,
  ],
})
export class FeaturesModule {}

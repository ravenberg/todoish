import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SkipCsrf } from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { Public } from '../auth/public.decorator.js';
import { User } from '../database/entities/index.js';
import { TasksService } from '../tasks/tasks.service.js';

const EmailSchema = z.object({
  subject: z.string().trim().min(1, 'An email needs a subject.').max(500),
  text: z.string().max(10_000).default(''),
});

/**
 * Email to Inbox: your mail provider (or `npm run email:demo`) posts each
 * forwarded email here. It's not a page and there's no login cookie, so
 * CSRF protection has nothing to protect: @SkipCsrf(). The secret token in
 * the URL is the proof. The subject is read like quick add, so "Call the
 * bank tomorrow p1" arrives with a date and a priority.
 */
@Public()
@SkipCsrf()
@Controller('hooks')
export class HooksController {
  constructor(
    private readonly tasks: TasksService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Post('inbox/:token')
  @HttpCode(201)
  async inbox(
    @Param('token') token: string,
    @Body({ schema: EmailSchema }) body: z.infer<typeof EmailSchema>,
  ) {
    const user = await this.users.findOneBy({ inboxToken: token });
    if (!user) throw new NotFoundException('No inbox has that address.');
    const task = await this.tasks.create(user, {
      text: body.subject,
      description: body.text,
    });
    return {
      task: {
        id: task.id,
        title: task.title,
        dueDate: task.dueDate,
        priority: task.priority,
        project: task.project.name,
      },
    };
  }
}

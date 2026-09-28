import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ValidSignature } from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { Public } from '../auth/public.decorator.js';
import { addDays } from '../common/dates.js';
import { User } from '../database/entities/index.js';
import { TasksService } from '../tasks/tasks.service.js';

/** iCalendar escaping: backslash, comma, semicolon and newlines. */
const text = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/[,;]/g, '\\$&')
    .replace(/\r?\n/g, '\\n');

/** Lines longer than 75 octets fold onto the next, as RFC 5545 asks. */
const fold = (line: string) => line.replace(/(.{74})(?=.)/g, '$1\r\n ');

/**
 * Your tasks with a date, as a calendar feed. Calendar apps fetch it without
 * cookies, so there's no login: the URL is signed, and carries the version
 * the settings page last handed out. Reset the link and the old one is dead.
 */
@Public()
@ValidSignature()
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly tasks: TasksService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get(':id.ics')
  async feed(@Param('id', ParseIntPipe) id: number, @Query('v') v: string) {
    const user = await this.users.findOneBy({ id });
    if (!user || String(user.calendarVersion) !== v)
      throw new ForbiddenException(
        'This calendar link was reset. Get the new one in Settings.',
      );
    const tasks = (await this.tasks.all(user)).filter((t) => t.dueDate);
    const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Todoish//Tasks, ish//EN',
      'X-WR-CALNAME:Todoish',
      ...tasks.flatMap((task) => {
        const day = task.dueDate!.replace(/-/g, '');
        const when = task.dueTime
          ? [
              `DTSTART:${day}T${task.dueTime.replace(':', '')}00`,
              'DURATION:PT30M',
            ]
          : [
              `DTSTART;VALUE=DATE:${day}`,
              `DTEND;VALUE=DATE:${addDays(task.dueDate!, 1).replace(/-/g, '')}`,
            ];
        return [
          'BEGIN:VEVENT',
          `UID:task-${task.id}@todoish.dev`,
          `DTSTAMP:${stamp}`,
          ...when,
          `SUMMARY:${text(task.title)}`,
          ...(task.description
            ? [`DESCRIPTION:${text(task.description)}`]
            : []),
          'END:VEVENT',
        ];
      }),
      'END:VCALENDAR',
    ];
    return new StreamableFile(
      Buffer.from(lines.map(fold).join('\r\n') + '\r\n'),
      {
        type: 'text/calendar; charset=utf-8',
        disposition: 'inline; filename="todoish.ics"',
      },
    );
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { type AnyRequest, header, optional, prepend } from 'nestjs-mvc';
import type { User } from '../database/entities/index.js';
import { commentRow } from './serializers.js';
import { TasksService } from './tasks.service.js';

/** Sent by the task dialog's poll: when it last heard about comments. */
export const COMMENTS_SINCE_HEADER = 'x-comments-since';

/**
 * The task dialog, on every page that lists tasks. `?task=12` in the URL
 * opens it; the page asks for `task` with a partial reload, so the list
 * underneath stays as it is and only the task travels.
 *
 * - `task` is `optional()`: never part of a normal visit, only when asked for.
 * - `comments` is `prepend()`: the dialog polls it with the time it last
 *   heard, gets only the newer ones, and puts them on top of what it has.
 */
@Injectable()
export class TaskDetail {
  constructor(private readonly tasks: TasksService) {}

  props(req: AnyRequest, user: User) {
    const query = (req as { query?: Record<string, string> }).query ?? {};
    const id = Number(query.task);
    const sinceHeader = header(req, COMMENTS_SINCE_HEADER);
    const since = sinceHeader ? new Date(sinceHeader) : null;
    return {
      task: optional(async () => {
        if (!id) return null;
        // Deleted since the link was made, maybe by someone else: no dialog.
        const task = await this.tasks.find(id, user).catch((error: unknown) => {
          if (error instanceof NotFoundException) return null;
          throw error;
        });
        return task ? this.tasks.detail(task, user) : null;
      }),
      comments: prepend(
        async () =>
          id && (await this.tasks.canSee(id, user))
            ? (
                await this.tasks.comments(
                  id,
                  // A second of overlap: SQLite keeps whole seconds; repeats are
                  // harmless, matchOn drops them.
                  since && !Number.isNaN(since.getTime())
                    ? new Date(since.getTime() - 1000)
                    : null,
                )
              ).map(commentRow)
            : [],
        { matchOn: 'id' },
      ),
      commentsCursor: new Date().toISOString(),
    };
  }
}

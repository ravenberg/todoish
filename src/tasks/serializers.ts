import type { Comment, Task } from '../database/entities/index.js';
import { projectRef } from '../projects/projects.service.js';
import { describeRecurrence } from './recurrence.js';

export const person = (user: { id: number; name: string }) => ({
  id: user.id,
  name: user.name,
});

export interface Counts {
  subtasks: Map<number, { done: number; total: number }>;
  comments: Map<number, number>;
}

/** A task as every list shows it. */
export function taskRow(task: Task, counts?: Counts) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    recurrence: task.recurrence ? describeRecurrence(task.recurrence) : null,
    project: projectRef(task.project),
    sectionId: task.section?.id ?? null,
    parentId: task.parent?.id ?? null,
    labels: (task.labels ?? [])
      .map((l) => ({ id: l.id, name: l.name, color: l.color }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    assignee: task.assignee ? person(task.assignee) : null,
    subtasks: counts?.subtasks.get(task.id) ?? null,
    comments: counts?.comments.get(task.id) ?? 0,
    position: task.position,
    completedAt: task.completedAt?.toISOString() ?? null,
    updatedAt: task.updatedAt.toISOString(),
  };
}

export type TaskRow = ReturnType<typeof taskRow>;

export function commentRow(comment: Comment) {
  return {
    id: comment.id,
    taskId: comment.task?.id,
    body: comment.body,
    author: comment.author ? person(comment.author) : null,
    file: comment.storageKey
      ? {
          name: comment.filename!,
          size: comment.size!,
          isImage: comment.mimeType!.startsWith('image/'),
          url: `/comments/${comment.id}/file`,
        }
      : null,
    createdAt: comment.createdAt.toISOString(),
  };
}

export type CommentRow = ReturnType<typeof commentRow>;

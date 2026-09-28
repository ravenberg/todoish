import { z } from 'zod';
import { isDay } from '../common/dates.js';
import { isRecurrence } from './recurrence.js';

const day = z
  .string()
  .refine(isDay, 'Pick a date from the calendar.')
  .nullable();
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'A time looks like 09:30.')
  .nullable();
const recurrence = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isRecurrence, 'Try “every day”, “every monday” or “every 2 weeks”.')
  .nullable();
const priority = z.number().int().min(1).max(4);
const id = z.number().int().positive();
const labels = z.array(z.string().trim().min(1).max(60)).max(20);

/** Quick add. The text is parsed on the server; the buttons override it. */
export const CreateTaskSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'What needs doing?')
    .max(
      500,
      'Keep it under 500 characters; the description has room for more.',
    ),
  description: z.string().max(10_000).optional(),
  projectId: id.nullable().optional(),
  sectionId: id.nullable().optional(),
  parentId: id.nullable().optional(),
  defaultProjectId: id.nullable().optional(),
  defaultDueDate: day.optional(),
  dueDate: day.optional(),
  dueTime: time.optional(),
  recurrence: recurrence.optional(),
  priority: priority.nullable().optional(),
  labels: labels.optional(),
  assigneeId: id.nullable().optional(),
});

/** The task dialog: any of these, one at a time or together. */
export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1, 'A task needs a name.').max(500).optional(),
  description: z.string().max(10_000).optional(),
  priority: priority.optional(),
  dueDate: day.optional(),
  dueTime: time.optional(),
  recurrence: recurrence.optional(),
  projectId: id.optional(),
  sectionId: id.nullable().optional(),
  labels: labels.optional(),
  assigneeId: id.nullable().optional(),
});

export const MoveTaskSchema = z.object({
  projectId: id,
  sectionId: id.nullable(),
  /** The task it now sits above, or null for the end of the list. */
  before: id.nullable(),
});

export const CommentSchema = z.object({
  body: z.string().trim().max(10_000).default(''),
});

export const RescheduleSchema = z.object({
  ids: z.array(id).min(1).max(200),
  dueDate: z.string().refine(isDay, 'Pick a date from the calendar.'),
});

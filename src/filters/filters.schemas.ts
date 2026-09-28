import { z } from 'zod';
import { COLORS } from '../projects/projects.schemas.js';
import { queryProblem } from './query.js';

/**
 * The query's syntax check lives in the schema, so the form's live
 * validation (Precognition) asks the server's own parser as you type.
 */
export const FilterSchema = z.object({
  name: z.string().trim().min(1, 'Give the filter a name.').max(80),
  query: z
    .string()
    .trim()
    .max(500)
    .superRefine((query, ctx) => {
      const problem = queryProblem(query);
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    }),
  color: z.enum(COLORS).default('charcoal'),
});

export const LabelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name the label.')
    .max(60)
    .regex(/^[\p{L}\p{N}_-]+$/u, 'One word: letters, numbers, - and _.'),
  color: z.enum(COLORS).default('charcoal'),
});

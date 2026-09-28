import { z } from 'zod';
import { VIEW_STYLES } from '../database/entities/index.js';

/** Keep in step with frontend/lib/colors.ts. */
export const COLORS = [
  'berry_red',
  'red',
  'orange',
  'yellow',
  'olive_green',
  'lime_green',
  'green',
  'mint_green',
  'teal',
  'sky_blue',
  'light_blue',
  'blue',
  'grape',
  'violet',
  'lavender',
  'magenta',
  'salmon',
  'charcoal',
  'grey',
  'taupe',
] as const;

const name = z
  .string()
  .trim()
  .min(1, 'Give it a name.')
  .max(120, 'That name is a bit long; 120 characters will do.')
  .refine((n) => n.toLowerCase() !== 'inbox', 'There’s only one Inbox.');

export const ProjectSchema = z.object({
  name,
  color: z.enum(COLORS).default('charcoal'),
  viewStyle: z.enum(VIEW_STYLES).default('list'),
  favorite: z.boolean().default(false),
});

export const UpdateProjectSchema = z.object({
  name: name.optional(),
  color: z.enum(COLORS).optional(),
  viewStyle: z.enum(VIEW_STYLES).optional(),
  favorite: z.boolean().optional(),
});

export const SectionSchema = z.object({
  name: z.string().trim().min(1, 'Name the section.').max(120),
});

import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.'),
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean().default(false),
});

export const PasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(200, 'That is a very long password. 200 characters will do.');

/**
 * Signing up. The "is this email taken" check lives in the schema (an async
 * refine), not the handler, so the form's live validation asks it too.
 */
export const registerSchema = (
  emailTaken: (email: string) => Promise<boolean>,
) =>
  z.object({
    name: z.string().trim().min(1, 'What should we call you?').max(80),
    email: z
      .email('That doesn’t look like an email address.')
      .trim()
      .toLowerCase()
      .refine(async (email) => !(await emailTaken(email)), {
        message: 'Someone already signed up with that address. Log in instead?',
      }),
    password: PasswordSchema,
  });

export type RegisterInput = z.infer<ReturnType<typeof registerSchema>>;

import { standardSchemaExceptionFactory } from 'nestjs-mvc';
import type { z } from 'zod';

/**
 * What the global validation pipe does, for pipes that build their schema at
 * runtime (because it needs the database). Field errors come back to the
 * form the same way, and Precognition runs it like any other pipe.
 */
export async function validateWith<S extends z.ZodType>(
  schema: S,
  value: unknown,
): Promise<z.output<S>> {
  const result = await schema.safeParseAsync(value);
  if (!result.success)
    throw standardSchemaExceptionFactory(result.error.issues);
  return result.data;
}

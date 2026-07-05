import { z } from 'zod';

/**
 * Schema for GET /api/client/account response.
 * Source: AccountTransformer returns {id, admin, username, email, first_name, last_name, language}.
 * Use passthrough() so future field additions don't break parsing.
 */
export const userAttributesSchema = z.object({
  id: z.number(),
  admin: z.boolean(),
  username: z.string(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  language: z.string(),
}).passthrough();

export const userResponseSchema = z.object({
  object: z.literal('user'),
  attributes: userAttributesSchema,
}).passthrough();

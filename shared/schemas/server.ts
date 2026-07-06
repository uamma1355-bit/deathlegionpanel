import { z } from 'zod';

/**
 * Server attributes schema — matches the ACTUAL upstream Pterodactyl v1.11
 * ServerTransformer output (not the docs spec).
 *
 * Key differences from docs:
 *   - `internal_id` (number) instead of `id` (string)
 *   - `node` is a string (node name) not a number (node ID)
 *   - `is_suspended` instead of `suspended`
 *   - `docker_image` + `invocation` as top-level fields (not nested in `container`)
 *   - `server_owner` boolean instead of `user` number
 *   - No `external_id`, `allocation`, `nest`, `egg`, `created_at`, `updated_at`
 *
 * All fields are optional + passthrough so we never fail on schema mismatch.
 */
export const serverAttributesSchema = z.object({
  internal_id: z.number().optional(),
  uuid: z.string().optional(),
  identifier: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.string().nullable().optional(),
  server_owner: z.boolean().optional(),
  is_suspended: z.boolean().optional(),
  is_installing: z.boolean().optional(),
  is_transferring: z.boolean().optional(),
  is_node_under_maintenance: z.boolean().optional(),
  node: z.union([z.string(), z.number()]).optional(),
  invocation: z.string().optional(),
  docker_image: z.string().optional(),
  egg_features: z.any().nullable().optional(),
  sftp_details: z.object({
    ip: z.string().optional(),
    port: z.number().optional(),
  }).passthrough().optional(),
  limits: z.object({
    memory: z.number().optional(),
    swap: z.number().optional(),
    disk: z.number().optional(),
    io: z.number().optional(),
    cpu: z.number().optional(),
    threads: z.string().nullable().optional(),
    oom_disabled: z.boolean().optional(),
  }).passthrough().optional(),
  feature_limits: z.object({
    databases: z.number().optional(),
    allocations: z.number().optional(),
    backups: z.number().optional(),
  }).passthrough().optional(),
  relationships: z.any().optional(),
}).passthrough();

export const serverResponseSchema = z.object({
  object: z.string(),
  attributes: serverAttributesSchema,
  meta: z.any().optional(),
}).passthrough();

export const serverListResponseSchema = z.object({
  object: z.string(),
  data: z.array(z.object({
    object: z.string(),
    attributes: serverAttributesSchema,
  }).passthrough()),
}).passthrough();

export const websocketTokenResponseSchema = z.object({
  object: z.string(),
  attributes: z.object({
    token: z.string(),
    socket: z.string(),
  }).passthrough(),
}).passthrough();

export const resourceUsageResponseSchema = z.object({
  object: z.string(),
  attributes: z.object({
    state: z.string(),
    memory: z.number(),
    cpu: z.number(),
    disk: z.number(),
    network: z.object({ rx: z.number(), tx: z.number() }),
  }).passthrough(),
}).passthrough();

export const allocationAttributesSchema = z.object({
  id: z.number().optional(),
  ip: z.string().optional(),
  alias: z.string().nullable().optional(),
  port: z.number().optional(),
  notes: z.string().nullable().optional(),
  is_default: z.boolean().optional(),
}).passthrough();

import { z } from 'zod';

export const allocationAttributesSchema = z.object({
  id: z.number(),
  ip: z.string(),
  alias: z.string().nullable(),
  port: z.number(),
  notes: z.string().nullable(),
  is_default: z.boolean(),
});

export const serverAttributesSchema = z.object({
  id: z.string(),
  external_id: z.string().nullable(),
  uuid: z.string(),
  identifier: z.string(),
  name: z.string(),
  description: z.string(),
  suspended: z.boolean(),
  status: z.string().nullable(),
  limits: z.object({
    memory: z.number(),
    swap: z.number(),
    disk: z.number(),
    io: z.number(),
    cpu: z.number(),
    threads: z.string().nullable(),
    oom_disabled: z.boolean(),
  }),
  feature_limits: z.object({
    databases: z.number(),
    allocations: z.number(),
    backups: z.number(),
  }),
  user: z.number(),
  node: z.number(),
  allocation: z.number(),
  nest: z.number(),
  egg: z.number(),
  container: z.object({
    startup_command: z.string(),
    image: z.string(),
    installed: z.boolean(),
    environment: z.record(z.string(), z.string()),
  }),
  created_at: z.string(),
  updated_at: z.string(),
});

export const serverResponseSchema = z.object({
  object: z.literal('server'),
  attributes: serverAttributesSchema,
  meta: z
    .object({
      is_server_owner: z.boolean(),
      user_permissions: z.array(z.string()),
    })
    .optional(),
});

export const serverListResponseSchema = z.object({
  object: z.literal('list'),
  data: z.array(
    z.object({
      object: z.literal('server'),
      attributes: serverAttributesSchema,
    }),
  ),
});

export const websocketTokenResponseSchema = z.object({
  object: z.literal('websocket_token'),
  attributes: z.object({
    token: z.string(),
    socket: z.string(),
  }),
});

export const resourceUsageResponseSchema = z.object({
  object: z.literal('stats'),
  attributes: z.object({
    state: z.string(),
    memory: z.number(),
    cpu: z.number(),
    disk: z.number(),
    network: z.object({ rx: z.number(), tx: z.number() }),
  }),
});

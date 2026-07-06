import { z } from 'zod';

export const allocationAttributesSchema = z.object({
  id: z.number(),
  ip: z.string(),
  alias: z.string().nullable(),
  port: z.number(),
  notes: z.string().nullable(),
  is_default: z.boolean(),
}).passthrough();

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
  }).passthrough(),
  feature_limits: z.object({
    databases: z.number(),
    allocations: z.number(),
    backups: z.number(),
  }).passthrough(),
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
  }).passthrough(),
  created_at: z.string(),
  updated_at: z.string(),
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

import type { JsonApiResource, JsonApiList } from './api.js';

export interface AllocationAttributes {
  id: number;
  ip: string;
  alias: string | null;
  port: number;
  notes: string | null;
  is_default: boolean;
  [key: string]: unknown;
}

export interface ServerAttributes {
  id: string;
  external_id: string | null;
  uuid: string;
  identifier: string;
  name: string;
  description: string;
  suspended: boolean;
  status: string | null;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads: string | null;
    oom_disabled: boolean;
  };
  feature_limits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  user: number;
  node: number;
  allocation: number;
  nest: number;
  egg: number;
  container: {
    startup_command: string;
    image: string;
    installed: boolean;
    environment: Record<string, string>;
  };
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ServerMeta {
  is_server_owner: boolean;
  user_permissions: string[];
}

export interface ServerRelationships {
  allocation?: JsonApiResource<AllocationAttributes>;
  allocations?: JsonApiResource<AllocationAttributes>[];
  egg?: JsonApiResource;
  nest?: JsonApiResource;
  node?: JsonApiResource;
  databases?: JsonApiResource[];
  subusers?: JsonApiResource[];
}

export type ServerResponse = JsonApiResource<ServerAttributes> & {
  meta?: ServerMeta;
  relationships?: ServerRelationships;
};

export type ServerListResponse = JsonApiList<ServerAttributes>;

export type AllocationResponse = JsonApiResource<AllocationAttributes>;

export interface WebsocketTokenResponse extends JsonApiResource {
  attributes: { token: string; socket: string; [key: string]: unknown };
}

import type { JsonApiResource } from './api.js';

/**
 * Server attributes — matches the ACTUAL upstream Pterodactyl v1.11
 * ServerTransformer output. All fields optional because the list and
 * detail endpoints return slightly different shapes.
 */
export interface ServerAttributes {
  internal_id?: number;
  uuid?: string;
  identifier?: string;
  name?: string;
  description?: string;
  status?: string | null;
  server_owner?: boolean;
  is_suspended?: boolean;
  is_installing?: boolean;
  is_transferring?: boolean;
  is_node_under_maintenance?: boolean;
  node?: string | number;
  invocation?: string;
  docker_image?: string;
  egg_features?: unknown;
  sftp_details?: { ip?: string; port?: number };
  limits?: {
    memory?: number;
    swap?: number;
    disk?: number;
    io?: number;
    cpu?: number;
    threads?: string | null;
    oom_disabled?: boolean;
  };
  feature_limits?: {
    databases?: number;
    allocations?: number;
    backups?: number;
  };
  relationships?: unknown;
  [key: string]: unknown;
}

export interface ServerMeta {
  is_server_owner?: boolean;
  user_permissions?: string[];
}

export type ServerResponse = JsonApiResource<ServerAttributes> & {
  meta?: ServerMeta;
};

export type ServerListResponse = {
  object: string;
  data: JsonApiResource<ServerAttributes>[];
  [key: string]: unknown;
};

export interface WebsocketTokenResponse extends JsonApiResource {
  attributes: { token: string; socket: string; [key: string]: unknown };
}

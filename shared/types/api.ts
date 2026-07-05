/**
 * JSON:API envelope produced by Spatie Fractal + JsonApiSerializer.
 * Every client API response follows one of these shapes.
 */

export interface JsonApiAttributes {
  [key: string]: unknown;
}

export interface JsonApiRelationships {
  [key: string]: JsonApiResource | JsonApiResource[] | undefined;
}

export interface JsonApiMeta {
  [key: string]: unknown;
}

export interface JsonApiResource<T extends JsonApiAttributes = JsonApiAttributes> {
  object: string;
  attributes: T;
  relationships?: JsonApiRelationships;
  meta?: JsonApiMeta;
}

export interface JsonApiList<T extends JsonApiAttributes = JsonApiAttributes> {
  object: 'list';
  data: JsonApiResource<T>[];
  meta?: JsonApiMeta & {
    pagination?: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
      links?: { previous?: string; next?: string };
    };
  };
}

export interface JsonApiError {
  code: string;
  status?: string;
  source?: { field?: string; pointer?: string };
  detail?: string;
  title?: string;
  meta?: Record<string, unknown>;
}

export interface JsonApiErrorResponse {
  errors: JsonApiError[];
}

/** A signed one-shot URL returned by file download/upload endpoints. */
export interface SignedUrlAttributes {
  url: string;
  [key: string]: unknown;
}

/** WebSocket token response. */
export interface WebsocketTokenAttributes {
  token: string;
  socket: string;
  [key: string]: unknown;
}

/** Resource usage snapshot. */
export interface ServerResourceUsageAttributes {
  state: string;
  memory: number;
  cpu: number;
  disk: number;
  network: { rx: number; tx: number; [key: string]: unknown };
  [key: string]: unknown;
}

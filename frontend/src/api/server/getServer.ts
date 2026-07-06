import { http } from '@/api/http';
import { serverListResponseSchema, serverResponseSchema } from '@shared/schemas/server';
import type { ServerListResponse, ServerResponse } from '@shared/types/server';

export async function getServers(): Promise<ServerListResponse> {
  // The upstream Pterodactyl API serves the server list at /api/client (root),
  // NOT /api/client/servers. The response shape is the same JSON:API list.
  const res = await http.get<unknown>('/api/client');
  return serverListResponseSchema.parse(res.data);
}

export async function getServer(uuid: string): Promise<ServerResponse> {
  const res = await http.get<unknown>(`/api/client/servers/${uuid}`);
  return serverResponseSchema.parse(res.data);
}

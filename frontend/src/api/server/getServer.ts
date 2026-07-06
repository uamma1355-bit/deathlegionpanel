import { http } from '@/api/http';
import { serverListResponseSchema, serverResponseSchema } from '@shared/schemas/server';
import type { ServerListResponse, ServerResponse } from '@shared/types/server';

export async function getServers(): Promise<ServerListResponse> {
  const res = await http.get<unknown>('/api/client/servers');
  return serverListResponseSchema.parse(res.data);
}

export async function getServer(uuid: string): Promise<ServerResponse> {
  const res = await http.get<unknown>(`/api/client/servers/${uuid}`);
  return serverResponseSchema.parse(res.data);
}

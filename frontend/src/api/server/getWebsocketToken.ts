import { http } from '@/api/http';
import { websocketTokenResponseSchema } from '@shared/schemas/server';
import type { WebsocketTokenResponse } from '@shared/types/server';

export async function getWebsocketToken(uuid: string): Promise<WebsocketTokenResponse> {
  const res = await http.get<unknown>(`/api/client/servers/${uuid}/websocket`);
  return websocketTokenResponseSchema.parse(res.data);
}

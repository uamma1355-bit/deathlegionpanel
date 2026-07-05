import { http } from '@/api/http';
import { resourceUsageResponseSchema } from '@shared/schemas/server';

export type ServerResourceUsage = {
  object: 'stats';
  attributes: {
    state: string;
    memory: number;
    cpu: number;
    disk: number;
    network: { rx: number; tx: number };
  };
};

export async function getServerResourceUsage(uuid: string): Promise<ServerResourceUsage> {
  const res = await http.get<unknown>(`/api/client/servers/${uuid}/resources`);
  return resourceUsageResponseSchema.parse(res.data) as ServerResourceUsage;
}

export async function sendPowerCommand(uuid: string, signal: 'start' | 'stop' | 'restart' | 'kill'): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/power`, { signal });
}

export async function sendConsoleCommand(uuid: string, command: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/command`, { command });
}

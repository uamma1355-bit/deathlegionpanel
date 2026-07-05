import { http } from '@/api/http';
import { userResponseSchema } from '@shared/schemas/user';
import type { UserResponse } from '@shared/types/user';

export async function getAccount(): Promise<UserResponse> {
  const res = await http.get<unknown>('/api/client/account');
  return userResponseSchema.parse(res.data);
}

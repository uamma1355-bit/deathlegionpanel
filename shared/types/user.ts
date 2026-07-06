import type { JsonApiResource } from './api.js';

/**
 * User attributes returned by GET /api/client/account.
 *
 * NOTE: This is the LIGHT shape from the AccountTransformer — it does NOT
 * include uuid, root_admin (it's `admin` instead), 2fa_enabled, created_at,
 * or updated_at. Those are only returned by the login response's `user` object.
 *
 * Source: app/Transformers/Api/Client/AccountTransformer.php
 */
export interface UserAttributes {
  id: number;
  admin: boolean;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  [key: string]: unknown;
}

export type UserResponse = JsonApiResource<UserAttributes>;

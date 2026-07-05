# 06 — API Contract

This is the contract between the decoupled `frontend/` and `backend/`. It mirrors
the existing Pterodactyl Client API exactly. The Application API and Remote API
are unchanged from upstream (see [04-SourceAnalysis-Routes.md](./04-SourceAnalysis-Routes.md)).

## 1. Base URL

- Frontend reads `VITE_API_URL` (e.g. `https://api.example.com`).
- All API paths are relative to that base.
- WebSocket URL comes from the `/websocket` endpoint (it's per-node), so there is no fixed `VITE_WS_URL` for the console. `VITE_WS_URL` is reserved for future direct-to-Wings features.

## 2. Authentication

### Cookie mode (default)

```
GET  /sanctum/csrf-cookie          → 204, sets XSRF-TOKEN + pterodactyl_session cookies
POST /api/client/auth/login        → 204 (or 400 with 2FA required)
POST /api/client/auth/logout       → 204
```

The browser sends cookies automatically. Axios interceptor attaches `X-XSRF-TOKEN` header on mutations.

### Token mode (opt-in for cross-domain Vercel)

User generates a `ptlc_` key via the account UI, pastes it into the frontend's "API token" field. Axios interceptor attaches `Authorization: Bearer ptlc_xxxxxxxxxxxxxxxx`. No CSRF cookie needed in this mode.

## 3. Auth endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/api/client/auth/login` | `{ email, password }` | `204` on success; `400` `{ errors: [{ code: "AuthenticationRequiredException", meta: { confirmation_token } }] }` if 2FA |
| `POST` | `/api/client/auth/login-checkpoint` | `{ confirmation_token, code, recovery_code? }` | `204` on success |
| `POST` | `/api/client/auth/logout` | — | `204` |
| `POST` | `/api/client/auth/password` | `{ email }` | `204` (sends email) |
| `POST` | `/api/client/auth/password/reset` | `{ email, password, password_confirmation, token }` | `204` |
| `GET`  | `/api/client/permissions` | — | `{ permissions: { control: [...], file: [...], ... } }` |

## 4. Account endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/api/client/account` | — | `{ object: "user", attributes: { ... } }` |
| `PUT` | `/api/client/account/email` | `{ email, password }` | `{ object: "user", ... }` |
| `PUT` | `/api/client/account/password` | `{ current_password, password, password_confirmation }` | `{ object: "user", ... }` |
| `GET` | `/api/client/account/api-keys` | — | `{ object: "list", data: [...] }` |
| `POST` | `/api/client/account/api-keys` | `{ description, allowed_ips? }` | `{ object: "api_key", attributes: { identifier, token, ... } }` (note: only returned ONCE on creation) |
| `DELETE` | `/api/client/account/api-keys/{identifier}` | — | `204` |
| `GET` | `/api/client/account/2fa` | — | `{ object: "two_factor", attributes: { enabled, image_url, secret } }` (image_url + secret only if `enabled: false`) |
| `POST` | `/api/client/account/2fa` | `{ password }` | `{ object: "two_factor", attributes: { image_url, secret } }` |
| `POST` | `/api/client/account/2fa/enable` | `{ code }` | `204` |
| `DELETE` | `/api/client/account/2fa` | `{ password }` | `204` |
| `GET` | `/api/client/account/ssh-keys` | — | `{ object: "list", data: [...] }` |
| `POST` | `/api/client/account/ssh-keys` | `{ name, public_key }` | `{ object: "ssh_key", ... }` |
| `DELETE` | `/api/client/account/ssh-keys/{fingerprint}` | — | `204` |
| `GET` | `/api/client/account/activity` | — | `{ object: "list", data: [...] }` |

## 5. Server endpoints (list + view + power + console)

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| `GET` | `/api/client/servers` | auth | — | `{ object: "list", data: [...] }` (server objects with relationships) |
| `GET` | `/api/client/servers/{uuid}` | server:* | — | `{ object: "server", attributes, relationships, meta: { is_server_owner, user_permissions } }` |
| `GET` | `/api/client/servers/{uuid}/resources` | server:* | — | `{ object: "stats", attributes: { state, memory, cpu, disk, network: { rx, tx } } }` (live-ish, polled) |
| `GET` | `/api/client/servers/{uuid}/websocket` | `control.console` | — | `{ object: "websocket_token", attributes: { token, socket } }` |
| `POST` | `/api/client/servers/{uuid}/command` | `control.console` | `{ command }` | `204` |
| `POST` | `/api/client/servers/{uuid}/power` | `control.start` / `stop` / `restart` | `{ signal: "start"\|"stop"\|"restart"\|"kill" }` | `204` |
| `POST` | `/api/client/servers/{uuid}/reinstall` | `settings.reinstall` | — | `204` |
| `POST` | `/api/client/servers/{uuid}/settings/rename` | `settings.rename` | `{ name, description }` | `{ object: "server", ... }` |
| `POST` | `/api/client/servers/{uuid}/settings/docker-image` | `settings.rename` | `{ docker_image }` | `{ object: "server", ... }` |

## 6. File endpoints

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| `GET` | `/api/client/servers/{uuid}/files/list` | `file.read` | query: `directory` | `{ object: "list_of_files", data: [...] }` |
| `GET` | `/api/client/servers/{uuid}/files/contents` | `file.read` | query: `file` | `text/plain` (raw file contents) |
| `PUT` | `/api/client/servers/{uuid}/files/write` | `file.write` | query: `file`, body: raw bytes | `204` |
| `GET` | `/api/client/servers/{uuid}/files/download` | `file.read` | query: `file` | `{ object: "signed_url", attributes: { url } }` (one-shot, 15-min TTL) |
| `GET` | `/api/client/servers/{uuid}/files/upload` | `file.create` | — | `{ object: "signed_url", attributes: { url } }` |
| `POST` | `/api/client/servers/{uuid}/files/create-folder` | `file.create` | `{ root, name }` | `204` |
| `POST` | `/api/client/servers/{uuid}/files/rename` | `file.update` | `{ root, files: [{ from, to }] }` | `204` |
| `POST` | `/api/client/servers/{uuid}/files/copy` | `file.create` | `{ location }` | `204` |
| `POST` | `/api/client/servers/{uuid}/files/compress` | `file.create` | `{ root, files }` | `{ object: "file_object", attributes: {...} }` |
| `POST` | `/api/client/servers/{uuid}/files/decompress` | `file.create` | `{ root, file }` | `204` |
| `POST` | `/api/client/servers/{uuid}/files/delete` | `file.delete` | `{ root, files }` | `204` |
| `POST` | `/api/client/servers/{uuid}/files/chmod` | `file.update` | `{ root, files: [{ file, mode }] }` | `204` |

### Direct-to-Wings upload (NOT to the panel)

After `GET .../files/upload` returns `{ url }`, the frontend `POST`s the file **directly to that URL** (on Wings' host). Wings enforces the JWT in the query string. Do NOT attach `Authorization` or `withCredentials` to this call.

## 7. Backup endpoints

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| `GET` | `/api/client/servers/{uuid}/backups` | `backup.read` | — | `{ object: "list", data: [...] }` |
| `POST` | `/api/client/servers/{uuid}/backups` | `backup.create` | `{ name?, ignored? }` | `{ object: "backup", ... }` |
| `GET` | `/api/client/servers/{uuid}/backups/{backup}` | `backup.read` | — | `{ object: "backup", ... }` |
| `DELETE` | `/api/client/servers/{uuid}/backups/{backup}` | `backup.delete` | — | `204` |
| `GET` | `/api/client/servers/{uuid}/backups/{backup}/download` | `backup.download` | — | `{ object: "signed_url", attributes: { url } }` |
| `POST` | `/api/client/servers/{uuid}/backups/{backup}/lock` | `backup.update` (or owner) | — | `{ object: "backup", ... }` |
| `POST` | `/api/client/servers/{uuid}/backups/{backup}/restore` | `backup.restore` | `{ truncate? }` | `204` |

## 8. Schedule endpoints

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| `GET` | `/api/client/servers/{uuid}/schedules` | `schedule.read` | — | `{ object: "list", data: [...] }` |
| `POST` | `/api/client/servers/{uuid}/schedules` | `schedule.create` | `{ name, minute, hour, day_of_week, day_of_month, month, is_active, only_when_online }` | `{ object: "schedule", ... }` |
| `GET` | `/api/client/servers/{uuid}/schedules/{schedule}` | `schedule.read` | — | `{ object: "schedule", attributes, relationships: { tasks: [...] } }` |
| `POST` | `/api/client/servers/{uuid}/schedules/{schedule}` | `schedule.update` | same as create | `{ object: "schedule", ... }` |
| `DELETE` | `/api/client/servers/{uuid}/schedules/{schedule}` | `schedule.delete` | — | `204` |
| `POST` | `/api/client/servers/{uuid}/schedules/{schedule}/execute` | `schedule.update` | — | `204` |
| `POST` | `/api/client/servers/{uuid}/schedules/{schedule}/tasks` | `schedule.update` | `{ action, payload, time_offset, continue_on_failure, sequence_id }` | `{ object: "task", ... }` |
| `POST` | `/api/client/servers/{uuid}/schedules/{schedule}/tasks/{task}` | `schedule.update` | same | `{ object: "task", ... }` |
| `DELETE` | `/api/client/servers/{uuid}/schedules/{schedule}/tasks/{task}` | `schedule.update` | — | `204` |

## 9. Database endpoints

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| `GET` | `/api/client/servers/{uuid}/databases` | `database.read` | — | `{ object: "list", data: [...] }` |
| `POST` | `/api/client/servers/{uuid}/databases` | `database.create` | `{ database, remote }` | `{ object: "server_database", ... }` |
| `POST` | `/api/client/servers/{uuid}/databases/{database}/rotate-password` | `database.update` | — | `{ object: "server_database", ... }` |
| `DELETE` | `/api/client/servers/{uuid}/databases/{database}` | `database.delete` | — | `204` |

## 10. Network / allocation endpoints

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| `GET` | `/api/client/servers/{uuid}/network/allocations` | `allocation.read` | — | `{ object: "list", data: [...] }` |
| `POST` | `/api/client/servers/{uuid}/network/allocations` | `allocation.create` | `{ ip? }` (auto-assigns if omitted) | `{ object: "allocation", ... }` |
| `POST` | `/api/client/servers/{uuid}/network/allocations/{allocation}` | `allocation.update` | `{ notes?, primary? }` | `{ object: "allocation", ... }` |
| `DELETE` | `/api/client/servers/{uuid}/network/allocations/{allocation}` | `allocation.delete` | — | `204` |
| `POST` | `/api/client/servers/{uuid}/network/primary` | `allocation.update` | `{ allocation }` | `204` |

## 11. Startup endpoints

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| `GET` | `/api/client/servers/{uuid}/startup` | `startup.read` | — | `{ object: "startup", attributes: { startup, docker_images, egg_variables: [...] } }` |
| `PUT` | `/api/client/servers/{uuid}/startup/variable` | `startup.update` | `{ key, value }` | `{ object: "egg_variable", ... }` |
| `PUT` | `/api/client/servers/{uuid}/startup/image` | `startup.update` | `{ docker_image }` | `{ object: "server", ... }` |

## 12. Subuser endpoints

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| `GET` | `/api/client/servers/{uuid}/users` | `user.read` | — | `{ object: "list", data: [...] }` |
| `POST` | `/api/client/servers/{uuid}/users` | `user.create` | `{ email, permissions }` | `{ object: "subuser", ... }` |
| `GET` | `/api/client/servers/{uuid}/users/{user}` | `user.read` | — | `{ object: "subuser", ... }` |
| `POST` | `/api/client/servers/{uuid}/users/{user}` | `user.update` | `{ permissions }` | `{ object: "subuser", ... }` |
| `DELETE` | `/api/client/servers/{uuid}/users/{user}` | `user.delete` | — | `204` |

## 13. Activity log

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| `GET` | `/api/client/servers/{uuid}/activity` | `activity.read` | query: `?page=N` | `{ object: "list", data: [...], meta: { pagination } }` |
| `GET` | `/api/client/account/activity` | auth | query: `?page=N` | `{ object: "list", data: [...], meta: { pagination } }` |

## 14. WebSocket protocol

See [07-WingsCompatibility.md](./07-WingsCompatibility.md) §4 for the full client ↔ Wings protocol. The panel is only involved for the initial JWT issuance.

## 15. Error envelope

Every 4xx/5xx response returns:

```json
{
  "errors": [
    {
      "code": "ValidationException",
      "status": "422",
      "source": { "field": "name" },
      "detail": "The name has already been taken.",
      "meta": { ... }
    }
  ]
}
```

Common codes:

| Code | Status | Meaning |
|------|--------|---------|
| `AuthenticationRequiredException` | 400 | 2FA challenge required (`meta.confirmation_token`) |
| `AuthenticationException` | 401 | Not authenticated |
| `AccessForbiddenException` | 403 | Authenticated but not allowed |
| `NotFoundException` | 404 | Resource doesn't exist or no access |
| `ValidationException` | 422 | Body validation failed (`source.field` populated) |
| `ThrottleRequestsException` | 429 | Rate limited |
| `DisplayException` | 400 | Generic user-facing error |
| `DaemonConnectionException` | 502 | Wings unreachable / errored |
| `BadHttpRequestException` | 400 | Generic bad request |

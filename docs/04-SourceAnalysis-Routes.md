# 04 — Source Analysis: Routes, Middleware, Auth, CSRF, Sessions, RBAC

> Extracted from the Task 2-A analysis of upstream `pterodactyl/panel@v1.11.3`.
> See `/home/z/my-project/worklog.md` for the raw audit trail.

## 1. Route file mount topology (`app/Providers/RouteServiceProvider.php`)

```
/                    routes/base.php            middleware: web
/admin               routes/admin.php           middleware: web (with AdminAuthenticate)
/auth                routes/auth.php            middleware: web
/api/client          routes/api-client.php      middleware: client-api (api, auth:sanctum, ClientAuthenticate, Activity, AccountSubject/ServerSubject)
/api/application     routes/api-application.php  middleware: application-api (api, ApplicationApiAuth, Activity, AdminAcl)
/api/remote          routes/api-remote.php      middleware: daemon (api, DaemonAuthenticate)
```

## 2. Custom middleware

| Class | Purpose | Group |
|-------|---------|-------|
| `Authenticate` | Redirect to `/auth/login` if not authed (web) | web |
| `EncryptCookies` | Laravel cookie encryption | web |
| `VerifyCsrfToken` | CSRF check; `$except = ['remote/*', 'daemon/*']` (both effectively dead — `daemon/*` doesn't exist, `remote/*` is under `/api/`) | web |
| `TrimStrings` | Trim request input | web |
| `SanitizeSession` | (Does not exist under this name — the actual class is `Pterodactyl\Http\Middleware\SanitizeSession` per upstream; absent in v1.11.3) | — |
| `ApiClientAuthenticate` | (Actual class: `ApiSubstituteBindings` for route model binding, then Sanctum's guard) | client-api |
| `ApplicationApiAuthenticate` | (Actual class: `ApiSubstituteBindings` + custom `ApplicationApiAuth` middleware) | application-api |
| `RequireTwoFactorAuthentication` | Forces 2FA based on `config('pterodactyl.auth.2fa_required')` | web + client-api |
| `AdminAuthenticate` | Checks `user.root_admin = 1` | admin (via `routes/admin.php` group) |
| `ServerExists` | (Actual class: `Pterodactyl\Http\Middleware\Server\ServerExists` — checks the `{server}` route binding is valid and the user can access it) | server-scoped routes inside `api-client.php` |
| `Activity` | Activity logger middleware | api groups |
| `LanguageMiddleware` | Sets app locale from user setting | web |
| `RedirectIfAuthenticated` | Redirect authed users away from /auth | web (guest) |
| `SecurityHeaders` | (Does not exist — security headers are set via `\App\Http\Middleware\EncryptCookies` addition or global response middleware) | — |
| `DaemonAuthenticate` | Validates Wings callbacks (`Bearer {daemon_token_id}.{decrypted_daemon_token}`) | daemon (api-remote) |
| `AuthenticateServerAccess` | (Actual class: `Pterodactyl\Http\Middleware\Server\AuthenticateServerAccess`) — checks user is owner or subuser of the server | server-scoped routes inside `api-client.php` |

### Effective middleware stacks

| Surface | Stack (in order) |
|---------|------------------|
| `web` | `EncryptCookies`, `AddQueuedCookiesToResponse`, `StartSession`, `ShareErrorsFromSession`, `VerifyCsrfToken`, `Authenticate`, `RequireTwoFactorAuthentication`, `LanguageMiddleware` |
| `client-api` | `ThrottleRequests:720,1,client-api`, `ApiSubstituteBindings`, `auth:sanctum`, `AuthenticateServerAccess` (server-scoped only), `AccountSubject`/`ServerSubject`, `TrackAPIKey`, `Activity`, `RequireTwoFactorAuthentication` |
| `application-api` | `ThrottleRequests:240,1,application-api`, `ApiSubstituteBindings`, `ApplicationApiAuth`, `AdminAcl`, `TrackAPIKey`, `Activity` |
| `daemon` | `ThrottleRequests:240,1,daemon`, `DaemonAuthenticate` |

## 3. Route inventory

### `routes/base.php` (web, 14 routes — all to be removed in decoupled frontend)

| Method | URI | Controller | Name |
|--------|-----|-----------|------|
| GET | `/` | `IndexController@index` | `index` |
| GET | `/status` | `IndexController@status` | `status` |
| GET | `/account` | `AccountController@index` | `account` |
| GET | `/account/api` | `AccountController@api` | `account.api` |
| GET | `/account/api/new` | `AccountController@apiKey` | `account.api.new` |
| GET | `/account/ssh` | `AccountController@ssh` | `account.ssh` |
| GET | `/locale.js` | `LocaleController@index` | `locale` |
| GET | `/react/{react}` | `ClientController@react` | `react` |
| GET | `/server/{server}` | `Servers\ServerController@index` | `server` |
| GET | `/server/{server}/{any}` | `Servers\ServerController@index` | `server.any` |
| GET | `/_debugbar/*` | (debugbar) | — |
| POST | `/auth/login/logout` | `LoginController@logout` | `logout` |
| GET | `/auth/login` | `LoginController@showLoginForm` | `login` |
| POST | `/auth/login` | `LoginController@login` | `login.post` |

In the decoupled backend, only `/locale.js` is kept (i18n loader), and only if we keep serving locales via the API. Otherwise, locales are bundled with the frontend.

### `routes/auth.php` (web, 8 routes — all to be removed; replaced by React + `/api/client/auth/*`)

| Method | URI | Controller |
|--------|-----|-----------|
| GET | `/auth/login` | `LoginController@showLoginForm` |
| POST | `/auth/login` | `LoginController@login` (redirects to `/auth/login/checkpoint` if 2FA) |
| GET | `/auth/login/checkpoint` | `LoginCheckpointController@showCheckpointForm` |
| POST | `/auth/login/checkpoint` | `LoginCheckpointController@login` |
| GET | `/auth/password` | `ForgotPasswordController@showLinkRequestForm` |
| POST | `/auth/password` | `ForgotPasswordController@sendResetLinkEmail` |
| GET | `/auth/password/reset/{token}` | `ResetPasswordController@showResetForm` |
| POST | `/auth/password/reset` | `ResetPasswordController@reset` |

### `routes/admin.php` (web, ~38 routes — KEPT verbatim)

All admin routes are kept Blade. See [11-AdminAreaStrategy.md](./11-AdminAreaStrategy.md).

### `routes/api-client.php` (~70 routes — JSON API, the main contract)

Auth:

| Method | URI | Controller | Permission |
|--------|-----|-----------|------------|
| POST | `/api/client/auth/login` | `Auth\LoginController` | guest |
| POST | `/api/client/auth/login-checkpoint` | `Auth\LoginCheckpointController` | guest (with confirmation token) |
| GET | `/api/client/account` | `Client/AccountController@index` | auth |
| GET | `/api/client/servers` | `Client/ServerController@index` | auth |
| GET | `/api/client/servers/{server}` | `Client/ServerController@view` | server: `*` |
| GET | `/api/client/servers/{server}/utilization` | `Client/ServerController@utilization` | server: `*` (deprecated alias for resources) |
| GET | `/api/client/servers/{server}/resources` | `Client/ServerController@resources` | server: `*` |
| GET | `/api/client/servers/{server}/websocket` | `Client/ServerController@websocket` | server: `control.console` |
| POST | `/api/client/servers/{server}/command` | `Client/ServerController@command` | server: `control.console` |
| POST | `/api/client/servers/{server}/power` | `Client/ServerController@power` | server: `control.start`/`control.stop`/`control.restart` |
| POST | `/api/client/servers/{server}/reinstall` | `Client/ServerController@reinstall` | server: `settings.reinstall` |

Note: `/api/client/auth/login` and `/api/client/auth/login-checkpoint` are NOT under the `auth:sanctum` middleware — they're public endpoints that issue the session cookie.

Files (`files` permission category):

| Method | URI | Controller | Permission |
|--------|-----|-----------|------------|
| GET | `/api/client/servers/{server}/files/list` | `Client/Servers/FileController@listDirectory` | `file.read` |
| GET | `/api/client/servers/{server}/files/contents` | `Client/Servers/FileController@getFileContents` | `file.read` |
| GET | `/api/client/servers/{server}/files/download` | `Client/Servers/FileController@download` | `file.read` |
| PUT | `/api/client/servers/{server}/files/write` | `Client/Servers/FileController@write` | `file.write` |
| POST | `/api/client/servers/{server}/files/write` | `Client/Servers/FileController@write` | `file.write` |
| POST | `/api/client/servers/{server}/files/create-folder` | `Client/Servers/FileController@createFolder` | `file.create` |
| POST | `/api/client/servers/{server}/files/rename` | `Client/Servers/FileController@rename` | `file.update` |
| POST | `/api/client/servers/{server}/files/duplicate` | `Client/Servers/FileController@duplicate` | `file.create` |
| POST | `/api/client/servers/{server}/files/copy` | `Client/Servers/FileController@copy` | `file.create` |
| POST | `/api/client/servers/{server}/files/compress` | `Client/Servers/FileController@compress` | `file.create` |
| POST | `/api/client/servers/{server}/files/decompress` | `Client/Servers/FileController@decompress` | `file.create` |
| POST | `/api/client/servers/{server}/files/delete` | `Client/Servers/FileController@delete` | `file.delete` |
| POST | `/api/client/servers/{server}/files/chmod` | `Client/Servers/FileController@chmod` | `file.update` |
| GET | `/api/client/servers/{server}/files/upload` | `Client/Servers/FileUploadController` | `file.create` |

Backups:

| Method | URI | Permission |
|--------|-----|-----------|
| GET | `/api/client/servers/{server}/backups` | `backup.read` |
| POST | `/api/client/servers/{server}/backups` | `backup.create` |
| GET | `/api/client/servers/{server}/backups/{backup}` | `backup.read` |
| DELETE | `/api/client/servers/{server}/backups/{backup}` | `backup.delete` |
| GET | `/api/client/servers/{server}/backups/{backup}/download` | `backup.download` |
| POST | `/api/client/servers/{server}/backups/{backup}/lock` | `backup.update` (or owner) |
| POST | `/api/client/servers/{server}/backups/{backup}/restore` | `backup.restore` |

Schedules + tasks:

| Method | URI | Permission |
|--------|-----|-----------|
| GET | `/api/client/servers/{server}/schedules` | `schedule.read` |
| POST | `/api/client/servers/{server}/schedules` | `schedule.create` |
| GET | `/api/client/servers/{server}/schedules/{schedule}` | `schedule.read` |
| POST | `/api/client/servers/{server}/schedules/{schedule}` | `schedule.update` |
| DELETE | `/api/client/servers/{server}/schedules/{schedule}` | `schedule.delete` |
| POST | `/api/client/servers/{server}/schedules/{schedule}/execute` | `schedule.update` |
| POST | `/api/client/servers/{server}/schedules/{schedule}/tasks` | `schedule.update` |
| POST | `/api/client/servers/{server}/schedules/{schedule}/tasks/{task}` | `schedule.update` |
| DELETE | `/api/client/servers/{server}/schedules/{schedule}/tasks/{task}` | `schedule.update` |

Databases:

| Method | URI | Permission |
|--------|-----|-----------|
| GET | `/api/client/servers/{server}/databases` | `database.read` |
| POST | `/api/client/servers/{server}/databases` | `database.create` |
| POST | `/api/client/servers/{server}/databases/{database}/rotate-password` | `database.update` |
| DELETE | `/api/client/servers/{server}/databases/{database}` | `database.delete` |

Network / allocations:

| Method | URI | Permission |
|--------|-----|-----------|
| GET | `/api/client/servers/{server}/network/allocations` | `allocation.read` |
| POST | `/api/client/servers/{server}/network/allocations` | `allocation.create` |
| POST | `/api/client/servers/{server}/network/allocations/{allocation}` | `allocation.update` (set notes / primary) |
| DELETE | `/api/client/servers/{server}/network/allocations/{allocation}` | `allocation.delete` |
| POST | `/api/client/servers/{server}/network/primary` | `allocation.update` |

Startup:

| Method | URI | Permission |
|--------|-----|-----------|
| GET | `/api/client/servers/{server}/startup` | `startup.read` |
| PUT | `/api/client/servers/{server}/startup/variable` | `startup.update` |
| PUT | `/api/client/servers/{server}/startup/image` | `startup.update` |

Subusers:

| Method | URI | Permission |
|--------|-----|-----------|
| GET | `/api/client/servers/{server}/users` | `user.read` |
| POST | `/api/client/servers/{server}/users` | `user.create` |
| GET | `/api/client/servers/{server}/users/{user}` | `user.read` |
| POST | `/api/client/servers/{server}/users/{user}` | `user.update` |
| DELETE | `/api/client/servers/{server}/users/{user}` | `user.delete` |

Settings:

| Method | URI | Permission |
|--------|-----|-----------|
| POST | `/api/client/servers/{server}/settings/rename` | `settings.rename` |
| POST | `/api/client/servers/{server}/settings/reinstall` | `settings.reinstall` |
| POST | `/api/client/servers/{server}/settings/docker-image` | `settings.rename` (reuses rename permission) |

Activity:

| Method | URI | Permission |
|--------|-----|-----------|
| GET | `/api/client/servers/{server}/activity` | `activity.read` (admin or owner only) |

Account:

| Method | URI | Permission |
|--------|-----|-----------|
| GET | `/api/client/account` | auth |
| PUT | `/api/client/account/email` | auth |
| PUT | `/api/client/account/password` | auth |
| GET | `/api/client/account/api-keys` | auth |
| POST | `/api/client/account/api-keys` | auth |
| DELETE | `/api/client/account/api-keys/{api_key}` | auth |
| GET | `/api/client/account/2fa` | auth |
| POST | `/api/client/account/2fa` | auth |
| DELETE | `/api/client/account/2fa` | auth |
| POST | `/api/client/account/2fa/enable` | auth |
| POST | `/api/client/account/2fa/disable` | auth |
| GET | `/api/client/account/ssh-keys` | auth |
| POST | `/api/client/account/ssh-keys` | auth |
| DELETE | `/api/client/account/ssh-keys/{ssh_key}` | auth |
| GET | `/api/client/account/activity` | auth |

### `routes/api-application.php` (~50 routes — JSON API, KEPT verbatim)

All under `/api/application/*` with the `ptla_` token. Grouped:
- `/api/application/users` — Users CRUD
- `/api/application/servers` — Servers CRUD
- `/api/application/nodes` — Nodes CRUD + allocations
- `/api/application/locations` — Locations CRUD
- `/api/application/nests` — Nests + Eggs + Eggs/Variables
- `/api/application/databases` — Server databases
- `/api/application/mounts` — Mounts CRUD

### `routes/api-remote.php` (8 routes — Wings callbacks, KEPT verbatim)

See [07-WingsCompatibility.md](./07-WingsCompatibility.md) §2.

## 4. Auth flow

### Login (no 2FA)

```
1. POST /api/client/auth/login
   body: { email, password, g-recaptcha-response? }
   - Validates credentials
   - If user.use_totp = 0: sets Auth::login($user), 204 No Content
   - If user.use_totp = 1: returns 400 with { errors: [{ code: "AuthenticationRequiredException", detail: "...", meta: { confirmation_token: "<token>" } }] }
```

### Login checkpoint (2FA)

```
2. POST /api/client/auth/login-checkpoint
   body: { confirmation_token, code, recovery_code? }
   - Looks up user by confirmation_token
   - Validates TOTP code OR recovery code
   - On success: Auth::login($user), 204 No Content
   - On failure: 400
```

### Logout

```
POST /api/client/auth/logout
- Auth::logout()
- 204 No Content
```

### Password reset

```
1. POST /api/client/auth/password
   body: { email }
   - Sends `SendPasswordReset` notification with a signed URL

2. POST /api/client/auth/password/reset
   body: { email, password, password_confirmation, token }
   - Validates token (from URL)
   - Updates password
   - Returns to login
```

### 2FA enforcement

`RequireTwoFactorAuthentication` middleware reads `config('pterodactyl.auth.2fa_required')`:
- `0`: off
- `1`: required only for `root_admin`
- `2`: required for all users

If enforced and user is not 2FA-authed within session, returns 400 with `AuthenticationRequiredException`.

### Rate limiting

- `/api/client/*`: 720 requests/min per IP
- `/api/application/*`: 240 requests/min per IP
- `/api/remote/*`: 240 requests/min per IP
- Login endpoint: 5 attempts per IP per 1 min (throttle middleware)

## 5. Session vs API auth

### Hybrid Sanctum

Pterodactyl uses Sanctum's **stateful SPA mode** by default. The same `/api/client/*` routes accept:

1. **Session cookie** (browser SPA) — `Cookie: pterodactyl_session=...`. Sanctum's `EnsureStatefulRequests` middleware checks the request origin against `SANCTUM_STATEFUL_DOMAINS` and, if stateful, runs the session guard.
2. **Bearer token** (external API consumer) — `Authorization: Bearer ptlc_xxxx`. Sanctum's token guard runs.

Both work transparently. No code change needed for either mode.

### CSRF

- The web middleware group applies `VerifyCsrfToken` to all non-GET requests.
- Sanctum's `EnsureStatefulRequests` also applies CSRF to stateful `/api/*` requests.
- CSRF token is read from the `XSRF-TOKEN` cookie (decrypted) and sent back in the `X-XSRF-TOKEN` header.
- Flow: `GET /sanctum/csrf-cookie` sets the cookie, then the SPA includes `X-XSRF-TOKEN` on mutations.
- `$except` in `VerifyCsrfToken`: `['remote/*', 'daemon/*']` — both effectively dead (those routes are under `/api/remote/*` which is exempted by the `api` middleware group anyway).

## 6. CSRF surface (51 non-`/api/` POST/PATCH/PUT/DELETE — all removed in decoupled frontend)

In the decoupled backend, all of `routes/base.php` non-admin and all of `routes/auth.php` are removed. Only the admin Blade area (`routes/admin.php`) keeps CSRF — and those routes don't affect the React frontend.

## 7. WebSocket implementation

### Panel-side endpoint

`GET /api/client/servers/{server}/websocket`
- Permission: `control.console`
- Returns: `{ object: "websocket_token", attributes: { token: "<jwt>", socket: "wss://<node fqdn>:<daemon_listen>/api/servers/<uuid>/ws" } }`
- JWT signed by `NodeJWTService::handle($user, $server, null, $permissions, 10)` (10 min TTL)
- Claims: `iss`, `aud`, `jti`, `iat`, `nbf`, `exp`, `user_uuid`, `user_id`, `server_uuid`, `permissions[]`

### Client-side (existing SPA)

Uses `sockette` (lightweight WebSocket wrapper). Sends `auth` event with the JWT on connect. Handles `token expiring`/`token expired` events by re-fetching the JWT from the panel.

### Wings-side protocol

See [07-WingsCompatibility.md](./07-WingsCompatibility.md) §4.

## 8. Permission / RBAC

### Two parallel systems

#### A. Client API (server-scoped subuser permissions)

`Permission` model class — 35 string constants in 10 categories:

| Category | Permissions |
|----------|-------------|
| `control` | `control.console`, `control.start`, `control.stop`, `control.restart` |
| `user` | `user.read`, `user.create`, `user.update`, `user.delete` |
| `file` | `file.read`, `file.create`, `file.update`, `file.delete`, `file.archive`, `file.sftp` |
| `backup` | `backup.read`, `backup.create`, `backup.update`, `backup.delete`, `backup.download`, `backup.restore` |
| `allocation` | `allocation.read`, `allocation.create`, `allocation.update`, `allocation.delete` |
| `startup` | `startup.read`, `startup.update` |
| `database` | `database.read`, `database.create`, `database.update`, `database.delete` |
| `schedule` | `schedule.read`, `schedule.create`, `schedule.update`, `schedule.delete` |
| `settings` | `settings.view`, `settings.rename`, `settings.reinstall` |
| `activity` | `activity.read` (admin/owner only — not granted to subusers) |

Enforcement chain:
1. `AuthenticateServerAccess` middleware — checks user is owner or subuser.
2. `ClientPermissionsRequest::permission($perm)` (called in controller) — checks the subuser's `permissions` JSON contains `$perm`. Owner always passes.
3. `ServerPolicy::before($user, $ability)` (Laravel policy) — second line of defense; same check.

#### B. Application API (`AdminAcl` bitmask)

9 resources × READ/WRITE:

| Resource | READ | WRITE |
|----------|------|-------|
| `AdminAcl::RESOURCE_USERS` | `1` | `1 << 0` ... actually `r_visible` bit |
| `AdminAcl::RESOURCE_SERVERS` | `1` | `1 << 1` |
| `AdminAcl::RESOURCE_NODES` | `1` | `1 << 2` |
| `AdminAcl::RESOURCE_ALLOCATIONS` | — | — |
| `AdminAcl::RESOURCE_EGGS` | — | — |
| `AdminAcl::RESOURCE_DATABASE_HOSTS` | — | — |
| `AdminAcl::RESOURCE_SERVER_DATABASES` | — | — |
| `AdminAcl::RESOURCE_MOUNTS` | — | — |
| `AdminAcl::RESOURCE_NESTS` | — | — |

(See `app/Services/Acl/Api/AdminAcl.php` for exact bitmask values.)

Stored on `api_keys.r_visible` (read bits) and `api_keys.r_write` (write bits) for `key_type=2` (Application) keys. Checked by `AdminAcl::check($apiKey, $resource, $permission)` middleware.

## 9. Findings worth addressing in the refactor

(From the Task 2-A appendix — these are upstream issues to be aware of but NOT necessarily fix.)

1. **Dead CSRF exemptions** in `VerifyCsrfToken::$except` (`remote/*`, `daemon/*`) — harmless, kept for compatibility.
2. **Dead `daemon.configuration` exemption** — same.
3. **Unrouted `EggInstallController`** and `AuthenticateWebsocketDetailsRequest` — dead code, ignored.
4. **Duplicate 2FA middleware** — `RequireTwoFactorAuthentication` is registered in both `web` and `client-api` groups. Harmless.
5. **Route-name typo** — `'acrtivity'` somewhere in `api-client.php`. Cosmetic.
6. **Legacy `api` token guard** — `auth.php` defines an `api` guard that's unused. Cosmetic.
7. **Deprecated `auth.session`** — `auth.php` references `'session' => 'auth.session'` which is the deprecated Sanctum middleware name. Still functional in v2.15.
8. **Missing registration/verification flows** — Pterodactyl does not implement user self-registration or email verification by default. The decoupled frontend doesn't need them either.

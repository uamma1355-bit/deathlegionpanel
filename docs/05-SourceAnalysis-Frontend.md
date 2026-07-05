# 05 — Source Analysis: Blade, React, Router, Axios API Surface

> Extracted from the Task 2-B analysis of upstream `pterodactyl/panel@v1.11.3`.
> See `/home/z/my-project/worklog.md` for the raw audit trail.

## 1. Blade templates (50 files)

| Path | Rendered by | Purpose | Category |
|------|-------------|---------|----------|
| `templates/wrapper.blade.php` | (layout) | Master HTML wrapper — emits `<div id="app">`, `window.PterodactylUser`, `window.SiteConfiguration`, bundle `<script>` tags. | LAYOUT |
| `templates/base/core.blade.php` | `BaseController@index` | User-facing SPA shell (extends wrapper) | REACT_SHELL |
| `templates/auth/core.blade.php` | auth controllers | Auth SPA shell (extends wrapper) | REACT_SHELL |
| `layouts/admin.blade.php` | admin controllers | AdminLTE layout | LAYOUT |
| `layouts/auth.blade.php` | auth controllers | (legacy, unused in v1.11) | LAYOUT |
| `layouts/error.blade.php` | exception handler | Error page wrapper | LAYOUT |
| `errors/` (vendor) | Laravel default | 404/500/etc. — Laravel vendor defaults; no custom Blade error pages exist. | ERROR |
| `admin/index.blade.php` | `Admin/StatisticsController` | Admin dashboard | ADMIN |
| `admin/servers/index.blade.php` | `Admin/ServersController` | Server list | ADMIN |
| `admin/servers/new.blade.php` | `Admin/ServersController@create` | Create server | ADMIN |
| `admin/servers/view/index.blade.php` | `Admin/ServersController@view` | Server detail | ADMIN |
| `admin/servers/view/delete.blade.php` | — | Delete server | ADMIN |
| `admin/servers/view/manage.blade.php` | — | Manage server | ADMIN |
| `admin/users/index.blade.php` | `Admin/UsersController` | User list | ADMIN |
| `admin/users/view.blade.php` | `Admin/UsersController@view` | User edit | ADMIN |
| `admin/users/new.blade.php` | `Admin/UsersController@create` | Create user | ADMIN |
| `admin/nodes/index.blade.php` | `Admin/NodesController` | Node list | ADMIN |
| `admin/nodes/new.blade.php` | `Admin/NodesController@create` | Create node | ADMIN |
| `admin/nodes/view/index.blade.php` | `Admin/NodesController@view` | Node detail | ADMIN |
| `admin/nodes/view/allocations.blade.php` | — | Allocations | ADMIN |
| `admin/nodes/view/settings.blade.php` | — | Node settings | ADMIN |
| `admin/nodes/view/configuration.blade.php` | — | Node Wings config | ADMIN |
| `admin/locations/index.blade.php` | `Admin/LocationsController` | Locations | ADMIN |
| `admin/databases/index.blade.php` | `Admin/DatabaseController` | DB hosts list | ADMIN |
| `admin/databases/new.blade.php` | — | New DB host | ADMIN |
| `admin/mounts/index.blade.php` | `Admin/MountsController` | Mounts | ADMIN |
| `admin/mounts/new.blade.php` | — | New mount | ADMIN |
| `admin/eggs/index.blade.php` | `Admin/EggsController` | Eggs | ADMIN |
| `admin/eggs/new.blade.php` | — | New egg | ADMIN |
| `admin/eggs/export.blade.php` | — | Export egg JSON | ADMIN |
| `admin/eggs/import.blade.php` | — | Import egg JSON | ADMIN |
| `admin/eggs/variables.blade.php` | — | Egg variables | ADMIN |
| `admin/eggs/scripts.blade.php` | — | Egg install scripts | ADMIN |
| `admin/nests/index.blade.php` | `Admin/NestsController` | Nests | ADMIN |
| `admin/nests/new.blade.php` | — | New nest | ADMIN |
| `admin/settings/index.blade.php` | `Admin/SettingsController` | Settings (mail/advanced/general) | ADMIN |
| `admin/settings/mail.blade.php` | — | Mail settings | ADMIN |
| `admin/settings/advanced.blade.php` | — | Advanced settings | ADMIN |
| `admin/settings/general.blade.php` | — | General settings | ADMIN |
| `admin/api/index.blade.php` | `Admin/ApiController` | API keys (deprecated admin form) | ADMIN |
| `partials/navigation.blade.php` | (included by layouts) | Nav partial | PARTIAL |
| `partials/sidenav.blade.php` | (included) | Side nav | PARTIAL |
| `partials/alerts.blade.php` | (included) | Flash messages | PARTIAL |
| `partials/breadcrumbs.blade.php` | (included) | Breadcrumbs | PARTIAL |
| `partials/modal.blade.php` | (included) | Modal shell | PARTIAL |
| `emails/server-installed.blade.php` | `Notifications\ServerInstalled` | Email | EMAIL |
| `emails/password-reset.blade.php` | `Notifications\SendPasswordReset` | Email | EMAIL |

### What's removed in the decoupled frontend

- All `templates/*` and `layouts/auth*` (the React shell — replaced by Vite-built `frontend/`).
- All `partials/*` (only used by the React shell).
- The auth views (`routes/auth.php` controllers and their views) — replaced by React pages.

### What stays Blade (backend-served)

- `layouts/admin.blade.php` and all `admin/*` (admin area — see [11-AdminAreaStrategy.md](./11-AdminAreaStrategy.md)).
- `layouts/error.blade.php` (used by Laravel's exception handler for non-JSON errors — admin only).
- `emails/*` (server-side email rendering).

## 2. The React mount shell (verbatim)

`resources/views/templates/wrapper.blade.php`:

```blade
<!DOCTYPE html>
<html lang="{{ config('app.locale') }}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', config('app.name'))</title>
    <link rel="stylesheet" href="{{ $asset->css('bundle.css') }}">
  </head>
  <body class="bg-neutral-50">
    <div id="app"></div>
    <script>
      window.PterodactylUser = {!! json_encode(Auth::check() ? Auth::user()->toVueObject() : null) !!};
      window.SiteConfiguration = {
        name: config('app.name'),
        locale: config('app.locale'),
        recaptcha: {
          enabled: config('recaptcha.enabled'),
          siteKey: config('recaptcha.website_key'),
        },
      };
    </script>
    {!! $asset->js('main.js') !!}
  </body>
</html>
```

`window.PterodactylUser` shape (from `User::toVueObject()`):
```ts
{
  uuid: string;
  username: string;
  email: string;
  root_admin: boolean;
  use_totp: boolean;
  language: string;
  // ... other user fields
}
```

## 3. React screens (top-level — 19 files)

| Path | Route | Purpose | Area |
|------|-------|---------|------|
| `components/auth/LoginContainer.tsx` | `/auth/login` | Login form | AUTH |
| `components/auth/ForgotPasswordContainer.tsx` | `/auth/password` | Forgot password | AUTH |
| `components/auth/ResetPasswordContainer.tsx` | `/auth/password/reset/:token` | Reset password | AUTH |
| `components/auth/LoginCheckpointContainer.tsx` | `/auth/login/checkpoint` | 2FA entry | AUTH |
| `components/dashboard/DashboardContainer.tsx` | `/` | Server list + account quick links | DASHBOARD |
| `components/dashboard/AccountApiContainer.tsx` | `/account/api` | API keys | DASHBOARD |
| `components/dashboard/AccountSSHContainer.tsx` | `/account/ssh` | SSH keys | DASHBOARD |
| `components/dashboard/AccountOverviewContainer.tsx` | `/account` | Account settings | DASHBOARD |
| `components/dashboard/AccountSecurityContainer.tsx` | `/account/security` | 2FA + password | DASHBOARD |
| `components/server/ServerConsole.tsx` | `/server/:id` | Console + power + stats | SERVER |
| `components/server/files/FileManagerContainer.tsx` | `/server/:id/files` | File browser | SERVER |
| `components/server/backups/BackupContainer.tsx` | `/server/:id/backups` | Backups | SERVER |
| `components/server/schedules/ScheduleContainer.tsx` | `/server/:id/schedules` | Schedules | SERVER |
| `components/server/users/UserContainer.tsx` | `/server/:id/users` | Subusers | SERVER |
| `components/server/databases/DatabasesContainer.tsx` | `/server/:id/databases` | Databases | SERVER |
| `components/server/network/NetworkContainer.tsx` | `/server/:id/network` | Network/allocations | SERVER |
| `components/server/startup/StartupContainer.tsx` | `/server/:id/startup` | Startup variables | SERVER |
| `components/server/settings/SettingsContainer.tsx` | `/server/:id/settings` | Server settings | SERVER |
| `components/server/activity/ActivityLogContainer.tsx` | `/server/:id/activity` | Activity log | SERVER |

**No admin area in React.** Admin is 100% Blade.

## 4. Router

There is no single `Router.tsx`. The setup is split across:

- `components/App.tsx` — top-level `<Switch>` with 4 entries.
- `routers/routes.ts` — central route table (path → component imports).
- `routers/AuthenticationRouter.tsx` — `/auth/*` sub-router.
- `routers/DashboardRouter.tsx` — `/` and `/account/*` sub-router.
- `routers/ServerRouter.tsx` — `/server/:id/*` sub-router.

### Top-level routes (from `App.tsx`)

| Path | Component | Guard |
|------|-----------|-------|
| `/auth/*` | `AuthenticationRouter` | `RedirectIfAuthenticated` |
| `/` | `DashboardRouter` | `AuthenticatedRoute` |
| `/server/:id/*` | `ServerRouter` | `AuthenticatedRoute` |
| `/admin/*` | (full page reload — Blade) | — |

### Auth routes (from `AuthenticationRouter.tsx`)

| Path | Component |
|------|-----------|
| `/auth/login` | `LoginContainer` |
| `/auth/login/checkpoint` | `LoginCheckpointContainer` |
| `/auth/password` | `ForgotPasswordContainer` |
| `/auth/password/reset/:token` | `ResetPasswordContainer` |

### Dashboard routes (from `DashboardRouter.tsx`)

| Path | Component |
|------|-----------|
| `/` | `DashboardContainer` |
| `/account` | `AccountOverviewContainer` |
| `/account/api` | `AccountApiContainer` |
| `/account/ssh` | `AccountSSHContainer` |
| `/account/security` | `AccountSecurityContainer` |

### Server routes (from `ServerRouter.tsx`)

| Path | Component | Permission guard |
|------|-----------|-------------------|
| `/server/:id` | `ServerConsole` | `control.console` |
| `/server/:id/files` | `FileManagerContainer` | `file.read` |
| `/server/:id/backups` | `BackupContainer` | `backup.read` |
| `/server/:id/schedules` | `ScheduleContainer` | `schedule.read` |
| `/server/:id/users` | `UserContainer` | `user.read` |
| `/server/:id/databases` | `DatabasesContainer` | `database.read` |
| `/server/:id/network` | `NetworkContainer` | `allocation.read` |
| `/server/:id/startup` | `StartupContainer` | `startup.read` |
| `/server/:id/settings` | `SettingsContainer` | `settings.view` |
| `/server/:id/activity` | `ActivityLogContainer` | `activity.read` (admin/owner only) |

### Route-protection HOCs

- `AuthenticatedRoute` — wraps `/` and `/server/:id`. If not authed, redirects to `/auth/login`.
- `PermissionRoute` — wraps per-server routes. Reads the server's permissions from `ServerContext` and the `permission` prop.
- `RequireServerPermission` — defensive HOC, currently unused in routes (defined but not invoked).
- `Can` — base permission-check component (uses `usePermissions()` hook). Used inside screens to conditionally render UI elements.

## 5. Axios API client — the contract

### Axios instance (`resources/scripts/api/http.ts`)

```ts
const http = axios.create({
  baseURL: '',  // relative URLs — relies on the SPA being served from the same origin as the API
  timeout: 20000,
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Request interceptor: shows the top-of-page progress bar
http.interceptors.request.use(config => { /* show progress bar */ return config; });

// Response interceptor: hides the progress bar, normalizes errors
http.interceptors.response.use(r => r, error => { /* hide progress bar, throw normalized */ });
```

### 2FA interceptor (`resources/scripts/api/interceptors.ts`)

```ts
export function setupInterceptors(navigate: (path: string) => void) {
  http.interceptors.response.use(r => r, error => {
    if (error?.response?.status === 400 && error.response.data?.errors?.[0]?.code === 'AuthenticationRequiredException') {
      // stash the confirmation token in sessionStorage, navigate to /auth/login/checkpoint
      navigate('/auth/login/checkpoint');
    }
    return Promise.reject(error);
  });
}
```

### CSRF / Sanctum cookie flow

Before login:
```ts
await http.get('/sanctum/csrf-cookie');
await http.post('/api/client/auth/login', { email, password });
```

### Full API surface (every exported function, grouped by file)

#### `api/getServers.ts`
- `getServers([include])` → `GET /api/client/servers`

#### `api/getSystemPermissions.ts`
- `getSystemPermissions()` → `GET /api/client/permissions`

#### `api/account/getApiKeys.ts`
- `getApiKeys()` → `GET /api/client/account/api-keys`

#### `api/account/createApiKey.ts`
- `createApiKey({ description, allowedIps })` → `POST /api/client/account/api-keys`

#### `api/account/deleteApiKey.ts`
- `deleteApiKey({ identifier })` → `DELETE /api/client/account/api-keys/{identifier}`

#### `api/account/getTwoFactorTokenData.ts`
- `getTwoFactorTokenData({ password })` → `POST /api/client/account/2fa` (returns QR + secret)

#### `api/account/enableAccountTwoFactor.ts`
- `enableAccountTwoFactor({ code })` → `POST /api/client/account/2fa/enable`

#### `api/account/disableAccountTwoFactor.ts`
- `disableAccountTwoFactor({ password })` → `DELETE /api/client/account/2fa`

#### `api/account/updateAccountEmail.ts`
- `updateAccountEmail({ email, password })` → `PUT /api/client/account/email`

#### `api/account/updateAccountPassword.ts`
- `updateAccountPassword({ current_password, password, password_confirmation })` → `PUT /api/client/account/password`

#### `api/account/ssh-keys.ts`
- `getSshKeys()` → `GET /api/client/account/ssh-keys`
- `createSshKey({ name, publicKey })` → `POST /api/client/account/ssh-keys`
- `deleteSshKey({ fingerprint })` → `DELETE /api/client/account/ssh-keys/{fingerprint}`

#### `api/account/activity.ts`
- `getAccountActivity()` → `GET /api/client/account/activity`

#### `api/auth/login.ts`
- `login({ email, password })` → `POST /api/client/auth/login`

#### `api/auth/loginCheckpoint.ts`
- `loginCheckpoint({ confirmation_token, code, recovery_code })` → `POST /api/client/auth/login-checkpoint`

#### `api/auth/requestPasswordResetEmail.ts`
- `requestPasswordReset({ email })` → `POST /api/client/auth/password`

#### `api/auth/performPasswordReset.ts`
- `performPasswordReset({ email, password, password_confirmation, token })` → `POST /api/client/auth/password/reset`

#### `api/server/getServer.ts`
- `getServer({ uuid })` → `GET /api/client/servers/{uuid}`

#### `api/server/getServerResourceUsage.ts`
- `getServerResourceUsage({ uuid })` → `GET /api/client/servers/{uuid}/resources`

#### `api/server/getWebsocketToken.ts`
- `getWebsocketToken({ uuid })` → `GET /api/client/servers/{uuid}/websocket`

#### `api/server/reinstallServer.ts`
- `reinstallServer({ uuid })` → `POST /api/client/servers/{uuid}/reinstall`

#### `api/server/renameServer.ts`
- `renameServer({ uuid, name, description })` → `POST /api/client/servers/{uuid}/settings/rename`

#### `api/server/setSelectedDockerImage.ts`
- `setSelectedDockerImage({ uuid, image })` → `POST /api/client/servers/{uuid}/settings/docker-image`

#### `api/server/updateStartupVariable.ts`
- `updateStartupVariable({ uuid, key, value })` → `PUT /api/client/servers/{uuid}/startup/variable`

#### `api/server/activity.ts`
- `getServerActivity({ uuid, page })` → `GET /api/client/servers/{uuid}/activity?page=`

#### `api/server/files/loadDirectory.ts`
- `loadDirectory({ uuid, directory })` → `GET /api/client/servers/{uuid}/files/list?directory=`

#### `api/server/files/getFileContents.ts`
- `getFileContents({ uuid, file })` → `GET /api/client/servers/{uuid}/files/contents?file=`

#### `api/server/files/saveFileContents.ts`
- `saveFileContents({ uuid, file, contents })` → `PUT /api/client/servers/{uuid}/files/write?file=`

#### `api/server/files/getFileDownloadUrl.ts`
- `getFileDownloadUrl({ uuid, file })` → `GET /api/client/servers/{uuid}/files/download?file=`

#### `api/server/files/getFileUploadUrl.ts`
- `getFileUploadUrl({ uuid })` → `GET /api/client/servers/{uuid}/files/upload`

#### `api/server/files/copyFile.ts`
- `copyFile({ uuid, location })` → `POST /api/client/servers/{uuid}/files/copy`

#### `api/server/files/createDirectory.ts`
- `createDirectory({ uuid, root, name })` → `POST /api/client/servers/{uuid}/files/create-folder`

#### `api/server/files/renameFiles.ts`
- `renameFiles({ uuid, root, files })` → `POST /api/client/servers/{uuid}/files/rename`

#### `api/server/files/deleteFiles.ts`
- `deleteFiles({ uuid, root, files })` → `POST /api/client/servers/{uuid}/files/delete`

#### `api/server/files/compressFiles.ts`
- `compressFiles({ uuid, root, files })` → `POST /api/client/servers/{uuid}/files/compress`

#### `api/server/files/decompressFiles.ts`
- `decompressFiles({ uuid, root, file })` → `POST /api/client/servers/{uuid}/files/decompress`

#### `api/server/files/chmodFiles.ts`
- `chmodFiles({ uuid, root, files })` → `POST /api/client/servers/{uuid}/files/chmod`

#### `api/server/backups/index.ts`
- `listBackups({ uuid })` → `GET /api/client/servers/{uuid}/backups`

#### `api/server/backups/createServerBackup.ts`
- `createServerBackup({ uuid, name, ignored })` → `POST /api/client/servers/{uuid}/backups`

#### `api/server/backups/deleteBackup.ts`
- `deleteBackup({ uuid, backup })` → `DELETE /api/client/servers/{uuid}/backups/{backup}`

#### `api/server/backups/getBackupDownloadUrl.ts`
- `getBackupDownloadUrl({ uuid, backup })` → `GET /api/client/servers/{uuid}/backups/{backup}/download`

#### `api/server/users/getServerSubusers.ts`
- `getServerSubusers({ uuid })` → `GET /api/client/servers/{uuid}/users`

#### `api/server/users/createOrUpdateSubuser.ts`
- `createOrUpdateSubuser({ uuid, email, permissions, ... })` → `POST /api/client/servers/{uuid}/users` (or `POST /api/client/servers/{uuid}/users/{user}` for update)

#### `api/server/users/deleteSubuser.ts`
- `deleteSubuser({ uuid, user })` → `DELETE /api/client/servers/{uuid}/users/{user}`

#### `api/server/schedules/getServerSchedules.ts`
- `getServerSchedules({ uuid })` → `GET /api/client/servers/{uuid}/schedules`

#### `api/server/schedules/getServerSchedule.ts`
- `getServerSchedule({ uuid, schedule })` → `GET /api/client/servers/{uuid}/schedules/{schedule}`

#### `api/server/schedules/createOrUpdateSchedule.ts`
- `createOrUpdateSchedule({ uuid, ...payload })` → `POST /api/client/servers/{uuid}/schedules` (or `POST /api/client/servers/{uuid}/schedules/{schedule}`)

#### `api/server/schedules/deleteSchedule.ts`
- `deleteSchedule({ uuid, schedule })` → `DELETE /api/client/servers/{uuid}/schedules/{schedule}`

#### `api/server/schedules/triggerScheduleExecution.ts`
- `triggerScheduleExecution({ uuid, schedule })` → `POST /api/client/servers/{uuid}/schedules/{schedule}/execute`

#### `api/server/schedules/createOrUpdateScheduleTask.ts`
- `createOrUpdateScheduleTask({ uuid, schedule, ...payload })` → `POST /api/client/servers/{uuid}/schedules/{schedule}/tasks` (or with `/{task}`)

#### `api/server/schedules/deleteScheduleTask.ts`
- `deleteScheduleTask({ uuid, schedule, task })` → `DELETE /api/client/servers/{uuid}/schedules/{schedule}/tasks/{task}`

#### `api/server/databases/getServerDatabases.ts`
- `getServerDatabases({ uuid })` → `GET /api/client/servers/{uuid}/databases`

#### `api/server/databases/createServerDatabase.ts`
- `createServerDatabase({ uuid, database, remote })` → `POST /api/client/servers/{uuid}/databases`

#### `api/server/databases/deleteServerDatabase.ts`
- `deleteServerDatabase({ uuid, database })` → `DELETE /api/client/servers/{uuid}/databases/{database}`

#### `api/server/databases/rotateDatabasePassword.ts`
- `rotateDatabasePassword({ uuid, database })` → `POST /api/client/servers/{uuid}/databases/{database}/rotate-password`

#### `api/server/network/setServerAllocationNotes.ts`
- `setServerAllocationNotes({ uuid, allocation, notes })` → `POST /api/client/servers/{uuid}/network/allocations/{allocation}`

#### `api/server/network/setPrimaryServerAllocation.ts`
- `setPrimaryServerAllocation({ uuid, allocation })` → `POST /api/client/servers/{uuid}/network/primary`

#### `api/server/network/createServerAllocation.ts`
- `createServerAllocation({ uuid, ip })` → `POST /api/client/servers/{uuid}/network/allocations`

#### `api/server/network/deleteServerAllocation.ts`
- `deleteServerAllocation({ uuid, allocation })` → `DELETE /api/client/servers/{uuid}/network/allocations/{allocation}`

#### `api/swr/getServerAllocations.ts` (SWR hook)
- `useServerAllocations(uuid)` → `GET /api/client/servers/{uuid}/network/allocations`

#### `api/swr/getServerBackups.ts` (SWR hook)
- `useServerBackups(uuid)` → `GET /api/client/servers/{uuid}/backups`

#### `api/swr/getServerStartup.ts` (SWR hook)
- `useServerStartup(uuid)` → `GET /api/client/servers/{uuid}/startup`

#### Non-`api/` HTTP calls (documented for completeness)
- `NavigationBar.tsx`: `POST /api/client/auth/logout` (inline)
- `BackupContextMenu.tsx`: `POST /api/client/servers/{uuid}/backups/{backup}/lock` (inline)
- `UploadButton.tsx`: direct `axios.post` to the signed Wings URL (bypasses panel — must keep this pattern; never attach credentials to direct-to-Wings calls)

## 6. Response envelope (JSON:API via Spatie Fractal)

```json
// Single resource
{
  "object": "server",
  "attributes": { ... },
  "relationships": { "allocations": { "object": "allocation", "attributes": {...} }, ... },
  "meta": { "is_server_owner": true, "user_permissions": ["control.console", ...] }
}

// Paginated list
{
  "object": "list",
  "data": [ { "object": "server", ... }, ... ],
  "meta": { "pagination": { "total": 42, "count": 15, "per_page": 15, "current_page": 1, "total_pages": 3 } }
}

// Error
{
  "errors": [
    {
      "code": "ValidationException",
      "status": "422",
      "source": { "field": "name" },
      "detail": "The name has already been taken.",
      "meta": { ... }  // optional, e.g. confirmation_token for 2FA
    }
  ]
}
```

This envelope is the **non-negotiable contract** between the decoupled frontend and backend. The new axios layer in `frontend/src/api/` must parse this shape; the new Laravel controllers must produce it via the same Fractal + `JsonApiSerializer`.

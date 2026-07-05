# 03 — Source Analysis: Models, Services, Wings, JWT, Schema, Jobs, Events, Activity, Notifications, Config

> Extracted from the Task 2-C analysis of upstream `pterodactyl/panel@v1.11.3`.
> See `/home/z/my-project/worklog.md` for the raw audit trail.

## 1. Models (29)

All extend `Pterodactyl\Models\Model`. Key facts that affect the API contract:

| Model | Table | Fillable highlights | Hidden | Notable |
|-------|-------|---------------------|--------|---------|
| `User` | `users` | `email`, `username`, `name_first`, `name_last`, `password`, `root_admin`, `language` | `password`, `remember_token`, `totp_secret` | `username` mutated to lowercase; virtual `name` accessor; `toVueObject()` for SPA bootstrap |
| `Server` | `servers` | `name`, `owner_id`, `node_id`, `egg_id`, `nest_id`, `allocation_id`, `disk`, `memory`, `cpu`, `swap`, `io`, `database_limit`, `allocation_limit`, `backup_limit`, `status`, `skip_scripts`, `description`, `startup`, `image`, `installed`, `transfer_id` | — | `$with = ['allocation']` (primary allocation always eager); has `uuid`, `uuidShort` (8 chars) |
| `Node` | `nodes` | `name`, `location_id`, `fqdn`, `scheme`, `memory`, `memory_overallocate`, `disk`, `disk_overallocate`, `upload_size`, `daemon_listen`, `daemon_sftp`, `daemon_base`, `daemon_token`, `daemon_token_id`, `maintenance_mode` | `daemon_token`, `daemon_token_id` | Decryption of `daemon_token` happens in `DaemonRepository` |
| `Egg` | `eggs` | `name`, `nest_id`, `uuid`, `author`, `description`, `docker_images` (JSON), `startup`, `config_files`, `config_startup`, `config_logs`, `config_stop`, `config_from`, `script_install`, `script_entry`, `script_container`, `copy_script_from` | — | Variables live in `egg_variables` |
| `Nest` | `nests` | `name`, `description`, `author` | — | Group of eggs |
| `Location` | `locations` | `short`, `long` | — | Group of nodes |
| `Database` | `databases` | `server_id`, `database_host_id`, `database`, `username`, `remote`, `password`, `max_connections` | `password` | Server-scoped DB |
| `DatabaseHost` | `database_hosts` | `name`, `host`, `port`, `username`, `password`, `max_databases`, `node_id` | `password` | MySQL host backing server DBs |
| `Allocation` | `allocations` | `node_id`, `ip`, `port`, `alias`, `server_id`, `notes` | — | Port assignment |
| `Backup` | `backups` | `server_id`, `uuid`, `is_successful`, `is_locked`, `name`, `ignored_files`, `disk`, `checksum`, `bytes`, `completed_at` | — | — |
| `Schedule` | `schedules` | `server_id`, `name`, `cron_day_of_week`, `cron_day_of_month`, `cron_hour`, `cron_minute`, `cron_month`, `is_active`, `is_processing`, `only_when_online`, `last_run_at`, `next_run_at` | — | — |
| `Task` | `tasks` | `schedule_id`, `sequence_id`, `action`, `payload`, `time_offset`, `is_queued`, `continue_on_failure` | — | `action` ∈ `command|power|backup` |
| `Subuser` | `subusers` | `server_id`, `user_id`, `permissions` (JSON) | — | Permissions stored as JSON array of strings |
| `ApiKey` | `api_keys` | `user_id`, `key_type`, `identifier`, `token`, `allowed_ips` (JSON), `memo`, `last_used_at`, `r_visible`, `r_write` (legacy), `server_id` (server-scoped) | `token` | Doubles as Sanctum's `personalAccessTokenModel` via `Sanctum::usePersonalAccessTokenModel(ApiKey::class)`; prefixes `ptlc_` (client) and `ptla_` (application) |
| `Session` | `sessions` | — | — | Laravel session table |
| `Permission` | — | — | — | **Table dropped** — permissions live as JSON on `subusers`. The `Permission` class is a constant-bag with 35 string constants in 10 categories. |
| `ActivityLog` | `activity_logs` | `ip`, `event`, `properties`, `api_key_id`, `timestamp` | — | Polymorphic subjects via `activity_log_subjects` |
| `ActivityLogSubject` | `activity_log_subjects` | `activity_log_id`, `subject_type`, `subject_id` | — | — |
| `EggVariable` | `egg_variables` | `egg_id`, `name`, `description`, `env_variable`, `default_value`, `user_viewable`, `user_editable`, `rules`, `sort` | — | — |
| `ServerVariable` | `server_variables` | `server_id`, `egg_variable_id`, `variable_value` | — | Per-server overrides |
| `Mount` | `mounts` | `name`, `description`, `source`, `target` | — | Node + server pivots |
| `ServerTransfer` | `server_transfers` | `server_id`, `old_node`, `new_node`, `old_allocation`, `new_allocation`, `status`, `started_at`, `completed_at` | — | — |
| `RecoveryToken` | `recovery_tokens` | `user_id`, `token` (hashed), `expires_at` | `token` | 2FA recovery codes |
| `UserSSHKey` | `user_ssh_keys` | `user_id`, `name`, `fingerprint`, `public_key` | — | — |
| `Setting` | `settings` | `key`, `value` | — | Panel config (app name, etc.) |

## 2. Service layer (~50 classes across 16 domains)

All under `app/Services/`. These are reused verbatim by the decoupled backend.
The new API controllers are thin and delegate to these services.

| Domain | Services | Calls Wings? |
|--------|----------|--------------|
| Servers | `ServerCreationService`, `ServerDeletionService`, `ServerEditService`, `ServerDetailsModificationService`, `ServerTransferService`, `VariableValidatorService`, `StartupCommandService`, `ReinstallServerService`, `ServerConfigurationService`, `GetUserPermissionsService` | Yes (create/delete/transfer/reinstall) |
| Users | `UserCreationService`, `UserDeletionService`, `UserUpdateService`, `UserService` | No |
| Nodes | `NodeCreationService`, `NodeDeletionService`, `NodeUpdateService`, `NodeJWTService` | NodeJWTService issues HMAC-SHA256 JWTs |
| Eggs | `EggCreationService`, `EggDeletionService`, `EggUpdateService`, `EggConfigurationService`, `EggConfigurationExporter`, `EggScriptExporterService`, `EggScriptImporterService`, `EggShareService`, `VariableCreationService`, `VariableDeletionService`, `VariableUpdateService` | No |
| Allocations | `AllocationDeletionService`, `AssignmentService` | No |
| Deployment | `FindVariablesWithValueService`, `DeploymentService` | No |
| Backups | `InitiateBackupService`, `DeleteBackupService` | Yes (trigger/delete) |
| Schedules | `ScheduleCreationService`, `ScheduleDeletionService`, `ScheduleUpdateService`, `ScheduleProcessingService` | Yes (via RunTaskJob) |
| Databases | `CreateServerDatabaseService`, `DeleteServerDatabaseService`, `DeployServerDatabaseService`, `RotatePasswordService`, `Hosts/HostCreationService`, `Hosts/HostDeletionService`, `Hosts/HostUpdateService` | No |
| Locations | `LocationCreationService`, `LocationDeletionService`, `LocationUpdateService` | No |
| Nests | `NestCreationService`, `NestDeletionService`, `NestUpdateService` | No |
| Subusers | `SubuserCreationService`, `SubuserDeletionService`, `SubuserUpdateService` | No |
| Activity | `ActivityLogService`, `ActivityLogBatchService`, `ActivityLogTargetableService` | No |
| Api | `ApiKeyCreationService`, `ApiKeyRotationService`, `VerifyApiKey` | No |
| Acl | `Api/AdminAcl` (bitmask helpers) | No |
| Telemetry | `TelemetryService` | No |
| Helpers | `Environment` | No |

Repositories (Eloquent): 22 classes under `app/Repositories/Eloquent/`.
Repositories (Wings): 8 classes under `app/Repositories/Wings/` — see §3.

## 3. Wings communication (`app/Repositories/Wings/`)

Every Panel → Wings call uses Guzzle with:

- Base URL: `config('pterodactyl.daemon.base_path')` per-node, computed as
  `{scheme}://{fqdn}:{daemon_listen}/api`
- Auth header: `Authorization: Bearer {decrypted daemon_token}`
  (decrypted via `app('encrypter')->decrypt($node->daemon_token)`)
- Timeout: 30s (Guzzle default)
- Server UUID in the URL is the long `uuid` (not `uuidShort`)

### Endpoint inventory

| Repository | Wings endpoint | Method | Body |
|------------|----------------|--------|------|
| `DaemonServerRepository::setDetails` | `/api/servers/{uuid}` | PATCH | server config object |
| `DaemonServerRepository::create` | `/api/servers` | POST | server config |
| `DaemonServerRepository::delete` | `/api/servers/{uuid}` | DELETE | — |
| `DaemonServerRepository::update` | `/api/servers/{uuid}/update` | PATCH | partial config |
| `DaemonPowerRepository::send` | `/api/servers/{uuid}/power` | POST | `{ signal }` |
| `DaemonCommandRepository::send` | `/api/servers/{uuid}/commands` | POST | `{ command }` |
| `DaemonFileRepository::setContents` | `/api/servers/{uuid}/files/{path}` | PUT | raw bytes |
| `DaemonFileRepository::getContents` | `/api/servers/{uuid}/files/{path}` | GET | — |
| `DaemonFileRepository::listDirectory` | `/api/servers/{uuid}/files?directory=...` | GET | — |
| `DaemonFileRepository::createDirectory` | `/api/servers/{uuid}/files/{path}?dir=...` | POST | — |
| `DaemonFileRepository::renameEntries` | `/api/servers/{uuid}/files/rename` | PUT | `{ root, files: [{from,to}] }` |
| `DaemonFileRepository::copyEntries` | `/api/servers/{uuid}/files/copy` | POST | `{ location }` |
| `DaemonFileRepository::deleteEntries` | `/api/servers/{uuid}/files/delete` | POST | `{ root, files }` |
| `DaemonFileRepository::compressEntries` | `/api/servers/{uuid}/files/compress` | POST | `{ root, files }` |
| `DaemonFileRepository::decompressEntries` | `/api/servers/{uuid}/files/decompress` | POST | `{ root, file }` |
| `DaemonFileRepository::chmodEntries` | `/api/servers/{uuid}/files/chmod` | POST | `{ root, files:[{file,mode}] }` |
| `DaemonBackupRepository::triggerBackup` | `/api/servers/{uuid}/backups` | POST | `{ adapter, uuid, ignore }` |
| `DaemonBackupRepository::restoreBackup` | `/api/servers/{uuid}/backups/{backup}/restore` | POST | `{ adapter, uuid, truncate }` |
| `DaemonBackupRepository::deleteBackup` | `/api/servers/{uuid}/backups/{backup}` | DELETE | — |
| `DaemonConfigurationRepository::updateSystem` | `/api/system` | PUT | node config |
| `DaemonTransferRepository::notify` | `/api/servers/{uuid}/transfer` | GET | JWT in query |

## 4. JWT signing (`app/Services/Nodes/NodeJWTService`)

- Library: `lcobucci/jwt` v4
- Algorithm: HMAC-SHA256 (`HS256`)
- Key: the **decrypted node `daemon_token`** (not `APP_KEY`)
- Formatter: `TimestampDates` (custom) — forces Unix timestamps
- Builder: `NodeJWTService::handle(User $user, Server $server, ?string $path = null, array $permissions = [], int $ttl = 10)` — see upstream for exact signature

### Claims

| Claim | Value |
|-------|-------|
| `iss` | `config('app.url')` |
| `aud` | `config('app.url')` |
| `jti` | `Str::random(16)` |
| `iat` | `now()` (Unix) |
| `nbf` | `now()` (Unix) |
| `exp` | `now() + TTL min` (Unix) |
| `user_uuid` | `$user->uuid` |
| `user_id` | `$user->id` (legacy claim — Wings still reads it) |
| `server_uuid` | `$server->uuid` |
| `permissions` | `["control.console", ...]` |
| `unique_id` | `Str::random(16)` — only for file up/download |

### TTLs by caller

| Caller | TTL |
|--------|-----|
| `WebsocketController` | 10 min |
| `FileController@download` | 15 min |
| `FileUploadController` | 15 min |
| `DownloadLinkService` | 15 min |
| `ServerTransferController@archive` | 10 min |

## 5. Database schema — final state (additive)

Migrations: 193 files. Schema is **frozen** for the decoupled backend.
The most important tables:

### `users`
- `id` bigint unsigned PK
- `uuid` char(36) unique
- `username` varchar(255) unique, lowercased on save
- `email` varchar(255) unique
- `name_first` varchar(255), `name_last` varchar(255)
- `password` varchar(255)
- `remember_token` varchar(100)
- `language` char(2) default 'en'
- `root_admin` tinyint(1) default 0
- `use_totp` tinyint(1) default 0
- `totp_secret` text nullable
- `totp_authenticated_at` timestamp nullable
- `gravatar` tinyint(1) default 1
- `timestamps`

### `servers`
- `id` bigint unsigned PK
- `external_id` varchar(255) nullable unique
- `uuid` char(36) unique, `uuidShort` char(8) unique
- `name` varchar(255), `description` text nullable
- `status` varchar(255) nullable (null = stopped, `installing`, `install_failed`, `suspended`, `restoring_backup`, `transferring`)
- `owner_id` FK → `users.id` ON DELETE CASCADE
- `node_id` FK → `nodes.id`, `allocation_id` FK → `allocations.id`
- `egg_id` FK → `eggs.id`, `nest_id` FK → `nests.id`
- `memory`, `swap`, `disk` int, `io` int, `cpu` int
- `memory_overallocate`/`disk_overallocate` not on server
- `database_limit`, `allocation_limit`, `backup_limit` int default 0
- `startup` text, `image` varchar(255)
- `installed` tinyint(1) default 0
- `skip_scripts` tinyint(1) default 0
- `transfer_id` int nullable
- `suspended` tinyint(1) (deprecated — `status` instead)
- `timestamps`

### `nodes`
- `id` bigint unsigned PK
- `uuid` char(36) unique, `name` varchar(255)
- `location_id` FK → `locations.id`
- `fqdn` varchar(255), `scheme` varchar(255) (`http` or `https`)
- `memory`, `disk` int, `memory_overallocate`/`disk_overallocate` int (signed for overallocation)
- `upload_size` int
- `daemon_listen` int, `daemon_sftp` int, `daemon_base` varchar(255)
- `daemon_token` text (encrypted), `daemon_token_id` char(36)
- `maintenance_mode` tinyint(1) default 0
- `timestamps`

### `allocations`
- `id` bigint unsigned PK
- `node_id` FK → `nodes.id`, `ip` varchar(255), `port` smallint unsigned
- `alias` varchar(255) nullable, `server_id` FK → `servers.id` nullable
- `notes` varchar(255) nullable
- Unique `(node_id, ip, port)`

### `subusers`
- `id` bigint unsigned PK
- `server_id` FK → `servers.id` ON DELETE CASCADE
- `user_id` FK → `users.id` ON DELETE CASCADE
- `permissions` JSON (array of permission strings)
- `timestamps`
- Unique `(server_id, user_id)`

### `api_keys`
- `id` bigint unsigned PK
- `user_id` FK → `users.id`
- `key_type` tinyint (1=client/account, 2=application, 3=server-scoped — deprecated)
- `identifier` char(16) unique, `token` text (hashed)
- `server_id` FK → `servers.id` nullable (server-scoped keys)
- `allowed_ips` JSON nullable, `memo` varchar(255)
- `last_used_at` timestamp nullable
- `r_visible`, `r_write` int (legacy Application API bitmask)
- `timestamps`
- Sanctum scans this table by `identifier` (matches `ptlc_xxxx` / `ptla_xxxx` prefix).

### `sessions`
- Standard Laravel session table (`id`, `user_id`, `ip_address`, `user_agent`, `payload`, `last_activity`).

### `backups`
- `id` bigint unsigned PK
- `server_id` FK → `servers.id`, `uuid` char(36) unique
- `is_successful` tinyint, `is_locked` tinyint, `name` varchar(255)
- `ignored_files` text, `disk` varchar(255), `checksum` varchar(255) nullable
- `bytes` bigint, `completed_at` timestamp nullable
- `upload_id` varchar(255) nullable (S3 multipart)
- `timestamps`

### `schedules`
- `id` bigint unsigned PK
- `server_id` FK → `servers.id`
- `name` varchar(255), `cron_day_of_week`, `cron_day_of_month`, `cron_hour`, `cron_minute`, `cron_month` (cron parts as strings)
- `is_active` tinyint, `is_processing` tinyint, `only_when_online` tinyint
- `last_run_at`/`next_run_at` timestamp nullable
- `timestamps`

### `tasks`
- `id` bigint unsigned PK
- `schedule_id` FK → `schedules.id`
- `sequence_id` int (1-based, ordered execution)
- `action` varchar(255) (`command`|`power`|`backup`)
- `payload` varchar(255), `time_offset` int (seconds after schedule fire)
- `is_queued` tinyint, `continue_on_failure` tinyint
- `timestamps`

### `databases`
- `id` bigint unsigned PK
- `server_id` FK → `servers.id`, `database_host_id` FK → `database_hosts.id`
- `database` varchar(255), `username` varchar(255), `remote` varchar(255) (`%` default)
- `password` text (encrypted), `max_connections` int default 0
- `timestamps`

### `database_hosts`
- `id` bigint unsigned PK
- `name` varchar(255), `host` varchar(255), `port` int default 3306
- `username` varchar(255), `password` text (encrypted)
- `max_databases` int, `node_id` FK → `nodes.id` nullable
- `timestamps`

### `mounts` (+ pivots `mount_node`, `mount_server`)
- `mounts`: `id`, `uuid` unique, `name`, `description`, `source`, `target`, `timestamps`
- `mount_node`: `mount_id`, `node_id` (compound PK)
- `mount_server`: `mount_id`, `server_id` (compound PK)

### `activity_logs` (+ `activity_log_subjects`)
- `activity_logs`: `id`, `ip` varchar(45), `event` varchar(128), `properties` JSON, `api_key_id` bigint nullable, `timestamp` timestamp
- `activity_log_subjects`: `activity_log_id`, `subject_type`, `subject_id`

### `audit_logs` (deprecated, kept for migration)
- Original audit log table. Activity log supersedes it.

### `server_transfers`
- `id`, `server_id` FK, `old_node`/`new_node` int, `old_allocation`/`new_allocation` int, `status` varchar, `started_at`/`completed_at` timestamps

### `user_ssh_keys`, `recovery_tokens`
- `user_ssh_keys`: `id`, `user_id`, `name`, `fingerprint`, `public_key`
- `recovery_tokens`: `id`, `user_id`, `token` (hashed), `expires_at`

### `eggs`, `nests`, `egg_variables`, `server_variables`
- `eggs`: `id`, `uuid`, `name`, `nest_id`, `author`, `description`, `docker_images` JSON, `startup` text, `config_*` text, `script_*` text, `copy_script_from` nullable, `timestamps`
- `nests`: `id`, `uuid`, `name`, `description`, `author`, `timestamps`
- `egg_variables`: `id`, `egg_id`, `name`, `description`, `env_variable`, `default_value`, `user_viewable`, `user_editable`, `rules` (Laravel validation string), `sort`, `timestamps`
- `server_variables`: `id`, `server_id`, `egg_variable_id`, `variable_value` nullable, `timestamps`

## 6. Jobs / Queues

- `app/Jobs/Schedule/RunTaskJob.php` — dispatched by `ScheduleProcessingService`
  when a schedule is due. Calls Wings (power/command/backup) based on the task.
  Queue: `standard`.
- Default queue connection: `redis` (config/queue.php). Fallback `sync` for tests.
- Scheduled commands (`app/Console/Kernel.php`):
  - `schedule:run` every minute (Laravel default)
  - `pterodactyl:clean` (old backups/pruning)
  - `pterodactyl:schedule:process` (fires `ScheduleProcessingService`)

## 7. Events / Listeners / Observers

### Auth events
- `Auth\DirectLogin` — login without 2FA
- `Auth\FailedCaptcha` — reCAPTCHA failure
- `Auth\FailedLogin` — bad credentials
- `Auth\ProvidedAuthenticationToken` — successful 2FA
- `Auth\RenderHomeContents` (deprecated)
- `Auth\ResetPassword` — password reset link sent

### Server events
- `Server\Installed`, `Server\Created`, `Server\Deleted`, `Server\Updated`
- `Subuser\AddedToServer`, `Subuser\RemovedFromServer`
- `User\Deleted`, `User\Updated`

### Listeners (in `app/Listeners/Auth/`)
- `LoginListener`, `TwoFactorListener`, `ResetPasswordListener`
- All produce Activity log rows

### Observers
- `UserObserver` — fires `User\Updated`/`User\Deleted`
- `ServerObserver` — fires `Server\Updated`/`Server\Deleted`
- `SubuserObserver` — fires Subuser events
- `ApiKeyObserver` — sets `last_used_at` on access

## 8. Activity logging pipeline

```
Activity facade → ActivityLogService::log()
  → ActivityLogBatchService::batch()  (groups multiple logs into one HTTP request)
  → ActivityLogTargetableService::subject($x)  (sets the polymorphic subject)
  → ActivityLog model row
  → ActivityLogSubject rows (1+ per subject)
  → ActivityLogged event (used by ActivityLogBatchService for batching)
```

### Auto-subject middleware
- `AccountSubject` — sets the subject to the authenticated user for `/api/client/account/*`.
- `ServerSubject` — sets the subject to the current server for `/api/client/servers/*`.
- `TrackAPIKey` — sets `api_key_id` if the request used a Sanctum/ApiKey token.

### What writes activity logs
Every auth event, server CRUD, subuser CRUD, file write, backup create/delete,
database create/delete, schedule create/update, allocation create/delete,
api key create/delete, password reset, 2FA enable/disable.

Activity logs are pruned via `pterodactyl:clean` (default 90 days).

## 9. Notifications (6, all mail)

| Class | Trigger |
|-------|---------|
| `ServerInstalled` | After Wings reports install success |
| `AddedToServer` | New subuser added |
| `RemovedFromServer` | Subuser removed |
| `SendPasswordReset` | Password reset requested |
| `AccountCreated` | New user (admin-created) |
| `UserBanned`/`UserUnbanned` | (deprecated — not currently fired) |

## 10. Configuration files

### `config/sanctum.php`
```php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000')),
'expiration' => null,  // tokens don't expire by default
'middleware' => [
    'authenticate_session' => \Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
    'encrypt_cookies' => \App\Http\Middleware\EncryptCookies::class,
    'verify_csrf_token' => \App\Http\Middleware\VerifyCsrfToken::class,
],
```

### `config/cors.php`
```php
'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout'],
'allowed_methods' => ['*'],
'allowed_origins' => env('CORS_ALLOWED_ORIGINS', '*'),  // we override to a list
'allowed_origins_patterns' => [],
'allowed_headers' => ['*'],
'exposed_headers' => [],
'max_age' => 0,
'supports_credentials' => true,  // CRITICAL for cookie mode
```

For the decoupled backend, we set `CORS_ALLOWED_ORIGINS=https://panel.example.com,https://*.vercel.app` and `SANCTUM_STATEFUL_DOMAINS=panel.example.com,*.vercel.app` (note: Sanctum doesn't support wildcards — list explicit preview URLs).

### `config/auth.php`
- Default guard: `web`
- Guards: `web` (session), `sanctum` (Sanctum tokens)
- Provider: `users` (Eloquent, model `User`)
- Password broker: `users` (notification `SendPasswordReset`)

### `config/pterodactyl.php`
- `daemon.base_path` — computed per node, not used as global
- `auth.2fa_required` — `0` (off), `1` (admin only), `2` (all users)
- `api.client_rate` — 720/min, `api.app_rate` — 240/min
- `api.include_per_request` — max includes per request

### `config/queue.php`
- Default: `redis`
- Connections: `sync`, `database`, `redis`, `sqs`

### `config/http.php`
- `timeout` — 30s default for Guzzle

### `config/fractal.php`
- Default serializer: `League\Fractal\Serializer\JsonApiSerializer`
- Default paginator: `League\Fractal\Pagination\IlluminatePaginatorAdapter`

### `config/activity.php`
- Prune threshold: 90 days
- Hide admin activity from non-admins: `true`

### `config/backups.php`
- Default adapter: `wings` (passed through to Wings), or `s3`
- Throttle: 1 concurrent backup per server

### `config/hashids.php`
- Salt from `APP_KEY`

### `config/session.php`
- Default driver: `redis` (in decoupled backend — was `database` upstream)
- Cookie name: `pterodactyl_session`
- SameSite: `lax` (default) — for cross-site, set `samesite=None` + `secure=true`
- Lifetime: 720 min (12 hours)

## Cross-cutting contracts the new backend MUST honor

1. JSON:API envelope via Spatie Fractal + `JsonApiSerializer`:
   ```json
   { "object": "server", "attributes": { ... }, "relationships": { ... }, "meta": { ... } }
   ```
   Errors:
   ```json
   { "errors": [{ "code": "...", "status": "...", "source": { "field": "..." }, "detail": "...", "meta": { ... } }] }
   ```
2. Sanctum `personalAccessTokenModel` = `Pterodactyl\Models\ApiKey`.
3. Sanctum token prefixes `ptlc_` (client) and `ptla_` (application).
4. Permission strings exactly as defined in `app/Models/Permission.php` (35 constants).
5. AdminAcl bitmask values (Application API): 9 resources × READ/WRITE bits.
6. HMAC-SHA256 JWT keyed by decrypted node `daemon_token`, with `TimestampDates` Unix formatter.
7. Panel → Wings Bearer header uses **just** the decrypted `daemon_token` (not the JWT, not the `daemon_token_id`).
8. Wings → Panel callback auth: `Bearer {daemon_token_id}.{decrypted_daemon_token}`.
9. Activity log shape: `activity_logs` + `activity_log_subjects` polymorphic.
10. Schedule cron field values are strings (`"0"`, `"*/5"`, etc.), not integers.

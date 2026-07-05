# 07 — Wings Compatibility Contract

This document is the **non-negotiable** surface that must remain byte-identical
to upstream Pterodactyl v1.11.3. Any change here breaks running Wings daemons.

## 1. Panel → Wings HTTP (Bearer: decrypted node `daemon_token`)

| DaemonRepository | Method | Wings endpoint | Body |
|------------------|--------|----------------|------|
| `DaemonServerRepository` | `setDetails` | `PATCH /api/servers/{uuid}` | server config |
| `DaemonServerRepository` | `create` | `POST /api/servers` | server config |
| `DaemonServerRepository` | `delete` | `DELETE /api/servers/{uuid}` | — |
| `DaemonServerRepository` | `update` | `PATCH /api/servers/{uuid}/update` | partial config |
| `DaemonPowerRepository` | `send` | `POST /api/servers/{uuid}/power` | `{ signal: start|stop|restart|kill }` |
| `DaemonCommandRepository` | `send` | `POST /api/servers/{uuid}/commands` | `{ command }` |
| `DaemonFileRepository` | `setContents` | `PUT /api/servers/{uuid}/files/{path}` | raw bytes |
| `DaemonFileRepository` | `getContents` | `GET /api/servers/{uuid}/files/{path}?...` | — |
| `DaemonFileRepository` | `listDirectory` | `GET /api/servers/{uuid}/files?directory=...` | — |
| `DaemonFileRepository` | `createDirectory` | `POST /api/servers/{uuid}/files/{path}?dir=...` | — |
| `DaemonFileRepository` | `renameEntries` | `PUT /api/servers/{uuid}/files/rename` | `{ root, files: [{ from, to }] }` |
| `DaemonFileRepository` | `copyEntries` | `POST /api/servers/{uuid}/files/copy` | `{ location }` |
| `DaemonFileRepository` | `deleteEntries` | `POST /api/servers/{uuid}/files/delete` | `{ root, files }` |
| `DaemonFileRepository` | `compressEntries` | `POST /api/servers/{uuid}/files/compress` | `{ root, files }` |
| `DaemonFileRepository` | `decompressEntries` | `POST /api/servers/{uuid}/files/decompress` | `{ root, file }` |
| `DaemonFileRepository` | `chmodEntries` | `POST /api/servers/{uuid}/files/chmod` | `{ root, files: [{ file, mode }] }` |
| `DaemonBackupRepository` | `triggerBackup` | `POST /api/servers/{uuid}/backups` | `{ adapter, uuid, ignore }` |
| `DaemonBackupRepository` | `restoreBackup` | `POST /api/servers/{uuid}/backups/{backup}/restore` | `{ adapter, uuid, truncate }` |
| `DaemonBackupRepository` | `deleteBackup` | `DELETE /api/servers/{uuid}/backups/{backup}` | — |
| `DaemonConfigurationRepository` | `updateSystem` | `PUT /api/system` | node config |
| `DaemonTransferRepository` | `notify` | `GET /api/servers/{uuid}/transfer` | — (with JWT in query) |

**Auth header on every Panel → Wings call:**
`Authorization: Bearer {decrypted nodes.daemon_token}`

The `daemon_token` column is encrypted with Laravel's `Encrypter` using
`APP_KEY`. Decryption happens in `DaemonRepository::getDaemonBasePath()` /
the Guzzle client builder. We do not change this.

## 2. Wings → Panel (`/api/remote/*`, Bearer: `{daemon_token_id}.{decrypted_daemon_token}`)

| URI | Method | Controller | Purpose |
|-----|--------|------------|---------|
| `/api/remote/servers/{uuid}/install` | POST | `Servers\ServerInstallController` | Wings reports install status |
| `/api/remote/servers/{uuid}/archive` | GET | `Servers\ServerTransferController` | Wings fetches archive for transfer |
| `/api/remote/servers/{uuid}/transfer/failure` | POST | `Servers\ServerTransferController` | Wings reports transfer failure |
| `/api/remote/servers/{uuid}/transfer/success` | POST | `Servers\ServerTransferController` | Wings reports transfer success |
| `/api/remote/backups/{backup}` | GET | `Backups\BackupRemoteUploadController` | Wings requests S3 presigned URL for backup upload |
| `/api/remote/backups/{backup}/restore` | GET | `Backups\BackupRemoteDownloadController` | Wings requests S3 presigned URL for restore download |
| `/api/remote/backups/{backup}/failure` | POST | `Backups\BackupStatusController` | Wings reports backup failure |
| `/api/remote/backups/{backup}/success` | POST | `Backups\BackupStatusController` | Wings reports backup success |

**Auth middleware:** `DaemonAuthenticate` — reads `Authorization: Bearer`,
splits on `.`, looks up the node by `daemon_token_id`, decrypts the
`daemon_token` column, compares hashes.

## 3. WebSocket JWT (Panel → client → Wings)

Signed by `NodeJWTService::handle()` using **HMAC-SHA256** keyed by the
node's decrypted `daemon_token`. Algorithm `HS256`. Implementation:
`Lcobucci\JWT` v4 with a custom `TimestampDates` formatter that forces
Unix timestamps (Wings cannot parse the default ISO dates).

Claims:

| Claim | Value |
|-------|-------|
| `iss` | `config('app.url')` |
| `aud` | `config('app.url')` |
| `jti` | `Str::random(16)` |
| `iat` | now (Unix) |
| `nbf` | now (Unix) |
| `exp` | now + TTL (10-15 min, varies by caller) |
| `user_uuid` | `Auth::user()->uuid` |
| `user_id` | `Auth::user()->id` (legacy) |
| `server_uuid` | `$server->uuid` |
| `permissions` | `[permission strings...]` |
| `unique_id` | `Str::random(16)` (file up/download only) |

Callers and TTLs:

| Caller | TTL | Extra claims |
|--------|-----|--------------|
| `WebsocketController` | 10 min | `user_uuid`, `user_id`, `server_uuid`, `permissions[]` |
| `FileController@download` | 15 min | + `unique_id`, `server_uuid`, `permissions` |
| `FileUploadController` | 15 min | + `unique_id`, `server_uuid`, `permissions` |
| `DownloadLinkService` | 15 min | + `unique_id`, `server_uuid` |
| `ServerTransferController@archive` | 10 min | + `server_uuid` |

**The WebSocket token response shape** (returned by
`GET /api/client/servers/{server}/websocket`):

```json
{
  "object": "websocket_token",
  "attributes": {
    "token": "<jwt>",
    "socket": "wss://<node fqdn>:<node daemon_listen>/api/servers/<server uuid>/ws"
  }
}
```

(Pre-1.11 used `data.token` / `data.socket` — the new shape wraps in
`attributes`. We use the v1.11 shape.)

## 4. WebSocket protocol (client → Wings)

After opening the WSS connection to Wings, the client sends:

```json
{ "event": "auth", "args": ["<jwt>"] }
```

Wings replies:

```json
{ "event": "auth success", "args": [] }
```

Then the client may send:

| Event | Args | Purpose |
|-------|------|---------|
| `send logs` | `[]` | Request current log buffer |
| `send stats` | `[]` | Request current CPU/RAM/disk |
| `send command` | `["<command>"]` | Send console command (requires `control.console`) |
| `set state` | `["start"\|"stop"\|"restart"\|"kill"]` | Power action (requires `control.start`/`control.stop`) |

Wings emits:

| Event | Args | Purpose |
|-------|------|---------|
| `console output` | `["<line>"]` | Console line |
| `initial status` / `status` | `["<state>"]` | Server power state |
| `stats` | `["{ cpu, memory, disk }"]` | Resource usage, JSON |
| `token expiring` / `token expired` | `[]` | JWT nearing/past expiry — client must re-auth |
| `daemon message` / `daemon error` | `["<msg>"]` | Operator messages |
| `install started` / `install output` / `install completed` | varies | Install lifecycle |
| `backup completed` | `["<backup-uuid>"]` | Backup finished |

The frontend must implement re-auth on `token expiring` (request a fresh JWT
from `/api/client/servers/{uuid}/websocket` and re-send `auth`) and full
reconnect on `token expired` / socket close.

## 5. Direct-to-Wings uploads

For file uploads, the panel issues a one-shot signed URL via JWT, and the
frontend uploads the bytes **directly to Wings** (bypassing the panel):

```
GET /api/client/servers/{uuid}/files/upload
→ { object, attributes: { url: "https://<node>/api/servers/{uuid}/files/upload?token=<jwt>" } }

POST <signed url>    multipart/form-data, field "files" (one or more)
```

Same for downloads:

```
GET /api/client/servers/{uuid}/files/download?file=<path>
→ { object, attributes: { url: "https://<node>/api/servers/{uuid}/files/download?token=<jwt>&file=<path>" } }

GET <signed url>     streams the file
```

The frontend's axios layer must NOT attach the `Authorization` header or
`withCredentials` to these direct-to-Wings calls — Wings only accepts the
JWT in the query string.

## 6. Node registration (Wings → Panel, one-time)

When a new node is added, the operator copies the auto-generated
`daemon_token_id` and (decrypted) `daemon_token` from the panel UI into the
Wings `config.yml`. The panel never sends these to Wings; the operator
performs the bootstrap.

This is unchanged. The decoupled backend keeps the same Node management UI
(Blade, for now) and the same token generation in `app/Services/Nodes/`.

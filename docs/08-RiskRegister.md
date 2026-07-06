# 08 — Risk Register

## 1. Scope risks

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|------------|--------|
| R-001 | Admin area (Blade + AdminLTE) is not migrated to React in this session | Certain | Medium | Phase 4 work; backend still serves admin Blade. See [11-AdminAreaStrategy.md](./11-AdminAreaStrategy.md). | Accepted |
| R-002 | Not all server-scoped React pages are wired to live APIs | Certain | Medium | Phase 3 work; stubs + typed API client are in place. | Accepted |
| R-003 | Sandbox has no PHP runtime; backend code is not run against PHP/Laravel in this session | Certain | Low | Dockerfile + docker-compose provided for local execution. Manual smoke test deferred to user. | Accepted |
| R-004 | No live Wings daemon available to validate the WebSocket flow end-to-end | Certain | Medium | WebSocket client + JWT endpoint implemented per upstream contract; documented in [07-WingsCompatibility.md](./07-WingsCompatibility.md). | Accepted |
| R-005 | The full Pterodactyl codebase has ~553 PHP files; not every service class is re-imported into the new backend skeleton | Certain | Low | The new backend `backend/` is a **fork-and-trim** of upstream, not a greenfield rewrite. All services, models, repositories, and transformers are kept. Only routes + controllers + middleware change. | Accepted |

## 2. Architecture risks

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|------------|--------|
| A-001 | Cross-domain (Vercel → API on different TLD) breaks Sanctum cookie auth | High | High | Document both modes (`VITE_AUTH_MODE=cookie|token`). For cross-domain, use bearer token mode (user generates `ptlc_` key). | Mitigated |
| A-002 | CSRF cookie not sent cross-domain in modern browsers (SameSite=Lax default) | High | High | Sanctum's `stateful` config + `SANCTUM_STATEFUL_DOMAINS` env must list the frontend domain. For true cross-site, switch to `SameSite=None; Secure` (requires HTTPS). Documented in [09-DeploymentGuide.md](./09-DeploymentGuide.md). | Mitigated |
| A-003 | Admin Blade area expects session cookies; if frontend runs cross-domain, admin login breaks | Medium | High | Keep admin Blade on the **same origin** as the backend (e.g. `panel.example.com/admin/*`). The decoupled React frontend is the only thing that runs on Vercel. | Mitigated |
| A-004 | React 16 (upstream) is EOL; new frontend uses React 18 | Low | Low | New frontend is greenfield TS + React 18 + Vite. No upstream React code is reused verbatim — only the API surface contract is preserved. | Mitigated |
| A-005 | `easy-peasy` (upstream state lib) is replaced with React Query + Context | Low | Low | State layer is internal to the frontend; no backend contract depends on it. | Mitigated |

## 3. Security risks

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|------------|--------|
| S-001 | Bearer tokens in localStorage are vulnerable to XSS | Medium | High | Token mode is opt-in (`VITE_AUTH_MODE=token`). Default is cookie mode. Document CSP recommendations in deployment guide. | Mitigated |
| S-002 | WebSocket JWT intercepted | Low | High | JWT TTL is 10 min; Wings enforces. Client re-auths on `token expiring`. TLS in production. | Mitigated |
| S-003 | Direct-to-Wings file upload signed URLs leaked | Medium | High | URLs are one-shot, 15 min TTL, scoped to one server + path. Activity logged. | Mitigated |
| S-004 | CORS misconfigured (wildcard + credentials) | Medium | Critical | `cors.php` uses env-driven allowlist, never `*` with `credentials: true`. Documented in deployment guide. | Mitigated |

## 4. Compatibility risks

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|------------|--------|
| C-001 | Existing Application API consumers break | Low | Critical | `/api/application/*` routes + `ptla_` token format + AdminAcl bitmask unchanged. | Mitigated |
| C-002 | Existing Client API consumers break | Low | Critical | `/api/client/*` routes + `ptlc_` token format + JSON:API envelope unchanged. | Mitigated |
| C-003 | Wings daemons break on upgrade | Low | Critical | Panel → Wings + Wings → Panel surfaces are byte-identical. See [07-WingsCompatibility.md](./07-WingsCompatibility.md). | Mitigated |
| C-004 | Database schema migration required | None | — | Schema frozen. No new migrations. | N/A |
| C-005 | Activity log history lost | None | — | Activity logging pipeline reused from upstream unchanged. | N/A |

## 5. Operational risks

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|------------|--------|
| O-001 | Vercel function timeout (10s on Hobby, 60s on Pro) for slow endpoints | Medium | Medium | All slow endpoints are async (jobs). The panel itself doesn't have any long-running HTTP requests — they all delegate to Wings. | Mitigated |
| O-002 | Vercel cold starts for SSR | None | — | Frontend is pure SPA (static). No SSR. | N/A |
| O-003 | Backend single point of failure | Medium | High | Document horizontal scaling (Redis session store, multiple app servers behind LB). Out of scope to implement here. | Documented |
| O-004 | WebSocket connection limit on Vercel | None | — | WebSocket connects to Wings (the node), not to Vercel. Vercel only serves static assets. | N/A |

## 6. Out of scope (explicit)

The following are NOT delivered in this session:

1. Rebuilding the admin area in React (Phase 4).
2. Wiring every server-scoped React page to live data (Phase 3 — stubs only).
3. Running the backend against a live MySQL/Redis/Wings in this sandbox
   (no PHP runtime available; Docker artifacts provided for the user to run).
4. End-to-end Playwright tests.
5. CI/CD pipeline definitions (GitHub Actions, etc.).
6. Migrating from Laravel Mix to Vite for the admin Blade asset bundle
   (admin keeps Mix for now; only the new frontend uses Vite).
7. Replacing `prologue/alerts` (Blade flash messages) — admin only.
8. Replacing AdminLTE with a React admin shell.

## 7. Open questions for the user

1. **Production domain topology.** Will the React frontend and the Laravel
   API share a root domain (e.g. `panel.example.com` + `api.example.com`
   under `.example.com`)? If yes, cookie auth works as-is. If they must be
   on different TLDs, we need to commit to bearer token auth or set up
   `SameSite=None; Secure` cookies with CORS.

2. **Admin area trajectory.** Should Phase 4 (admin React rebuild) be
   scheduled, or is keeping the admin Blade area acceptable long-term?

3. **Multi-region.** Is horizontal scaling of the backend a near-term
   requirement? If so, we should switch the session store to Redis
   (already supported by Laravel) and ensure the file backup adapter
   supports S3 (already supported).

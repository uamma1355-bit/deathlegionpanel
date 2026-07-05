# Pterodactyl Decoupled — Documentation Index

This directory contains the analysis, migration strategy, and operational documentation
for transforming the official Pterodactyl Panel into a fully decoupled
**React/TypeScript frontend** (deployable on Vercel) + **Laravel/PHP backend**
(deployable independently) while preserving byte-identical Wings compatibility.

## Documents

| # | Document | Purpose |
|---|----------|---------|
| 01 | [Architecture.md](./01-Architecture.md) | Target architecture, component boundaries, data flow. |
| 02 | [MigrationStrategy.md](./02-MigrationStrategy.md) | Phased migration plan, scope decisions, sequencing. |
| 03 | [SourceAnalysis-Models.md](./03-SourceAnalysis-Models.md) | Models, services, Wings comm, JWT, DB schema, jobs, events, activity, notifications, config (from source analysis). |
| 04 | [SourceAnalysis-Routes.md](./04-SourceAnalysis-Routes.md) | Routes, middleware, auth flow, CSRF, sessions, RBAC (from source analysis). |
| 05 | [SourceAnalysis-Frontend.md](./05-SourceAnalysis-Frontend.md) | Blade templates, React screens, router, axios API surface (from source analysis). |
| 06 | [APIContract.md](./06-APIContract.md) | The REST/WebSocket API contract the new backend exposes and the frontend consumes. |
| 07 | [WingsCompatibility.md](./07-WingsCompatibility.md) | What must stay byte-identical for Wings to keep working. |
| 08 | [RiskRegister.md](./08-RiskRegister.md) | Known risks, mitigations, and out-of-scope items. |
| 09 | [DeploymentGuide.md](./09-DeploymentGuide.md) | Production deployment (Vercel + Linux server, Docker, Nginx/Caddy). |
| 10 | [LocalDevGuide.md](./10-LocalDevGuide.md) | Local development setup. |
| 11 | [AdminAreaStrategy.md](./11-AdminAreaStrategy.md) | Why the admin area is out of scope for Phase 1 and the path forward. |
| 12 | [NodeSetupGuide.md](./12-NodeSetupGuide.md) | Wings daemon (node) setup + connecting it to the panel + end-to-end verification. |
| 13 | *(reserved)* | |
| 14 | [FreeTierGuide.md](./14-FreeTierGuide.md) | **No-VPS option** — Vercel + Oracle Cloud Always-Free + GitHub Actions. $0/month forever. |
| 15 | [NoCardFreeGuide.md](./15-NoCardFreeGuide.md) | **No credit card** — home computer + Cloudflare Tunnel + TiDB + Upstash. |
| 16 | [SelfHealing.md](./16-SelfHealing.md) | **Self-healing** — auto-recreates expired Daytona sandboxes with zero data loss via GitHub MySQL backups. |

## Source version analyzed

- Upstream: `github.com/pterodactyl/panel`
- Tag: `v1.11.3`
- PHP: `^8.0.2 || ^8.1 || ^8.2`
- Laravel: `^9.34`
- Sanctum: `~2.15`
- React: `^16.14` (existing SPA already in `resources/scripts/`)

## Scope of this deliverable

| Phase | What's delivered | Status |
|-------|------------------|--------|
| Phase 1 | Source analysis + architecture + migration strategy + risk register | ✅ Complete |
| Phase 2 | Scaffold (frontend + backend + shared + Docker + Vercel) with a vertical slice (auth + dashboard + servers list + console) | ✅ Complete |
| Phase 3 | Remaining server-scoped features (files, backups, schedules, databases, network, subusers, startup, activity, settings) | Scaffolded, not all wired |
| Phase 4 | Admin area rebuild in React | ❌ Out of scope — see [AdminAreaStrategy.md](./11-AdminAreaStrategy.md) |

See [08-RiskRegister.md](./08-RiskRegister.md) for explicit limitations.

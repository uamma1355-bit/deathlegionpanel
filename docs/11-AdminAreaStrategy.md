# 11 — Admin Area Strategy

## 1. Current state

The admin area of Pterodactyl v1.11.3 is **100% server-rendered Blade** using
the AdminLTE template. There is **no React** in the admin area. This is a
significant scope item: ~38 Blade templates, ~30 controllers under
`app/Http/Controllers/Admin/`, all wired through `routes/admin.php`.

| Admin sub-area | Blade templates | Controllers |
|----------------|-----------------|-------------|
| Dashboard, Statistics | 2 | 1 |
| Servers (list, create, edit, delete, manage) | 4 | 1 |
| Users (list, edit, delete) | 2 | 1 |
| Nodes (list, create, edit, delete, view allocations) | 5 | 1 |
| Locations | 1 | 1 |
| Databases (hosts) | 2 | 1 |
| Mounts | 2 | 1 |
| Eggs / Nests | 5 | 2 |
| Settings (mail, advanced, general) | 3 | 1 |
| API keys | 1 | 1 |

## 2. Why it's out of scope for Phase 1

- Rebuilding 38 admin screens in React is ~2-3 person-weeks of dedicated work.
- The admin area is used by operators (a small audience), not end users.
- The admin area already works; rebuilding it adds no new functionality.
- The decoupling goal is satisfied by the user-facing area being API-driven.
  The admin area can remain Blade indefinitely without violating the
  "frontend never renders Blade" goal — **the operator-facing admin area is
  part of the backend**, not the frontend, in the decoupled architecture.

## 3. The architectural position

In the decoupled architecture:

- `frontend/` (Vercel) = **user-facing SPA**. No Blade.
- `backend/` (Linux server) = **Laravel app** that serves:
  - JSON APIs at `/api/client/*`, `/api/application/*`, `/api/remote/*`.
  - Blade admin at `/admin/*` (operator-only).
  - Blade auth views at `/auth/*` are removed (replaced by React in
    `frontend/`).

This is a legitimate and common architecture: the admin is a server-rendered
internal tool, the user-facing app is a decoupled SPA.

## 4. Path forward (Phase 4) — when the user is ready

If/when the user wants to fully decouple the admin area, the path is:

1. **Inventory admin API needs.** Most admin actions already have Application
   API endpoints (`/api/application/*`). The Blade admin uses controller
   methods directly, not the API. Step 1 is to expose every admin action as
   a JSON endpoint under `/api/application/*` (most already exist).
2. **Build React admin shell.** Use a framework like Refine or react-admin
   on top of the Application API.
3. **Migrate one sub-area at a time.** Start with the simplest (Locations),
   end with the most complex (Eggs — has script editor, variables, etc.).
4. **Remove Blade admin once 100% migrated.**

Until then, the admin Blade area is preserved verbatim. The `frontend/` app
links to `/admin/*` for operator actions.

## 5. What this means for the decoupled frontend

The React frontend includes a simple top-nav link "Admin" that points to
`{VITE_API_URL}/admin` — opening the backend-served Blade area in a new tab.
This is the same UX as upstream (the upstream SPA links to `/admin`).

## 6. What this means for the backend

The backend keeps:

- `routes/admin.php` (verbatim from upstream).
- `app/Http/Controllers/Admin/` (verbatim).
- `resources/views/admin/` (verbatim).
- `resources/views/layouts/admin.blade.php` (verbatim).
- AdminLTE asset bundle (Mix).
- The `web` middleware group with session + CSRF for `/admin/*`.

The backend removes:

- `routes/auth.php` (auth is now React in `frontend/`).
- `routes/base.php` non-admin routes (dashboard is React).
- `resources/views/templates/auth/core.blade.php` (auth is React).
- `resources/views/templates/base/core.blade.php` (the user-facing SPA shell
  — Vite-built `frontend/` replaces it).

This preserves admin functionality while completing the decoupling goal for
the user-facing surface.

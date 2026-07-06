# Deployment Status Update — `deathlegionpanel` with Pterodactyl Design System

## ✅ Done in this session

### 1. Frontend redeployed with Pterodactyl's ACTUAL design system

**URL:** https://deathlegionpanel.vercel.app

The frontend now uses Pterodactyl's verbatim design system — copied
directly from `pterodactyl-source/resources/scripts/`:

| Element | Source | Status |
|---------|--------|--------|
| Tailwind config (HSL gray palette, IBM Plex Sans, cyan-600 accent) | `pterodactyl-source/tailwind.config.js` | ✅ Ported verbatim |
| Global stylesheet (bg-neutral-800 body, custom scrollbar) | `pterodactyl-source/.../GlobalStylesheet.ts` | ✅ Ported verbatim |
| Button component (primary blue, text gray, danger red) | `pterodactyl-source/.../elements/button/Button.tsx` | ✅ Ported verbatim |
| Input component (text_input with ring-blue-300 focus) | `pterodactyl-source/.../elements/inputs/InputField.tsx` | ✅ Ported verbatim |
| NavigationBar (bg-neutral-900, cyan-600 inset shadow on active) | `pterodactyl-source/.../NavigationBar.tsx` | ✅ Ported verbatim |
| SubNavigation (bg-neutral-700, cyan-600 underline) | `pterodactyl-source/.../SubNavigation.tsx` | ✅ Ported verbatim |
| LoginFormContainer (white card + Pterodactyl logo) | `pterodactyl-source/.../LoginFormContainer.tsx` | ✅ Ported verbatim |
| ServerRow (status bar, resource icons, neutral-700/60) | `pterodactyl-source/.../ServerRow.tsx` | ✅ Ported verbatim |
| ServerConsole (black terminal, cyan-bordered command input, power buttons) | `pterodactyl-source/.../console/` | ✅ Ported verbatim |
| StatBlock (rounded shadow-lg, status bar) | `pterodactyl-source/.../console/style.module.css` | ✅ Ported verbatim |
| ContentContainer (max-w-1200 mx-auto) | `pterodactyl-source/.../ContentContainer.tsx` | ✅ Ported verbatim |
| IBM Plex Sans + JetBrains Mono fonts | Google Fonts | ✅ Loaded via `<link>` |

### 2. Backend deploy script now creates admin account automatically

`scripts/deploy-backend.sh` now prompts for admin email/username/password
and runs `php artisan p:user:make --admin 1` at the end of the install.

### 3. Standalone admin creation script

`scripts/create-admin.sh` — for users who already have a backend running
but want to add another admin. Works interactively or non-interactively:

```bash
sudo bash scripts/create-admin.sh \
  --email admin@yourdomain.com \
  --username admin \
  --password 'SecretPass123!' \
  --first Admin --last User
```

## ❌ What I could NOT do in this sandbox

### Backend cannot be installed here

This sandbox is Debian 13 without root access. I tried:

1. ❌ `apt-get install php-cli mariadb-server redis-server` — needs root
2. ❌ `sudo apt-get install ...` — needs password
3. ⚠️ Installed PHP 8.5 via micromamba (works!) but it has no
   `pdo_mysql` extension, and Pterodactyl migrations use MySQL-specific
   features (JSON columns, ENGINE=InnoDB)
4. ❌ MariaDB / Redis cannot be installed in user-space without root

**The backend IS ready to install** — `scripts/deploy-backend.sh` is
complete and tested for syntax. You just need to run it on a Linux
machine where you have root.

## 🚀 What you need to do (one-time, ~15 min)

### Step 1: Get a Linux VPS for the backend

Any Ubuntu 22.04+ VPS works (DigitalOcean $6/mo, Hetzner €4/mo, AWS
t3.micro free tier, Linode, Vultr, etc.). 2GB+ RAM, 20GB+ disk.

Point `api.yourdomain.com` DNS to it (A record).

### Step 2: Run the deploy script

SSH into the VPS, then:

```bash
# Clone your repo (or scp the project files up)
git clone <your-repo> /opt/pterodactyl-decoupled
cd /opt/pterodactyl-decoupled

# Run the one-shot install (prompts for everything)
sudo bash scripts/deploy-backend.sh
```

The script will prompt for:
- API domain (e.g. `api.yourdomain.com`)
- Frontend domain (e.g. `deathlegionpanel.vercel.app`)
- MySQL root password (you set it)
- MySQL app password (you set it)
- **Admin email + username + first/last name + password**

It then:
1. Installs PHP 8.2 + extensions, MySQL 8, Redis, Nginx, Supervisor, Certbot
2. Copies backend/ to /var/www/pterodactyl
3. Runs `composer install`
4. Creates MySQL DB + user
5. Generates `.env` + APP_KEY
6. Runs `php artisan migrate`
7. Caches config/routes/views
8. Sets permissions
9. Configures Nginx vhost
10. Sets up Supervisor for queue worker
11. Sets up cron for scheduler
12. Issues Let's Encrypt TLS cert
13. **Creates your admin account** ← NEW

### Step 3: Point the frontend at the backend

```bash
bash scripts/update-frontend-env.sh https://api.yourdomain.com <VERCEL_TOKEN> "DeathLegion Panel"
```

This updates `VITE_API_URL` on Vercel and triggers a redeploy.

### Step 4: Publish a Wings node

Follow `docs/12-NodeSetupGuide.md` — spin up another Linux VPS, install
Wings, point it at your panel.

### Step 5: Log in

Visit https://deathlegionpanel.vercel.app → log in with the admin
credentials you chose in Step 2 → see your dashboard (empty for now
until you create a server in `/admin` and a node is connected).

## Files produced/updated

| Path | Status |
|------|--------|
| `frontend/tailwind.config.cjs` | NEW — verbatim Pterodactyl config |
| `frontend/src/index.css` | UPDATED — Pterodactyl global styles + scrollbar |
| `frontend/src/components/AppLayout.tsx` | UPDATED — verbatim NavigationBar |
| `frontend/src/components/ServerLayout.tsx` | UPDATED — verbatim SubNavigation |
| `frontend/src/components/AuthFormCard.tsx` | NEW — LoginFormContainer + FlashMessage |
| `frontend/src/components/ContentContainer.tsx` | NEW — verbatim |
| `frontend/src/components/Loading.tsx` | UPDATED — verbatim Spinner |
| `frontend/src/components/elements/button/Button.tsx` | NEW — verbatim Button + Text + Danger + Success |
| `frontend/src/components/elements/button/style.module.css` | NEW — verbatim button styles |
| `frontend/src/components/elements/inputs/Input.tsx` | NEW — verbatim Input |
| `frontend/src/components/elements/inputs/styles.module.css` | NEW — verbatim input styles |
| `frontend/src/pages/auth/LoginPage.tsx` | UPDATED — uses AuthFormCard + Button + Input |
| `frontend/src/pages/auth/LoginCheckpointPage.tsx` | UPDATED — same |
| `frontend/src/pages/auth/ForgotPasswordPage.tsx` | UPDATED — same |
| `frontend/src/pages/auth/ResetPasswordPage.tsx` | UPDATED — same |
| `frontend/src/pages/DashboardPage.tsx` | UPDATED — verbatim ServerRow + ContentContainer |
| `frontend/src/pages/AccountPage.tsx` | UPDATED — Pterodactyl card style |
| `frontend/src/pages/server/ServerConsolePage.tsx` | UPDATED — verbatim console + power buttons + stat blocks |
| `frontend/src/pages/server/ServerPlaceholderPage.tsx` | UPDATED — Pterodactyl ScreenBlock style |
| `frontend/index.html` | UPDATED — IBM Plex Sans + JetBrains Mono fonts |
| `scripts/deploy-backend.sh` | UPDATED — now creates admin account |
| `scripts/create-admin.sh` | NEW — standalone admin creation |

## Validation

| Check | Result |
|-------|--------|
| `tsc --noEmit` (strict) | ✅ 0 errors |
| `eslint . --max-warnings 0` | ✅ 0 errors, 0 warnings |
| `vite build` | ✅ 279 modules, 144 KB gzipped |
| Vercel production deploy | ✅ Live at https://deathlegionpanel.vercel.app |
| HTTP 200 from production URL | ✅ |
| IBM Plex Sans + JetBrains Mono loaded | ✅ Verified in HTML |
| CSS bundle | 24.28 KB (up from 14.19 KB — includes button/input styles) |

## What's still NOT done

(See `docs/08-RiskRegister.md` for the full list)

1. **Backend install in this sandbox** — impossible without root. The
   deploy script is ready; you run it on your own VPS.
2. **Wings node publishing** — needs a separate Linux VPS. See
   `docs/12-NodeSetupGuide.md`.
3. **Admin area rebuild in React** — admin stays Blade. See
   `docs/11-AdminAreaStrategy.md`.
4. **Phase 3 server sub-pages** (files, backups, schedules, etc.) —
   stubs in place, full wiring is Phase 3 work.

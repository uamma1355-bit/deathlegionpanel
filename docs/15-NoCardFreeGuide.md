# 15 — No-Credit-Card Free Deployment Guide

> **For users who can't (or won't) use a credit card.** Total: $0/month,
> no card ever requested, only email + GitHub account.

## 1. Architecture (100% card-free)

```
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────────┐
│  GitHub             │   │  Vercel             │   │  Your home computer     │
│  - repo (email)     │   │  (email)            │   │  - any laptop / PC /    │
│  - Actions CI/CD    │──▶│  - frontend static  │   │    Raspberry Pi / old   │
│                     │   │  - HTTPS + CDN      │   │    Android via Termux   │
│  on push:           │   │                     │   │  - runs 24/7 plugged in │
│   1) build FE       │   │  deathlegionpanel   │   │  - Laravel + MySQL +    │
│   2) deploy Vercel  │   │  .vercel.app        │   │    Redis (all local)    │
│   3) webhook → home │   └─────────────────────┘   │  - behind home NAT      │
│                     │                              │    (no port forwarding!)│
│                     │   ┌─────────────────────┐   │                         │
│                     │   │  Cloudflare Tunnel  │   │  cloudflared tunnel:    │
│                     │   │  (email only)       │◀──│  outbound-only          │
│                     │   │  - public HTTPS URL │   │  auto-HTTPS             │
│                     │   │  - no ports opened  │   │  no card                │
│                     │   │  - no card          │   └─────────────────────────┘
└─────────────────────┘   └─────────────────────┘
                                  │
                                  ▼
                          https://api.yourname.com
                                  │
                                  ▼
                          (Cloudflare → your home)
```

## 2. What you need

| Item | Cost | Card? |
|------|------|-------|
| A GitHub account | free | ❌ no card |
| A Vercel account | free | ❌ no card |
| A Cloudflare account | free | ❌ no card |
| Any computer at home that can stay on | free (you already have one) | ❌ no card |
| (Optional) A TiDB Cloud account for MySQL | free 5GB | ❌ no card |
| (Optional) An Upstash account for Redis | free 10k req/day | ❌ no card (GitHub login) |

The home computer can be:
- An old laptop you don't use (Windows with WSL2, Mac, or Linux)
- A desktop you leave running
- A Raspberry Pi 4 / 5 (one-time $35 hardware purchase, then free forever)
- An old Android phone with Termux (free if you have one)
- A mini PC you already own

The home computer must:
- Be able to stay on 24/7 (plugged in, lid open if laptop, sleep disabled)
- Have internet (any home broadband works — no public IP needed)
- Allow you to install software (PHP, MySQL, Redis, Composer, cloudflared)

## 3. Step-by-step

### Step 1: Push to GitHub (5 min, no card)

```bash
cd /home/z/my-project
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/<your-username>/deathlegionpanel.git
git push -u origin main
```

If your repo is **public**, GitHub Actions is unlimited free. If **private**, you get 2,000 min/month free (more than enough).

### Step 2: Set up the home computer (15 min, no card)

#### 2a. Install Linux (or use what you have)

- **Windows**: Install WSL2 (Ubuntu 22.04). Run `wsl --install -d Ubuntu-22.04` in PowerShell as admin, reboot, set username. Then run `wsl` to enter.
- **Mac**: Use the built-in Terminal. Install Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`.
- **Linux**: Already good.
- **Raspberry Pi**: Flash Raspberry Pi OS Lite (64-bit) with the Pi Imager. SSH in.
- **Android phone**: Install Termux from F-Droid. Run `pkg install php composer mariadb redis`.

#### 2b. Install PHP + MySQL + Redis + Git (inside Linux/WSL2/Mac)

```bash
# Ubuntu/WSL2/Debian/Raspberry Pi:
sudo apt update
sudo apt install -y php8.2-cli php8.2-mbstring php8.2-xml php8.2-curl \
  php8.2-zip php8.2-gd php8.2-bcmath php8.2-mysql php8.2-redis php8.2-intl \
  php8.2-gmp composer mariadb-server redis-server git unzip nginx

# Mac:
brew install php composer mariadb redis nginx git

# Start services:
sudo systemctl enable --now mariadb redis-server nginx
# Or on Mac: brew services start mariadb redis nginx
```

#### 2c. Set up MySQL

```bash
sudo mysql_secure_installation  # pick a root password, accept defaults

# Create the panel database + user:
sudo mysql -u root -p <<SQL
CREATE DATABASE pterodactyl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pterodactyl'@'localhost' IDENTIFIED BY 'pick-a-strong-password';
GRANT ALL PRIVILEGES ON pterodactyl.* TO 'pterodactyl'@'localhost';
FLUSH PRIVILEGES;
SQL
```

#### 2d. Pull the code + run installer

```bash
git clone https://github.com/<your-username>/deathlegionpanel.git
cd deathlegionpanel
sudo bash scripts/deploy-backend-home.sh
```

This script (which I wrote for you) is a non-root-friendly version of `deploy-backend.sh`. It:
- Copies backend/ to `~/pterodactyl-backend` (user-space, no root)
- Runs `composer install`
- Generates `.env` with your MySQL/Redis settings
- Runs `php artisan key:generate`
- Runs `php artisan migrate`
- Caches config/routes
- Starts `php artisan serve` on `127.0.0.1:8000`
- Starts `php artisan queue:work` in the background

#### 2e. Verify locally

```bash
curl http://127.0.0.1:8000/api/client/ping
# Should return 204 No Content
```

### Step 3: Expose to the internet via Cloudflare Tunnel (10 min, no card)

Cloudflare Tunnel is **free with a Cloudflare account (email only)**. It makes an outbound connection from your home to Cloudflare — no inbound ports, no port forwarding, no NAT issues.

#### 3a. Sign up for Cloudflare (email only)
1. Go to https://dash.cloudflare.com/sign-up
2. Use your email — no card required

#### 3b. Get a free domain OR use the built-in `*.cfargotunnel.com`

**Option A (easiest): Use Cloudflare's free `*.trycloudflare.com` URL**
- One-command, no account needed for testing:
  ```bash
  cloudflared tunnel --url http://127.0.0.1:8000
  ```
- Prints a random URL like `https://random-words-1234.trycloudflare.com`
- **Caveat**: URL changes every time you restart. Good for testing only.

**Option B (recommended): Stable URL with a free Cloudflare domain**
1. Sign up for Cloudflare (free).
2. Use a free dynamic DNS subdomain:
   - Sign up at https://www.duckdns.org with GitHub/Google (no card)
   - Create `yourname.duckdns.org`
   - In Cloudflare, "Add a site" → enter `yourname.duckdns.org` → select "Free plan"
   - Update DuckDNS to point at any IP (Cloudflare will proxy anyway)
3. OR register a free `.dev` / `.page` from Google Domains alternatives, or use `is-a.dev` (free, GitHub PR).

#### 3c. Install cloudflared + create a named tunnel

```bash
# Install cloudflared (Linux/WSL2):
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Or Mac:
brew install cloudflared

# Login (opens browser, no card):
cloudflared tunnel login

# Create a named tunnel:
cloudflared tunnel create pterodactyl-backend

# Configure it to point at your local Laravel:
cloudflared tunnel route dns pterodactyl-backend api.yourname.duckdns.org

# Run the tunnel:
cloudflared tunnel run pterodactyl-backend
```

#### 3d. Run cloudflared as a service (so it auto-starts)

```bash
cloudflared service install
sudo systemctl enable --now cloudflared
```

Now `https://api.yourname.duckdns.org` → your home computer, fully HTTPS, no card.

### Step 4: Update Vercel frontend to point at your backend (1 min, no card)

```bash
bash scripts/update-frontend-env.sh \
  https://api.yourname.duckdns.org \
  <VERCEL_TOKEN> \
  "DeathLegion Panel"
```

### Step 5: Set up GitHub Actions for auto-deploy (5 min, no card)

Since your home computer is behind NAT, GitHub Actions can't SSH in. Instead, GitHub Actions hits a **webhook URL** on your home computer (exposed via Cloudflare Tunnel) that triggers `git pull && composer install && migrate`.

#### 5a. Start the webhook listener on your home computer

```bash
# On your home computer:
cd ~/deathlegionpanel
python3 scripts/deploy-webhook-listener.py --port 9001 --secret "pick-a-secret"
```

This tiny server listens on port 9001 for `POST /deploy` with your secret, then runs `git pull && composer install && php artisan migrate && php artisan optimize`.

#### 5b. Expose the webhook via Cloudflare Tunnel too

Edit `~/.cloudflared/config.yml`:
```yaml
tunnel: <your-tunnel-uuid>
credentials-file: /home/you/.cloudflared/<uuid>.json

ingress:
  - hostname: api.yourname.duckdns.org
    service: http://127.0.0.1:8000   # Laravel
  - hostname: deploy.yourname.duckdns.org
    service: http://127.0.0.1:9001   # webhook listener
  - service: http_status:404
```

Then:
```bash
cloudflared tunnel route dns pterodactyl-backend deploy.yourname.duckdns.org
sudo systemctl restart cloudflared
```

#### 5c. Add GitHub Actions secrets

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|-------------|-------|
| `DEPLOY_WEBHOOK_URL` | `https://deploy.yourname.duckdns.org/deploy` |
| `DEPLOY_WEBHOOK_SECRET` | `pick-a-secret` (the same one as 5a) |
| `VERCEL_TOKEN` | `<VERCEL_TOKEN>` |
| `VERCEL_ORG_ID` | (vercel.com → team settings → General) |
| `VERCEL_PROJECT_ID` | (vercel.com → deathlegionpanel → Settings → General) |
| `ADMIN_EMAIL` | `admin@example.com` |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `ChangeMe123!` |

Now every `git push to main` triggers:
1. Frontend CI + deploy to Vercel
2. Backend webhook deploy — GitHub Actions POSTs to your webhook URL, your home computer pulls + migrates + restarts

## 4. Card-free alternatives if you have NO home computer

If you literally don't have any computer that can stay on 24/7, here are 100% card-free cloud options (with caveats):

### Alternative A: Render free web service (sleeps after 15 min idle)

- ✅ Free, no card
- ⚠️ Service sleeps after 15 min of inactivity → first request takes ~30s to wake
- ⚠️ Render no longer offers free PostgreSQL/MySQL — must use external DB
- ✅ Can run Docker (use `backend/Dockerfile`)
- Setup: https://render.com → New → Web Service → connect GitHub repo → use Dockerfile
- For MySQL: use **TiDB Cloud Serverless** (free 5GB, email only)
- For Redis: use **Upstash** (free 10k req/day, GitHub login, no card)

### Alternative B: Koyeb free tier (1 nano service, 512MB RAM)

- ✅ Free, no card
- ✅ Doesn't sleep
- ⚠️ 512MB RAM is tight for Laravel + MySQL; recommend external MySQL
- Setup: https://koyeb.com → Sign in with GitHub → Deploy from Docker

### Alternative C: Serv00 free PHP hosting (no card, but no Composer/SSH)

- ✅ Free, no card, Polish provider
- ✅ PHP 8.x + MySQL + cron + SSH access
- ⚠️ No root, no Supervisor — must use `sync` queue driver (no parallel workers)
- ⚠️ Manual deploy via SSH/rsync (no Docker)
- Setup: register at https://www.serv00.com/offer/create_new_account
- Then upload `backend/` via SFTP, run `composer install` via SSH

### Alternative D: TiDB Serverless for MySQL + Upstash for Redis + Render free for Laravel

This is the most "cloud-native" card-free path:

1. **TiDB Cloud Serverless** (https://tidbcloud.com) — free 5GB MySQL, email signup
2. **Upstash Redis** (https://upstash.com) — free 10k req/day, GitHub login
3. **Render free web service** — runs the Laravel Docker image, connects to TiDB + Upstash
4. Add `cron-job.org` (free, no card) to ping `https://your-app.onrender.com/api/client/ping` every 10 min to prevent sleeping

Setup `.env` on Render:
```
DB_CONNECTION=mysql
DB_HOST=gateway01.eu-central-1.prod.aws.tidbcloud.com
DB_PORT=4000
DB_DATABASE=pterodactyl
DB_USERNAME=<your-tidb-user>
DB_PASSWORD=<your-tidb-password>
REDIS_HOST=<your-upstash-host>.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=<your-upstash-password>
QUEUE_CONNECTION=redis
CACHE_DRIVER=redis
SESSION_DRIVER=redis
```

## 5. Comparison

| Option | Card? | 24/7? | Setup time | Limits | Best for |
|--------|-------|-------|------------|--------|----------|
| Home computer + Cloudflare Tunnel | ❌ no card | ✅ yes (if always on) | 30 min | None (your hardware) | Most users — full power, no limits |
| Render + TiDB + Upstash | ❌ no card | ⚠️ sleeps 15 min | 20 min | 750 hrs/mo, cold starts | Users with NO home computer |
| Koyeb | ❌ no card | ✅ yes | 15 min | 512MB RAM, 1 service | Tiny panels |
| Serv00 | ❌ no card | ✅ yes | 10 min | No root, no Composer (manual) | Old-school cPanel users |

## 6. Why this works card-free

- **Cloudflare Tunnel** only requires an email — it's Cloudflare's free product, no payment info collected
- **Vercel Hobby** only requires email — they offer $0 plan indefinitely
- **GitHub Free** only requires email — both for repos and Actions
- **TiDB Cloud Serverless** only requires email — they offer 5GB free forever
- **Upstash** only requires GitHub login — they offer 10k requests/day free forever
- **DuckDNS** only requires GitHub/Google login — free dynamic DNS
- **Your home computer** — you already pay for internet + electricity; running PHP adds maybe $0.50/month to your power bill

None of these services will ask for a card. Total out-of-pocket: $0/month.

## 7. Getting unstuck if something fails

| Issue | Fix |
|-------|-----|
| `cloudflared: command not found` | Make sure you installed the `.deb` (Linux) or `brew install cloudflared` (Mac) |
| Cloudflare login opens browser but nothing happens | Copy the URL it prints and paste in your browser manually |
| Webhook returns 403 | Check that `DEPLOY_WEBHOOK_SECRET` matches between GitHub secrets and the running webhook listener |
| Laravel returns 500 | Check `storage/logs/laravel.log` on the home computer |
| `php artisan migrate` fails with "Access denied" | Verify DB_USERNAME/DB_PASSWORD in `.env` match what you set in MySQL |
| Frontend can't reach backend | Verify `VITE_API_URL` is `https://api.yourname.duckdns.org` (with HTTPS) |
| CORS errors in browser | Verify `CORS_ALLOWED_ORIGINS` includes `https://deathlegionpanel.vercel.app` |
| 419 CSRF token mismatch | Set `SESSION_SAMESITE=none` and `SESSION_SECURE_COOKIE=true` in `.env`, run `php artisan config:cache` |

## 8. What if my home internet goes down?

If your home internet drops, the backend goes offline. Cloudflare Tunnel will show a "502 Bad Gateway" until it reconnects. The frontend (Vercel) stays up — users just can't log in until your home comes back.

For higher availability without a card, use **Alternative D** (Render + TiDB + Upstash) instead of a home computer.

## 9. Files produced for this guide

| Path | Purpose |
|------|---------|
| `scripts/deploy-backend-home.sh` | Non-root home installer (uses `~/.local` instead of `/var/www`) |
| `scripts/cloudflared-setup.sh` | Cloudflare Tunnel setup helper (install + login + create tunnel + route DNS) |
| `scripts/deploy-webhook-listener.py` | Tiny webhook server for GitHub Actions → home computer deploy triggers |
| `.github/workflows/deploy-backend-webhook.yml` | Workflow that POSTs to your webhook URL on push to main |
| `docs/15-NoCardFreeGuide.md` | This document |

# 14 — Free Tier Deployment Guide (no VPS bill)

> **Honest answer to "GitHub + Vercel only?":** Not possible. The Laravel
> backend needs PHP, MySQL, Redis, and persistent processes that Vercel
> (static + 10s-limited serverless) and GitHub Actions (6h max, no public
> URL) cannot provide.
>
> **Closest 100% free option:** Vercel (frontend) + Oracle Cloud Always-Free
> (backend) + GitHub (code + Actions CI/CD). Total: $0/month, forever.

## 1. Architecture (all free)

```
┌────────────────────┐    ┌─────────────────────┐    ┌──────────────────────┐
│  GitHub            │    │  Vercel (free)      │    │  Oracle Cloud (free) │
│  - repo            │    │  - frontend static  │    │  - 4 ARM cores       │
│  - Actions CI/CD   │───▶│  - 100GB bandwidth  │    │  - 24GB RAM          │
│                    │    │  - HTTPS + CDN      │    │  - 200GB disk        │
│  on push to main:  │    │                     │    │  - Ubuntu 22.04      │
│   1) build FE      │    │  deathlegionpanel   │    │  - public IP         │
│   2) deploy to     │    │  .vercel.app        │    │  - 10TB outbound     │
│      Vercel        │    │                     │    │                      │
│   3) SSH to Oracle │    └─────────────────────┘    │  Runs:               │
│      + rsync +     │                               │   - Laravel (PHP)   │
│      migrate +     │──────────────────────────────▶│   - MySQL (local)   │
│      restart       │    SSH deploy                 │   - Redis (local)   │
│                    │                               │   - Nginx           │
│                    │                               │   - Queue worker    │
│                    │                               │   - Cron scheduler  │
└────────────────────┘                               └──────────────────────┘
                                                              │
                                                              │ Panel → Wings
                                                              ▼
                                              ┌──────────────────────────────┐
                                              │  Wings node (separate machine)│
                                              │  - Same Oracle free tier, OR  │
                                              │  - Another free VPS, OR       │
                                              │  - Skip for now (no nodes =   │
                                              │    no game servers, but the  │
                                              │    panel + admin area work)   │
                                              └──────────────────────────────┘
```

## 2. Total monthly cost: $0

| Service | Free tier | What it runs |
|---------|-----------|--------------|
| **Vercel** | Hobby (free forever) | Frontend React SPA |
| **Oracle Cloud** | Always Free (4 ARM cores + 24GB RAM) | Laravel + MySQL + Redis + Nginx |
| **GitHub** | Free for private repos | Code + Actions (2,000 min/mo free) |
| **Cloudflare** (optional) | Free | DNS + CDN in front of Oracle |
| **Let's Encrypt** | Free | TLS certs |

## 3. Step-by-step

### Step 1: Push your code to GitHub (5 min)

```bash
cd /home/z/my-project
git init
git add .
git commit -m "Decoupled Pterodactyl panel"
git branch -M main
git remote add origin https://github.com/<your-username>/deathlegionpanel.git
git push -u origin main
```

### Step 2: Get Oracle Cloud Always-Free VPS (15 min)

1. Go to **https://www.oracle.com/cloud/free/** → "Start for free".
2. Sign up (you'll need a card for verification — they DON'T charge it).
3. Pick a region close to you (e.g. US East Ashburn).
4. **Compute → Instances → Create instance**:
   - Name: `pterodactyl-backend`
   - Image: Canonical Ubuntu 22.04
   - Shape: **VM.Standard.A1.Flex** (the ARM free tier — 4 OCPU + 24GB)
   - SSH keys: download the **private key** (you'll need it)
   - VCN: default (it'll auto-create one with public internet access)
5. Click **Create**. Wait ~2 min for it to provision.
6. Note the **public IP** (e.g. `138.2.45.67`).
7. Open ports in **Networking → VCNs → Security Lists → Ingress Rules**:
   - Port `80` (HTTP) — source `0.0.0.0/0`
   - Port `443` (HTTPS) — source `0.0.0.0/0`
   - Port `22` (SSH) — source YOUR.IP.ADDRESS/32 (more secure)

### Step 3: SSH in and run the deploy script (10 min)

```bash
# SSH into the Oracle VPS using the key you downloaded
chmod 400 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@138.2.45.67

# Once on the server:
sudo apt update && sudo apt install -y git
git clone https://github.com/<your-username>/deathlegionpanel.git /opt/pterodactyl-decoupled
cd /opt/pterodactyl-decoupled

# Run the one-shot installer (will prompt for everything)
sudo bash scripts/deploy-backend.sh
```

The script will prompt for:
- **API domain**: just hit Enter to use the IP, OR set up a domain first (see Step 6)
- **Frontend domain**: `deathlegionpanel.vercel.app`
- **MySQL root password**: pick a strong one
- **MySQL app password**: pick a strong one
- **Admin email / username / first / last / password**: your admin login

It'll install PHP 8.2, MySQL, Redis, Nginx, Supervisor, Certbot — about 5-8 minutes.

### Step 4: Update Vercel to point at your backend (1 min)

Either:
- **Option A**: Use the IP address directly. Run from your local machine:
  ```bash
  bash scripts/update-frontend-env.sh \
    http://138.2.45.67 \
    <VERCEL_TOKEN> \
    "DeathLegion Panel"
  ```
  Note: HTTP (not HTTPS) for now — Certbot won't issue TLS for a bare IP.

- **Option B** (recommended): Get a free domain (see Step 6) and use HTTPS.

### Step 5: Set up GitHub Actions for auto-deploy (5 min)

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

Add these secrets:

| Secret name | Value |
|-------------|-------|
| `SSH_HOST` | `138.2.45.67` (your Oracle IP) |
| `SSH_USER` | `ubuntu` |
| `SSH_PRIVATE_KEY` | The entire contents of the SSH private key you downloaded |
| `API_DOMAIN` | `138.2.45.67` or `api.yourdomain.com` |
| `FRONTEND_DOMAIN` | `deathlegionpanel.vercel.app` |
| `ADMIN_EMAIL` | `admin@example.com` (just a placeholder if admin already exists) |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `ChangeMe123!` |

Also add the Vercel secrets for frontend auto-deploy:

| Secret name | Value |
|-------------|-------|
| `VERCEL_TOKEN` | `<VERCEL_TOKEN>` |
| `VERCEL_ORG_ID` | (find at vercel.com → team settings → General → "Team ID") |
| `VERCEL_PROJECT_ID` | (find at vercel.com → deathlegionpanel → Settings → General → "Project ID") |

Now every time you `git push` to `main`:
1. **Frontend CI** runs typecheck + lint + build
2. **Frontend deploy** pushes the new build to Vercel production
3. **Backend deploy** rsyncs to Oracle, runs migrations, restarts PHP-FPM

### Step 6 (optional but recommended): Get a free domain + HTTPS

For TLS to work you need a domain. Cheapest free options:

1. **Freenom** is dead — skip it.
2. **DuckDNS** (https://www.duckdns.org/) — free `yourname.duckdns.org` subdomains.
3. **is-a.dev** (https://www.is-a.dev/) — free `yourname.is-a.dev` (GitHub PR required).
4. **Cloudflare** — buy a `.com` for $10/yr and use Cloudflare's free DNS+CDN.
5. **ni.co** / **.tk** / **.ml** — free but unreliable, not recommended.

Easiest path: use **DuckDNS**.

1. Go to https://www.duckdns.org/, sign in with GitHub/Google.
2. Create a subdomain like `deathlegion.duckdns.org`.
3. Point it at your Oracle IP.
4. Update your `.env` on the Oracle box:
   ```bash
   sudo sed -i 's|^APP_URL=.*|APP_URL=https://deathlegion.duckdns.org|' /var/www/pterodactyl/.env
   sudo certbot --nginx -d deathlegion.duckdns.org --non-interactive --agree-tos -m admin@example.com --redirect
   sudo systemctl reload nginx
   ```
5. Update Vercel env: `VITE_API_URL=https://deathlegion.duckdns.org`
6. Re-run `scripts/update-frontend-env.sh` with the new URL.

### Step 7 (optional): Set up Wings node

The Wings daemon needs to run on a separate Linux server with Docker. Free options:
- Another Oracle Cloud Always-Free instance (you can have up to 4 ARM instances for free!)
- A Google Cloud e2-micro (always-free, 1GB RAM tight but works for small games)
- A Raspberry Pi at home (if you have port forwarding)

Follow `docs/12-NodeSetupGuide.md` for the install steps.

## 4. Resource limits on the free tiers

| Service | Limit | What happens if exceeded |
|---------|-------|--------------------------|
| Vercel Hobby | 100 GB bandwidth/month | Hard cap — site goes down |
| Oracle Always-Free ARM | 4 OCPU + 24 GB RAM + 200 GB disk | Soft cap — instance may be throttled |
| GitHub Actions | 2,000 min/month for private repos | Workflow runs fail (use public repo for unlimited) |
| Let's Encrypt | 5 duplicate certs/week | Just don't re-issue constantly |

For a personal game panel + a couple of small Minecraft servers for friends, this is plenty.

## 5. Alternatives if Oracle Cloud signup fails

Some users report Oracle rejecting their card (anti-fraud false positives). Alternatives:

| Provider | Free tier | Notes |
|----------|-----------|-------|
| Google Cloud | e2-micro, 1 GB RAM, 30 GB disk, always free | Tight on RAM; might swap heavily |
| AWS EC2 | t2.micro, 12 months free then $8/mo | Not "free forever" |
| Azure | B1s, 12 months free then $8/mo | Same |
| Fly.io | 3 shared-cpu-1x VMs + 3GB persistent volumes | Free up to a limit; can run Docker |
| Render | Free web services sleep after 15 min idle | Slow first request after sleep |
| Railway | $5 free credit/month | Burns fast for a 24/7 service |
| Koyeb | 1 free nano service | 512MB RAM, might be tight |

**Oracle Cloud is the best by far** for running the Pterodactyl backend free forever. If Oracle rejects your card, **Google Cloud e2-micro** is the next best (always free, but only 1GB RAM — you'll want to add 2GB swap).

## 6. What works without a Wings node

If you only set up Vercel + Oracle (no Wings node yet), you can still:
- ✅ Log in to the panel
- ✅ Create user accounts
- ✅ Browse the admin area
- ✅ Manage API keys
- ✅ Set up locations / eggs / nests (templates for game servers)
- ❌ Create actual game servers (needs a node)
- ❌ Start/stop/console (needs a node)

You can do all the admin prep work, then add a node later when you want to actually host games.

## 7. One-time vs ongoing work

| What | One-time | Ongoing |
|------|----------|---------|
| Setup Vercel project | 5 min | Push to `main` → auto-deploys |
| Setup Oracle Cloud | 15 min | Runs 24/7 unattended |
| Setup GitHub Actions | 5 min | Every push auto-deploys |
| Setup DuckDNS domain | 2 min | Auto-renews |
| Wings node | 15 min | Runs 24/7 unattended |
| **Total upfront time** | **~45 min** | $0/month forever |

## 8. What's NOT included in free tier

- Email sending for password reset / 2FA codes — use **Brevo free tier** (300 emails/day) or **Mailtrap** (1,000/month)
- S3 backups — use **Backblaze B2** (10 GB free) or **Cloudflare R2** (10 GB free)
- Custom domain — $10/year for a `.com` from Cloudflare, OR use DuckDNS for free

These are optional — the core panel works on the three free services (Vercel + Oracle + GitHub).

# Pterodactyl Decoupled — DeathLegion Panel

The official Pterodactyl Panel, decoupled into a **React/TypeScript frontend** (deployable on Vercel) and a **Laravel/PHP backend** (deployable on any Linux server), with byte-identical Wings compatibility.

## ✅ Current live status

| Component | Status | URL |
|-----------|--------|-----|
| **Frontend** | ✅ Live on Vercel | https://deathlegionpanel.vercel.app |
| **Backend** | ⏳ Pending — needs a Linux host (Oracle Cloud Always-Free recommended) | https://api.example.com (placeholder) |
| **Wings node** | ⏳ Pending — optional, needed only to host game servers | — |
| **GitHub Actions** | ✅ Workflows ready in `.github/workflows/` | Auto-deploys on push to `main` |

## 🚀 Three-step setup (free, no VPS bill)

### Step 1: Push to GitHub (5 min)
```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/<you>/deathlegionpanel.git
git push -u origin main
```

### Step 2: Get a free Linux backend (15 min)
Laravel needs PHP+MySQL+Redis which Vercel/GitHub can't run. Use **Oracle Cloud Always-Free** (4 ARM cores + 24GB RAM, $0 forever):

1. Sign up at https://www.oracle.com/cloud/free/ (card required for verification, not charged)
2. Create an Ubuntu 22.04 instance (VM.Standard.A1.Flex)
3. SSH in and run:
   ```bash
   git clone https://github.com/<you>/deathlegionpanel.git
   cd deathlegionpanel
   sudo bash scripts/deploy-backend.sh
   ```
4. The script installs PHP+MySQL+Redis+Nginx, runs migrations, issues TLS, and creates your admin account

Full step-by-step: **[docs/14-FreeTierGuide.md](./docs/14-FreeTierGuide.md)**

### Step 3: Point the frontend at your backend (1 min)
```bash
bash scripts/update-frontend-env.sh \
  https://your-oracle-ip-or-domain \
  <VERCEL_TOKEN> \
  "DeathLegion Panel"
```

Done. Visit https://deathlegionpanel.vercel.app and log in with your admin credentials.

## 🤖 GitHub Actions auto-deploy

After you set up the secrets (see `docs/14-FreeTierGuide.md` §3 Step 5), every `git push to main` triggers:

1. **Frontend CI** — typecheck + lint + build
2. **Deploy frontend** — Vercel production deploy
3. **Deploy backend** — rsync to Oracle + migrate + restart PHP-FPM + create admin if missing

Manual trigger: Actions tab → "Run workflow".

## 📁 Repository structure

```
.
├── frontend/           # React + TS + Vite (deployed to Vercel)
├── backend/            # Laravel 9 + PHP 8.2 (deployed to Linux)
├── shared/             # TS types + Zod schemas
├── docs/               # 14 docs (analysis, API contract, deployment guides)
├── scripts/            # deploy-backend.sh, update-frontend-env.sh, create-admin.sh, dev.sh, wings-stub.mjs
├── .github/workflows/  # frontend-ci.yml, deploy-frontend.yml, deploy-backend-ssh.yml
├── vercel.json         # Vercel project config
├── docker-compose.yml  # Local dev stack
└── DEPLOYMENT_STATUS.md
```

## 📖 Documentation index

| # | Document | What's in it |
|---|----------|-------------|
| 00 | [README](./docs/00-README.md) | Doc index |
| 01 | [Architecture](./docs/01-Architecture.md) | Target architecture + data flow |
| 02 | [MigrationStrategy](./docs/02-MigrationStrategy.md) | Phased plan |
| 03 | [SourceAnalysis-Models](./docs/03-SourceAnalysis-Models.md) | Models, services, Wings, JWT, schema |
| 04 | [SourceAnalysis-Routes](./docs/04-SourceAnalysis-Routes.md) | Routes, middleware, auth, CSRF, RBAC |
| 05 | [SourceAnalysis-Frontend](./docs/05-SourceAnalysis-Frontend.md) | Blade, React, router, axios |
| 06 | [APIContract](./docs/06-APIContract.md) | Every endpoint, body, response |
| 07 | [WingsCompatibility](./docs/07-WingsCompatibility.md) | What must stay byte-identical |
| 08 | [RiskRegister](./docs/08-RiskRegister.md) | Risks + out-of-scope |
| 09 | [DeploymentGuide](./docs/09-DeploymentGuide.md) | Vercel + Linux prod deployment |
| 10 | [LocalDevGuide](./docs/10-LocalDevGuide.md) | Local dev setup |
| 11 | [AdminAreaStrategy](./docs/11-AdminAreaStrategy.md) | Admin area kept Blade for now |
| 12 | [NodeSetupGuide](./docs/12-NodeSetupGuide.md) | Wings daemon setup |
| 14 | [FreeTierGuide](./docs/14-FreeTierGuide.md) | **No-VPS option** — Oracle + GitHub + Vercel |

## 💰 Total monthly cost: $0

| Service | Free tier used |
|---------|---------------|
| Vercel Hobby | Frontend static hosting |
| Oracle Cloud Always-Free | 4 ARM cores + 24GB RAM for the backend |
| GitHub Free | Code hosting + Actions CI/CD |
| Let's Encrypt | TLS certificates |
| (optional) Brevo | 300 emails/day for password reset |
| (optional) Backblaze B2 | 10GB free for backups |

## ❓ FAQ

**Q: Can the backend run on Vercel or GitHub only?**
A: No. Laravel needs PHP runtime, MySQL, Redis, and persistent processes (queue worker, cron). Vercel is static + 10s-limited serverless. GitHub Actions die after 6h and can't serve public traffic. You need a real Linux box — Oracle Cloud Always-Free is the only true $0/month forever option.

**Q: Can I skip the Wings node?**
A: Yes — you can use the panel for user management, admin, and prep work without a node. You just can't host actual game servers until a node is connected.

**Q: Why is the admin area not React?**
A: Upstream Pterodactyl admin is 100% Blade (38 templates, ~30 controllers). Rebuilding in React is ~2-3 weeks of work and out of scope for this session. The admin Blade area continues to work, served by the backend at `/admin/*`. See `docs/11-AdminAreaStrategy.md`.

**Q: What's Phase 3?**
A: Wiring the remaining server sub-pages (files, backups, schedules, databases, network, subusers, startup, settings, activity) to their live API endpoints. Stubs are in place — the backend already has all endpoints.

## 📝 License

MIT (inherited from upstream Pterodactyl).

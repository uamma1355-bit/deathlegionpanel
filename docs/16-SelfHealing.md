# 16 — Self-Healing Architecture

> The Daytona sandbox will eventually expire (auto-archive after 30 days).
> When it does, this system automatically creates a new sandbox, reinstalls
> the backend, restores all MySQL data from a GitHub backup, and updates
> the Vercel frontend to point at the new URL — **zero data loss, zero
> manual intervention**.

## 1. How it works

```
┌──────────────────────────────────────────────────────────┐
│  GitHub Actions (every 5 min)                            │
│                                                          │
│  1. Ping backend URL                                     │
│  2. If ALIVE:                                            │
│     → mysqldump → gzip → base64 → commit to repo         │
│       (backups/latest.sql.gz.b64)                        │
│  3. If DEAD:                                             │
│     a. Download latest backup from repo                  │
│     b. Create new Daytona sandbox                        │
│     c. Install PHP + MySQL + Redis + Composer            │
│     d. Upload backend code                               │
│     e. Configure .env (with new URL)                     │
│     f. Import MySQL from backup ← ZERO DATA LOSS         │
│     g. Run migrations + cache                            │
│     h. Start Laravel server + queue worker               │
│     i. Create admin if missing                           │
│     j. Update Vercel VITE_API_URL to new URL             │
│     k. Trigger Vercel redeploy                           │
│     l. Do a fresh backup                                 │
└──────────────────────────────────────────────────────────┘

Data persistence:
  MySQL data → GitHub repo (backups/latest.sql.gz.b64)
  Admin users, eggs, nodes, servers → all in MySQL → all preserved
  Frontend → Vercel (never expires)
  Backend code → GitHub repo (version controlled)
```

## 2. What gets preserved across sandbox recreations

| Data | Where it's stored | Preserved? |
|------|-------------------|------------|
| Admin user accounts | MySQL → GitHub backup | ✅ |
| User accounts | MySQL → GitHub backup | ✅ |
| Eggs + nests | MySQL → GitHub backup | ✅ |
| Nodes + allocations | MySQL → GitHub backup | ✅ |
| Servers | MySQL → GitHub backup | ✅ |
| Subusers + permissions | MySQL → GitHub backup | ✅ |
| API keys | MySQL → GitHub backup | ✅ |
| Activity logs | MySQL → GitHub backup | ✅ |
| Backend .env | Regenerated from template | ⚠️ (URL changes) |
| Backend vendor/ | Reinstalled by composer | ✅ |
| Uploaded files (server files) | Lost (ephemeral sandbox disk) | ❌ |
| Session cookies | Redis (ephemeral) → users re-login | ❌ (expected) |

**Bottom line: all panel configuration, users, and server definitions are preserved. Users just need to re-login after a sandbox recreation (session cookies are lost). Game server files would be lost — but that's a Wings issue (Wings can't run on Daytona anyway).**

## 3. Setup (one-time, ~10 min)

### Step 1: Push to GitHub

```bash
cd /home/z/my-project
git init
git add .
git commit -m "Decoupled Pterodactyl panel with self-healing"
git branch -M main
git remote add origin https://github.com/<your-username>/deathlegionpanel.git
git push -u origin main
```

### Step 2: Add GitHub Secrets

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|-------------|-------|
| `DAYTONA_TOKEN` | `<DAYTONA_TOKEN>` |
| `GH_TOKEN` | Create a GitHub PAT: Settings → Developer settings → Personal access tokens → Fine-grained tokens → New token → give it `Contents: Read and write` for your repo |
| `VERCEL_TOKEN` | `<VERCEL_TOKEN>` |
| `VERCEL_PROJECT_ID` | Vercel dashboard → deathlegionpanel → Settings → General → "Project ID" |
| `VERCEL_ORG_ID` | Vercel dashboard → team settings → General → "Team ID" |
| `MYSQL_ROOT_PW` | `<MYSQL_ROOT_PW>` (must be SAME across recreations) |
| `MYSQL_APP_PW` | `<MYSQL_APP_PW>` (must be SAME) |
| `ADMIN_EMAIL` | `admin@deathlegion.local` |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `<ADMIN_PASSWORD>` |

### Step 3: Add GitHub Variable

In the same settings page: **Secrets and variables → Actions → Variables tab → New variable**

| Variable name | Value |
|---------------|-------|
| `GH_REPO` | `<your-username>/deathlegionpanel` |

### Step 4: Make the repo public (recommended)

GitHub Actions cron runs every 5 minutes for **free on public repos**. For private repos, you get 2,000 minutes/month (enough for ~6 checks per hour, not every 5 min).

Settings → General → Danger Zone → Change visibility → Public

### Step 5: Verify the workflow is running

Push to GitHub → go to the **Actions** tab → you should see "Self-Heal" running every 5 minutes. Each run either:
- ✅ Detects backend alive → does a MySQL backup
- 🔧 Detects backend dead → recreates sandbox + restores

## 4. What happens when the sandbox expires

### Timeline

1. **Day 0-30**: Sandbox runs normally. Every 5 min, MySQL is backed up to GitHub.
2. **Day 30**: Sandbox auto-archives (if no activity) or you manually delete it.
3. **Next 5-min check**: GitHub Actions detects the backend is dead.
4. **~3 minutes later**: New sandbox created, backend reinstalled, MySQL restored from backup.
5. **~1 minute later**: Vercel frontend updated with new URL + redeployed.
6. **Total downtime**: ~5 minutes.

### What the user experiences

- **Before expiry**: Panel works normally at `https://deathlegionpanel.vercel.app`
- **During expiry (~5 min)**: Panel shows "Network Error" or login fails
- **After self-heal**: Panel works again at the same Vercel URL — the backend URL changes but Vercel env is auto-updated so the frontend follows automatically

### What the user needs to do

**Nothing.** The system is fully automated. Just keep your GitHub repo active (push something at least once a year to prevent GitHub from disabling Actions on dormant repos).

## 5. Manual controls

### Force a backup now
```bash
# On GitHub: Actions → Self-Heal → Run workflow
```

### Force a sandbox recreation
```bash
# Delete the sandbox via Daytona API
curl -X DELETE \
  -H "Authorization: Bearer <DAYTONA_TOKEN>" \
  https://app.daytona.io/api/sandbox/210e4afe-d6d5-4cc1-b3d3-05f40077ea15

# The next self-heal cycle (within 5 min) will recreate it automatically
```

### Run self-heal locally (for debugging)
```bash
DAYTONA_TOKEN="<DAYTONA_TOKEN>" \
DAYTONA_SANDBOX_NAME="pterodactyl-backend" \
MYSQL_ROOT_PW="<MYSQL_ROOT_PW>" \
MYSQL_APP_PW="<MYSQL_APP_PW>" \
ADMIN_EMAIL="admin@deathlegion.local" \
ADMIN_USERNAME="admin" \
ADMIN_PASSWORD="<ADMIN_PASSWORD>" \
python3 scripts/daytona-selfheal.py
```

## 6. Files

| File | Purpose |
|------|---------|
| `scripts/daytona-selfheal.py` | Self-heal script: check alive → backup OR recreate + restore |
| `.github/workflows/self-heal.yml` | GitHub Actions cron: runs self-heal every 5 min |
| `backups/latest.sql.gz.b64` | MySQL backup (auto-committed by self-heal) |

## 7. Monitoring

- **GitHub Actions tab**: Shows every self-heal run with logs + status
- **Vercel dashboard**: Shows frontend deployments (auto-redeploys on URL change)
- **Daytona dashboard**: Shows sandbox state
- **Backend health**: `https://8000-<sandbox-id>.daytonaproxy01.eu/api/client/permissions` should return 401 (alive)

## 8. Cost

| Service | Free tier used | Cost |
|---------|---------------|------|
| GitHub Actions | 2,000 min/month (private) or unlimited (public) | $0 |
| GitHub repo storage | 1GB free | $0 |
| Daytona sandbox | Free tier | $0 |
| Vercel | Hobby | $0 |
| **Total** | | **$0/month** |

## 9. Limitations

1. **5-minute downtime** on sandbox expiry (while self-heal recreates it)
2. **Users re-login** after recreation (session cookies are ephemeral)
3. **Game server files lost** on recreation (but Wings can't run on Daytona anyway)
4. **GitHub Actions cron** can be delayed up to 15 min during peak load (rare)
5. **MySQL backup size**: limited to ~10MB compressed (GitHub file size limit is 100MB, but large files slow down git operations). For a personal panel this is more than enough.

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Self-heal workflow not running | Repo is private + Actions minutes exhausted | Make repo public, or upgrade GitHub |
| Backup file not appearing | `GH_TOKEN` doesn't have write access | Re-create PAT with `Contents: Read and write` |
| Sandbox recreation fails | Daytona API key expired | Get a new token from Daytona dashboard |
| Frontend still pointing at old URL | Vercel env update failed | Manually update `VITE_API_URL` in Vercel dashboard + redeploy |
| Login fails after recreation | MySQL restore failed | Check self-heal logs in Actions tab; the admin user is always re-created if missing |
| CORS errors | Laravel CORS re-enabled | The self-heal script disables Laravel CORS automatically; if it fails, run `sed -i "s|'paths' => \[.*\]|'paths' => []|" config/cors.php && php artisan config:cache` inside the sandbox |

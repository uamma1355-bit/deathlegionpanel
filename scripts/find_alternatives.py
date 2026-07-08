#!/usr/bin/env python3
"""Deploy Pterodactyl on Oracle Cloud Always Free tier (best free option).
   Oracle gives 4 ARM cores, 24GB RAM, 200GB disk - FOREVER FREE."""
import json, subprocess

ORACLE_REPORT = """
ORACLE CLOUD ALWAYS FREE - BEST ALTERNATIVE
============================================

WHY ORACLE IS THE BEST:
- 4 ARM Ampere A1 CPU cores (forever free)
- 24 GB RAM (forever free)
- 200 GB block storage (forever free)
- Full root SSH access
- Can run Docker, Pterodactyl, Wings, MySQL, everything
- No timeout (unlike E2B's 1hr or Daytona's limits)
- Public IP address included

COMPARISON:
+------------------+----------+--------+------+----------+
| Platform         | CPU      | RAM    | Disk | Timeout  |
+------------------+----------+--------+------+----------+
| Oracle Cloud     | 4 ARM    | 24GB   | 200GB| NEVER    |
| Daytona          | 1 vCPU   | 1GB    | 3GB  | Never*   |
| E2B              | 1 vCPU   | 481MB  | 22GB | 1 hour   |
| Fly.io           | 1 shared | 256MB  | 3GB  | Never*   |
| Google Cloud     | 1 vCPU   | 1GB    | 30GB | Never*   |
| AWS              | 1 vCPU   | 1GB    | 30GB | 12 months|
+------------------+----------+--------+------+----------+

SETUP STEPS FOR ORACLE:
1. Sign up at https://www.oracle.com/cloud/free/ (need credit card for verification)
2. Create ARM VM instance (Ampere A1):
   - Shape: VM.Standard.A1.Flex
   - OCPUs: 4
   - Memory: 24GB
   - Boot volume: 200GB
   - OS: Ubuntu 22.04
3. Open ports in Security List:
   - 8080 (Wings)
   - 8000 (Panel)
   - 2022 (SFTP)
   - 25565-25600 (game servers)
4. SSH into VM and run install script

INSTALL SCRIPT (run on Oracle VM):
```bash
#!/bin/bash
# Install Docker
curl -fsSL https://get.docker.com | bash

# Install PHP 8.2 + extensions
apt update && apt install -y php8.2 php8.2-fpm php8.2-mysql php8.2-mbstring \
  php8.2-gd php8.2-curl php8.2-zip php8.2-xml php8.2-bcmath mariadb-server redis-server nginx

# Install composer
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer

# Install Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | bash
apt install -y nodejs

# Clone Pterodactyl
cd /var/www
git clone https://github.com/pterodactyl/panel.git pterodactyl
cd pterodactyl
composer install --no-dev
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force

# Install Wings
curl -sL https://github.com/pterodactyl/wings/releases/download/v1.11.13/wings_linux_arm64 -o /usr/local/bin/wings
chmod +x /usr/local/bin/wings
```

WHAT THIS GIVES YOU:
- Full Pterodactyl panel (no resource limits)
- Wings with 24GB RAM for game servers
- 200GB disk (no more disk full errors)
- No 1hr timeout (unlike E2B)
- No 1GB RAM limit (unlike Daytona)
- Can run 20+ servers simultaneously
- Can install Blueprint (enough disk space)
- Self-healing not needed (VM is permanent)
"""

print(ORACLE_REPORT)

with open('/home/z/my-project/ORACLE_CLOUD_GUIDE.md', 'w') as f:
    f.write(ORACLE_REPORT)

# Also check other alternatives
ALTERNATIVES = """
FREE HOSTING ALTERNATIVES COMPARISON
=====================================

TIER 1 - BEST (Full VM, permanent):
1. Oracle Cloud Always Free
   - 4 ARM cores, 24GB RAM, 200GB disk
   - URL: https://www.oracle.com/cloud/free/
   - Best for: Running full Pterodactyl stack
   
2. Google Cloud Free
   - 1 e2-micro, 1GB RAM, 30GB disk
   - URL: https://cloud.google.com/free
   - Best for: Small panel (similar to Daytona)

TIER 2 - GOOD (Docker, with limits):
3. Fly.io
   - 3 shared VMs, 256MB RAM each, 3GB disk
   - URL: https://fly.io
   - Best for: Running individual containers
   
4. Koyeb
   - 1 nano service, 512MB RAM
   - URL: https://koyeb.com
   - Best for: Simple web apps

TIER 3 - SANDBOX (Time-limited):
5. Daytona (current)
   - 1 vCPU, 1GB RAM, 3GB disk
   - URL: https://daytona.io
   - Best for: Development (what we use now)

6. E2B (current)
   - 1 vCPU, 481MB RAM, 22GB disk, 1hr timeout
   - URL: https://e2b.dev
   - Best for: Storage/backup (what we use now)

7. GitHub Codespaces
   - 2 vCPU, 8GB RAM, 32GB disk, 120hr/month
   - URL: https://github.com/codespaces
   - Best for: Development

8. Gitpod
   - 2 vCPU, 8GB RAM, 50GB disk, 50hr/month
   - URL: https://gitpod.io
   - Best for: Development

RECOMMENDATION:
- Move Pterodactyl to Oracle Cloud (24GB RAM, 200GB disk)
- Keep Daytona as backup
- Keep E2B for storage
- Keep Vercel for frontend
- This eliminates ALL current limitations:
  - No more disk full errors (200GB vs 3GB)
  - No more RAM limits (24GB vs 1GB)
  - No more timeouts (permanent vs 1hr)
  - Can install Blueprint (enough disk)
  - Can run all 20 servers simultaneously
"""

print(ALTERNATIVES)

with open('/home/z/my-project/FREE_ALTERNATIVES.md', 'w') as f:
    f.write(ALTERNATIVES)

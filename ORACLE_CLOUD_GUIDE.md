
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
apt update && apt install -y php8.2 php8.2-fpm php8.2-mysql php8.2-mbstring   php8.2-gd php8.2-curl php8.2-zip php8.2-xml php8.2-bcmath mariadb-server redis-server nginx

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


DEATH LEGION PANEL - DISTRIBUTED ARCHITECTURE REPORT
====================================================

ARCHITECTURE OVERVIEW:
- Panel: Daytona Sandbox 1 (current)
- Wings Nodes: 5 Daytona sandboxes
- Storage: 5 E2B sandboxes (110GB total)
- Frontend: Vercel (deathlegionpanel.vercel.app)
- Self-Healing: GitHub Actions (every 5 minutes)

PANEL NODE (Daytona Sandbox 1):
- ID: 210e4afe-d6d5-4cc1-b3d3-05f40077ea15
- URL: https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu
- Resources: 1 CPU, 1GB RAM, 3GB disk
- Services: PHP (port 8001), nginx (port 8000), MySQL, Redis, Wings (port 8080)
- Role: Panel + Wings Node 1

WINGS NODES (Daytona Sandboxes):
- Node 2: f5a3ce9a-eb83-44a9-8f05-33eee5848b04
  URL: https://8000-f5a3ce9a-eb83-44a9-8f05-33eee5848b04.daytonaproxy01.eu
  Resources: 1 CPU, 1GB RAM, 3GB disk
  Role: Wings Node 2
- Node 3: 3c575ec2-0e0e-46b6-8c28-4aaf329394a9
  URL: https://8000-3c575ec2-0e0e-46b6-8c28-4aaf329394a9.daytonaproxy01.eu
  Resources: 1 CPU, 1GB RAM, 3GB disk
  Role: Wings Node 3
- Node 4: 0f1a0854-02dd-4a42-8bda-6b73c2efa738
  URL: https://8000-0f1a0854-02dd-4a42-8bda-6b73c2efa738.daytonaproxy01.eu
  Resources: 1 CPU, 1GB RAM, 3GB disk
  Role: Wings Node 4
- Node 5: fd91f2e1-99cf-4b04-a4f9-2a05d52c0e4d
  URL: https://8000-fd91f2e1-99cf-4b04-a4f9-2a05d52c0e4d.daytonaproxy01.eu
  Resources: 1 CPU, 1GB RAM, 3GB disk
  Role: Wings Node 5

STORAGE BACKEND (E2B Sandboxes):
- Storage 1: i5keo0dyrihzepgswnv28
  Disk: 22GB
  Timeout: 1 hour (needs self-healing)
  Role: MySQL backups, file storage, bot templates
- Storage 2: i2kh0pb6gavdozyllk3hd
  Disk: 22GB
  Timeout: 1 hour (needs self-healing)
  Role: MySQL backups, file storage, bot templates
- Storage 3: i17t2hixi0du2nbbq0g46
  Disk: 22GB
  Timeout: 1 hour (needs self-healing)
  Role: MySQL backups, file storage, bot templates
- Storage 4: i8gy9fc3pvjjgby4xatz8
  Disk: 22GB
  Timeout: 1 hour (needs self-healing)
  Role: MySQL backups, file storage, bot templates
- Storage 5: i2agphb6gfskk2um33huc
  Disk: 22GB
  Timeout: 1 hour (needs self-healing)
  Role: MySQL backups, file storage, bot templates

TOTAL RESOURCES:
- CPUs: 5 (Daytona) + 5 (E2B) = 10 CPUs
- RAM: 5GB (Daytona) + 2.5GB (E2B) = 7.5GB
- Disk: 15GB (Daytona) + 110GB (E2B) = 125GB
- Public URLs: 5 (Daytona) + 1 (Vercel)

SERVERS:
- Total: 20 servers (2 per user, 10 users)
- Distribution: 4 servers per node
- RAM per server: 512MB
- Disk per server: 1024MB
- Image: ghcr.io/ptero-eggs/yolks:nodejs_24

SELF-HEALING:
- GitHub Actions runs every 5 minutes
- Checks all Daytona sandboxes
- Restarts services if down
- Recreates E2B sandboxes before 1hr timeout
- Cleans disk space automatically

LIMITATIONS:
- Daytona: Cannot upgrade resources (1 CPU, 1GB RAM, 3GB disk per sandbox)
- E2B: 1 hour timeout (sandboxes auto-destroy after 1hr)
- E2B: No public URL (accessed via SDK only)
- E2B: 481MB RAM (too low for running services)
- Daytona sandboxes cannot communicate directly (each is isolated)
- Wings nodes need Panel's public URL to sync server configs

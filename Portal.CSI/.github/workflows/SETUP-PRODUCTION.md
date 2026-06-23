# Setup Production CD Pipeline

## ⚠️ Current Status

**Production CD is currently DISABLED for auto-deployment.**

The workflow is configured for **manual trigger only** (`workflow_dispatch`) until production server and configuration are ready.

**Auto-trigger from `main` branch push will be enabled AFTER completing all setup steps below.**

---

## Required GitHub Secrets

Sebelum Production CD workflow dapat berjalan, setup GitHub Secrets berikut:

### Navigation
GitHub Repository → Settings → Secrets and variables → Actions → New repository secret

### Required Secrets

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `PROD_DEPLOY_PATH` | Production deployment directory | `E:\Portal.CSI` |
| `PROD_BACKUP_PATH` | Production backup directory | `E:\Backups\Portal.CSI` |
| `PROD_BACKEND_POOL` | IIS Backend App Pool name | `CSI-Portal-Backend-Prod` |
| `PROD_FRONTEND_POOL` | IIS Frontend App Pool name | `CSI-Portal-Frontend-Prod` |
| `PROD_BACKEND_URL` | Production backend URL | `https://api.portal.example.com` |
| `PROD_FRONTEND_URL` | Production frontend URL | `https://portal.example.com` |

## Production Environment Files

Buat file environment production (jangan commit ke Git):

### backend/.env.production
```env
NODE_ENV=production
PORT=5000
DB_SERVER=PROD_SQL_SERVER
DB_DATABASE=CSI_PROD
DB_USER=prod_user
DB_PASSWORD=<production_password>
LDAP_URL=ldap://prod-ldap.example.com:389
JWT_SECRET=<production_jwt_secret>
# ... other production config
```

### frontend/.env.production
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.portal.example.com
# ... other production config
```

## GitHub Environment Protection

Setup GitHub Environment protection untuk approval:

1. Go to: Repository → Settings → Environments
2. Click **New environment** → Name: `production`
3. Configure protection rules:
   - ✅ **Required reviewers**: Add approvers (minimal 1 person)
   - ✅ **Wait timer**: 0 minutes (atau sesuai kebutuhan)
   - ✅ **Deployment branches**: Selected branches → `main`

## Self-Hosted Runner Setup

Production server harus install GitHub Actions runner:

### 1. Download Runner (di Production Server)
```powershell
# Create runner directory
New-Item -ItemType Directory -Force -Path "C:\actions-runner"
cd C:\actions-runner

# Download latest runner
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-win-x64-2.311.0.zip -OutFile actions-runner-win-x64.zip

# Extract
Expand-Archive -Path actions-runner-win-x64.zip -DestinationPath .
```

### 2. Configure Runner
```powershell
# Get token from: https://github.com/AOP-IT-Digital-B2B/Portal.CSI/settings/actions/runners/new

.\config.cmd --url https://github.com/AOP-IT-Digital-B2B/Portal.CSI --token <YOUR_TOKEN> --labels env-prod,location-datacenter

# Install as Windows Service
.\svc.sh install
.\svc.sh start
```

### 3. Verify Runner
Check: https://github.com/AOP-IT-Digital-B2B/Portal.CSI/settings/actions/runners

Runner should show: ✅ Idle (green circle)

## IIS Setup on Production

### 1. Create Application Pools
```powershell
Import-Module WebAdministration

# Backend Pool
New-WebAppPool -Name "CSI-Portal-Backend-Prod"
Set-ItemProperty "IIS:\AppPools\CSI-Portal-Backend-Prod" -Name managedRuntimeVersion -Value ""

# Frontend Pool
New-WebAppPool -Name "CSI-Portal-Frontend-Prod"
Set-ItemProperty "IIS:\AppPools\CSI-Portal-Frontend-Prod" -Name managedRuntimeVersion -Value ""
```

### 2. Create IIS Sites
```powershell
# Backend Site (Port 5000 atau sesuai kebutuhan)
New-Website -Name "CSI-Portal-Backend-Prod" `
  -ApplicationPool "CSI-Portal-Backend-Prod" `
  -PhysicalPath "E:\Portal.CSI\backend" `
  -Port 5000

# Frontend Site (Port 5001 atau sesuai kebutuhan)
New-Website -Name "CSI-Portal-Frontend-Prod" `
  -ApplicationPool "CSI-Portal-Frontend-Prod" `
  -PhysicalPath "E:\Portal.CSI\frontend" `
  -Port 5001
```

### 3. Install iisnode (if not already)
Download and install from: https://github.com/Azure/iisnode/releases

## Enable Auto-Deployment (Final Step)

⚠️ **Only do this AFTER completing all setup steps above!**

Once production server, runner, secrets, and environment are all configured:

1. Open `.github/workflows/cd-production.yml`
2. Uncomment the `push` trigger:

```yaml
on:
  # Auto-trigger disabled until production server is ready
  # Uncomment below when production setup is complete:
  push:              # ← Remove the # comment
    branches:        # ← Remove the # comment
      - main         # ← Remove the # comment
  workflow_dispatch:  # Manual trigger only
```

Should become:

```yaml
on:
  push:
    branches:
      - main
  workflow_dispatch:
```

3. Commit and push the change
4. Test by pushing to `main` branch
5. ✅ Production CD now auto-triggers on every push to `main`

Until this is enabled, production deployment can only be triggered manually via GitHub Actions UI.

---

## Deployment Flow

```
Developer Push → main branch
         ↓
   CI Pipeline (tests/build)
         ↓
   CD Production Triggered
         ↓
   ⏸ Requires Approval ⏸
         ↓
   Approved by Reviewer
         ↓
   Deploy to Production
         ↓
   Health Check
         ↓
   ✅ Production Live
```

## Manual Deployment

🔒 **Currently the ONLY way to deploy to production** (auto-trigger disabled)

To deploy to production manually:

1. Go to: https://github.com/AOP-IT-Digital-B2B/Portal.CSI/actions
2. Select "CD Pipeline - Deploy to Production"
3. Click "Run workflow"
4. Select branch: `main`
5. Click "Run workflow"
6. Wait for approval (if environment protection is configured)
7. Approve deployment (if required)

**Note:** Manual deployment will only work AFTER completing runner and secrets setup.

## Rollback

Jika deployment gagal, rollback menggunakan backup:

```powershell
$latestBackup = Get-ChildItem "E:\Backups\Portal.CSI" | Sort-Object Name -Descending | Select-Object -First 1

# Stop pools
Stop-WebAppPool -Name "CSI-Portal-Backend-Prod"
Stop-WebAppPool -Name "CSI-Portal-Frontend-Prod"

# Restore from backup
robocopy $latestBackup.FullName "E:\Portal.CSI" /MIR /R:3 /W:5

# Start pools
Start-WebAppPool -Name "CSI-Portal-Backend-Prod"
Start-WebAppPool -Name "CSI-Portal-Frontend-Prod"
```

## Monitoring

Monitor production deployment:
- GitHub Actions: https://github.com/AOP-IT-Digital-B2B/Portal.CSI/actions
- Production Backend Health: https://api.portal.example.com/api/v1/health
- Production Frontend: https://portal.example.com

## Troubleshooting

### Deployment stuck at "Waiting for approval"
- Check Environment protection rules
- Ensure required reviewers are configured

### Runner offline
```powershell
# On production server
cd C:\actions-runner
.\svc.sh status
.\svc.sh start
```

### IIS pools not starting
```powershell
# Check event logs
Get-EventLog -LogName Application -Source "iisnode" -Newest 20

# Check pool state
Get-WebAppPoolState -Name "CSI-Portal-Backend-Prod"
```

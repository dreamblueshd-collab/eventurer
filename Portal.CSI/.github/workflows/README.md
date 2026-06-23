# CI/CD Workflow Structure

## Overview

> ⚠️ **Update struktur (terkini):** Pipeline sudah dikonsolidasi menjadi **2 file**:
> `ci.yml` (lint/test/build) dan `cd.yml` (deploy). Deploy **production bukan file
> terpisah** lagi — ia menjadi job di dalam `cd.yml` (development = auto, production =
> manual `workflow_dispatch` + approval). Referensi `cd-production.yml` di bawah hanya
> historis. Runner pakai **Node.js 22**.

Project ini menggunakan workflow CI/CD dengan strategi branch berikut:

```
┌─────────────────────────────────────────────────────────────┐
│                    Git Branch Strategy                       │
└─────────────────────────────────────────────────────────────┘

    main                    development
     │                           │
     ├─ CI Pipeline             ├─ CI Pipeline
     │  (tests/build)           │  (tests/build)
     │                           │
     └─ CD Production           └─ CD Development
        (manual approval)          (auto deploy)
        │                          │
        ▼                          ▼
   PRODUCTION SERVER          DEVELOPMENT SERVER
   (IP: TBD)                  (IP: 10.14.181.31)
```

## Workflows

### 1. CI Pipeline (`ci.yml`)
**Trigger:** Push/PR to `main` or `development`  
**Purpose:** Build & test code  
**Runs on:** GitHub-hosted Windows runner

**Steps:**
- ✅ Checkout code
- ✅ Setup Node.js 22
- ✅ Install dependencies (`npm install`)
- ✅ Build frontend
- ✅ Run backend tests
- ✅ Upload build artifacts

**Status:** ✅ Active

---

### 2. CD Development (`cd.yml`)
**Trigger:** Push to `development` branch  
**Purpose:** Auto-deploy to development server  
**Runs on:** Self-hosted runner (DMZSVR-B2BWEBDEV)

**Server Info:**
- IP: `10.14.181.31`
- Deploy Path: `D:\Portal Event Management\Portal.CSI`
- Backup Path: `D:\Portal Event Management\_backups\`
- Backend Pool: `CSI-Portal-Backend`
- Frontend Pool: `CSI-Portal-Frontend`
- Backend Port: `6000`
- Frontend Port: `6001`

**Steps:**
- ✅ Create timestamped backup
- ✅ Install dependencies
- ✅ Build frontend (standalone)
- ✅ Copy static files
- ✅ Recycle IIS pools
- ✅ Verify deployment

**Status:** ✅ Active (auto-deploy enabled)

---

### 3. CD Production (`cd-production.yml`) ⭐ NEW
**Trigger:** Manual only (via workflow_dispatch) until production setup complete  
**Purpose:** Deploy to production server (requires approval)  
**Runs on:** Self-hosted runner (production server)

> ⚠️ **Auto-trigger disabled**: Push to `main` will NOT trigger production deployment until production server is configured. Uncomment trigger in workflow file after setup.

**Server Info:** (configured via GitHub Secrets)
- IP: `{{ PROD_SERVER }}`
- Deploy Path: `{{ PROD_DEPLOY_PATH }}`
- Backup Path: `{{ PROD_BACKUP_PATH }}`
- Backend Pool: `{{ PROD_BACKEND_POOL }}`
- Frontend Pool: `{{ PROD_FRONTEND_POOL }}`
- Backend URL: `{{ PROD_BACKEND_URL }}`
- Frontend URL: `{{ PROD_FRONTEND_URL }}`

**Steps:**
- ⏸️ **Requires manual approval** (GitHub Environment)
- ✅ Create timestamped backup
- ✅ Install dependencies
- ✅ Build frontend (standalone)
- ✅ Stop IIS pools
- ✅ Deploy files (excludes dev files)
- ✅ Copy production env files
- ✅ Start IIS pools
- ✅ Health check
- ✅ Verify deployment

**Status:** 🔧 Setup required - Manual trigger only (see SETUP-PRODUCTION.md)

---

## Deployment Flow

### Development Deployment
```
1. Developer commits to development branch
2. CI Pipeline runs (1-2 min)
3. CD Development auto-triggers
4. Deploys to 10.14.181.31 (5-10 min)
5. ✅ Development updated
```

### Production Deployment (After Setup)
```
1. Developer commits to main branch (or merge from development)
2. CI Pipeline runs (1-2 min)
3. Manually trigger CD Production workflow (GitHub Actions UI)
4. ⏸️ Waits for manual approval
5. Reviewer approves deployment
6. Deploys to production server (5-10 min)
7. Health check runs
8. ✅ Production updated
```

> 🔒 **Currently**: Auto-trigger disabled. Production must be triggered manually until server setup is complete.

---

## Required Secrets

GitHub Secrets needed for production deployment:

| Secret | Description | Example |
|--------|-------------|---------|
| `PROD_DEPLOY_PATH` | Production deploy directory | `E:\Portal.CSI` |
| `PROD_BACKUP_PATH` | Production backup directory | `E:\Backups\Portal.CSI` |
| `PROD_BACKEND_POOL` | IIS Backend App Pool | `CSI-Portal-Backend-Prod` |
| `PROD_FRONTEND_POOL` | IIS Frontend App Pool | `CSI-Portal-Frontend-Prod` |
| `PROD_BACKEND_URL` | Production backend URL | `https://api.portal.example.com` |
| `PROD_FRONTEND_URL` | Production frontend URL | `https://portal.example.com` |

**Setup:** Repository → Settings → Secrets and variables → Actions

---

## Environment Protection

**Production Environment Protection:**
- Name: `production`
- Required reviewers: ✅ (minimum 1)
- Allowed branches: `main` only
- Wait timer: 0 minutes (or as needed)

**Setup:** Repository → Settings → Environments → New environment

---

## Runner Configuration

### Development Runner
- **Name:** DMZSVR-B2BWEBDEV
- **Status:** ✅ Active (Idle)
- **Labels:** `self-hosted`, `Windows`, `X64`, `env-stg`, `location-onprem`
- **Server:** 10.14.181.31

### Production Runner (Setup Required)
- **Name:** TBD (production server)
- **Status:** ⏸️ Not configured yet
- **Labels:** `self-hosted`, `Windows`, `X64`, `env-prod`, `location-datacenter`
- **Server:** TBD
- **Setup guide:** See SETUP-PRODUCTION.md

---

## URLs

### Development
- Backend: http://localhost:6000
- Frontend: http://localhost:6001
- Health: http://localhost:6000/api/v1/health

### Production
- Backend: `{{ PROD_BACKEND_URL }}`
- Frontend: `{{ PROD_FRONTEND_URL }}`
- Health: `{{ PROD_BACKEND_URL }}/api/v1/health`

---

## Monitoring

### GitHub Actions
https://github.com/AOP-IT-Digital-B2B/Portal.CSI/actions

### Workflow Status
- **CI Pipeline:** ✅ Passing
- **CD Development:** ✅ Active
- **CD Production:** 🔧 Setup required

---

## Next Steps

Before production deployment can work:

1. ✅ Commit and push production workflow
2. ⏸️ Setup GitHub Secrets (6 secrets)
3. ⏸️ Setup GitHub Environment "production" with approval
4. ⏸️ Install GitHub Actions runner on production server
5. ⏸️ Create IIS sites on production server
6. ⏸️ Create production environment files (.env.production)
7. ⏸️ Test deployment with manual trigger

Detailed guide: `.github/workflows/SETUP-PRODUCTION.md`

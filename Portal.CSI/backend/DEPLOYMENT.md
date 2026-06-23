# Portal Event — Deployment Guide

## Prerequisites

- Node.js 22+ installed
- SQL Server 2019+ accessible
- IIS with iisnode module installed
- LDAP auth service accessible (Corporate Active Directory)
- SMTP server configured (internal relay, port 25)

## Architecture

```
[Browser] → [IIS: Next.js Frontend (port 6001)] → [IIS: Express Backend (port 6000)] → [SQL Server]
                                                          ↓
                                                    [LDAP Auth Service]
                                                          ↓
                                                    [SMTP Relay]
```

## Server Environments

| Environment | Server | Backend Port | Frontend Port | Domain |
|---|---|---|---|---|
| Development | Lihat CD pipeline config | 6000 | 6001 | Configured in `.env` |
| Production | Lihat CD pipeline config | 6000 | 6001 | Configured in `.env` |

## Environment Setup

### 1. Environment Configuration

Backend `.env` file harus ada di `backend/.env`. **Jangan buat file kosong** — backend akan fail-fast jika file tidak ditemukan.

```bash
# Copy dari example
cp backend/.env.example backend/.env
```

### 2. Critical Environment Variables

**Database (SQL Server):**
```env
NODE_ENV=production
DB_SERVER=<your-sql-server>
DB_USER=<your-db-user>
DB_PASSWORD=<your-secure-password>
DB_NAME=CSI
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
```

**JWT (WAJIB generate random string):**
```env
# Generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=<random-string-minimal-32-karakter>
JWT_EXPIRATION=8h
JWT_REFRESH_EXPIRATION=7d
```

**LDAP:**
```env
LDAP_AUTH_URL=<your-ldap-auth-service-url>
LDAP_TIMEOUT_MS=8000
```

**Email (SMTP internal — no auth):**
```env
SMTP_HOST=<your-smtp-relay-host>
SMTP_PORT=25
SMTP_SECURE=false
SMTP_DISABLE_AUTH=true
SMTP_FROM=Event Management Portal <noreply@component.astra.co.id>
```

**URLs & Security:**
```env
BASE_URL=https://<your-production-domain>
FRONTEND_BASE_URL=https://<your-production-domain>
PUBLIC_SURVEY_BASE_URL=https://<your-production-domain>
CORS_ORIGIN=https://<your-production-domain>
HTTPS_ENABLED=false
```

> Note: `HTTPS_ENABLED=false` karena TLS termination dilakukan di level IIS/reverse proxy, bukan di Node.js.

**Security:**
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
LOGIN_LOCKOUT_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_WINDOW_MINUTES=15
LOGIN_LOCKOUT_DURATION_MINUTES=15
```

## Database Setup

### Database Server

- Development: Lihat `backend/.env.development`
- Production: Lihat `backend/.env` di server production

### Run Migrations

```bash
cd backend
npm run migrate
```

Migration files berada di `src/database/migrations/` (001–049). Script `npm run migrate` menjalankan seluruh file berurutan secara otomatis.

### Seed Data (Development Only)

```bash
node scripts/seed-mockup-master-data.js
```

Default test users (password: `admin123`):
- `superadmin` (SuperAdmin)
- `firman` (AdminEvent)
- `sinta` (ITLead)
- `indah` (DepartmentHead)

> ⚠️ Jangan jalankan seed di production.

## Deployment via CI/CD

Deployment dilakukan otomatis melalui GitHub Actions:

- **CI**: `.github/workflows/ci.yml` — build test pada setiap push/PR
- **CD**: `.github/workflows/cd.yml` — deploy ke server saat push ke `development` atau `main`

### CD Pipeline Flow

1. Wait for CI checks to pass
2. Checkout code
3. Install dependencies (backend: `npm install --omit=dev`, frontend: `npm install`)
4. Build frontend (`next build` → standalone output)
5. Backup current deployment
6. Deploy backend via robocopy (exclude: node_modules, logs, .env)
7. Deploy frontend standalone
8. Enforce canonical env URLs
9. Recycle IIS app pools

### Manual Deploy (jika CI/CD tidak tersedia)

```powershell
# Di server deployment
cd "D:\Portal Event Management\Portal.CSI"

# Pull latest code
git pull origin main

# Backend
cd backend
npm install --omit=dev

# Frontend
cd ..\frontend
npm install
npm run build

# Copy standalone output
xcopy ".next\standalone" "D:\Portal Event Management\Portal.CSI\frontend" /E /I /Y

# Recycle IIS
& "$env:windir\System32\inetsrv\appcmd.exe" recycle apppool /apppool.name:"CSI-Portal-Backend"
& "$env:windir\System32\inetsrv\appcmd.exe" recycle apppool /apppool.name:"CSI-Portal-Frontend"
```

## IIS Configuration

### Application Pools

| Pool Name | .NET CLR | Managed Pipeline | Identity |
|---|---|---|---|
| CSI-Portal-Backend | No Managed Code | Integrated | LocalSystem |
| CSI-Portal-Frontend | No Managed Code | Integrated | LocalSystem |

> **Penting:** Maximum Worker Processes = **1** untuk kedua pool (karena in-memory session/challenge store).

### Sites

| Site | Physical Path | Port | App Pool |
|---|---|---|---|
| CSI-Portal-Backend | `D:\Portal Event Management\Portal.CSI\backend` | 6000 | CSI-Portal-Backend |
| CSI-Portal-Frontend | `D:\Portal Event Management\Portal.CSI\frontend` | 6001 | CSI-Portal-Frontend |

### web.config (Backend)

```xml
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="src/server.js" verb="*" modules="iisnode" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
          <match url="^src/server.js\/debug[\/]?" />
        </rule>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{REQUEST_URI}" />
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True" />
          </conditions>
          <action type="Rewrite" url="src/server.js" />
        </rule>
      </rules>
    </rewrite>
    <iisnode nodeProcessCommandLine="&quot;C:\Program Files\nodejs\node.exe&quot;" />
  </system.webServer>
</configuration>
```

## Health Checks

```bash
# Backend health
curl http://localhost:6000/api/v1/health

# Expected: {"status":"healthy","database":"connected","environment":"production"}

# Frontend
curl http://localhost:6001/login
```

## Security Checklist (Production)

- [x] JWT secret generated (random 48+ bytes)
- [x] HTTPS via IIS TLS termination
- [x] CORS restricted to specific domain
- [x] Rate limiting enabled (200 req/15min)
- [x] Account lockout (5 attempts, 15 min)
- [x] httpOnly + Secure + SameSite cookies
- [x] Helmet security headers (X-Frame-Options, CSP, HSTS)
- [x] No directory listing
- [x] Parameterized SQL queries (no injection)
- [x] XSS protection middleware
- [x] AES-256-GCM form encryption
- [x] Generic error messages in production (no stack trace)
- [ ] MFA for admin (planned)
- [ ] Password complexity policy (planned)

## Backup Strategy

CD pipeline otomatis membuat backup sebelum setiap deployment:
- Path: `D:\Portal Event Management\_backups\Portal.CSI\backup-<timestamp>`
- Retention: 10 backups terakhir (cleanup otomatis)

### Manual Backup Database

```sql
BACKUP DATABASE CSI TO DISK = 'D:\Backups\CSI_manual_backup.bak' WITH COMPRESSION;
```

## Rollback

### Rollback Code

```powershell
# Lihat backup terakhir
dir "D:\Portal Event Management\_backups\Portal.CSI" | Sort-Object Name -Descending | Select -First 5

# Restore dari backup
$backup = "D:\Portal Event Management\_backups\Portal.CSI\backup-<timestamp>"
robocopy $backup "D:\Portal Event Management\Portal.CSI" /MIR /XD node_modules .next logs uploads

# Recycle IIS
& "$env:windir\System32\inetsrv\appcmd.exe" recycle apppool /apppool.name:"CSI-Portal-Backend"
& "$env:windir\System32\inetsrv\appcmd.exe" recycle apppool /apppool.name:"CSI-Portal-Frontend"
```

### Rollback Database

Tidak ada automated rollback. Untuk rollback manual:
1. Restore dari backup `.bak` file
2. Atau buat script SQL inverse untuk migration tertentu

## Monitoring & Logs

### Log Files

Tersimpan di `backend/logs/`:
- `app.log` — semua log
- `error.log` — error only
- `warn.log` — warnings
- `exceptions.log` — uncaught exceptions

### Log Rotation

Winston logger otomatis rotate berdasarkan ukuran file. Cleanup manual jika disk penuh:

```powershell
# Hapus log lebih dari 30 hari
Get-ChildItem "D:\Portal Event Management\Portal.CSI\backend\logs" -Filter "*.log" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item
```

## Troubleshooting

### Backend tidak start setelah deploy

1. Cek `backend/logs/app.log` untuk error
2. Pastikan `.env` ada dan tidak kosong
3. Cek koneksi DB: `http://localhost:6000/api/v1/health`

### Login gagal (401)

1. Cek health endpoint — apakah DB connected?
2. Jika error "Cannot insert NULL into CreatedAt" → cek default constraints di DB
3. Jika "Invalid username or password" → verifikasi password hash di tabel Users

### Frontend blank/error

1. Pastikan `frontend/server.js` ada (standalone build)
2. Cek apakah `BACKEND_INTERNAL_URL` di frontend `.env` mengarah ke backend yang benar
3. Recycle frontend app pool

---

*Last updated: 9 Juni 2026*

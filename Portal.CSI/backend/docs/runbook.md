# Runbook — Portal Event Backend

## Server Information

| Environment | Server | IP | Backend Port | Frontend Port |
|---|---|---|---|---|
| Development (STG) | vm-dmzsvr-b2bwebdev | 10.14.181.31 | 6000 | 6001 |
| Production | TBSSVR-CONSOLEJOB | 10.14.99.60 | 6000 | 6001 |

| Resource | Server | Database |
|---|---|---|
| DB Development | Lihat `.env.development` | CSI |
| DB GCP / Remote Dev | `portal-event-acil` / `34.101.33.52` | CSI |
| DB Production | Lihat `.env` di server production | CSI |

---

## Cara Start/Stop Server

### Production & Development (IIS + iisnode)

```powershell
# Recycle backend app pool (restart tanpa downtime)
& "$env:windir\System32\inetsrv\appcmd.exe" recycle apppool /apppool.name:"CSI-Portal-Backend"

# Recycle frontend app pool
& "$env:windir\System32\inetsrv\appcmd.exe" recycle apppool /apppool.name:"CSI-Portal-Frontend"

# Stop app pool (untuk maintenance)
& "$env:windir\System32\inetsrv\appcmd.exe" stop apppool /apppool.name:"CSI-Portal-Backend"

# Start app pool
& "$env:windir\System32\inetsrv\appcmd.exe" start apppool /apppool.name:"CSI-Portal-Backend"
```

> CD pipeline (`cd.yml`) otomatis handle deploy + recycle IIS pool.
> Tidak menggunakan PM2 — semua dikelola oleh IIS/iisnode.

### Local Development

```bash
cd backend
npm install
npm run dev    # nodemon auto-reload
```

---

## Environment Variables

File `.env` harus ada di `backend/.env`. Referensi lengkap: `.env.example`.

Critical variables:

```env
NODE_ENV=production
DB_SERVER=<production-db-server>
DB_USER=<db-username>
DB_PASSWORD=<db-password>
DB_NAME=CSI
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

JWT_SECRET=<random 48+ bytes hex>
JWT_EXPIRATION=8h
JWT_REFRESH_EXPIRATION=7d

LDAP_AUTH_URL=<ldap-auth-service-url>
LDAP_TIMEOUT_MS=8000

SMTP_HOST=<smtp-relay-host>
SMTP_PORT=25
SMTP_SECURE=false
SMTP_DISABLE_AUTH=true
SMTP_FROM=Event Management Portal <noreply@component.astra.co.id>

BASE_URL=<production-domain>
FRONTEND_BASE_URL=<production-domain>
PUBLIC_SURVEY_BASE_URL=<production-domain>
CORS_ORIGIN=<production-domain>
HTTPS_ENABLED=false

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
LOGIN_LOCKOUT_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_WINDOW_MINUTES=15
LOGIN_LOCKOUT_DURATION_MINUTES=15

SESSION_TIMEOUT_MINUTES=30
SESSION_MAX_DURATION_HOURS=8

UPLOAD_DIR=public/uploads
MAX_FILE_SIZE_MB=10
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

---

## Database Setup

### Run Migrations

```bash
cd backend
npm run migrate
```

Migration files: `src/database/migrations/001_*.sql` s.d. `054_*.sql`.

### Audit Schema

```bash
cd backend
npm run db:doctor
npm run db:audit:envs
```

Catatan:

- `db:doctor` memeriksa environment aktif berdasarkan `.env` / `.env.development`
- `db:audit:envs` membandingkan kolom, primary key, dan foreign key lintas environment bila koneksinya tersedia

### Seed Data (Development Only)

```bash
node scripts/seed-mockup-master-data.js
```

Test users (password: `admin123`): superadmin, firman, sinta, indah, jovan, itlead2, dll.

---

## Health Check

```bash
# Backend health
curl http://localhost:6000/api/v1/health

# Expected response (healthy):
# {"status":"healthy","timestamp":"...","database":"connected","environment":"production"}

# Expected response (unhealthy):
# {"status":"unhealthy","timestamp":"...","database":"disconnected","error":"..."}
```

---

## Common Troubleshooting

### Server tidak bisa start

**Gejala**: Error di log saat app pool start

**Cek**:
1. Pastikan `.env` ada dan tidak kosong
2. Pastikan DB accessible: `telnet 10.14.99.122 1433`
3. Cek log: `D:\Portal Event Management\Portal.CSI\backend\logs\app.log`

---

### Login gagal — "An error occurred during login"

**Gejala**: Response 401, message "An error occurred during login"

**Solusi**:
1. Cek log untuk exact error
2. Jika error "Cannot insert NULL into column 'CreatedAt'" → tambahkan default constraint:
   ```sql
   ALTER TABLE Sessions ADD CONSTRAINT DF_Sessions_CreatedAt DEFAULT GETDATE() FOR CreatedAt;
   ALTER TABLE AuditLogs ADD CONSTRAINT DF_AuditLogs_Timestamp DEFAULT GETDATE() FOR [Timestamp];
   ```
3. Jika "Login failed for user" → cek DB_PASSWORD di `.env`

---

### Login gagal — "Invalid username or password"

**Solusi**:
1. Cek apakah user exist dan `IsActive = 1` di tabel Users
2. Jika user `UseLDAP = 1`: pastikan LDAP server accessible (lihat `LDAP_AUTH_URL` di `.env`)
3. Jika user `UseLDAP = 0`: verifikasi password hash di DB (bcrypt format: `$2b$10$...`)
4. Reset password manual:
   ```bash
   node scripts/reset-test-users-password.js
   ```

---

### Email tidak terkirim

**Solusi**:
1. Cek SMTP connectivity: `telnet <SMTP_HOST> 25`
2. Pastikan `SMTP_DISABLE_AUTH=true` (relay internal tanpa auth)
3. Cek log untuk detail error: `grep "email" logs/app.log | tail -20`

---

### Response 401 di semua endpoint

**Solusi**:
1. JWT_SECRET berubah → semua session lama invalid (expected behavior)
2. User perlu login ulang setelah JWT_SECRET diganti
3. Cek apakah cookie `csi_access_token` ter-set (DevTools → Application → Cookies)

---

### Database schema mismatch

**Gejala**: Error "Invalid column name" atau "Cannot insert NULL"

**Solusi**:
1. Jalankan `npm run db:doctor`
2. Jalankan migration terbaru: `npm run migrate`
3. Jika issue hanya terjadi pada satu environment, jalankan `npm run db:audit:envs`
4. Jika default constraints hilang, jalankan sync script untuk menambahkan defaults
5. Bandingkan schema DEV vs GCP vs PROD untuk identifikasi perbedaan

---

### Port sudah dipakai (local dev)

```powershell
# Cari process yang menggunakan port
netstat -ano | findstr :6000

# Kill process
taskkill /PID <PID> /F
```

---

## Rollback Procedure

### Rollback Code (dari backup CD pipeline)

```powershell
# Lihat backup tersedia
dir "D:\Portal Event Management\_backups\Portal.CSI" | Sort-Object Name -Descending

# Stop app pools
& "$env:windir\System32\inetsrv\appcmd.exe" stop apppool /apppool.name:"CSI-Portal-Backend"
& "$env:windir\System32\inetsrv\appcmd.exe" stop apppool /apppool.name:"CSI-Portal-Frontend"

# Restore dari backup
$backup = "D:\Portal Event Management\_backups\Portal.CSI\backup-YYYYMMDD-HHMMSS"
robocopy $backup "D:\Portal Event Management\Portal.CSI" /MIR /XD node_modules .next logs uploads

# Start app pools
& "$env:windir\System32\inetsrv\appcmd.exe" start apppool /apppool.name:"CSI-Portal-Backend"
& "$env:windir\System32\inetsrv\appcmd.exe" start apppool /apppool.name:"CSI-Portal-Frontend"
```

### Rollback Database

Tidak ada automated rollback. Opsi:
1. Restore full backup: `RESTORE DATABASE CSI FROM DISK = '<path>.bak'`
2. Atau buat script SQL inverse secara manual

---

## Log Files

Tersimpan di `backend/logs/`:

| File | Konten |
|---|---|
| `app.log` | Semua log (info, warn, error) |
| `error.log` | Error only |
| `warn.log` | Warning only |
| `exceptions.log` | Uncaught exceptions |
| `rejections.log` | Unhandled promise rejections |

```powershell
# Lihat log terbaru
Get-Content logs/app.log -Tail 50

# Cari error
Select-String "error" logs/app.log | Select-Object -Last 20
```

---

## Scheduled Operations

Backend menjalankan scheduler (node-cron) untuk:
- Email blast terjadwal
- Reminder otomatis

Scheduler start otomatis saat backend start. Status bisa dicek di log:
```
"Scheduled operations processor started"
```

---

## Contacts

| Role | Name | Responsibility |
|---|---|---|
| Developer | Acil (Adam Juliansyah) | Full-stack development, deployment |
| Technical Lead | Murjito | Architecture oversight |
| User | Indah Rahayu | Business requirements |

---

*Last updated: 19 Juni 2026*

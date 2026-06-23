# Technical Document — CSI Portal

## Stack Detail

### Frontend

| Item | Detail |
|---|---|
| Framework | Next.js 16.x (App Router) |
| React | 19.x |
| Language | TypeScript 5.x |
| Styling | CSS Modules (zero runtime) + Tailwind CSS 4 |
| State | React `useState` / `useEffect` / `useCallback` / `useMemo` |
| HTTP | Native `fetch` API dengan wrapper auth |
| Image cropper | `react-easy-crop` |
| Carousel | `swiper` |
| Node | 22.x LTS |

### Backend

| Item | Detail |
|---|---|
| Runtime | Node.js 22.x LTS |
| Framework | Express 4.x (CommonJS) |
| Language | JavaScript (CommonJS) |
| DB Driver | `mssql` v12.x (server kantor) + `msnodesqlv8` (lokal Windows auth) |
| Auth | `jsonwebtoken`, `bcrypt`, `ldapjs` (LDAP) |
| Email | `nodemailer` + `ejs` (template) |
| Validation | `express-validator` |
| Security | `helmet`, `express-rate-limit`, `cors` |
| Logging | `winston` |
| File/Upload | `multer` |
| Report/Export | `exceljs`, `pdfkit`, `qrcode` |
| Scheduling | `node-cron` |
| API Docs | `swagger-ui-express` + `yamljs` (openapi.yaml) |
| Testing | `jest` + `supertest` + `fast-check` |

### Database

| Item | Detail |
|---|---|
| Engine | Microsoft SQL Server 2019+ |
| Database | `CSI` |
| Driver | `mssql` v12.x / `msnodesqlv8` v5.x |

---

## Struktur Direktori

### Frontend (`frontend/`)

```
src/
├── app/
│   ├── (admin)/admin/          # Admin panel pages (App Router)
│   │   ├── dashboard/
│   │   ├── email-blast/        # Standalone email blast (SuperAdmin)
│   │   ├── event-management/
│   │   │   ├── [surveyId]/operations/  # Operations + Email Blast modal
│   │   │   └── survey-create/          # Survey Builder
│   │   ├── report/
│   │   ├── approval-admin/
│   │   ├── approval-it-lead/
│   │   ├── best-comments/
│   │   ├── audit-trail/
│   │   ├── doorprize/          # Doorprize (hidden dari sidebar, akses via URL)
│   │   ├── master-bu/
│   │   ├── master-divisi/
│   │   ├── master-department/
│   │   ├── master-function/
│   │   ├── master-aplikasi/
│   │   ├── master-user/
│   │   ├── dept-aplikasi/
│   │   └── function-aplikasi/
│   ├── (report-full)/          # Report detail (full page, tanpa sidebar)
│   ├── login/                  # Login page
│   ├── reset-password/
│   ├── [code]/                 # Short link resolver public survey
│   └── survey/                 # Public survey pages
├── components/
│   ├── admin/                  # Admin-specific components
│   ├── auth/                   # Auth components
│   ├── common/                 # Shared components (Dropdown, etc.)
│   ├── layout/                 # AdminShell, sidebar, header
│   └── survey/                 # Public survey + preview components
├── config/
│   └── navigation.ts           # Role-based navigation config
├── lib/                        # API client/helper domain (20+ files)
│   ├── auth.ts                 # Session management, login/logout
│   ├── email-blast.ts          # Standalone email blast API calls
│   ├── fetch-with-auth.ts      # 401 auto-redirect wrapper
│   ├── surveys.ts              # Event/survey API calls
│   ├── approvals.ts            # Approval workflow API calls
│   ├── reports.ts              # Report API calls
│   ├── master-data.ts          # Master data API calls
│   ├── users.ts                # User management API calls
│   ├── mappings.ts             # Mapping API calls
│   ├── operations.ts           # Scheduled operations API calls
│   ├── doorprize-api.ts        # Doorprize API calls
│   └── audit.ts                # Audit trail API calls
└── types/                      # TypeScript type definitions
```

### Backend (`backend/`)

```
src/
├── controllers/                # Route handlers
├── middleware/                 # Auth, audit, rate-limit, CORS, error
├── routes/                     # Express router (apiRoutes, authRoutes, monitoringRoutes)
├── services/                   # Business logic (+ subfolder: approval-service/,
│                               #   report-service/, survey-service/, email-service/,
│                               #   auth-service/, response-service/)
├── templates/email/            # EJS email templates
├── database/
│   ├── connection.js           # MSSQL connection pool
│   ├── sql-client.js           # Auto-pilih driver mssql / msnodesqlv8
│   └── migrations/             # SQL migration files (001–049, termasuk 023b)
└── utils/                      # Helper utilities
```

---

## Admin Design System (`page-mockup.module.css`)

Semua halaman admin menggunakan satu shared CSS Module di:

```
src/app/(admin)/admin/page-mockup.module.css
```

File ini adalah design system utama admin panel. Import dan gunakan class-nya via CSS Modules:

```tsx
import styles from '@/app/(admin)/admin/page-mockup.module.css';
```

### Kelompok Class Utama

| Kelompok | Class | Keterangan |
|---|---|---|
| **Page Header** | `pageHead`, `title`, `subtitle`, `toolbar` | Header halaman dengan judul dan toolbar aksi |
| **Panel / Card** | `panel`, `panelHeader`, `panelTitle`, `meta` | Container konten utama |
| **Filter Toolbar** | `filterToolbar`, `filterGroup`, `filterGroupSm/Md/Lg/Auto`, `filterLabel`, `filterControl` | Baris filter dengan label dan kontrol |
| **Form** | `formGroup`, `label`, `input`, `select`, `textarea` | Elemen form standar |
| **Buttons** | `btn`, `btnPrimary`, `btnSecondary`, `btnDanger`, `btnRow` | Tombol aksi |
| **Badges** | `badge`, `badgeActive`, `badgeClosed`, `badgeWarning`, `badgeDraft`, `badgePrimary` | Status label |
| **Table** | `tableWrap`, `table` | Tabel standar dengan horizontal scroll |
| **Master Table** | `masterTableWrap`, `masterTable` | Tabel lebar untuk halaman master data |
| **Pagination** | `pagination` | Kontrol halaman tabel |
| **Modal** | `modalOverlay`, `modalCard`, `wideModalCard`, `modalHeader`, `modalTitle`, `modalClose`, `modalBody`, `modalFooter`, `modalGridTwo` | Dialog/modal |
| **Upload** | `uploadRow`, `filePickerWrap`, `fileTrigger`, `fileText`, `uploadNote` | Komponen upload file |
| **Chip / Tag** | `chipInputWrap`, `chip`, `chipRemove`, `chipInput`, `suggestionMenu`, `suggestionItem` | Input multi-tag dengan autocomplete |
| **Operations Panel** | `operationalPanel`, `opsPanel`, `opsLayout`, `opsBlock`, `channelTabs`, `channelTab`, `channelTabActive` | Panel operasional survey (link/QR/blast) |
| **Toggle** | `toggleSwitch`, `toggleSwitchOn`, `toggleThumb` | Toggle switch on/off |
| **Misc** | `filterGrid`, `controlRow`, `subPanel`, `scheduleGrid`, `masterDownloadButton` | Helper layout |

### Pola Penggunaan Filter Toolbar

```tsx
<div className={styles.filterToolbar}>
  <div className={`${styles.filterGroup} ${styles.filterGroupMd}`}>
    <label className={styles.filterLabel}>Status</label>
    <select className={styles.filterControl}>...</select>
  </div>
  <div className={`${styles.filterGroup} ${styles.filterGroupAuto}`}>
    <label className={styles.filterLabel}>Cari</label>
    <input className={styles.filterControl} type="text" />
  </div>
</div>
```

### Responsive Breakpoints

- `≤ 768px`: Panel padding dikurangi, filter group menjadi flex wrap, modal grid menjadi 1 kolom.
- `≤ 480px`: Filter toolbar menjadi kolom penuh, semua filter group stretch 100%.

---

## Admin Shell Layout (`admin-shell.module.css`)

Komponen `AdminShell` adalah layout wrapper utama admin panel (header + sidebar + content area).

### Struktur

| Elemen | Class | Keterangan |
|---|---|---|
| Root | `root` | Full-height wrapper, background `#f3f4f6` |
| Header | `header` | Sticky top bar, height 56px, z-index 50 |
| Hamburger | `hamburger` | Tombol buka/tutup sidebar (mobile only) |
| Logo | `logoLink` | Link logo di header |
| User menu | `userWrap` | Dropdown user di kanan header |
| Layout container | `container` | Flex row: sidebar + content |
| Sidebar overlay | `sidebarOverlay` / `sidebarOverlayVisible` | Backdrop gelap saat sidebar terbuka di mobile |
| Sidebar | `sidebar` | Nav panel kiri, lebar 224px |
| Content | `content` | Area konten utama, padding 20px |

### Responsive Behavior (≤ 768px)

- Header menjadi `position: sticky` sehingga tetap terlihat saat scroll.
- Tombol hamburger (`hamburger`) muncul di header.
- Sidebar berpindah ke `position: fixed` dan tersembunyi di luar layar (`translateX(-100%)`).
- Klik hamburger menambahkan class `sidebarOpen` → sidebar slide-in dari kiri.
- Overlay (`sidebarOverlayVisible`) muncul di belakang sidebar; klik overlay menutup sidebar.
- Content padding dikurangi menjadi 12px.

### Animasi

- Sidebar (desktop): `slideInSidebar` — fade + slide dari kiri, 260ms.
- Content: `fadeInContent` — fade + slide dari bawah, 320ms.
- Sidebar (mobile): CSS `transition: transform 0.25s ease` (animasi JS-driven, bukan keyframe).

### Legacy Aliases

Class lama berikut tetap tersedia agar halaman yang sudah ada tidak rusak:
`filterBar`, `filterBarGrid`, `filterField`, `filterInput`, `filterSelect`, `filterActions`.

---

## Auth Flow

```
1. POST /api/v1/auth/login
   → Validate credentials (LDAP or local bcrypt)
   → Issue JWT access token (15m) + refresh token (7d)
   → Set HttpOnly cookie: csi_refresh_token
   → Return: { success, user, accessToken }

2. FE stores:
   - accessToken → sessionStorage (csi_token)
   - user object → sessionStorage (csi_user)
   - session marker → sessionStorage (csi_session_present)

3. Subsequent requests:
   → Authorization: Bearer <accessToken>
   → credentials: "include" (sends cookie)

4. Token refresh:
   → POST /api/v1/auth/refresh (cookie auto-sent)
   → Returns new accessToken

5. 401 response:
   → clearSession() → redirect to /admin/login

6. Logout:
   → POST /api/v1/auth/logout
   → Server invalidates refresh token
   → FE clears sessionStorage
```

---

## API Base Path & Environment Config

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_BASE_PATH=http://localhost:3000/api/v1
```

### Backend (`.env`)

```env
PORT=3000
NODE_ENV=development
DB_SERVER=localhost
DB_NAME=CSI
DB_USER=sa
DB_PASSWORD=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
FRONTEND_URL=http://localhost:3001
```

---

## Database Schema Overview

> **Catatan struktur (migration 049):** `Events` adalah parent container, `Surveys`
> adalah child (relasi 1 Event : N Surveys). PK `Events` tetap bernama `SurveyId`
> (dipakai konseptual sebagai `EventId`) untuk menghindari refactor FK besar. Kolom
> survey-specific (Status, periode, link, target, dst.) pindah ke `Surveys`.
> Synonym backward-compat tersedia: `SurveyAdminAssignments`→`EventAdminAssignments`,
> `SurveyPublishCycles`→`EventPublishCycles`, `SurveyConfiguration`→`EventConfiguration`.
> Semua PK/FK bertipe `BIGINT IDENTITY` (lihat `database-diagram.md`).

### Core Tables

| Tabel | Deskripsi |
|---|---|
| `Users` | User accounts dengan role (SuperAdmin, AdminEvent, ITLead, DepartmentHead) |
| `BusinessUnits` | Master BU |
| `Divisions` | Master Divisi (FK: BusinessUnits) |
| `Departments` | Master Departemen (FK: Divisions) |
| `Functions` | Master Function (IT Lead ownership, FK Dept owner) |
| `Applications` | Master Aplikasi |
| `Events` | Parent event/container (Status event-level, AssignedAdminId, EventTypeId, RequireApproval) |
| `Surveys` | Child survey per event (Status, periode, target, link/QR/embed) |
| `EventConfiguration` | Konfigurasi tampilan survey (hero, logo, warna, multi-page, posisi gambar) |
| `Questions` | Pertanyaan per survey |
| `EventAdminAssignments` | Assignment multi Admin Event ke event (source of truth) |
| `EventPublishCycles` | Siklus publish survey |
| `Responses` | Response header per responden (ResponseApprovalStatus) |
| `QuestionResponses` | Jawaban per pertanyaan (dengan TakeoutStatus, IsBestComment) |
| `ApprovalHistory` | Riwayat aksi approval per QuestionResponse |
| `BestCommentFeedback` | Feedback IT Lead atas best comment |
| `ScheduledOperations` | Jadwal blast/reminder email (SurveyId nullable untuk standalone) |
| `EmailLogs` | Log pengiriman email |
| `AuditLogs` | Log aktivitas sistem |
| `Sessions` | Sesi login + refresh token hash |
| `PasswordResetTokens` | Token reset password |
| `Configuration` | Key-value konfigurasi sistem |
| `SapSyncLogs` | Log sinkronisasi data SAP |

### Mapping Tables

| Tabel | Deskripsi |
|---|---|
| `FunctionApplicationMappings` | Function → Aplikasi |
| `ApplicationDepartmentMappings` | Aplikasi → Departemen |
| `EventAdminAssignments` | Event → Admin Event assignments (alias lama: `SurveyAdminAssignments`) |

### Doorprize Tables

| Tabel | Deskripsi |
|---|---|
| `DoorprizeEvents` | Event doorprize (ParentEventId → Events.SurveyId) |
| `DoorprizeGifts` | Daftar hadiah per event |
| `DoorprizeParticipants` | Peserta doorprize |
| `DoorprizeResults` | Hasil undian (pemenang) |

> Doorprize diakses via Event Detail → section Doorprize. Navigasi kembali
> menggunakan `ParentEventId` untuk link ke parent event.

---

## Deployment Notes

1. **Build FE**: `npm run build` di `frontend/`
2. **Start FE**: `npm start` (port 3001) atau `npm run dev` untuk development
3. **Start BE**: `node server.js` atau `npm start` di `backend/` (port 3000)
4. **Database**: Jalankan migration SQL secara berurutan dari `001` sampai `053` (`npm run migrate`)
5. **Environment**: Copy `.env.example` → `.env` dan isi semua variabel
6. **Reverse proxy**: IIS digunakan untuk production (TLS termination, iisnode)

Lihat `backend/docs/runbook.md` untuk detail operasional.

---

## Email Blast & Scheduled Operations

### Architecture

```
┌─────────────────────┐     ┌───────────────────────┐     ┌──────────────────┐
│  Frontend           │     │  Backend              │     │  SMTP Server     │
│  (Operations Page)  │────▶│  emailService.js      │────▶│  10.14.250.131   │
│                     │     │  scheduledOps.js      │     │  Port 25 (no TLS)│
└─────────────────────┘     └───────────────────────┘     └──────────────────┘
                                       │
                                       ▼
                            ┌───────────────────────┐
                            │  DB: ScheduledOps     │
                            │  DB: EmailLogs        │
                            └───────────────────────┘
```

### Komponen

| Komponen | File | Keterangan |
|----------|------|-----------|
| Email Service | `emailService.js` | Template rendering (EJS), sending, logging |
| Scheduled Ops Processor | `scheduledOperationsProcessor.js` | Cron job (tiap menit), proses pending operations |
| Email Controller | `emailController.js` | REST endpoint blast/reminder |
| Frontend Operations | `[surveyId]/operations/page.tsx` | UI operations panel (link, QR, email blast modal) |
| Standalone Email Blast | `email-blast/page.tsx` | Blast tanpa konteks survey (SuperAdmin only) |

### Flow Email Blast

```
1. Admin Event buka Operations page → klik "Email Blast"
2. Modal muncul → pilih target (BU/Divisi/Dept/Function), template, jadwal
3. POST /api/v1/emails/blast
   → Jika immediate: langsung kirim batch (50/batch, delay 1s)
   → Jika scheduled: simpan ke ScheduledOperations
4. Scheduled processor (cron tiap menit):
   → Query ScheduledOperations WHERE NextExecutionAt <= NOW()
   → Execute blast/reminder
   → Update status, hitung NextExecutionAt (once/daily/weekly/monthly)
5. Setiap email → log ke EmailLogs (status: Sent/Failed)
```

### Frequency Options

| Frequency | Behavior |
|-----------|----------|
| `once` | Kirim satu kali pada jadwal |
| `daily` | Kirim setiap hari pada waktu yang ditentukan |
| `weekly` | Kirim setiap minggu pada hari & waktu tertentu |
| `monthly` | Kirim setiap bulan pada tanggal & waktu tertentu |

### Duplicate Prevention

Email tidak akan dikirim ulang ke recipient yang sama dalam window 24 jam (configurable). Dicek via `EmailLogs` table sebelum setiap pengiriman.

### SMTP Configuration (Production)

```
Host: 10.14.250.131
Port: 25
Secure: false (no TLS)
Auth: disabled (relay internal)
Timeout: 30 detik (prevent iisnode hang)
```

### Email Templates (EJS)

| Template | Kegunaan |
|----------|---------|
| `survey-invitation.ejs` | Undangan survey baru |
| `survey-reminder.ejs` | Reminder untuk non-respondent |
| `approval-notification.ejs` | Notifikasi persetujuan takeout |
| `rejection-notification.ejs` | Notifikasi penolakan takeout |

Semua template mendukung:
- Personalisasi (nama penerima, judul survey)
- Survey link (with tracking)
- Calendar invite (.ics attachment) untuk scheduled events
- Hero image embedding (optional)

### Standalone Email Blast (SuperAdmin)

Endpoint: `POST /api/v1/emails/blast-standalone`

Blast email tanpa terikat survey tertentu — digunakan untuk pengumuman umum. `ScheduledOperations.SurveyId` = NULL untuk operasi standalone.

---

## Approval Workflow

### Overview

Sistem approval berlapis untuk mengelola takeout response yang dinilai tidak valid:

```
AdminEvent propose takeout
       │
       ▼
Response status: PendingITLead
       │
       ▼
ITLead approve/reject
       │
       ├── Approve → TakeoutStatus = TakenOut
       │              ResponseApprovalStatus = ApprovedFinal
       │
       └── Reject  → TakeoutStatus = Rejected (kembali Active)
                      ResponseApprovalStatus = PendingAdminTakeoutDecision
```

### Status Flow

| ResponseApprovalStatus | Keterangan |
|------------------------|-----------|
| `Submitted` | Baru masuk, belum direview |
| `RejectedByAdmin` | Ditolak admin (seluruh response) |
| `PendingITLead` | Menunggu review IT Lead |
| `PendingAdminTakeoutDecision` | Ditolak IT Lead, kembali ke Admin |
| `ApprovedFinal` | Semua takeout disetujui, response final |

| TakeoutStatus (per QuestionResponse) | Keterangan |
|--------------------------------------|-----------|
| `Active` | Jawaban aktif/valid |
| `ProposedTakeout` | Diusulkan untuk dihapus |
| `TakenOut` | Disetujui dihapus dari scoring |
| `Rejected` | Ditolak IT Lead, kembali aktif |

### Access Control

| Role | Akses |
|------|-------|
| AdminEvent | Propose/cancel takeout, mark best comment, bulk actions |
| ITLead | Approve/reject takeout (hanya function yang di-assign) |
| DepartmentHead | View only (report + best comments) |
| SuperAdmin | View only (dashboard + audit trail) |

### Best Comments

AdminEvent dapat menandai `QuestionResponse.IsBestComment = 1` pada jawaban berkualitas. ITLead dapat memberikan feedback (`BestCommentFeedback` table) terhadap komentar yang ditandai.

### ApprovalHistory

Setiap aksi approval dicatat di tabel `ApprovalHistory`:
- Action: `Proposed`, `Approved`, `Rejected`, `Cancelled`
- PreviousStatus → NewStatus
- PerformedBy, PerformedAt, Reason

---

## Report & Export

### Report Types

| Report | Endpoint | Keterangan |
|--------|----------|-----------|
| Before Takeout | `GET /api/v1/reports/:surveyId?view=before` | Skor sebelum takeout (semua response) |
| After Takeout | `GET /api/v1/reports/:surveyId?view=after` | Skor setelah exclude takeout |
| Takeout Comparison | `GET /api/v1/reports/:surveyId/takeout-comparison` | Side-by-side before/after per function |
| Dept Head Review | `GET /api/v1/reports/dept-head/:deptId/:surveyId` | View per department (DeptHead only) |

### Report Data Structure

```json
{
  "surveyTitle": "Survey Corp IT & BPM 2026",
  "totalResponses": 150,
  "averageScore": 7.8,
  "functionScores": [
    { "functionName": "ERP", "score": 8.2, "responseCount": 45 },
    { "functionName": "Infrastructure", "score": 7.1, "responseCount": 32 }
  ],
  "questionScores": [
    { "questionId": 759, "promptText": "Rating", "avgScore": 7.5 }
  ]
}
```

### Export Formats

| Format | Library | Endpoint |
|--------|---------|----------|
| Excel (.xlsx) | `exceljs` | `GET /api/v1/reports/:surveyId/export?format=xlsx` |
| PDF | `pdfkit` | `GET /api/v1/reports/:surveyId/export?format=pdf` |

### Scoring Logic

- Skor dihitung dari `QuestionResponses.NumericValue` dan `MatrixValues`
- Response dengan `TakeoutStatus = 'TakenOut'` di-exclude dari report "After Takeout"
- Response dengan `ResponseApprovalStatus = 'RejectedByAdmin'` di-exclude dari kedua report
- Publish cycle filtering: hanya response dari cycle aktif yang dihitung

---

## Doorprize Module

### Architecture

Doorprize adalah sub-event di bawah parent Event. Diakses via Event Detail → section Doorprize.

```
Event (SurveyId=17)
  ├── Survey (form CSI)
  └── DoorprizeEvent (ParentEventId=17)
        ├── DoorprizeGifts (hadiah)
        ├── DoorprizeParticipants (peserta)
        └── DoorprizeResults (pemenang)
```

### Endpoints

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/api/v1/doorprize/events` | List semua event doorprize |
| GET | `/api/v1/doorprize/events/:id` | Detail event (+ counts) |
| POST | `/api/v1/doorprize/events` | Create event (support `parentEventId`) |
| PUT | `/api/v1/doorprize/events/:id` | Update event (+ image upload) |
| DELETE | `/api/v1/doorprize/events/:id` | Hapus event |
| GET/POST/PUT/DELETE | `/api/v1/doorprize/events/:id/gifts` | CRUD hadiah |
| GET/POST/PUT/DELETE | `/api/v1/doorprize/events/:id/participants` | CRUD peserta |
| POST | `/api/v1/doorprize/events/:id/participants/import` | Import Excel peserta |
| GET | `/api/v1/doorprize/events/:id/draw-state` | State undian (eligible, results) |
| POST | `/api/v1/doorprize/events/:id/draw` | Eksekusi undian (random pick) |

### Draw Logic

1. Ambil eligible participants: `isActive = true` AND belum menang
2. Random pick dari eligible pool (`crypto.getRandomValues`)
3. Insert ke `DoorprizeResults` (drawnAt, drawnBy)
4. Return winner + gift info
5. Frontend render animasi (slot machine / spin wheel)

### Public Display

Route: `/doorprize/display/[eventId]` — halaman presentasi undian (full screen, dark theme, animasi 3D).

---

## Security & Audit

### Authentication

| Layer | Implementasi |
|-------|-------------|
| Password | `bcrypt` hash (salt rounds: 10) |
| LDAP | `ldapjs` untuk login via Active Directory |
| JWT Access Token | 8 jam expiry, disimpan di sessionStorage |
| JWT Refresh Token | 7 hari, HttpOnly cookie (`csi_refresh_token`) |
| Session | Tabel `Sessions` (refresh token hash, IP, expiry) |
| Login lockout | 5 attempts → lock 15 menit |

### Authorization

Middleware `authMiddleware.js` memvalidasi JWT di setiap request protected. Role-based access control (RBAC) menggunakan permission strings:

```
surveys:read, surveys:create, surveys:update, surveys:delete
responses:read, responses:submit
approvals:read, approvals:propose, approvals:review
reports:read, reports:export
emails:send
users:read, users:create, users:update
master:read, master:create, master:update, master:delete
doorprize:read, doorprize:create, doorprize:update, doorprize:delete
audit:read
```

### Rate Limiting

| Scope | Limit |
|-------|-------|
| Global API | 1000 req / 15 menit |
| Login endpoint | 5 attempts / 15 menit per IP |
| Email blast | 50 emails / batch, 1s delay |

### Audit Trail

Tabel `AuditLogs` mencatat semua aktivitas CRUD:

| Column | Keterangan |
|--------|-----------|
| UserId | Siapa yang melakukan |
| Action | CREATE / UPDATE / DELETE |
| EntityType | User, Survey, Response, etc. |
| EntityId | ID entitas yang terpengaruh |
| OldValues | JSON sebelum perubahan |
| NewValues | JSON setelah perubahan |
| IpAddress | IP user |
| CreatedAt | Timestamp |

Frontend: `/admin/audit-trail` — tabel searchable dengan filter action, entity type, date range.

### CORS

Production: hanya domain `e-venturer.astraotoparts.co.id` dan `e-venturer-stg.astraotoparts.co.id` yang diizinkan.

### HTTPS

TLS termination dilakukan di IIS. Backend dijalankan dengan `HTTPS_ENABLED=false` (IIS ↔ backend via HTTP localhost). Frontend standalone Next.js juga HTTP — IIS handles external HTTPS.

---

## CI/CD Pipeline

### CI (`.github/workflows/ci.yml`)

Trigger: push ke `main`/`development` atau PR.

| Job | Steps |
|-----|-------|
| Frontend Build & Test | Install → Lint → Type Check → Build |
| Backend Build & Test | Install → Jest (unit + property-based) |
| Quality Gate | Summary (pass jika keduanya OK) |

### CD (`.github/workflows/cd.yml`)

Trigger: push ke `main`/`development` (setelah CI pass).

| Environment | Runner | Target |
|-------------|--------|--------|
| Development | `self-hosted, vm-dmzsvr-b2bwebdev` | `D:\Portal Event Management\Portal.CSI` |
| Production | `self-hosted, 10.14.99.60` | Path via secrets |

### CD Steps (kedua environment)

1. Wait for CI pass (poll check-runs)
2. Checkout (clean: false, shallow)
3. Restore Next.js cache (local robocopy)
4. Backup current deployment (robocopy /MIR, keep last 10)
5. Install dependencies (npm install --omit=dev / --prefer-offline)
6. Build frontend (standalone output)
7. Save Next.js cache
8. Stop IIS app pools
9. Deploy backend + frontend (robocopy /MIR, exclude .env)
10. Enforce environment canonical URLs
11. Start IIS app pools
12. Health check
13. Deployment summary

### IIS Application Pools

| Pool | Site | Port |
|------|------|------|
| CSI-Portal-Backend | Backend (iisnode) | 6000 |
| CSI-Portal-Frontend | Frontend (iisnode) | 6001 |

### Rollback

Backup tersimpan di `_backups/backup-{timestamp}`. Rollback manual: stop pools → robocopy backup ke deployment path → start pools.

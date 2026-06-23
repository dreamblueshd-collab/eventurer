# Portal.CSI — Konteks Proyek & Catatan Review

Dokumen ini merangkum arsitektur, konvensi, dan hasil review agar mudah dibaca
kembali di sesi/pekerjaan berikutnya. Update saat ada keputusan penting.

## 1. Ringkasan
Portal.CSI ("CSI Portal" / e-Venturer) adalah aplikasi internal PT Astra Otoparts
untuk **manajemen survey Customer Satisfaction Index (CSI)**, lengkap dengan
**approval berjenjang**, modul **doorprize/event**, **email blast**, **master data
organisasi**, dan **audit trail**.

## 2. Struktur Repo
```
Portal.CSI/
├── backend/    # Node.js + Express + SQL Server (deploy IIS/iisnode)
├── frontend/   # Next.js 16 (App Router) + React 19 + TS + Tailwind 4
└── .github/    # CI (ci.yml) & CD (cd.yml) GitHub Actions
```
Catatan: repo `dreamblueshd-collab/eventurer` menampung kode ini di subfolder
`Portal.CSI/` (di-import dari `ademscil/Portal.CSI`). Default branch repo = `master`.

## 3. Stack & Arsitektur
### Backend (`backend/`)
- Express 4, autentikasi JWT (access+refresh) + sesi DB (tabel `Sessions`),
  bcrypt, LDAP (`ldapService`), `express-validator`.
- Layered: `routes/` → `controllers/` → `services/` (+ `baseRepository`) → SQL.
- **Semua query parameterized** (`mssql .input()/@param`) — aman dari SQL injection.
- Keamanan: Helmet (CSP/HSTS), rate limiting (global + auth + reset password),
  account lockout, audit logging global, error handler dengan sanitasi pesan teknis.
- Driver DB: `mssql` (TCP) atau `msnodesqlv8` (ODBC, untuk LocalDB/Trusted_Connection).
- Docs: `backend/docs/openapi.yaml`, koleksi Postman, `runbook.md`, `DEPLOYMENT.md`.

### Frontend (`frontend/`)
- Next.js App Router, route groups: `(admin)`, `(public)`, `(report-full)`.
- Auth berbasis **cookie httpOnly** (token tidak di localStorage lagi).
- **API proxy** `src/app/api/[...path]/route.ts` mem-forward ke backend (atasi
  masalah header di IIS, tangani Set-Cookie, multipart, dan error HTML→JSON).
- Helper API di `src/lib/*.ts`; tipe di `src/types/`.

## 4. Build & Test (catatan lingkungan)
- **CI jalan di Windows** (`windows-2025-vs2026`), Node 22.
- **`msnodesqlv8` butuh header ODBC (`sql.h`) Windows** → `npm install` GAGAL build
  native di Linux/sandbox. Untuk verifikasi lokal: `npm install --ignore-scripts`
  lalu `NODE_ENV=test npm run test:ci` (tes me-mock DB; 286 tes lulus).
- Frontend: `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm run build`.
- Secrets via `.env` (gitignored). `CORS_ORIGIN`, `BASE_URL`, dll. di-set saat deploy.

## 5. Alur Kerja (workflow)
- `git push`/`clone` langsung TIDAK bisa (auth via gateway) → pakai GitHub Power
  (push_to_remote, create_pull_request, pull_repository, list_pull_requests).
- 1 task = 1 branch baru = 1 PR ke `master`. Stage file by **explicit path**
  (jangan `git add -A`/`.`). **User yang merge** tiap PR.
- Setelah merge: `git checkout master && git merge --ff-only origin/master`.
- Komunikasi & deskripsi PR dalam **Bahasa Indonesia**.
- `.kiro/` di-**gitignore** di repo ini → konteks repo ditaruh di `docs/` (bukan
  `.kiro/steering/`).

## 6. Hasil Review & Status Temuan
Legend: ✅ sudah diperbaiki · ⏳ direncanakan · ℹ️ catatan.

### Sudah diperbaiki (PR review/refactor)
- ✅ **CORS**: dulu memantulkan origin apa pun + `credentials:true` saat `CORS_ORIGIN='*'`.
  Kini di production `*` **memblok startup** (error), dan reflect hanya di dev.
  (`backend/src/config/security.js`)
- ✅ **`trust proxy`**: dulu `true` (percaya semua proxy → spoofing XFF).
  Kini `'loopback'`, dipusatkan di `app.js`. Komentar strategi CSRF ditambahkan.
- ✅ **Blacklist SQLi/XSS yang merusak data**: `sqlInjectionProtection` dulu memblok
  teks bebas yang mengandung `--`; kini hanya scan `query`+`params` (bukan `body`)
  dan pola `--`/komentar dihapus. `xssProtection` **tidak lagi memutasi `req.body`**
  (data survey disimpan apa adanya; XSS dicegah di output/React).
  (`backend/src/middleware/security.js`)
- ✅ **Dead code** `isUuid()` (selalu `false`, tak terpakai) dihapus dari
  `authService.js` & `userService.js`.
- ✅ **CI**: trigger ditambah `master` (dulu hanya `main`/`development` → CI tak jalan
  untuk PR ke master); `npm install` → `npm ci`. (`.github/workflows/ci.yml`)
- ✅ **Fondasi envelope**: `backend/src/utils/apiResponse.js`.

### Direncanakan / belum
- ⏳ **Standardisasi response API** → lihat `docs/API-STANDARDIZATION-PLAN.md` (2 fase).
- ⏳ **CSRF**: middleware `csrfProtection` ada tapi belum di-wire; saat ini proteksi
  via cookie `SameSite=Lax`. Wire double-submit jika butuh lebih ketat.
- ℹ️ **CSP** mengizinkan `'unsafe-inline'` (script & style) — pertimbangkan nonce.
- ℹ️ **`cd.yml`** trigger tetap `main`/`development` (sengaja, agar `master` tak
  memicu deploy). Sesuaikan jika strategi branch berubah.
- ℹ️ **Dua UI admin** (statis `backend/public/admin` + Next.js `frontend`) —
  perjelas mana yang kanonik untuk kurangi duplikasi.
- ℹ️ LDAP default IP internal (`10.14.255.106`) di `config/index.js` — idealnya env saja.

## 7. Konvensi Wajib (untuk perubahan berikutnya)
- Query DB selalu parameterized.
- Body request/response `camelCase`; mapping dari kolom DB `PascalCase` di service.
- Response baru: pakai helper `apiResponse.js` (`success/data/meta` & `error.code`).
- Jangan commit secret; jangan ubah `.gitignore`/`web.config` deploy tanpa alasan.
- Jalankan `npm run test:ci` (backend) & `tsc --noEmit`/`build` (frontend) sebelum PR.

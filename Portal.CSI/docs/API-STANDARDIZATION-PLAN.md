# Rencana Standardisasi API — Portal.CSI

Dokumen ini adalah rencana kerja untuk menstandarkan **payload** dan **response**
seluruh API Portal.CSI. Dibagi menjadi **2 fase**:

- **Fase 1 — Backend:** merombak semua response/payload yang belum standar agar
  memakai satu *envelope* yang konsisten.
- **Fase 2 — Frontend:** menyesuaikan seluruh pemanggilan API (lib + komponen)
  untuk membaca/mengirim sesuai kontrak baru.

> Status: **rencana** (belum dieksekusi). Fondasi sudah disiapkan di
> `backend/src/utils/apiResponse.js`.

---

## 1. Kondisi Saat Ini (Masalah)

Bentuk response **tidak konsisten** antar-endpoint.

### 1.1 Response sukses memakai key ad-hoc per-resource
Setiap endpoint memakai nama field berbeda untuk payload utamanya:

| Endpoint (contoh) | Bentuk sekarang |
|---|---|
| `GET /applications` | `{ success: true, applications: [...] }` |
| `GET /applications/:id` | `{ success: true, application: {...} }` |
| `GET /business-units` | `{ success: true, businessUnits: [...] }` |
| `GET /audit` | `{ success: true, logs: [...], pagination? }` |
| `POST /auth/login` | `{ success: true, user: {...} }` |
| `POST /applications` | `{ success: true, message: '...', application: {...} }` |

Akibat: klien harus tahu nama field unik tiap endpoint; sulit dibuat helper generik;
paginasi tidak seragam.

### 1.2 Response error punya minimal dua bentuk berbeda
- **Controller (manual)** — *flat*:
  ```json
  { "error": "Validation failed", "message": "Validasi gagal" }
  ```
  kadang `{ "error": "Validation failed", "details": [...] }`.
- **Global error handler** (`middleware/errorHandler.js`) — *nested*:
  ```json
  { "error": { "message": "...", "type": "ValidationError", "statusCode": 400 } }
  ```

Akibat: frontend tidak bisa menangani error secara seragam; tidak ada **kode error
yang stabil & machine-readable** (hanya teks judul yang mudah berubah).

### 1.3 Lain-lain
- Paginasi tidak konsisten (`pagination` ada di sebagian endpoint, formatnya beda).
- Penamaan field campur (`camelCase` umum, tapi sebagian map dari kolom DB `PascalCase`).
- Tidak ada penanda versi/kontrak yang jelas selain prefix `/api/v1`.

---

## 2. Target Kontrak (Envelope Standar)

Sudah diimplementasikan sebagai helper di `backend/src/utils/apiResponse.js`.

### 2.1 Sukses
```json
{
  "success": true,
  "data": { },
  "meta": { }
}
```
- **`data`**: SELALU payload utama (objek untuk single resource, array untuk list,
  `null` untuk aksi tanpa body). **Tidak** lagi pakai key seperti `applications`/`user`.
- **`meta`** (opsional): metadata seperti paginasi, hitungan, pesan.

### 2.2 List + Paginasi
```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "pagination": { "page": 1, "pageSize": 20, "total": 137, "totalPages": 7 }
  }
}
```

### 2.3 Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validasi gagal",
    "details": [ { "field": "email", "message": "Format email tidak valid" } ]
  }
}
```
- **`code`**: `UPPER_SNAKE_CASE`, stabil, untuk di-`switch` di frontend.
- **`message`**: teks untuk pengguna (boleh berubah/dilokalkan), **tanpa** detail SQL/stack.
- **`details`** (opsional): error per-field (mis. dari `express-validator`).

### 2.4 Katalog `code` awal
| HTTP | `code` |
|---|---|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 405 | `METHOD_NOT_ALLOWED` |
| 406 | `NOT_ACCEPTABLE` |
| 409 | `CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 422 | `VALIDATION_ERROR` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |
| 503 | `SERVICE_UNAVAILABLE` |

### 2.5 Konvensi tambahan
- Body **request** & **response**: `camelCase`.
- Mapping kolom DB `PascalCase` → `camelCase` dilakukan di service (sudah ada
  `mapUserRecord` dsb. sebagai pola).
- Timestamp: ISO-8601 UTC (`...Z`).
- Endpoint non-JSON (download/export/template/pdf/excel/uploads) **dikecualikan**
  dari envelope (kirim biner/stream apa adanya). Daftar bypass sudah ada di
  `middleware/security.js` (`acceptHeaderValidation`).

---

## 3. FASE 1 — Backend (rombak payload & response)

**Tujuan:** seluruh endpoint JSON memakai envelope di Bagian 2.

### 3.1 Fondasi (SELESAI)
- [x] `backend/src/utils/apiResponse.js` — `sendSuccess`, `sendCreated`,
      `sendPaginated`, `sendError`, `defaultErrorCode`.
- [x] `backend/src/utils/controllerError.js` — `handleControllerError`,
      `sendValidationErrors` (jembatan exception/validator -> envelope standar).
- [x] Global error handler (`middleware/errorHandler.js`) sudah memakai envelope
      `{ success:false, error:{ code, message, details? } }` + `notFoundHandler`.
- [x] Test shape: `utils/__tests__/apiResponse.test.js`,
      `controllers/__tests__/applicationController.test.js`.

### 3.2 Langkah
1. **Standarkan global error handler** (`middleware/errorHandler.js`)
   - Ubah `formatErrorResponse` agar mengeluarkan bentuk 2.3
     (`{ success:false, error:{ code, message, details? } }`).
   - Petakan setiap kelas error (`ValidationError`, `NotFoundError`, dst.) ke `code`.
   - Pertahankan sanitasi pesan teknis & `stack` hanya di non-production.
   - Samakan `notFoundHandler` ke bentuk yang sama (`NOT_FOUND`).
2. **Adopsi `express-validator` terpusat**
   - Buat 1 middleware `handleValidation` yang mengubah hasil `validationResult`
     menjadi `sendError(res, { status:422, code:'VALIDATION_ERROR', details })`.
   - Ganti blok `if (!errors.isEmpty()) {...}` yang berulang di controller.
3. **Migrasi controller per-modul** (ganti `res.json({...})` manual → helper).
   Urutan disarankan (kecil → besar / dependensi):
   - [x] `authController` (cookie + bentuk `user`) — **SELESAI** (data = objek user;
         cookie auth dipertahankan; integration test diselaraskan). Semua controller
         backend kini memakai envelope standar.
         Catatan: error dari middleware (`authMiddleware`/`security`) masih bentuk
         lama `{ error, message }` -> follow-up terpisah.
   - [x] `applicationController`, `businessUnitController`, `departmentController`,
         `divisionController`, `functionController` (master data) — **SELESAI**
   - [x] `userController` — **SELESAI**
   - [x] `mappingController`, `integrationController` — **SELESAI**
   - [x] `questionController`, `responseController`, `surveyController` — **SELESAI**
   - [x] `approvalController` — **SELESAI**
   - [x] `doorprizeController` — **SELESAI** (test lama doorprizeController.test.js diperbarui ke envelope; doorprize.integration.test.js perlu realign saat ada DB test)
   - [x] `reportController` (export non-JSON tetap) — **SELESAI**
   - [x] `auditController`, `emailController` — **SELESAI**
   - Untuk tiap endpoint:
     - List → `sendPaginated(res, items, { page, pageSize, total })` atau
       `sendSuccess(res, items)` bila tanpa paginasi.
     - Single → `sendSuccess(res, obj)`.
     - Create → `sendCreated(res, obj)`.
     - Aksi tanpa body → `sendSuccess(res, null, { meta:{ message } })`.
     - Error manual → `sendError(...)` atau lempar kelas error (biar handler global).
4. **Update kontrak**
   - Selaraskan `backend/docs/openapi.yaml` & koleksi Postman dengan envelope baru.
   - Tambahkan/--perbarui test response-shape (lihat 3.4).
5. **Strategi kompatibilitas (penting untuk transisi)**
   - **Opsi A (disarankan):** karena FE & BE satu repo dan rilis bareng,
     lakukan *breaking change* langsung lalu kerjakan Fase 2 sebelum rilis.
   - **Opsi B (bertahap):** sementara sertakan field lama + `data` ("dual-write"),
     tandai `@deprecated`, hapus setelah Fase 2 selesai. Lebih aman tapi lebih kotor.
   - Putuskan di awal Fase 1 dan catat di PR.

### 3.3 Aturan eksekusi PR (sesuai alur kerja repo)
- 1 modul controller = 1 branch = 1 PR ke `master` (mudah di-review & rollback).
- Setiap PR menyertakan: ringkasan, daftar endpoint yang berubah, contoh
  before/after JSON, dan catatan verifikasi `npm run test:ci`.

### 3.4 Testing Fase 1
- Tambah test "response shape" memakai `supertest` untuk minimal 1 endpoint sukses,
  1 list, 1 error per modul (assert ada `success`, `data`/`error.code`).
- `npm run test:ci` harus hijau di tiap PR (CI Windows menjalankan ini).

### 3.5 Definition of Done Fase 1
- Tidak ada lagi `res.json({ <adhocKey>: ... })` untuk endpoint JSON.
- Semua error lewat `sendError`/handler global (bentuk 2.3).
- OpenAPI + Postman selaras. Test shape hijau.

### 3.6 Penutup & Review Fase 1 (SELESAI ✅)
Fase 1 (backend) selesai dan diselaraskan. Ringkasan hasil review:

**Cakupan yang sudah standar (envelope `{success,data,meta}` / `{success:false,error:{code,message,details?}}`):**
- 17/17 controller memakai helper `apiResponse`/`controllerError` (terverifikasi via grep).
- Global `errorHandler` + `notFoundHandler` memakai envelope.
- Middleware penolak request: `authMiddleware` (401 `UNAUTHENTICATED`, 403 `FORBIDDEN`,
  500 `INTERNAL_ERROR`), `security` (CSRF/SQLi/contentType 415/accept 406/size 413/
  ipFilter/fileUpload), `connectionHandler` (504 `GATEWAY_TIMEOUT`).
- Rate limit (429 `RATE_LIMITED`) di `config/security.js` + `app.js`.
- `monitoringRoutes`: jalur error memakai envelope.
- Dokumentasi: `openapi.yaml` v1.2.0 (skema `SuccessEnvelope`/`ErrorEnvelope`/
  `PaginationMeta` + katalog kode), kedua koleksi Postman mendokumentasikan envelope.

**Pengecualian yang DISENGAJA (bukan resource API):**
- Endpoint health/observability sukses (`/health`, `/api/v1/health`,
  `/monitoring/health|metrics|uptime|system`) tetap memakai format monitoring
  (status/timestamp/metrics) yang diharapkan tooling.
- Export biner (Excel/PDF/template) mengirim file langsung (exempt).
- Auth memakai cookie httpOnly untuk token (token tidak di body).

**Catatan/follow-up (di luar Fase 1):**
- `doorprize.integration.test.js` (di-exclude dari `test:ci`, butuh DB) perlu
  realign saat test berbasis DB dijalankan.
- Service results internal (mis. `phoneOtpService`) memakai `{success,error}` sendiri
  (bukan response HTTP) — tidak termasuk envelope.

**Verifikasi akhir:** `npm run test:ci` → 29 suite, 341 tes lulus; `node --check` OK;
`openapi.yaml` & koleksi Postman valid (parse OK).

---

## 4. FASE 2 — Frontend (menyesuaikan payload & response)

**Tujuan:** semua pemanggilan API membaca `data`/`meta`/`error.code` sesuai kontrak baru.

### 4.1 Fondasi
1. Definisikan tipe generik di `frontend/src/types/`:
   ```ts
   export type ApiSuccess<T> = { success: true; data: T; meta?: ApiMeta };
   export type ApiError = { success: false; error: { code: string; message: string; details?: unknown } };
   export type ApiResponse<T> = ApiSuccess<T> | ApiError;
   export type ApiMeta = { pagination?: { page: number; pageSize: number; total: number; totalPages: number } };
   ```
2. Buat helper terpusat di `frontend/src/lib/` (mis. `api-client.ts`):
   - `unwrap<T>(res): T` → kembalikan `data` atau lempar `ApiError` (dengan `code`).
   - Map `error.code` → pesan/penanganan UI (toast, redirect 401, dsb.).
   - Integrasikan dengan `fetch-with-auth.ts` & proxy `app/api/[...path]`.

### 4.1 Fondasi (SELESAI)
1. [x] Tipe generik di `frontend/src/types/api.ts` (`ApiResponse<T>`, `ApiSuccess`,
   `ApiErrorResponse`, `ApiMeta`, `ApiPagination`, `ApiErrorCode`).
2. [x] Helper terpusat `frontend/src/lib/api-client.ts`:
   - `apiFetch`/`apiGet`/`apiGetWithMeta`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete`
     mengembalikan `data` (+`meta`) atau melempar `ApiError` (membawa `code`/`status`/`details`).
   - `getApiErrorMessage` (envelope + legacy + validator details), `isApiError`.
   - Terintegrasi dengan `fetchWithAuth` (401 -> redirect login) & proxy `app/api/[...path]`.

### 4.2 Langkah migrasi (cermin dari modul Fase 1)
Sesuaikan tiap file `lib/*.ts` + komponen/page yang memakainya:
- [x] `lib/auth.ts` (login/validate -> `data`, forgot/reset -> `meta.message`), `fetch-with-auth.ts` — **SELESAI**
- [x] `lib/master-data.ts`, `lib/org-hierarchy.ts`, `lib/users.ts` — **SELESAI**
- [x] `lib/mappings.ts` — **SELESAI**
- [x] `lib/survey-events.ts`, `lib/survey-questions.ts`, `lib/public-survey.ts`,
      `lib/survey-distribution.ts` — **SELESAI** (shared `api-utils.getErrorMessage` jadi envelope-aware)
- [x] `lib/approvals.ts` — **SELESAI**
- [x] `lib/doorprize-api.ts` — **SELESAI**
- [x] `lib/reports.ts`, `lib/audit.ts`, `lib/email-blast.ts`, `lib/operations.ts` — **SELESAI**

> **Status Fase 2:** semua `lib/*.ts` sudah memakai envelope (`data`/`meta`/`error.code`).
> Sisa: audit komponen/page yang memanggil API langsung (bypass lib) + `npm run build` penuh + smoke test.
- Untuk tiap pemanggilan:
  - Baca payload dari `res.data` (bukan `res.applications` dsb.).
  - Baca list dari `res.data` + paginasi dari `res.meta.pagination`.
  - Tangani error via `res.error.code`/`message` (bukan menebak teks).

### 4.3 Testing Fase 2
- Smoke test alur utama: login, master data CRUD, buat survey, isi survey publik,
  approval, doorprize draw, report/export.
- `npm run lint` + `npx tsc --noEmit` + `npm run build` hijau (dijalankan CI).

### 4.4 Definition of Done Fase 2
- Tidak ada akses field lama (`.applications`, `.user`, `.logs`, dst.).
- Semua error UI memakai `error.code`.
- (Jika Opsi B dipakai di Fase 1) field lama dihapus di backend setelah ini.

---

## 5. Ringkasan Urutan Eksekusi
1. (SELESAI) Helper envelope + perbaikan temuan keamanan.
2. Fase 1.1: error handler + middleware validasi terpusat (1 PR).
3. Fase 1.2: migrasi controller per-modul (beberapa PR).
4. Fase 1.3: OpenAPI/Postman + test shape.
5. Fase 2.1: tipe + `api-client` frontend (1 PR).
6. Fase 2.2: migrasi `lib/*` + komponen per-modul (beberapa PR).
7. (Jika dual-write) hapus field lama di backend.

# CSI Schema Identifier Audit

Tanggal update: 2026-06-19

## Status aktual

Dokumen versi lama yang membahas `UNIQUEIDENTIFIER` sebagai baseline sudah tidak sesuai.

Schema aktif project CSI saat ini memakai identifier numerik `bigint` untuk primary identifier utama pada domain inti, termasuk:

- `Users.UserId`
- `BusinessUnits.BusinessUnitId`
- `Divisions.DivisionId`
- `Departments.DepartmentId`
- `Functions.FunctionId`
- `Applications.ApplicationId`
- `Events.SurveyId`
- `Responses.ResponseId`
- `ScheduledOperations.OperationId`
- `Doorprize*` tables

## Prinsip identifier yang berlaku sekarang

### Internal identifier

- gunakan `bigint` sebagai key internal utama
- key internal tetap menjadi acuan join, FK, audit, dan operasi backend
- UI tidak perlu menampilkan key internal kecuali memang untuk kebutuhan teknis

### Business / human-facing identifier

- `Users`
  - `Username` untuk identifier operasional
  - `NPK` untuk referensi kepegawaian bila tersedia
- `BusinessUnits`, `Divisions`, `Departments`, `Functions`, `Applications`
  - `Code` bersifat business-facing bila tersedia
  - `Name` tetap menjadi label utama di UI
- `Events`
  - belum memiliki event code formal
  - saat ini human-facing reference tetap bertumpu pada `Title`

## Catatan domain penting

### Users

- user tidak lagi membawa kolom org hierarchy langsung di tabel `Users`
- update user aktif hanya mengelola field:
  - `username`
  - `npk`
  - `displayName`
  - `email`
  - `phoneNumber`
  - `role`
  - `isActive`
  - `useLDAP`
  - `passwordHash` melalui flow password khusus

### Events

- `Events.AssignedAdminId` adalah field kompatibilitas untuk primary admin
- source of truth multi-admin ada di assignment table
- target schema yang benar untuk field ini adalah `bigint`
- audit 2026-06-19 menemukan `GCP` masih tertinggal di `nvarchar`, sedangkan `DEV` dan `PROD` sudah `bigint`

### Configuration

- runtime aktif menggunakan `EventConfiguration`
- referensi `SurveyConfiguration` lama harus dianggap deprecated

## Temuan audit 2026-06-19

- `DEV` dan `PROD` sudah selaras untuk kolom CRUD inti
- `GCP` masih drift pada:
  - `Events.AssignedAdminId`
  - baseline constraint untuk beberapa tabel, terutama `Users`
- `LOCAL` belum bisa diverifikasi karena koneksi SQL Server lokal tidak aktif

Lihat detail lengkap di:

- `backend/docs/database-environment-sync-audit.md`

## Arah implementasi

### Yang harus dipertahankan

- backend dan frontend membaca identifier internal sebagai `number`
- UI menampilkan label bisnis, bukan bergantung pada PK
- template bulk upload memakai kolom bisnis seperti `Name`, `Username`, `Email`, bukan key internal

### Yang harus dihindari

- menghidupkan kembali kontrak lama yang menganggap `Users` punya org hierarchy kolom langsung
- memakai `SurveyConfiguration` di code path baru
- membuat logic yang hanya cocok untuk satu environment database

## Ringkasan

- baseline identifier project saat ini adalah `bigint`, bukan UUID
- `Username`, `NPK`, `Code`, dan `Title` adalah identifier bisnis yang dipakai untuk kebutuhan operasional dan UI
- pekerjaan sinkronisasi berikutnya harus fokus ke penyamaan schema environment, terutama `GCP`, bukan mengubah model identifier aplikasi

# Propose Solution — CSI Portal

## Latar Belakang

PT Astra Otoparts Tbk membutuhkan platform terpusat untuk mengelola survei kepuasan IT (Customer Satisfaction Index) yang melibatkan berbagai unit bisnis, divisi, departemen, dan fungsi. Sebelumnya proses pengumpulan feedback dilakukan secara manual (spreadsheet/email), sehingga sulit untuk dikonsolidasi, dianalisis, dan diaudit.

## Tujuan

- Menyediakan portal survei berbasis web yang dapat diakses oleh seluruh responden internal.
- Memberikan alur approval multi-level (Admin Event → IT Lead) sebelum data masuk ke laporan.
- Menghasilkan laporan otomatis dengan statistik skor, distribusi rating, dan perbandingan takeout.
- Menyediakan manajemen master data (BU, Divisi, Dept, Function, Aplikasi, User) yang terpusat.

## Arsitektur Solusi

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  Next.js 16 App Router (FE) — port 3001                     │
│  CSS Modules · TypeScript · React Server/Client Components  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST (JSON)
                         │ JWT via HttpOnly Cookie + Bearer Token
┌────────────────────────▼────────────────────────────────────┐
│  Node.js + Express (BE) — port 3000                         │
│  REST API /api/v1/*                                         │
│  Middleware: auth, audit, rate-limit, CORS                  │
└────────────────────────┬────────────────────────────────────┘
                         │ mssql (node-mssql)
┌────────────────────────▼────────────────────────────────────┐
│  Microsoft SQL Server (MSSQL)                               │
│  Database: CSI                                              │
└─────────────────────────────────────────────────────────────┘
```

## Modul Utama

| Modul | Deskripsi |
|---|---|
| Auth | Login, logout, JWT refresh, forgot/reset password |
| Event Management | CRUD event/survey, survey builder, konfigurasi tampilan |
| Operations | Schedule blast email, reminder, QR code generation, email blast modal (per-event) |
| Email Blast | Standalone email blast untuk undangan/pengumuman umum (SuperAdmin) |
| Approval Admin | Review responden, duplicate check, approve/reject takeout |
| Approval IT Lead | Final approve response, propose takeout, feedback best comments |
| Best Comments | Seleksi komentar terbaik, feedback IT Lead |
| Report | Generate, view, export (Excel/PDF) laporan per event |
| Master Data | BU, Divisi, Dept, Function, Aplikasi, User (CRUD + upload/download template) |
| Mapping | Dept→Aplikasi, Function→Aplikasi |
| Audit Trail | Log seluruh aktivitas sistem (SuperAdmin only) |
| Doorprize | Manajemen event doorprize: hadiah, peserta, undian (akses via URL `/admin/doorprize`) |

## Teknologi yang Dipilih

| Layer | Teknologi | Alasan |
|---|---|---|
| Frontend | Next.js 16 App Router | SSR/SSG hybrid, file-based routing, React Server Components |
| Styling | CSS Modules | Scoped styles tanpa runtime overhead, tidak perlu library tambahan |
| Language | TypeScript | Type safety, refactoring aman, IDE support |
| Backend | Node.js + Express | Ringan, ekosistem luas, mudah di-deploy |
| Database | MSSQL (SQL Server) | Standar enterprise PT Astra Otoparts, ACID compliance |
| Auth | JWT + HttpOnly Cookie | Stateless, aman dari XSS, refresh token support |
| Email | Nodemailer | Integrasi SMTP internal |

## Constraint dan Asumsi

- Deployment di lingkungan internal (intranet) PT Astra Otoparts.
- LDAP/AD integration tersedia untuk autentikasi user (opsional, fallback ke password lokal).
- MSSQL Server sudah tersedia dan dikelola oleh tim IT infrastruktur.
- Tidak ada integrasi real-time (WebSocket); semua data di-fetch on-demand.
- SIT/UAT dan SAP Integration berada di fase berikutnya (out of scope v1.0).
- Semua label UI menggunakan Bahasa Indonesia.

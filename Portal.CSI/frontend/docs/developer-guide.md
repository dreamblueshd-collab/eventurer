# CSI Web App Developer Guide

Dokumen ini adalah panduan teknis utama untuk developer CSI Web App.
Scope dokumen mencakup:

1. Setup local FE + BE + database
2. Workflow pengembangan harian
3. Alur fitur utama lintas role
4. Standar kualitas, testing, dan troubleshooting
5. Proses branch, merge, dan CI/CD

## 1. Landscape Proyek

### 1.1 Repository dan Path

1. Repo utama (monorepo): `D:\AOP\portal-csi-github`
2. FE: `D:\AOP\portal-csi-github\frontend`
3. BE: `D:\AOP\portal-csi-github\backend`
4. Mockup/dokumentasi (terpisah, jangan ubah): `D:\AOP\mockup-admin-csi`
5. Planning tracker: `D:\AOP\mockup-admin-csi\Estimation - CSI Web App For Edit.xlsx`

### 1.2 Stack

1. FE: Next.js App Router + TypeScript + CSS Modules
2. BE: Node.js + Express + SQL Server
3. Auth: JWT + role-based access + middleware
4. CI/CD: GitHub Actions (`ci.yml`, `cd.yml`) di FE dan BE

### 1.3 Role Utama

1. SuperAdmin
2. AdminEvent
3. ITLead
4. DepartmentHead

### 1.4 Business Rules Terkonfirmasi

1. Domain utama aplikasi adalah `Event Management`.
2. `Survey` diperlakukan sebagai salah satu `event type`.
3. Satu aplikasi hanya boleh dimiliki oleh satu function.
4. Satu function dapat memiliki banyak aplikasi.
5. `Function` memiliki `DeptId` sebagai owner department.
6. Approval IT Lead ditentukan berdasarkan function pemilik aplikasi.
7. `DepartmentHead` bersifat view-only untuk monitoring dan review.
8. Flow approval survey final:
   - responden submit
   - `AdminEvent` approve/reject response awal
   - yang approved masuk ke `ITLead`
   - `ITLead` approve atau propose takeout
   - hasil propose takeout kembali ke `AdminEvent` untuk approve/reject
   - setelah keputusan final, data response masuk ke report
   - `AdminEvent` memilih best comment
   - `ITLead` memberi feedback untuk best comment
9. Response yang direject pada tahap awal oleh `AdminEvent` tidak lanjut ke proses berikutnya, tetapi tetap tersimpan untuk histori.
10. `Continue Design + Save Draft` harus mengubah status event survey menjadi `Draft`.
11. `Publish` hanya boleh menghasilkan status `Active` bila `EndDateTime` belum lewat.
12. Periode event survey harus mendukung `datetime`, bukan date-only, agar use case event beberapa jam tetap tertangani.

## 2. Prasyarat Local Development

1. Node.js 22+ (disarankan versi stabil yang sama di FE/BE)
2. SQL Server aktif dan bisa diakses dari mesin development
3. Akses network internal (untuk LDAP/SMTP internal jika dipakai)
4. Git sudah terinstall
5. VS Code + terminal

## 3. Setup Backend (`D:\AOP\portal-csi-github\backend`)

### 3.1 Install dependency

```cmd
cd /d D:\AOP\portal-csi-github\backend
npm.cmd install
```

### 3.2 Set environment

1. Copy template:

```cmd
copy .env.example .env
```

2. Isi variabel penting minimal:
- `PORT`
- `DB_SERVER`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`

Catatan:
1. `JWT_SECRET` minimal 32 karakter.
2. Jangan commit secret asli.

### 3.3 Setup database

```cmd
npm.cmd run db:init
npm.cmd run migrate
npm.cmd run db:seed
```

All-in-one:

```cmd
npm.cmd run db:setup
```

### 3.4 Jalankan backend

```cmd
npm.cmd run dev
```

Default API: `http://localhost:3000`

## 4. Setup Frontend (`D:\AOP\portal-csi-github\frontend`)

### 4.1 Install dependency

```cmd
cd /d D:\AOP\portal-csi-github\frontend
npm.cmd install
```

### 4.2 Set environment

1. Copy template:

```cmd
copy .env.local.example .env.local
```

2. Nilai minimum:
- `NEXT_PUBLIC_API_BASE_PATH=/api/v1`
- `BACKEND_INTERNAL_URL=http://localhost:3000`

### 4.3 Jalankan frontend

```cmd
npm.cmd run dev:3001
```

URL login FE: `http://localhost:3001/login`

## 5. Kenapa pakai `cmd` untuk npm

Jika PowerShell policy memblokir `npm.ps1` (error digital signature), jalankan via:

```cmd
npm.cmd <command>
```

Contoh:

```cmd
npm.cmd run lint
npm.cmd run build
```

## 6. Struktur Fitur Inti

### 6.1 Event lifecycle ringkas

1. SuperAdmin buat draft event.
2. AdminEvent `Continue Design` di Survey Builder.
3. AdminEvent publish, generate link/QR/embed.
4. AdminEvent blast email via modal di Operations (pre-filled survey link).
5. Responden isi survey.
6. Approval oleh SuperAdmin/AdminEvent/ITLead sesuai flow.
7. Best comments dipilih.
8. Report dihitung (termasuk before/after takeout).

> SuperAdmin juga bisa mengirim email blast standalone (undangan/pengumuman) via menu sidebar Email Blast.

### 6.2 Aturan bisnis penting

1. Username dan NPK terpisah.
2. Master User create/edit wajib field username.
3. BU/Divisi/Department source dari DB, tanpa duplicate option.
4. Divisi/Department hanya untuk Corporate HO.
5. Non-HO: Divisi dan Department mengikuti nama BU.
6. Event role:
- Create Survey Event: SuperAdmin
- Continue Design: AdminEvent
7. Dashboard AdminEvent menampilkan non-draft dan aksi utama View Report.

## 7. Workflow Pengembangan Harian

### 7.1 Start of task

1. Baca `Time Plan` dan `Time Plan Detail`.
2. Tentukan activity ID yang terdampak.
3. Lakukan small patch (incremental).
4. Hindari perubahan behavior halaman lain jika tidak diminta.

### 7.2 Implementasi

1. FE:
- page di `src/app/(admin)/admin/...`
- shared component di `src/components/...`
- API client di `src/lib/...`
2. BE:
- route/controller/service di `src/...`
- migration/seed di `src/database` atau `scripts`

### 7.3 Verifikasi minimum sebelum dianggap selesai

```cmd
cd /d D:\AOP\portal-csi-github\frontend
npm.cmd run lint
npm.cmd run build
```

```cmd
cd /d D:\AOP\portal-csi-github\backend
npm.cmd run test:ci
```

Jika test BE tertentu memang di-ignore oleh script, catat di note.

## 8. Role-based Uji Minimum

Setiap task yang menyentuh logic role wajib cek:

1. SuperAdmin
2. AdminEvent
3. ITLead
4. DepartmentHead

Checklist inti:

1. Sidebar/menu sesuai role.
2. Route guard sesuai role.
3. Aksi create/edit/approve/review sesuai permission.
4. Tidak ada menu/aksi bocor ke role lain.

## 9. Standar Kode dan UI

1. Jangan gunakan `window.confirm`; gunakan modal konfirmasi.
2. Jangan sisakan artefak aneh:
- karakter rusak
- string fallback tidak valid
- duplicate key React list
3. Parse/build error harus diperbaiki di sumber.
4. Untuk tabel lebar, gunakan horizontal scroll di area tabel.
5. Perubahan visual harus konsisten dengan mockup dan pattern `Master User`.

## 10. Testing Matrix (Manual)

### 10.1 Smoke lintas module

1. Login -> Dashboard
2. Event Management -> Create/Edit -> Continue Design
3. Operations -> Generate link/QR -> Schedule blast/reminder
4. Respondent page -> Submit
5. Approval Admin/ITLead
6. Best Comments
7. Report selection/filter/export

### 10.2 Fokus regression

1. Save Draft vs Publish status transition
2. Data source dropdown dari master data
3. Survey link generated harus bisa dibuka responden
4. Comment rule/validation submit
5. Signature/hero cover persistency

## 11. Troubleshooting Cepat

### 11.1 PowerShell blok npm

Gunakan:

```cmd
npm.cmd run <script>
```

### 11.2 Excel planning tidak bisa diupdate otomatis

Masalah umum: file `.xlsx` masih terbuka dan lock read-only.

Solusi:
1. Tutup semua window Excel.
2. Jalankan update lagi.

### 11.3 Email schedule status Pending lama / Failed

1. Cek scheduler BE running.
2. Cek timezone server.
3. Cek konfigurasi SMTP.
4. Cek log backend untuk error SMTP/auth/connection.

### 11.4 Survey generated link tidak sinkron data terbaru

1. Pastikan Save Draft/Publish sukses.
2. Regenerate link setelah publish.
3. Cek data source element di survey config tersimpan ke DB.

## 12. Git Flow dan Release

### 12.1 Branching

1. Kerja di branch feature dari `development`.
2. Commit jelas dan kecil.
3. Merge ke `development`.
4. Merge ke `main` hanya bila diminta eksplisit.

### 12.2 Contoh command

```cmd
git checkout development
git pull
git checkout -b feature/<nama-task>
git add .
git commit -m "feat: <ringkas>"
git push -u origin feature/<nama-task>
```

### 12.3 Setelah merge

1. Pantau GitHub Actions sampai hijau (CI/CD).
2. Jika ada fail, perbaiki di branch yang sama, push ulang.

## 13. Definition of Done (Developer Side)

Sebuah activity dianggap siap `Done` jika:

1. Implementasi sesuai rule bisnis.
2. Lint/build FE hijau.
3. Test/quality gate BE relevan dijalankan.
4. Uji role minimum selesai.
5. Tidak ada regression kritikal di flow utama.
6. Note di timeplan sudah diisi dengan bullet tanggal.
7. Status di timeplan dapat diubah ke `Done`.

## 14. Referensi Internal

1. FE README: [../README.md](../README.md)
2. BE README: `D:\AOP\portal-csi-github\backend\README.md`
3. BE deployment notes: `D:\AOP\portal-csi-github\backend\DEPLOYMENT.md`
4. Technical document: [./technical-document.md](./technical-document.md)
5. Release notes: [./release-notes.md](./release-notes.md)
6. E2E testing checklist: [./e2e-testing-checklist.md](./e2e-testing-checklist.md)
7. Database diagram: `D:\AOP\portal-csi-github\backend\docs\database-diagram.md`

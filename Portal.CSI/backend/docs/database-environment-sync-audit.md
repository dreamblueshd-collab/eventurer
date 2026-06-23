# Database Environment Sync Audit

Tanggal audit: 2026-06-19

## Tujuan

- memastikan schema CRUD, bulk upload, dan template download konsisten lintas environment
- menghindari kasus bug yang hanya muncul di satu database
- menjadikan `DEV` sebagai baseline sinkronisasi karena paling dekat dengan code terbaru

## Environment yang diaudit

| Environment | Source koneksi | Status |
|---|---|---|
| `LOCAL` | `localhost:1433 / CSI` | tidak bisa diverifikasi dari mesin ini, koneksi ditolak |
| `DEV` | `10.14.90.210\\DEV / CSI` | terhubung |
| `GCP` | `portal-event-acil / 34.101.33.52 / CSI` | terhubung |
| `PROD` | `10.14.99.122\\webmedical / CSI` | terhubung |

## Ringkasan hasil

### 1. Kolom tabel CRUD inti

Tabel berikut sinkron antara `DEV` dan `PROD` pada level kolom:

- `Users`
- `BusinessUnits`
- `Divisions`
- `Departments`
- `Functions`
- `Applications`
- `FunctionApplicationMappings`
- `ApplicationDepartmentMappings`
- `Events`
- `EventConfiguration`
- `Responses`
- `ScheduledOperations`
- `DoorprizeEvents`
- `DoorprizeParticipants`
- `DoorprizeGifts`
- `DoorprizeResults`

Perbedaan kolom yang terdeteksi:

- `GCP.Events.AssignedAdminId = nvarchar`
- `DEV.Events.AssignedAdminId = bigint`
- `PROD.Events.AssignedAdminId = bigint`
- `Surveys.RequireApproval` kini menjadi sumber kebenaran untuk approval form; `Events.RequireApproval` dipertahankan sementara untuk kompatibilitas dan sudah disinkronkan ke `Surveys` melalui migration `055`

### 2. Constraint / key drift

Temuan kritis di `GCP`:

- `Users` tidak memiliki primary key / candidate key yang bisa dipakai FK
- `Events` tidak memiliki FK `AssignedAdminId -> Users.UserId`
- migration `054_rollback_assigned_admin_to_bigint.sql` gagal diterapkan karena FK tidak bisa dibuat tanpa key yang valid di tabel `Users`

Catatan:

- drift constraint di `GCP` lebih besar dari sekadar tipe kolom
- sinkronisasi `GCP` harus dimulai dari baseline key/constraint, bukan langsung mengubah satu kolom

Temuan tambahan di `PROD`:

- beberapa tabel inti masih tidak menunjukkan primary key / foreign key yang sama seperti `DEV`
- secara kolom, `PROD` masih cocok dengan `DEV` untuk tabel CRUD inti
- artinya `PROD` lebih dekat ke target dibanding `GCP`, tetapi belum sepenuhnya identik pada level constraint

### 3. Localhost

`LOCAL` belum bisa dimasukkan ke baseline karena SQL Server lokal tidak sedang menerima koneksi pada `localhost:1433`.

## Perubahan code yang dilakukan saat audit ini

- notifikasi CRUD halaman admin diseragamkan ke toast pada area yang masih tertinggal:
  - `master-user`
  - `dept-aplikasi`
  - `function-aplikasi`
  - `event-management`
- referensi backend yang masih memakai `SurveyConfiguration` diarahkan ke `EventConfiguration`
- export user list disesuaikan dengan schema user saat ini, tanpa field org hierarchy lama
- type frontend `UserListItem` dibersihkan dari field hierarchy yang sudah tidak dipakai oleh model user aktif
- `db doctor` diperbarui agar menyorot mismatch schema yang relevan saat ini

## Tooling audit yang tersedia

### 1. Doctor per environment aktif

```bash
cd backend
npm run db:doctor
```

Fungsi:

- memeriksa object penting yang dibutuhkan aplikasi
- menyorot tipe `Events.AssignedAdminId`
- menunjukkan migration yang belum terpasang pada environment aktif

### 2. Audit sinkronisasi lintas environment

```bash
cd backend
npm run db:audit:envs
```

Script: `backend/scripts/audit-db-env-sync.js`

Script ini membandingkan:

- kolom
- primary key
- foreign key

untuk tabel CRUD inti lintas environment.

## Status migration

Migration terakhir di repo:

- `054_rollback_assigned_admin_to_bigint.sql`

Status saat audit:

- `DEV`: schema kolom sudah sesuai target untuk `Events.AssignedAdminId`
- `GCP`: migration `054` belum bisa diselesaikan karena baseline key/constraint tidak lengkap
- `PROD`: tipe kolom target sudah benar untuk `Events.AssignedAdminId`, tetapi audit lintas environment masih menunjukkan drift constraint dibanding `DEV`
- `GCP`: kolom `Surveys.RequireApproval` sudah ditambahkan dan disinkronkan dari `Events.RequireApproval` agar jalur form tidak lagi 500

## Rekomendasi sinkronisasi

1. hidupkan `LOCAL` SQL Server agar localhost bisa ikut diaudit
2. gunakan `DEV` sebagai baseline schema operasional
3. buat migration baseline khusus `GCP` untuk:
   - memastikan key valid pada `Users.UserId`
   - memastikan FK inti yang dibutuhkan aplikasi tersedia
   - baru setelah itu rollback `Events.AssignedAdminId` ke `bigint`
4. audit dan samakan constraint `PROD` terhadap baseline `DEV` untuk tabel inti yang masih tidak identik
5. setelah `GCP` dan `PROD` sinkron, jalankan ulang `npm run db:audit:envs` sampai tidak ada diff pada tabel inti

## Kesimpulan

- masalah lintas database saat ini bukan lagi di CRUD frontend/backend utama, melainkan drift schema environment
- `DEV` adalah baseline terbaik saat ini
- `PROD` sudah selaras di level kolom inti, tetapi masih perlu audit constraint lanjutan
- `GCP` masih perlu sinkronisasi baseline constraint sebelum bisa disamakan penuh
- `LOCAL` masih pending audit karena instance belum aktif

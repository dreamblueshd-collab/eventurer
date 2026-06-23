# Dokumen Informasi Portal CSI — Untuk Tim QA

**Tujuan:** Dokumen ini berisi penjelasan lengkap tentang aplikasi Portal CSI, dibuat khusus untuk tim QA agar bisa menyusun skenario test.

**Aplikasi:** Portal Customer Satisfaction Index (CSI) — PT Astra Otoparts Tbk
**Versi:** 1.1.0 (Juni 2026)

---

## 📌 Daftar Isi

1. [Aplikasi Ini Tentang Apa?](#1-aplikasi-ini-tentang-apa)
2. [Siapa Saja yang Pakai Aplikasi Ini?](#2-siapa-saja-yang-pakai-aplikasi-ini)
3. [Halaman-Halaman yang Ada di Aplikasi](#3-halaman-halaman-yang-ada-di-aplikasi)
4. [Fitur Lengkap per Modul](#4-fitur-lengkap-per-modul)
5. [Alur Proses Bisnis yang Perlu Di-Test](#5-alur-proses-bisnis-yang-perlu-di-test)
6. [Aturan Bisnis Penting](#6-aturan-bisnis-penting)
7. [Data Test yang Bisa Dipakai](#7-data-test-yang-bisa-dipakai)
8. [Checklist Module untuk Skenario Test](#8-checklist-module-untuk-skenario-test)

---

## 1. Aplikasi Ini Tentang Apa?

Portal CSI adalah aplikasi **internal** (dipakai di dalam kantor) milik **PT Astra Otoparts Tbk**. Fungsinya untuk mengelola **survei kepuasan** terhadap layanan IT.

### Masalah yang Dipecahkan

Dulu proses pengumpulan feedback dilakukan secara manual (lewat spreadsheet/email), susah untuk direkap, dianalisis, dan diaudit. Sekarang semuanya dilakukan secara online lewat aplikasi ini.

### Alur Singkat

```
Buat Event/Survey → Bagikan ke Responden (link/QR/Email)
         ↓
Responden Isi Survey (online)
         ↓
Admin Review Jawaban → IT Lead Approve Final
         ↓
Buat Laporan (otomatis) → Export ke Excel/PDF
```

### Fitur Tambahan

Selain survei biasa, aplikasi ini juga punya:
- **Doorprize** — undian berhadiah untuk peserta
- **Email Blast** — kirim email massal (undangan, pengumuman)

---

## 2. Siapa Saja yang Pakai Aplikasi Ini?

Ada **4 tipe pengguna (role)** dengan akses yang berbeda-beda.

### 2.1 SuperAdmin (Admin Utama)

| Bisa Mengakses | Tidak Bisa |
|----------------|------------|
| Dashboard | Approval Admin |
| Event Management (buat event) | Approval IT Lead |
| Email Blast (sendiri) | Report (dari sidebar, harus buka via URL) |
| Master User (kelola akun) | |
| Audit Trail (lihat semua aktivitas) | |

### 2.2 AdminEvent (Admin Event)

| Bisa Mengakses | Tidak Bisa |
|----------------|------------|
| Dashboard | Master User |
| Event Management (hanya event yang ditugaskan ke dia) | Audit Trail |
| Survey Builder (desain pertanyaan) | Email Blast standalone |
| Operations (link, QR, kirim email blast) | |
| Approval Admin (review jawaban responden) | |
| Report (generate & export) | |
| Best Comments (pilih komentar terbaik) | |
| Semua Master Data | |
| Semua Mapping | |

### 2.3 ITLead (Pimpinan IT)

| Bisa Mengakses | Tidak Bisa |
|----------------|------------|
| Dashboard | Buat/edit event/survey |
| Report (hanya lihat, tidak bisa generate/export) | Approval Admin |
| Approval IT Lead (approve final jawaban) | Master Data |
| Best Comments (memberi feedback) | Mapping |
| | Email Blast |

### 2.4 DepartmentHead (Kepala Departemen)

| Bisa Mengakses | Tidak Bisa |
|----------------|------------|
| Dashboard | Semua yang bersifat aksi (create, edit, approve, dll) |
| Report (hanya lihat) | |
| Best Comments (hanya lihat) | |

> **Catatan untuk QA:** Semua menu/sidebar harus sesuai dengan role di atas. Tidak boleh ada menu yang bocor ke role lain.

---

## 3. Halaman-Halaman yang Ada di Aplikasi

### 3.1 Halaman Khusus Admin (Harus Login)

| Halaman | Fungsinya |
|---------|-----------|
| `/login` | Halaman masuk/login |
| `/reset-password` | Ganti password |
| `/dashboard` | Halaman utama setelah login |
| `/event-management` | Daftar semua event/survey |
| `/event-management/[id]/survey-create` | Halaman untuk mendesain pertanyaan survey |
| `/event-management/[id]/operations` | Halaman untuk atur link, QR, kirim email, jadwalkan blast |
| `/email-blast` | Kirim email massal (tanpa terkait survey) — **Hanya SuperAdmin** |
| `/report` | Laporan hasil survey |
| `/report/[id]` | Detail laporan per event (tampilan penuh, tanpa menu samping) |
| `/approval-admin` | Review jawaban responden — **Hanya AdminEvent** |
| `/approval-it-lead` | Approve final jawaban — **Hanya ITLead** |
| `/best-comments` | Pilih komentar terbaik |
| `/audit-trail` | Lihat semua aktivitas di sistem — **Hanya SuperAdmin** |
| `/master-bu` | Data Business Unit |
| `/master-divisi` | Data Divisi |
| `/master-department` | Data Departemen |
| `/master-function` | Data Function |
| `/master-aplikasi` | Data Aplikasi |
| `/master-user` | Data User/Akun — **Hanya SuperAdmin** |
| `/dept-aplikasi` | Mapping Departemen → Aplikasi |
| `/function-aplikasi` | Mapping Function → Aplikasi |
| `/doorprize` | Kelola undian doorprize (tidak muncul di menu, harus buka URL langsung) |

### 3.2 Halaman Publik (Tidak Perlu Login)

| Halaman | Fungsinya |
|---------|-----------|
| `/survey/[id]` | Form isi survey untuk responden |
| `/survey/success` | Halaman setelah berhasil isi survey |
| `/[kode-pendek]` | Link pendek yang otomatis mengarah ke halaman survey |
| `/doorprize/display/[id]` | Layar presentasi undian (tampilan penuh, tema gelap) |

---

## 4. Fitur Lengkap per Modul

### 4.1 Login

- Masuk pake **Username** dan **Password**
- Ada 2 tipe user:
  - **LDAP** — pake password Active Directory (kantor)
  - **Non-LDAP** — pake password yang ada di database aplikasi
- Kalau 5 kali salah login, akun akan terkunci 15 menit
- Kalau session habis (8 jam), otomatis diarahkan ke halaman login

**Yang perlu di-test:**
- Login semua role (4 role) → harus masuk ke dashboard masing-masing
- Login dengan password salah → muncul pesan error
- Login 5x salah → terkunci 15 menit
- Logout → session hilang, tidak bisa balik ke halaman admin
- Akses halaman admin tanpa login → diarahkan ke login

### 4.2 Dashboard (Semua Role)

- Halaman utama setelah login
- Tampilannya beda-beda tergantung role

### 4.3 Event Management

Event/Survey punya **status** yang berurutan:
```
Draft → Active → Closed → Archived
```

**Fitur:**
- **Tambah event baru** — isi judul, deskripsi, tanggal, target responden
- **Edit event** — ubah data event
- **Hapus event** — hanya bisa kalau belum ada responden yang mengisi
- **Filter status** — pilih status yang mau dilihat (Draft, Active, Closed, Archived)
- **Cari event** — berdasarkan judul
- **Scoping** — AdminEvent hanya lihat event yang ditugaskan ke dia

**Yang perlu di-test:**
- Bikin event baru, simpan, muncul di daftar
- Edit event, perubahan tersimpan
- Hapus event (yang belum ada respondennya) → berhasil
- Hapus event yang sudah diisi responden → gagal
- Filter dan search berfungsi
- SuperAdmin lihat semua event, AdminEvent lihat sesuai assignment

> **⚠️ Bug sudah diperbaiki:** Dulu saat create BU, sistem **otomatis membuat Divisi dan Departemen** dengan nama yang sama — ini adalah **bug** dan sudah diperbaiki. Sekarang create BU hanya membuat 1 BU saja, tidak auto-create Divisi atau Departemen. Data yang sudah terlanjur terbuat bisa dibersihkan dengan script `backend/scripts/cleanup-auto-created-divisions-depts.sql`.

### 4.4 Survey Builder (Desain Pertanyaan)

Ini adalah halaman untuk membuat soal-soal survey. Bisa memilih dari **10+ tipe pertanyaan**:

| Tipe | Fungsinya |
|------|-----------|
| **Hero** | Gambar cover/banner di halaman depan survey |
| **Text** | Jawaban berupa teks bebas |
| **Multiple Choice** | Pilih satu opsi (radio button) |
| **Checkbox** | Pilih beberapa opsi (centang) |
| **Dropdown** | Pilih dari daftar yang muncul ke bawah |
| **Rating** | Beri nilai 1–10 (tombol angka) |
| **Likert** | Skala setuju-tidak setuju untuk beberapa pernyataan |
| **Matrix** | Tabel rating dengan beberapa baris pertanyaan |
| **Date** | Pilih tanggal |
| **Signature** | Tanda tangan (coret-coret di layar) |
| **Selector Aplikasi** | Pilih aplikasi dari daftar (berdasarkan mapping) |
| **Follow-up** | Pertanyaan lanjutan yang muncul per aplikasi yang dipilih |

**Fitur Lain:**
- Atur urutan pertanyaan
- Atur pertanyaan wajib / tidak wajib
- Multi-page (pertanyaan dibagi ke beberapa halaman)
- Atur tampilan: gambar cover, logo, warna, font
- **Preview** — lihat tampilan survey di Desktop atau HP
- **Save Draft** — simpan sebagai draft
- **Publish** — terbitkan (hanya kalau tanggal belum lewat)

**Yang perlu di-test:**
- Tambah semua tipe pertanyaan → tersimpan dan muncul
- Edit pertanyaan → perubahan tersimpan
- Hapus pertanyaan → terhapus
- Urutan pertanyaan tetap setelah refresh
- Save draft → data hilang setelah refresh? (harusnya tetap ada)
- Publish → status jadi Active
- Publish kalau tanggal sudah lewat → ditolak, status tetap Draft
- Preview desktop dan mobile tampil dengan benar
- Hero image bisa di-upload dan di-crop
- Pengaturan warna, font, dll tersimpan setelah refresh

### 4.5 Operations (Link, QR, Email, Jadwal)

Halaman ini untuk membagikan survey ke responden.

**Fitur:**
- **Generate Link** — buat link survey
- **Shorten URL** — bikin link pendek
- **Copy Link** — salin link ke clipboard
- **Generate QR Code** — buat kode QR (bisa di-download)
- **Embed Code** — kode untuk tempel di website lain
- **Email Blast (Modal)** — kirim email massal dari halaman ini:
  - Link survey sudah terisi otomatis (tidak bisa diubah)
  - Bisa lampirkan QR Code dan tombol "Mulai Survey"
  - Bisa lampirkan Calendar Invite (undangan meeting)
- **Schedule Blast** — jadwalkan pengiriman email (bisa sekali, harian, mingguan, bulanan)
- **Schedule Reminder** — jadwalkan pengingat
- **Cancel Schedule** — batalkan jadwal yang sudah dibuat

**Yang perlu di-test:**
- Generate link → link bisa dibuka dan mengarah ke survey
- Short link → mengarah ke survey yang benar
- QR code muncul dan bisa di-download
- Email blast modal terbuka, link survey terisi otomatis dan read-only
- Kirim email blast → terkirim (cek email)
- Schedule blast → muncul di tabel jadwal
- Cancel schedule → status berubah jadi Cancelled
- Schedule weekly dengan hari Minggu → tetap tersimpan

### 4.6 Email Blast Standalone (Hanya SuperAdmin)

Halaman khusus untuk kirim email massal yang **tidak terkait survey**. Misalnya undangan rapat atau pengumuman.

- Tidak ada link survey
- Bisa upload file Excel/CSV untuk daftar penerima
- Bisa lampirkan Calendar Invite

### 4.7 Approval Admin (Hanya AdminEvent)

Setelah responden mengisi survey, AdminEvent harus mereview:

**Daftar Responden:**
- Lihat semua responden yang sudah mengisi
- Filter duplikat (responden yang isi lebih dari 1x)
- **Approve** → kirim ke IT Lead
- **Reject** → tolak jawaban (dengan alasan)
- **Export ke CSV** — download daftar responden

**Propose Takeout:**
- Lihat usulan takeout dari IT Lead
- **Approve Takeout** → setuju hapus jawaban dari penilaian
- **Reject Takeout** → tolak usulan (jawaban tetap dipakai)

### 4.8 Approval IT Lead (Hanya ITLead)

**Propose Takeout:**
- Lihat jawaban yang sudah di-approve AdminEvent
- **Approve Final** → data masuk ke laporan
- **Propose Takeout** → usulkan hapus jawaban dari penilaian (dengan alasan)

**Best Comments Feedback:**
- Lihat komentar terbaik yang dipilih AdminEvent
- Tulis feedback untuk setiap komentar

### 4.9 Best Comments (AdminEvent & DeptHead)

**AdminEvent:**
- Lihat semua komentar responden
- Pilih komentar terbaik (mark as best comment)
- Hapus tanda best comment (unmark)

**DeptHead:**
- Hanya bisa lihat komentar terbaik + feedback dari IT Lead

### 4.10 Report (AdminEvent, ITLead, DeptHead)

**Generate Report:**
- AdminEvent bisa generate laporan per event
- Sebelum generate: tombol "Generate Report"
- Sesudah generate: tombol "Regenerate Report", "View Report", "Export"

**View Report:**
- Statistik: total responden, rata-rata skor
- Grafik skor per aplikasi
- Detail jawaban per responden
- Perbandingan skor sebelum dan sesudah takeout

**Export:**
- **Excel (.xlsx)** — file langsung di-download
- **PDF** — tampilan cetak (Ctrl+P → Save as PDF)

**Aturan:**
- AdminEvent (SuperAdmin) tidak melihat section "Propose Takeout Score Comparison"
- ITLead dan DeptHead hanya bisa melihat, tidak bisa generate/export
- Report hanya bisa di-generate kalau sudah ada responden yang final approved

### 4.11 Master Data (Hanya AdminEvent)

Modul untuk mengelola data referensi:
- **Business Unit (BU)** — unit bisnis
- **Divisi** — divisi di bawah BU
- **Departemen** — departemen di bawah divisi
- **Function** — fungsi/layanan IT (punya IT Lead)
- **Aplikasi** — daftar aplikasi IT
- **User** — data akun (hanya SuperAdmin)

**Fitur per Master Data:**
- Tambah data baru
- Edit data
- Aktif/Nonaktifkan data (toggle)
- Upload file Excel untuk import data
- Download template Excel

### 4.12 Mapping (Hanya AdminEvent)

**Mapping Function → Aplikasi:**
Satu Function bisa punya banyak Aplikasi, tapi satu Aplikasi hanya dimiliki satu Function.

**Mapping Departemen → Aplikasi:**
Tampilan hierarki: BU > Divisi > Departemen > Aplikasi yang di-centang.

### 4.13 Audit Trail (Hanya SuperAdmin)

Log semua aktivitas yang terjadi di sistem:
- Siapa yang melakukan
- Aksi apa (Tambah/Ubah/Hapus/Login/dll)
- Data apa yang diubah
- Sebelum dan sesudah perubahan
- IP address
- Waktu kejadian

**Fitur Filter:**
- Cari berdasarkan Username, ID, IP
- Filter berdasarkan aksi
- Filter berdasarkan jenis data
- Filter tanggal
- Pagination (halaman sebelumnya/selanjutnya)

### 4.14 Doorprize (Hidden — Akses Via URL Langsung)

Modul undian yang tidak muncul di menu samping. Akses via URL: `/admin/doorprize`

**Fitur:**
- Kelola Event Doorprize (nama, periode, gambar)
- Kelola Hadiah (gifts) per event
- Kelola Peserta (bisa import dari Excel)
- **Draw/Undian** — sistem memilih pemenang secara acak
- Lihat Hasil Undian

**Tampilan Khusus:**
`/doorprize/display/[id]` — layar presentasi undian (tema gelap, ukuran penuh, animasi).

---

## 5. Alur Proses Bisnis yang Perlu Di-Test

### 5.1 Alur Utama (End-to-End)

```
Step 1: SuperAdmin buat event baru
   ↓
Step 2: AdminEvent buka Survey Builder → desain pertanyaan
   ↓
Step 3: AdminEvent atur tampilan (gambar, warna, dll)
   ↓
Step 4: AdminEvent Save Draft
   ↓
Step 5: AdminEvent Publish → event jadi Active
   ↓
Step 6: AdminEvent generate link & QR code
   ↓
Step 7: AdminEvent kirim email blast (atau jadwalkan)
   ↓
Step 8: Responden buka link → isi survey → submit
   ↓
Step 9: AdminEvent lihat Approval Admin → Approve jawaban
   ↓
Step 10: ITLead lihat Approval IT Lead → Approve Final / Propose Takeout
   ↓
Step 11: AdminEvent pilih Best Comments
   ↓
Step 12: ITLead beri feedback untuk Best Comments
   ↓
Step 13: AdminEvent Generate Report → Export Excel/PDF
```

### 5.2 Alur Approval

```
Responden Submit (status: Submitted)
       ↓
AdminEvent Review
       ├── Reject → status: RejectedByAdmin (selesai)
       └── Approve → status: PendingITLead
                          ↓
                   ITLead Review
                       ├── Approve Final → status: ApprovedFinal (masuk laporan)
                       └── Propose Takeout → status: PendingAdminTakeoutDecision
                                                    ↓
                                             AdminEvent Decision
                                                ├── Setuju → jawaban dihapus dari nilai
                                                └── Tolak  → jawaban tetap dipakai
```

### 5.3 Alur Doorprize

```
Buat Event Doorprize
   ↓
Tambah Hadiah (Gifts)
   ↓
Tambah Peserta (manual / import Excel)
   ↓
Lakukan Undian (Draw)
   ↓
Sistem pilih pemenang secara acak
   ↓
Tampilkan hasil (pemenang + hadiah)
```

---

## 6. Aturan Bisnis Penting

Ini adalah **aturan-aturan** yang harus diperhatikan saat bikin skenario test. Kalau aturan ini dilanggar, berarti ada bug.

| No | Aturan | Keterangan |
|----|--------|------------|
| 1 | **Role access** | Setiap role hanya bisa mengakses menu sesuai tabel di bagian 2. Tidak boleh ada menu yang bocor. |
| 2 | **AdminEvent scoping** | AdminEvent hanya melihat event yang ditugaskan ke dia. |
| 3 | **Status flow** | Event harus mengikuti urutan: Draft → Active → Closed → Archived. Tidak boleh loncat. |
| 4 | **Publish expired** | Kalau tanggal sudah lewat, publish harus ditolak. |
| 5 | **Delete event** | Event yang sudah ada respondennya tidak boleh dihapus. |
| 6 | **Duplicate email** | Responden tidak boleh submit 2x dengan email dan aplikasi yang sama. |
| 7 | **Mandatory question** | Pertanyaan yang ditandai wajib harus diisi sebelum submit. |
| 8 | **Takeout flow** | Takeout harus melewati AdminEvent → ITLead → AdminEvent lagi. |
| 9 | **Report state** | Report baru bisa di-generate kalau ada responden yang sudah final approved. |
| 10 | **Link survey** | Link survey di modal Operations harus terisi otomatis dan tidak bisa diubah. |
| 11 | **Email blast ganda** | Email tidak boleh dikirim ke penerima yang sama dalam 24 jam. |
| 12 | **One app one function** | Satu aplikasi hanya boleh dimiliki oleh satu function. |
| 13 | **Event expired** | Event yang tanggalnya sudah lewat otomatis dianggap Closed. |
| 14 | **Login lockout** | 5x salah login → terkunci 15 menit. |
| 15 | **In Design removed** | Filter status tidak boleh ada opsi "In Design". |

---

## 7. Data Test yang Bisa Dipakai

### 7.1 Akun Test (Password: admin123)

| Username | Role | Keterangan |
|----------|------|------------|
| `superadmin` | SuperAdmin | Akses penuh ke semua fitur |
| `firman` | AdminEvent | Bisa kelola event, approval, master data |
| `sinta` | ITLead | Bisa approval IT Lead |
| `indah` | DepartmentHead | Hanya lihat report & best comments |
| `jovan` | AdminEvent | AdminEvent cadangan |
| `itlead2` | ITLead | ITLead cadangan |

> **Catatan:** Beberapa user mungkin LDAP (pake password Active Directory). Kalau gagal login, coba user non-LDAP seperti di atas.

### 7.2 Survey Minimal untuk Test

Satu event survey sebaiknya berisi minimal:

| No | Tipe Pertanyaan |
|----|-----------------|
| 1 | Hero (gambar cover) |
| 2 | Text |
| 3 | Multiple Choice |
| 4 | Checkbox |
| 5 | Dropdown |
| 6 | Rating |
| 7 | Likert |
| 8 | Matrix |
| 9 | Date |
| 10 | Signature (tanda tangan) |
| 11 | Selector aplikasi (app_department / app_function) |
| 12 | 1 pertanyaan lanjutan (follow-up per aplikasi) |

### 7.3 Email Test

Gunakan email berikut untuk test blast email:
- `qa1@example.com`
- `qa2@example.com`
- `qa3@example.com`

### 7.4 URL Test

| Halaman | URL |
|---------|-----|
| Login | `http://localhost:3001/login` |
| Dashboard | `http://localhost:3001/dashboard` |
| Event Management | `http://localhost:3001/event-management` |
| Doorprize | `http://localhost:3001/admin/doorprize` |
| Survey Publik | `http://localhost:3001/survey/[surveyId]` |

---

## 8. Checklist Module untuk Skenario Test

Berikut daftar modul yang perlu dibuatkan skenario test-nya:

### Modul 1: Auth & Session
- [ ] Login semua role (4 role)
- [ ] Login gagal (password salah)
- [ ] Login lockout (5x salah)
- [ ] Logout
- [ ] Akses halaman tanpa login
- [ ] Session expired (tunggu 8 jam atau manipulasi token)

### Modul 2: Event Management
- [ ] Create event (SuperAdmin)
- [ ] Edit event
- [ ] Delete event (belum ada responden vs sudah ada)
- [ ] Filter status
- [ ] Search event
- [ ] Scoping AdminEvent

### Modul 3: Survey Builder
- [ ] Tambah semua tipe pertanyaan
- [ ] Edit pertanyaan
- [ ] Hapus pertanyaan
- [ ] Reorder pertanyaan
- [ ] Save Draft
- [ ] Publish (valid vs expired)
- [ ] Preview (desktop & mobile)
- [ ] Upload & crop gambar
- [ ] Atur tampilan (warna, font, dll)

### Modul 4: Operations
- [ ] Generate link
- [ ] Short URL
- [ ] QR code (generate & download)
- [ ] Embed code
- [ ] Email blast modal (link pre-filled)
- [ ] Schedule blast/reminder
- [ ] Cancel schedule

### Modul 5: Email Blast Standalone
- [ ] Menu muncul untuk SuperAdmin saja
- [ ] Kirim email tanpa survey
- [ ] Upload file recipients
- [ ] Calendar invite

### Modul 6: Public Survey (Responden)
- [ ] Buka link survey
- [ ] Cascade dropdown (BU → Divisi → Dept)
- [ ] Pilih aplikasi
- [ ] Submit tanpa isi mandatory → validasi
- [ ] Submit lengkap → sukses
- [ ] Submit duplikat → ditolak

### Modul 7: Approval Admin
- [ ] Daftar responden
- [ ] Filter duplikat
- [ ] Approve responden
- [ ] Reject responden (dengan alasan)
- [ ] Export CSV
- [ ] Approve/Reject takeout

### Modul 8: Approval IT Lead
- [ ] Approve final response
- [ ] Propose takeout (dengan alasan)
- [ ] Submit feedback best comments

### Modul 9: Best Comments
- [ ] Mark best comment
- [ ] Unmark best comment
- [ ] View best comments (DeptHead readonly)

### Modul 10: Report
- [ ] Generate report
- [ ] View report detail
- [ ] Export Excel
- [ ] Export PDF
- [ ] Takeout comparison

### Modul 11: Master Data
- [ ] CRUD semua master (BU, Divisi, Dept, Function, Aplikasi, User)
- [ ] Aktif/nonaktifkan data
- [ ] Upload Excel
- [ ] Download template

### Modul 12: Mapping
- [ ] Function → Aplikasi
- [ ] Departemen → Aplikasi

### Modul 13: Audit Trail
- [ ] List log
- [ ] Filter berdasarkan aksi, tanggal, entity

### Modul 14: Doorprize
- [ ] CRUD event doorprize
- [ ] CRUD hadiah
- [ ] Tambah peserta (manual & import)
- [ ] Undian (draw)
- [ ] Lihat hasil

### Modul 15: Role Isolation
- [ ] Setiap role coba akses halaman yang bukan haknya → harus ditolak
- [ ] Sidebar hanya menampilkan menu sesuai role

---

## Referensi Dokumen Tambahan

Jika butuh informasi lebih detail, dokumen berikut ada di folder project:

| Dokumen | Isinya |
|---------|--------|
| `backend/docs/runbook.md` | Informasi server, cara start/stop, troubleshooting |
| `backend/DEPLOYMENT.md` | Panduan deployment, environment variables |
| `frontend/docs/admin-guide.md` | Panduan penggunaan untuk admin |
| `frontend/docs/e2e-testing-checklist.md` | 124 test case E2E lengkap per modul |
| `frontend/docs/qa/event-management-manual-qa.md` | 22 skenario manual QA untuk event management |

---

*Dokumen ini dibuat untuk keperluan tim QA dalam menyusun skenario test aplikasi Portal CSI.*
*Terakhir diperbarui: 11 Juni 2026*
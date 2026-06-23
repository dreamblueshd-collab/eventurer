# Admin Guide — Portal Event

Panduan penggunaan untuk administrator Portal Event (CSI Web App).

---

## 1. Login dan Role

### Cara Login

1. Buka browser dan akses URL portal (lihat `.env` untuk domain yang aktif)
2. Masukkan **Username** dan **Password**
3. Klik **Masuk**

> Password dienkripsi (AES-256-GCM) secara otomatis sebelum dikirim ke server.

### Role dan Akses

| Role | Akses |
|---|---|
| **SuperAdmin** | Dashboard, Event Management, Master User, Email Blast (standalone), Audit Trail |
| **AdminEvent** | Dashboard, Event Management (+ Survey Builder, Operations, Email Blast modal), Report, Approval Admin, Best Comments, semua Master Data, Mapping |
| **ITLead** | Dashboard, Approval IT Lead, Report (readonly) |
| **DepartmentHead** | Dashboard, Report (readonly), Best Comments (readonly) |

### Logout

Klik nama user di pojok kanan atas → **Logout**.

---

## 2. Event Management

### Membuat Event Baru

1. Buka **Event Management** di sidebar
2. Klik **+ Tambah Event**
3. Isi form:
   - **Judul Event** (wajib)
   - **Deskripsi** (opsional)
   - **Tanggal Mulai / Selesai**
   - **Target Responden** dan **Target Score**
   - **Assigned Admin** (pilih Admin Event yang bertanggung jawab)
4. Klik **Simpan** → event tersimpan dengan status **Draft**

### Mengubah Status Event

Status event mengikuti alur: `Draft → Active → Closed → Archived`

1. Buka detail event
2. Ubah field **Status** sesuai kebutuhan
3. Klik **Simpan**

### Menghapus Event

1. Di daftar event, klik **Delete** pada event yang ingin dihapus
2. Konfirmasi di dialog yang muncul

> ⚠️ Event yang sudah memiliki responden tidak dapat dihapus.

---

## 3. Survey Builder

### Menambah Pertanyaan

1. Buka event → tab **Survey Builder**
2. Klik **+ Tambah Pertanyaan**
3. Pilih tipe pertanyaan:
   - **Rating** — skala numerik (1–10)
   - **Text** — jawaban teks bebas
   - **Multiple Choice** — pilihan tunggal (vertikal/horizontal)
   - **Checkbox** — pilihan ganda (multi-select)
   - **Dropdown** — pilihan dari daftar
   - **Likert** — skala persetujuan multi-statement (dengan komentar bersyarat per statement)
   - **Matrix** — tabel rating multi-baris
   - **Date** — tanggal
   - **Signature** — tanda tangan (canvas)
   - **Hero** — cover/banner survey
   - Selector aplikasi: **app_department** / **app_function** (opsi diambil dari mapping)
4. Isi **Teks Pertanyaan** dan opsi lainnya
5. Klik **Simpan**

### Mengatur Urutan Pertanyaan

Gunakan field **Display Order** untuk mengatur urutan tampil pertanyaan.

### Konfigurasi Tampilan Survey

Tab **Konfigurasi** memungkinkan pengaturan:
- Hero image dan logo
- Warna utama dan sekunder
- Font family
- Progress bar dan nomor halaman
- Mode multi-page

---

## 4. Operations & Email Blast

### Dua Flow Email Blast

CSI Portal memiliki dua flow email blast yang terpisah:

#### A. Email Blast Standalone (SuperAdmin)

Menu sidebar **Email Blast** hanya tersedia untuk SuperAdmin. Digunakan untuk mengirim email blast umum (undangan meeting, pengumuman) tanpa konteks survey.

1. Buka **Email Blast** di sidebar
2. Isi **Subject** dan **Message**
3. Masukkan recipients (manual atau upload file Excel/CSV)
4. Opsional: aktifkan **Calendar Invite** (dengan Teams link)
5. Klik **Kirim Email Blast**

#### B. Email Blast dari Operations (AdminEvent)

Untuk blast terkait survey yang sudah publish, gunakan modal di halaman Operations:

1. Buka event → tab **Operations**
2. Klik tombol **📧 Email Blast**
3. Modal full-page terbuka dengan **link survey pre-filled** (tidak bisa diubah)
4. Isi Subject, Message, Recipients
5. Opsional: aktifkan **Tombol Mulai Survey**, **QR Code**, **Calendar Invite**
6. Klik **Kirim Email Blast**

> 💡 Link survey di modal Operations bersifat read-only karena sudah terikat dengan event yang sedang dibuka.

### Share Survey (Operations)

Di halaman Operations juga tersedia fitur share tanpa email:

1. Tab **Invite** — Generate dan copy link survey
2. Tab **QR Code** — Generate dan download QR code
3. Tab **Embed** — Copy embed code untuk iframe

### Schedule Blast & Reminder

1. Buka event → tab **Operations**
2. Gunakan section **Schedule Blast** atau **Schedule Reminder**
3. Isi form:
   - **Tanggal Jadwal**
   - **Template Email**
   - **Pesan Kustom** (opsional)
   - **Frekuensi**: Once / Daily / Weekly / Monthly
   - **Sertakan QR Code**: centang jika perlu
4. Klik **Schedule**

### Melihat Scheduled Operations

Di tab **Operations**, tabel **Scheduled Operations** menampilkan semua jadwal yang aktif beserta statusnya.

### Cancel Scheduled Operation

Klik **Cancel** pada baris operasi yang ingin dibatalkan.

---

## 5. Approval Flow

### Alur Approval

```
Responden submit → Admin Event review → IT Lead final approve → Data masuk Report
```

### Approval Admin (Admin Event)

1. Buka **Approval Admin** di sidebar
2. Pilih **Survey** dari dropdown
3. Tab **Daftar Responden**:
   - Cek responden duplicate (filter: All / Duplicate / Unique)
   - Pilih responden → **Approve Selected** (kirim ke IT Lead) atau **Reject Selected**
   - Export daftar responden ke CSV
4. Tab **Propose Takeout**:
   - Review usulan takeout dari IT Lead
   - Pilih takeout → **Approve Takeout** atau **Reject Takeout**

### Approval IT Lead (IT Lead)

1. Buka **Approval IT Lead** di sidebar
2. Pilih **Survey** dan **Function**
3. Tab **Propose Takeout**:
   - Review score dan komentar responden
   - Pilih baris → **Approve Final Response** (data masuk report) atau **Propose Takeout** (usulkan ke Admin Event)
4. Tab **Best Comments Feedback**:
   - Tulis feedback untuk setiap best comment yang dipilih Admin Event
   - Klik **Submit**

---

## 6. Report Generation

### Generate Report (Admin Event)

1. Buka **Report** di sidebar
2. Di tabel **Daftar Event**, cari event yang ingin di-generate
3. Klik **Generate Report** (atau **Regenerate Report** jika sudah pernah di-generate)
4. Tunggu proses selesai → status berubah menjadi **Generated**

### View Report

1. Klik **View Report** pada event yang sudah Generated
2. Halaman report menampilkan:
   - Statistik (total responden, avg score, distribusi rating)
   - Detail jawaban per responden
   - Perbandingan takeout (before vs after)

### Export Report

1. Klik **Export** pada event yang sudah Generated
2. Pilih format: **Excel (.xlsx)** atau **PDF (Print View)**
3. Klik **Export**
   - Excel: file langsung didownload
   - PDF: halaman report dibuka di tab baru → gunakan Ctrl+P → Save as PDF

### View Report (DepartmentHead / ITLead — Readonly)

Role DepartmentHead dan ITLead hanya bisa melihat report yang sudah di-generate. Tombol Generate/Export tidak tersedia.

---

## 7. Master Data Management

### Akses Master Data

Semua halaman master data ada di sidebar bagian **MASTER DATA** (hanya AdminEvent).

### CRUD Master Data

Setiap halaman master data (BU, Divisi, Dept, Function, Aplikasi) memiliki:
- **Tambah**: klik **+ Tambah**, isi form, klik **Simpan**
- **Edit**: klik **Edit** pada baris data
- **Toggle Aktif/Nonaktif**: klik toggle di kolom Status

### Upload Template Excel

1. Klik **Download Template** untuk mendapatkan format yang benar
2. Isi data di file Excel sesuai format
3. Klik **Upload File** → pilih file → klik **Upload**
4. Sistem akan menampilkan ringkasan: berhasil diimport, diupdate, gagal

### Mapping Dept → Aplikasi

1. Buka **Dept → Aplikasi** di sidebar
2. Pilih Departemen dari daftar
3. Centang aplikasi yang ingin di-mapping
4. Klik **Simpan Mapping**

### Mapping Function → Aplikasi

Sama seperti Dept → Aplikasi, gunakan halaman **Function → Aplikasi**.

---

## 8. Best Comments

### Memilih Best Comments (Admin Event)

1. Buka **Best Comments** di sidebar
2. Filter by Survey dan Function
3. Tab **View Comments**:
   - Centang komentar yang ingin dijadikan best comment
   - Klik **Save Best Comments**
4. Untuk menghapus best comment: klik **Unmark** pada baris yang sudah ditandai

### Melihat Best Comments (DepartmentHead — Readonly)

DepartmentHead hanya bisa melihat tab **View Best Comments** yang menampilkan komentar terbaik beserta feedback IT Lead.

---

## 9. Audit Trail (SuperAdmin)

1. Buka **Audit Trail** di sidebar
2. Gunakan filter untuk mempersempit pencarian:
   - **Search By**: Username, Entity ID, IP Address, User Agent
   - **Action**: Create, Update, Delete, Login, dll.
   - **Entity**: jenis data yang diubah
   - **Tanggal Mulai / Akhir**
3. Klik **Apply Filter**
4. Klik **View** pada baris untuk melihat detail perubahan (Old Values vs New Values)
5. Gunakan tombol **Prev / Next** untuk navigasi halaman

---

## 10. Doorprize (akses via URL)

Modul Doorprize **tidak muncul di sidebar** dan diakses langsung via URL `http://<server>:3001/admin/doorprize` (perlu permission `doorprize:*`). Fitur:

- Kelola **Doorprize Event** (nama, periode, gambar)
- Kelola **Gifts** (daftar hadiah per event)
- Kelola **Participants** (peserta undian)
- Lihat **Results** (pemenang hasil undian)

---

## Tips & Catatan

- Semua aksi destruktif (delete, reject) memerlukan konfirmasi dialog.
- Jika sesi expired (401), sistem otomatis redirect ke halaman login.
- Data yang ditampilkan selalu fresh (no-cache) — tidak perlu refresh manual.
- Untuk pertanyaan teknis, hubungi tim IT atau lihat `docs/developer-guide.md`.
- Deployment guide: lihat `backend/DEPLOYMENT.md`.
- Runbook & troubleshooting: lihat `backend/docs/runbook.md`.

---

*Last updated: 9 Juni 2026*

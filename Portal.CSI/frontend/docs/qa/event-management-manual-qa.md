# Event Management Manual QA

Tanggal acuan: 09-Mar-2026

Dokumen ini dipakai untuk verifikasi manual terstruktur pada area:
- Row 24 `Survey Builder (Create / Edit / Publish) per Event`
- Row 25 `Menu Pertanyaan Survey (CRUD)`
- Row 26 `Halaman Responden (Isi Survey)`
- Row 27 `Submit Jawaban Responden (API + Validasi)`
- Row 28 `Blast Email Link di halaman survey management`
- Row 29 `Blast Reminder di halaman survey management`
- Row 30 `Menu Laporan Hasil Survey (Filter per Event)`
- Row 31 `Fungsi Generate Report Survey di menu Report (admin event)`
- Row 32 `Export Laporan Hasil (Excel/PDF)`

## Scope Role

- `SuperAdmin`: create event, monitoring status, akses audit
- `AdminEvent`: builder, publish, operations, blast, reminder
- `ITLead`: monitor downstream data impact, tidak create/edit builder
- `DepartmentHead`: readonly monitoring

## Data Setup Minimal

Gunakan minimal 1 event dengan kondisi berikut:
- Status backend `Active`
- `EndDateTime` masih di masa depan
- `AssignedAdminId` terisi ke akun `AdminEvent` test

Builder event harus memiliki:
- `Hero`
- 1 `Text`
- 1 `Multiple Choice`
- 1 `Checkbox`
- 1 `Dropdown`
- 1 `Rating`
- 1 `Likert`
- 1 `Matrix`
- 1 `Date`
- 1 `Signature`
- 1 pertanyaan `app_department` atau `app_function`
- 1 pertanyaan lanjutan dengan `displayCondition = after_mapped_selection`
- 1 pertanyaan yang title-nya kosong

Email test:
- `qa1@example.com`
- `qa2@example.com`
- `qa3@example.com`

## Skenario 1: Builder Save Draft

Precondition:
- Login sebagai `AdminEvent`
- Buka halaman edit builder event

Langkah:
1. Ubah `Hero Title`
2. Ubah `Hero Subtitle`
3. Ubah `Primary Color`
4. Ubah `Secondary Color`
5. Ubah `Button Style`
6. Aktif/nonaktifkan `Show Progress Bar`
7. Aktif/nonaktifkan `Show Page Numbers`
8. Ubah `Multi Page`
9. Klik `Save Draft`
10. Refresh halaman

Expected:
- Tidak ada error runtime
- Semua config tetap terbaca setelah refresh
- Draft tersimpan ke DB, bukan hilang setelah reload

## Skenario 2: CRUD Pertanyaan

Precondition:
- Masih di builder

Langkah:
1. Tambah 1 pertanyaan baru
2. Edit label/title pertanyaan
3. Ubah required flag
4. Reorder pertanyaan
5. Hapus 1 pertanyaan
6. Simpan draft
7. Refresh halaman

Expected:
- Urutan pertanyaan tetap konsisten setelah refresh
- Pertanyaan yang dihapus tidak muncul lagi
- Metadata elemen tetap sinkron
- Tidak ada duplicate key warning, karakter rusak, atau placeholder aneh

## Skenario 3: Publish Event Valid

Precondition:
- `EndDateTime` event masih valid

Langkah:
1. Klik `Publish`
2. Buka halaman event management
3. Buka dashboard

Expected:
- Publish berhasil
- Status event tampil sesuai status efektif
- Event muncul di area yang memang menampilkan non-draft

## Skenario 4: Publish Event Expired

Precondition:
- Siapkan event lain dengan `EndDateTime` di masa lalu

Langkah:
1. Buka builder event expired
2. Klik `Publish`

Expected:
- Publish ditolak
- Muncul feedback inline yang jelas
- Event tidak menjadi `Active`
- Di list tampil sebagai `Closed`

## Skenario 5: Preview vs Published Parity

Precondition:
- Event sudah dipublish

Langkah:
1. Bandingkan builder preview dengan halaman public survey
2. Cek `Hero Title`, `Hero Subtitle`, warna tombol, progress bar, page number
3. Cek `Multi Page = Yes`
4. Cek `Multi Page = No`

Expected:
- Tampilan live mengikuti config builder
- Progress bar dan page numbers hanya muncul bila aktif
- Single-page dan multi-page konsisten dengan setting builder

## Skenario 6: Title Kosong

Precondition:
- Ada pertanyaan dengan title kosong

Langkah:
1. Publish event
2. Buka halaman public survey

Expected:
- Tidak muncul placeholder `Untitled Question`
- Tidak ada string dummy/fallback palsu

## Skenario 7: Responden Tanpa Email

Precondition:
- Builder tidak mewajibkan pertanyaan email

Langkah:
1. Buka public survey tanpa query email
2. Isi pertanyaan wajib selain email
3. Submit

Expected:
- Submit berhasil
- Sistem tidak memaksa email
- Tidak ada fallback email buatan

## Skenario 8: Duplicate Prevention Dengan Email

Precondition:
- Event yang sama

Langkah:
1. Submit response dengan email valid
2. Submit lagi dengan email dan kombinasi aplikasi yang sama

Expected:
- Duplicate prevention bekerja
- Response kedua ditolak sesuai rule

## Skenario 9: Multiple App Mapping

Precondition:
- Ada selector `app_department` atau `app_function`

Langkah:
1. Pilih lebih dari 1 aplikasi
2. Pastikan pertanyaan lanjutan muncul per aplikasi
3. Isi jawaban berbeda untuk tiap aplikasi
4. Submit

Expected:
- Pertanyaan lanjutan di-repeat per aplikasi
- Jawaban tiap aplikasi tidak tercampur
- Tidak ada runtime error saat submit

## Skenario 10: Generate Link

Precondition:
- Login sebagai `AdminEvent`
- Buka halaman `Operations`

Langkah:
1. Klik `Generate Link`
2. Klik `Copy Link`
3. Aktifkan `Shorten URL`
4. Klik `Generate Short Link`
5. Salin short link
6. Buka link hasil generate

Expected:
- Link normal mengarah ke FE route `/survey/[surveyId]`
- Short link redirect ke survey yang benar
- Tidak mengarah ke legacy static page

## Skenario 11: Generate QR

Langkah:
1. Klik `Generate QR`
2. Download hasil QR
3. Scan QR

Expected:
- QR berhasil dibuat
- File PNG dapat di-download
- Hasil scan mengarah ke public survey FE

## Skenario 12: Email Blast dari Operations (Modal)

Precondition:
- Event masih aktif dan sudah publish (link survey tersedia)
- Login sebagai `AdminEvent`

Langkah:
1. Buka event → tab **Operations**
2. Klik tombol **📧 Email Blast**
3. Verifikasi modal full-page terbuka
4. Verifikasi field **Link Survey** terisi otomatis dan **read-only** (tidak bisa diedit)
5. Isi **Subject** dan **Message**
6. Isi recipients manual: `qa1@example.com, qa2@example.com`
7. Aktifkan **Tombol Mulai Survey**
8. Aktifkan **Lampirkan QR Code**
9. Klik **Kirim Email Blast**

Expected:
- Modal terbuka dengan animasi smooth
- Link survey pre-filled dari data event, tidak bisa diubah
- Blast berhasil dikirim
- Hasil ditampilkan di footer modal (total/terkirim/gagal)
- Tekan Escape atau klik overlay menutup modal

## Skenario 12b: Email Blast Standalone (SuperAdmin)

Precondition:
- Login sebagai `SuperAdmin`

Langkah:
1. Buka **Email Blast** di sidebar
2. Verifikasi halaman TIDAK menampilkan section "Survey Link & QR"
3. Isi **Subject** dan **Message**
4. Isi recipients manual atau upload file CSV
5. Aktifkan **Calendar Invite**, isi event title, start/end
6. Klik **Kirim Email Blast**

Expected:
- Halaman standalone tanpa konteks survey
- Tidak ada toggle mode blast/survey
- Blast berhasil dikirim
- Calendar invite (.ics) terlampir di email

## Skenario 13: Schedule Reminder Once

Langkah:
1. Isi `Frequency = Once`
2. Isi tanggal dan waktu masa depan
3. Kosongkan `Email Subject`
4. Kosongkan `Email Message`
5. Isi recipients manual
6. Klik `Schedule Reminder`

Expected:
- Schedule berhasil
- Operasi reminder muncul di tabel
- Status awal `Pending`

## Skenario 14: Schedule Weekly

Langkah:
1. Pilih `Frequency = Weekly`
2. Pilih `Day of Week = Sunday`
3. Isi `Start Date`
4. Isi `Schedule Time`
5. Klik schedule

Expected:
- Schedule berhasil
- `Sunday` tetap tersimpan dan tidak hilang karena nilai `0`
- Tabel operasi tetap konsisten

## Skenario 15: Cancel Scheduled Operation

Langkah:
1. Pilih salah satu operasi `Pending`
2. Klik `Cancel`
3. Konfirmasi modal

Expected:
- Status berubah menjadi `Cancelled`
- Operasi tidak bisa di-cancel ulang dari UI

## Skenario 16: Role Access Check

Langkah:
1. Login sebagai `SuperAdmin`
2. Login sebagai `AdminEvent`
3. Login sebagai `ITLead`
4. Login sebagai `DepartmentHead`

Expected:
- `AdminEvent` bisa akses builder dan operations sesuai assignment
- `SuperAdmin` tetap bisa create survey event
- `ITLead` tidak mendapat create/edit builder
- `DepartmentHead` readonly, tidak mendapat create/edit/blast/reminder

## Skenario 17: Regression Check Event Status

Langkah:
1. Buka event management
2. Buka dashboard
3. Bandingkan event `Active` dengan `EndDateTime` sudah lewat

Expected:
- Status efektif tampil `Closed`
- Event expired tidak menampilkan aksi `Operations`

## Skenario 18: Report Selection Filter

Precondition:
- Login sebagai role yang punya akses report
- Minimal ada 1 event dengan report sudah di-generate

Langkah:
1. Buka halaman `Report`
2. Isi pencarian nama event
3. Ubah filter status
4. Kosongkan pencarian

Expected:
- List event terfilter sesuai nama dan status
- `AdminEvent` hanya melihat event sesuai assignment
- `ITLead` dan `DepartmentHead` hanya readonly

## Skenario 19: Generate Report Action State

Precondition:
- Login sebagai `AdminEvent`
- Minimal ada 1 event dengan response final approved
- Event tersebut belum di-generate

Langkah:
1. Buka halaman `Report`
2. Cari event target
3. Perhatikan tombol aksi sebelum generate
4. Klik `Generate Report`
5. Refresh halaman

Expected:
- Sebelum generate: hanya `Generate Report`
- Setelah generate dan refresh: muncul `Regenerate Report`, `View Report`, `Export`
- Event tanpa response final approved tidak bisa generate

## Skenario 20: View Report Full Page

Precondition:
- Report sudah di-generate

Langkah:
1. Klik `View Report`
2. Periksa tampilan halaman detail report

Expected:
- Halaman tampil full page tanpa sidebar
- Struktur visual mengikuti mockup report detail
- Data kosong tetap kosong, tidak ada hardcode palsu
- Sumber data hanya dari response final approved

## Skenario 21: View Report Tanpa Generate

Precondition:
- Ada event dengan response final approved tetapi belum di-generate

Langkah:
1. Akses URL detail report langsung `/admin/report/[surveyId]`

Expected:
- Halaman tidak melakukan generate otomatis
- Muncul pesan bahwa report belum di-generate
- Role readonly tidak memicu perubahan state report

## Skenario 22: Export Report

Precondition:
- Report sudah di-generate

Langkah:
1. Klik `Export`
2. Pilih unduhan Excel
3. Ulangi untuk PDF
4. Buka file hasil unduh

Expected:
- Export hanya tersedia untuk report yang sudah di-generate
- Nama file unduhan mengikuti judul report/event
- Konten export sesuai data report final-approved
- Tidak ada formula injection dari data teks responden

## Exit Criteria

Area dianggap lolos bila:
- Tidak ada parse/build/runtime error
- Builder, preview, dan public form konsisten
- Submit response berjalan untuk skenario email wajib dan non-wajib
- Blast/reminder dapat dijadwalkan untuk `once` dan `recurring`
- QR dan generated link usable
- View/generate/export report mengikuti state generated yang benar
- Role access tidak bocor

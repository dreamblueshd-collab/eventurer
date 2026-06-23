# E2E Testing Checklist — CSI Portal
**Fase: Internal Testing (QA Test + Bug Fixing + re-testing)**
**Acuan awal:** Activity B.21 (Integrasi E2E) — diperbarui untuk Internal Testing
**Terakhir disinkronkan:** 5 Juni 2026 (sesuai kode aktual + migration 049)
**Environment:** FE http://localhost:3001 | BE http://localhost:3000

---

## Status Legend
- `[ ]` = Belum ditest
- `[✓]` = Pass
- `[✗]` = Fail (catat error di kolom Catatan)
- `[-]` = Skip / N/A

---

## 1. Auth & Session

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 1.1 | Login sebagai `superadmin` | Redirect ke dashboard, sidebar tampil menu: Dashboard, Event Management, Email Blast, Audit Trail, Master User | [ ] | |
| 1.2 | Login sebagai `adminevent` | Redirect ke dashboard, sidebar: Dashboard, Event Management, Report, Approval Admin, Best Comments, Master (BU/Divisi/Department/Function/Aplikasi), Mapping (Dept/Function → Aplikasi) | [ ] | |
| 1.3 | Login sebagai `itlead` | Redirect ke dashboard, sidebar: Dashboard, Report, Approval IT Lead | [ ] | |
| 1.4 | Login sebagai `depthead` | Redirect ke dashboard, sidebar: Dashboard, Report, Best Comments | [ ] | |
| 1.5 | Login dengan password salah | Tampil pesan error, tidak redirect | [ ] | |
| 1.6 | Logout | Session terhapus, redirect ke login, tidak bisa back ke dashboard | [ ] | |
| 1.7 | Akses halaman admin tanpa login | Redirect ke login | [ ] | |

---

## 2. Master Data

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 2.1 | Master User — list tampil | Data user muncul di tabel | [ ] | |
| 2.2 | Master User — create user baru | User tersimpan, muncul di list | [ ] | |
| 2.3 | Master User — edit user | Perubahan tersimpan | [ ] | |
| 2.4 | Master User — activate/deactivate | Status berubah | [ ] | |
| 2.5 | Master BU — list tampil | Data BU muncul | [ ] | |
| 2.6 | Master BU — create/edit | Data tersimpan | [ ] | |
| 2.7 | Master Divisi — kolom BU di depan | Kolom BU tampil sebagai kolom pertama | [ ] | |
| 2.8 | Master Department — list tampil | Data muncul | [ ] | |
| 2.9 | Master Function — list tampil | Data muncul | [ ] | |
| 2.10 | Master Aplikasi — list tampil | Data muncul | [ ] | |

---

## 3. Event Management

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 3.1 | List event tampil | Daftar event muncul dengan status badge | [ ] | |
| 3.2 | Filter event by status | List terfilter | [ ] | |
| 3.2b | Dropdown filter status **tidak** memuat opsi "In Design" | Opsi "In Design" sudah dihapus dari filter | [ ] | |
| 3.3 | Search event | Hasil search muncul | [ ] | |
| 3.4 | Create event baru | Modal terbuka, event tersimpan, muncul di list | [ ] | |
| 3.5 | Edit event | Perubahan tersimpan | [ ] | |
| 3.6 | Delete event | ConfirmDialog muncul, event terhapus setelah konfirmasi | [ ] | |
| 3.7 | Klik "Survey Builder" dari event | Redirect ke halaman builder | [ ] | |
| 3.8 | Klik "Operations" dari event | Redirect ke halaman operations | [ ] | |
| 3.9 | Login `superadmin` — kolom tabel | Kolom **Event** dan **Survey** tampil; jumlah `<th>` header match dengan `<td>` per baris (tidak ada column shift) | [ ] | |
| 3.10 | Login `adminevent` — scoping assignment | Hanya event yang di-assign ke admin tsb yang tampil (cek `Events.AssignedAdminId` ATAU `EventAdminAssignments`) | [ ] | |

---

## 4. Survey Builder

Tipe elemen yang didukung: `hero`, `text`, `choice` (multiple choice), `checkbox`, `dropdown`, `rating`, `likert`, `matrix`, `date`, `signature`.

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 4.1 | Halaman builder load | Pertanyaan existing tampil | [ ] | |
| 4.2 | Add question tipe Rating | Question tersimpan, muncul di list | [ ] | |
| 4.3 | Add question tipe Text | Question tersimpan | [ ] | |
| 4.4 | Add question tipe Dropdown | Question tersimpan dengan options | [ ] | |
| 4.5 | Add question tipe Multiple Choice (choice) | Tersimpan; orientasi vertikal/horizontal benar | [ ] | |
| 4.6 | Add question tipe Checkbox | Tersimpan dengan multi-select | [ ] | |
| 4.7 | Add question tipe Likert | Tersimpan; komentar per statement & threshold wajib (default 7) berfungsi | [ ] | |
| 4.8 | Add question tipe Matrix | Tersimpan dengan kolom/baris | [ ] | |
| 4.9 | Add question tipe Date | Tersimpan | [ ] | |
| 4.10 | Add question tipe Signature | Tersimpan; canvas tanda tangan tampil di preview | [ ] | |
| 4.11 | Selector aplikasi `app_department` | Opsi aplikasi muncul dari mapping Department terpilih | [ ] | |
| 4.12 | Selector aplikasi `app_function` | Opsi aplikasi muncul dari mapping Function terpilih | [ ] | |
| 4.13 | Pertanyaan lanjutan `after_mapped_selection` | Pertanyaan di-repeat per aplikasi terpilih, jawaban tidak tercampur | [ ] | |
| 4.14 | Edit question | Perubahan tersimpan | [ ] | |
| 4.15 | Delete question | ConfirmDialog muncul, question terhapus | [ ] | |
| 4.16 | Reorder question + Save Draft + refresh | Urutan konsisten setelah reload | [ ] | |
| 4.17 | Preview mode (Desktop & Mobile) | Survey tampil sesuai config; device switcher berfungsi | [ ] | |
| 4.18 | Publish survey valid | Status berubah ke Active | [ ] | |
| 4.19 | Publish event expired (EndDate lewat) | Publish ditolak, status tidak menjadi Active (tampil Closed) | [ ] | |

### 4b. Image Cropper & Style Settings

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 4b.1 | Upload Hero image → modal cropper terbuka | Modal cropper (±1100px) terbuka, layout split (crop kiri, kontrol kanan) | [ ] | |
| 4b.2 | Tools cropper: zoom / rotate / flip / rotation | Semua tools berfungsi pada preview crop | [ ] | |
| 4b.3 | Logo placement selector (di dalam cropper) | Pilihan posisi logo ada di dalam modal cropper, bukan di Style Settings | [ ] | |
| 4b.4 | Remove button di tiap upload point | Gambar (hero/logo/background) bisa dihapus | [ ] | |
| 4b.5 | Style Settings → ubah nilai → "Batal" | Semua nilai revert ke snapshot awal termasuk image URL (tidak ikut tersimpan) | [ ] | |
| 4b.6 | Persistensi image position setelah Save Draft + refresh | Posisi gambar (X/Y) tetap tersimpan | [ ] | |

---

## 5. Operations (per Event)

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 5.1 | Generate survey link | Link muncul di input field | [ ] | |
| 5.2 | Copy link | Toast/message "berhasil disalin" | [ ] | |
| 5.3 | Generate QR code | Gambar QR muncul | [ ] | |
| 5.4 | Download QR | File PNG ter-download | [ ] | |
| 5.5 | Tab Embed — embed code muncul | Kode iframe tampil | [ ] | |
| 5.6 | Klik "Email Blast" — modal terbuka | Modal full-page terbuka, link survey pre-filled & read-only | [ ] | |
| 5.7 | Email Blast modal — kirim blast | Blast terkirim, result ditampilkan di footer modal | [ ] | |
| 5.8 | Email Blast modal — close (Escape/overlay/Tutup) | Modal tertutup tanpa side effect | [ ] | |
| 5.9 | Schedule Blast (once) | Muncul di Scheduled Operations table | [ ] | |
| 5.10 | Schedule Reminder (once) | Muncul di Scheduled Operations table | [ ] | |
| 5.11 | Cancel scheduled operation | ConfirmDialog muncul, status berubah ke Cancelled | [ ] | |

---

## 5b. Email Blast Standalone (SuperAdmin)

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 5b.1 | Menu Email Blast tampil di sidebar (SuperAdmin) | Menu muncul | [ ] | |
| 5b.2 | Menu Email Blast TIDAK tampil (AdminEvent/ITLead/DeptHead) | Menu tidak muncul | [ ] | |
| 5b.3 | Halaman standalone — tidak ada section Survey Link & QR | Section tidak tampil | [ ] | |
| 5b.4 | Kirim blast standalone dengan calendar invite | Blast terkirim, .ics terlampir | [ ] | |
| 5b.5 | Upload file recipients (CSV/Excel) | File terbaca, blast terkirim | [ ] | |

---

## 6. Public Survey (Responden)

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 6.1 | Akses `/survey/:surveyId` | Form survey tampil | [ ] | |
| 6.2 | Pilih BU → Divisi cascade | Dropdown Divisi terisi sesuai BU | [ ] | |
| 6.3 | Pilih Divisi → Dept cascade | Dropdown Dept terisi sesuai Divisi | [ ] | |
| 6.4 | Pilih aplikasi | Checkbox aplikasi tampil | [ ] | |
| 6.5 | Submit tanpa isi mandatory | Validasi error muncul | [ ] | |
| 6.6 | Submit lengkap | Response tersimpan, halaman sukses tampil | [ ] | |
| 6.7 | Submit duplikat (email + app sama) | Pesan duplikat muncul, tidak tersimpan | [ ] | |

---

## 7. Approval Admin (AdminEvent)

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 7.1 | Tab Daftar Responden — list tampil | Data responden muncul | [ ] | |
| 7.2 | Filter duplicate: "Duplicate Only" | Hanya responden duplikat tampil | [ ] | |
| 7.3 | Select responden + Approve Selected | Status berubah ke PendingITLead | [ ] | |
| 7.4 | Select responden + Reject Selected | Dialog alasan muncul, status berubah | [ ] | |
| 7.5 | Export to CSV | File CSV ter-download | [ ] | |
| 7.6 | Tab Propose Takeout — list tampil | Data proposed takeout muncul | [ ] | |
| 7.7 | Approve Takeout | Status takeout berubah | [ ] | |
| 7.8 | Reject Takeout | Dialog alasan muncul, status berubah | [ ] | |
| 7.9 | Header tabel responden | Kolom **Event** dan **Survey** ada; jumlah `<th>` match `<td>` (tidak ada column shift) | [ ] | |

---

## 8. Approval IT Lead

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 8.1 | Tab Propose Takeout — pending list tampil | Data pending IT Lead muncul | [ ] | |
| 8.2 | Approve Final Response | Status berubah ke ApprovedFinal | [ ] | |
| 8.3 | Propose Takeout | Dialog alasan muncul, data masuk ke Approval Admin | [ ] | |
| 8.4 | Tab Best Comments Feedback — list tampil | Best comments muncul | [ ] | |
| 8.5 | Submit feedback | Feedback tersimpan | [ ] | |
| 8.6 | Load halaman approval IT Lead (cek console) | Tidak ada React hydration error (tidak ada whitespace antar `<th>`) | [ ] | |

---

## 9. Best Comments (AdminEvent)

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 9.1 | Tab View Comments — list tampil | Komentar muncul | [ ] | |
| 9.2 | Mark best comment | Komentar ditandai | [ ] | |
| 9.3 | Unmark best comment | Tanda dihapus | [ ] | |
| 9.4 | Tab View Best Comments — list tampil | Best comments + feedback IT Lead muncul | [ ] | |

---

## 10. Report

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 10.1 | List event report tampil | Daftar event muncul | [ ] | |
| 10.2 | Generate Report | Status berubah ke Generated | [ ] | |
| 10.3 | View Report | Halaman report detail terbuka dengan data | [ ] | |
| 10.4 | Chart Applications Score tampil | Bar chart muncul | [ ] | |
| 10.5 | Function Detail table tampil | Tabel dengan rowspan muncul | [ ] | |
| 10.6 | Export Excel | File .xlsx ter-download | [ ] | |
| 10.7 | Export PDF | Print view terbuka | [ ] | |
| 10.8 | Takeout Comparison table | Data before/after muncul | [ ] | |
| 10.9 | Login `superadmin` — section "Propose Takeout Score Comparison" | Section **tidak tampil** untuk SuperAdmin (`{!isSuperAdmin && ...}`) | [ ] | |

---

## 11. Audit Trail

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 11.1 | List audit log tampil | Log muncul dengan timestamp, user, action | [ ] | |
| 11.2 | Filter by date range | Log terfilter | [ ] | |
| 11.3 | Filter by action | Log terfilter | [ ] | |

---

## 12. Mapping

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 12.1 | Mapping Function→App — list tampil | Data mapping muncul | [ ] | |
| 12.2 | Tambah mapping | Mapping tersimpan | [ ] | |
| 12.3 | Hapus mapping | ConfirmDialog muncul, mapping terhapus | [ ] | |
| 12.4 | Mapping Dept→App — hierarchical view | BU > Divisi > Dept > App tampil | [ ] | |

---

## 13. Role Isolation

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 13.1 | DeptHead akses `/admin/event-management` | Redirect atau 403 | [ ] | |
| 13.2 | DeptHead akses `/admin/approval-admin` | Redirect atau 403 | [ ] | |
| 13.3 | ITLead akses `/admin/master-bu` | Redirect atau 403 | [ ] | |
| 13.4 | SuperAdmin akses `/admin/approval-admin` | Redirect atau 403 | [ ] | |
| 13.5 | SuperAdmin akses `/admin/report` (via URL) | Page guard mengizinkan (`canAccess` true), tetapi section "Propose Takeout Score Comparison" disembunyikan (lihat 10.9). Catatan: sidebar SuperAdmin tidak menampilkan menu Report — verifikasi perilaku yang diinginkan dengan PM | [ ] | |
| 13.6 | ITLead akses `/admin/report` | Diizinkan (readonly), ITLead termasuk role Report | [ ] | |
| 13.7 | DeptHead akses semua master/mapping/approval-admin | Redirect atau 403 | [ ] | |

---

## 14. Doorprize (akses via URL `/admin/doorprize`)

> Fitur hidden dari sidebar (akses langsung via URL). Permission: `doorprize:read|create|update|delete`. Endpoint: `/api/v1/doorprize/*`.

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 14.1 | Akses `/admin/doorprize` | Halaman doorprize terbuka (tidak muncul di sidebar) | [ ] | |
| 14.2 | List Doorprize Events | Data event doorprize muncul | [ ] | |
| 14.3 | Create Doorprize Event (+ image) | Event tersimpan, image ter-upload | [ ] | |
| 14.4 | CRUD Gifts per event | Gift bisa tambah/edit/hapus | [ ] | |
| 14.5 | Kelola Participants | Peserta bisa ditambah/diimpor | [ ] | |
| 14.6 | Draw / lihat Results | Hasil undian tersimpan & tampil | [ ] | |

---

## Ringkasan Hasil Testing

| Modul | Total | Pass | Fail | Skip |
|-------|-------|------|------|------|
| 1. Auth | 7 | | | |
| 2. Master Data | 10 | | | |
| 3. Event Management | 11 | | | |
| 4. Survey Builder | 19 | | | |
| 4b. Image Cropper & Style Settings | 6 | | | |
| 5. Operations | 11 | | | |
| 5b. Email Blast Standalone | 5 | | | |
| 6. Public Survey | 7 | | | |
| 7. Approval Admin | 9 | | | |
| 8. Approval IT Lead | 6 | | | |
| 9. Best Comments | 4 | | | |
| 10. Report | 9 | | | |
| 11. Audit Trail | 3 | | | |
| 12. Mapping | 4 | | | |
| 13. Role Isolation | 7 | | | |
| 14. Doorprize | 6 | | | |
| **TOTAL** | **124** | | | |

---

## Bug Log

| # | Modul | Deskripsi Bug | Severity | Status |
|---|-------|---------------|----------|--------|
| | | | | |

---

## Catatan Meeting

_Diisi saat meeting mingguan_

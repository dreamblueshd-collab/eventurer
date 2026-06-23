# CSI Frontend (Next.js)

Frontend baru berbasis Next.js App Router untuk menggantikan halaman statis lama.

## Prasyarat

- Backend CSI berjalan di `http://localhost:3000`
- Node.js 22+

## Setup

1. Salin environment:

```bash
cp .env.local.example .env.local
```

2. Install dependency:

```bash
npm install
```

Jika PowerShell memblokir `npm.ps1` (error `is not digitally signed`), jalankan via CMD-compatible binary:

```cmd
npm.cmd install
```

3. Jalankan frontend di port `3001`:

```bash
npm run dev:3001
```

Fallback saat policy PowerShell memblokir:

```cmd
npm.cmd run dev:3001
```

4. Buka:

`http://localhost:3001/login`

## Cakupan Fitur

Aplikasi sudah lengkap (bukan lagi migrasi bertahap). Halaman admin tersedia:

- Auth: Login, reset password
- Dashboard (semua role)
- Event Management (+ Survey Builder + Operations + Email Blast modal)
- Email Blast standalone (SuperAdmin)
- Approval Admin, Approval IT Lead, Best Comments
- Report (+ report detail full-page), Audit Trail
- Master: User, BU, Divisi, Department, Function, Aplikasi
- Mapping: Dept → Aplikasi, Function → Aplikasi
- Doorprize (akses via URL `/admin/doorprize`)
- Public survey flow (short link → form → submit)

## Dokumentasi Developer

- Panduan lengkap developer tersedia di [docs/developer-guide.md](docs/developer-guide.md)

## Catatan Teknis

- Frontend memanggil API melalui path `/api/*`.
- `next.config.ts` me-rewrite request ke backend `BACKEND_INTERNAL_URL`.
- Auth berbasis cookie httpOnly (`credentials: "include"`); marker sesi + data user disimpan di `sessionStorage`. Penyimpanan `localStorage` hanya dipertahankan sebagai legacy/deprecated.

# Proses Pesanan

Aplikasi manajemen pesanan dengan alur produksi Cetak → Gunting → Jahit → Packing.
Data disimpan di Supabase (Postgres) supaya semua tim melihat data yang sama dari mana saja.

## Jalankan di komputer sendiri

```bash
npm install
cp .env.example .env   # lalu isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
npm run dev
```

## Setup Supabase (sekali saja)

1. Buat project baru di https://supabase.com (gratis).
2. Buka **SQL Editor** di dashboard Supabase, tempel isi file `supabase-schema.sql`, lalu **Run**.
   - Jika sebelumnya sudah pernah menjalankan versi lama file ini (tabel `orders` sudah ada), cukup jalankan baris terakhirnya saja: `alter table orders add column if not exists grup text;` untuk menambahkan kolom grup baru.
3. Buka **Project Settings > API**, salin **Project URL** dan **anon public key**.
4. Isi dua nilai itu ke `.env` (untuk lokal) dan ke Environment Variables di Vercel (untuk produksi).

## Deploy ke Vercel via GitHub

1. Push folder ini ke repository GitHub baru.
2. Buka https://vercel.com, klik **Add New > Project**, pilih repo tersebut.
3. Vercel akan mendeteksi Vite secara otomatis (build command `vite build`, output `dist`) — tidak perlu diubah.
4. Di step **Environment Variables**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Klik **Deploy**. Setelah selesai, aplikasi bisa diakses lewat domain `*.vercel.app` yang diberikan Vercel.

Setiap kali push ke branch utama di GitHub, Vercel otomatis build ulang dan deploy versi terbaru.

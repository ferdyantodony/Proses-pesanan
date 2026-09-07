-- Jalankan ini di Supabase: Dashboard > SQL Editor > New query > Run

create table if not exists orders (
  id text primary key,
  no_resi text,
  deskripsi text,
  image text,
  images jsonb not null default '[]'::jsonb,
  grup text,
  stage text not null default 'cetak',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Kalau tabel "orders" sudah ada sebelumnya, jalankan baris yang relevan saja:
alter table orders add column if not exists grup text;
alter table orders add column if not exists images jsonb not null default '[]'::jsonb;

-- Pindahkan foto lama (kolom "image" tunggal) ke kolom "images" yang baru, kalau ada:
update orders
set images = jsonb_build_array(image)
where image is not null and (images is null or images = '[]'::jsonb);

-- Karena aplikasi ini tidak punya login, RLS dinonaktifkan supaya
-- anon key (dipakai di browser) bisa baca & tulis. Ini cocok untuk
-- tool internal di balik URL yang tidak disebar publik.
-- Jangan pakai pola ini untuk data sensitif atau aplikasi publik.
alter table orders disable row level security;

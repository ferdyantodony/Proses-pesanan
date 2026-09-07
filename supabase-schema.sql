-- Jalankan ini di Supabase: Dashboard > SQL Editor > New query > Run

create table if not exists orders (
  id text primary key,
  no_resi text,
  deskripsi text,
  image text,
  stage text not null default 'cetak',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Karena aplikasi ini tidak punya login, RLS dinonaktifkan supaya
-- anon key (dipakai di browser) bisa baca & tulis. Ini cocok untuk
-- tool internal di balik URL yang tidak disebar publik.
-- Jangan pakai pola ini untuk data sensitif atau aplikasi publik.
alter table orders disable row level security;

-- =============================================================================
-- SIPUT-OPT — Skema awal
-- Jalankan sekali di Supabase SQL Editor (atau `supabase db push`).
-- Baseline keamanan: RLS di semua tabel, perubahan status/penugasan/peran
-- hanya melalui RPC security definer yang memvalidasi peran & cakupan wilayah.
-- =============================================================================

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.peran_pengguna as enum ('petani', 'petugas', 'admin_kabupaten', 'admin_provinsi');
create type public.status_laporan as enum ('baru', 'diverifikasi', 'ditugaskan', 'ditangani', 'selesai', 'ditolak');
create type public.tingkat_serangan as enum ('ringan', 'sedang', 'berat', 'puso');

-- ---------------------------------------------------------------------------
-- Utilitas
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Master wilayah (kode resmi Kemendagri, mis. '64' provinsi, '64.72' kota)
-- ---------------------------------------------------------------------------
create table public.wilayah (
  kode        text primary key,
  nama        text not null,
  tingkat     smallint not null check (tingkat between 1 and 4), -- 1 prov, 2 kab/kota, 3 kec, 4 desa
  kode_induk  text references public.wilayah (kode),
  geom        extensions.geometry(MultiPolygon, 4326)
);
create index wilayah_geom_idx on public.wilayah using gist (geom);
create index wilayah_induk_idx on public.wilayah (kode_induk);

-- ---------------------------------------------------------------------------
-- Profil pengguna
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  nama_lengkap  text,
  no_hp         text,
  role          public.peran_pengguna not null default 'petani',
  kode_wilayah  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_wilayah_idx on public.profiles (kode_wilayah);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Profil otomatis saat user mendaftar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, nama_lengkap, no_hp)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'nama_lengkap'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'no_hp'), '')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helper peran & cakupan (security definer agar tidak rekursif terhadap RLS)
-- ---------------------------------------------------------------------------
create or replace function public.peran_saya()
returns public.peran_pengguna language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.wilayah_saya()
returns text language sql stable security definer set search_path = '' as $$
  select kode_wilayah from public.profiles where id = auth.uid()
$$;

-- Apakah kode wilayah berada dalam cakupan pengguna saat ini?
--   admin_provinsi           : semua (aplikasi tingkat provinsi)
--   admin_kabupaten/petugas  : kode diawali kode wilayah miliknya
create or replace function public.dalam_cakupan(p_kode text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case public.peran_saya()
    when 'admin_provinsi' then true
    when 'admin_kabupaten' then p_kode is not null and public.wilayah_saya() is not null
                                and (p_kode = public.wilayah_saya() or p_kode like public.wilayah_saya() || '.%')
    when 'petugas' then p_kode is not null and public.wilayah_saya() is not null
                                and (p_kode = public.wilayah_saya() or p_kode like public.wilayah_saya() || '.%')
    else false
  end
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.peran_saya() in ('admin_kabupaten', 'admin_provinsi'), false)
$$;

-- Cegah pengguna mengubah role/kode_wilayah/email miliknya sendiri lewat API.
-- Pemilik project (SQL Editor, auth.uid() null) dan RPC atur_peran tetap boleh.
create or replace function public.lindungi_kolom_profil()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and coalesce(current_setting('siput.rpc', true), '') <> '1' then
    if new.role is distinct from old.role
       or new.kode_wilayah is distinct from old.kode_wilayah
       or new.email is distinct from old.email
       or new.id is distinct from old.id then
      raise exception 'Kolom role, kode_wilayah, dan email tidak boleh diubah langsung';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_lindungi before update on public.profiles
  for each row execute function public.lindungi_kolom_profil();

-- ---------------------------------------------------------------------------
-- Master jenis OPT
-- ---------------------------------------------------------------------------
create table public.jenis_opt (
  id           bigint generated always as identity primary key,
  nama         text not null unique,
  nama_ilmiah  text,
  kategori     text not null default 'hama' check (kategori in ('hama', 'penyakit', 'gulma', 'lainnya')),
  komoditas    text,
  aktif        boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Laporan serangan OPT
-- ---------------------------------------------------------------------------
create table public.laporan (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null unique default gen_random_uuid(), -- idempotensi sinkron offline
  pelapor_id         uuid not null default auth.uid() references public.profiles (id),
  jenis_opt_id       bigint references public.jenis_opt (id),
  jenis_opt_lain     text,
  komoditas          text not null check (length(trim(komoditas)) > 0),
  tingkat            public.tingkat_serangan not null,
  luas_serangan_ha   numeric(12, 4) check (luas_serangan_ha >= 0),
  luas_tanam_ha      numeric(12, 4) check (luas_tanam_ha >= 0),
  deskripsi          text,
  alamat             text,
  -- Koordinat final (dikonfirmasi pelapor, bisa dikoreksi manual)
  lat                double precision not null check (lat between -90 and 90),
  lng                double precision not null check (lng between -180 and 180),
  lokasi             extensions.geography(Point, 4326),
  -- Koordinat GPS asli (tidak berubah walau pin dikoreksi)
  gps_lat            double precision check (gps_lat between -90 and 90),
  gps_lng            double precision check (gps_lng between -180 and 180),
  gps_akurasi_m      real check (gps_akurasi_m >= 0),
  gps_diambil_pada   timestamptz,
  kode_wilayah       text,
  status             public.status_laporan not null default 'baru',
  petugas_id         uuid references public.profiles (id),
  catatan_admin      text,
  diamati_pada       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint laporan_jenis_wajib check (jenis_opt_id is not null or length(trim(coalesce(jenis_opt_lain, ''))) > 0),
  constraint laporan_luas_logis check (luas_tanam_ha is null or luas_serangan_ha is null or luas_serangan_ha <= luas_tanam_ha)
);
create index laporan_lokasi_idx on public.laporan using gist (lokasi);
create index laporan_pelapor_idx on public.laporan (pelapor_id);
create index laporan_petugas_idx on public.laporan (petugas_id);
create index laporan_status_idx on public.laporan (status);
create index laporan_wilayah_idx on public.laporan (kode_wilayah);
create index laporan_created_idx on public.laporan (created_at desc);

create trigger laporan_updated_at before update on public.laporan
  for each row execute function public.set_updated_at();

-- Hitung geografi & kode wilayah di server (nilai dari klien diabaikan).
create or replace function public.laporan_isi_turunan()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_kode text;
begin
  new.lokasi := extensions.st_setsrid(extensions.st_makepoint(new.lng, new.lat), 4326)::extensions.geography;

  if tg_op = 'INSERT' or new.lat is distinct from old.lat or new.lng is distinct from old.lng then
    select w.kode into v_kode
    from public.wilayah w
    where w.geom is not null
      and extensions.st_intersects(w.geom, extensions.st_setsrid(extensions.st_makepoint(new.lng, new.lat), 4326))
    order by w.tingkat desc
    limit 1;

    if v_kode is null then
      select p.kode_wilayah into v_kode from public.profiles p where p.id = new.pelapor_id;
    end if;
    new.kode_wilayah := v_kode;
  else
    new.kode_wilayah := old.kode_wilayah;
  end if;
  return new;
end $$;

create trigger laporan_turunan before insert or update on public.laporan
  for each row execute function public.laporan_isi_turunan();

-- Lindungi kolom alur kerja: hanya boleh diubah via RPC.
create or replace function public.lindungi_kolom_laporan()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and coalesce(current_setting('siput.rpc', true), '') <> '1' then
    if tg_op = 'INSERT' then
      if new.status <> 'baru' or new.petugas_id is not null or new.catatan_admin is not null then
        raise exception 'Laporan baru harus berstatus baru tanpa penugasan';
      end if;
      if new.pelapor_id <> auth.uid() then
        raise exception 'pelapor_id harus pengguna saat ini';
      end if;
    else
      if new.status is distinct from old.status
         or new.petugas_id is distinct from old.petugas_id
         or new.catatan_admin is distinct from old.catatan_admin
         or new.pelapor_id is distinct from old.pelapor_id
         or new.client_id is distinct from old.client_id
         or new.gps_lat is distinct from old.gps_lat
         or new.gps_lng is distinct from old.gps_lng
         or new.gps_akurasi_m is distinct from old.gps_akurasi_m
         or new.gps_diambil_pada is distinct from old.gps_diambil_pada then
        raise exception 'Kolom status, penugasan, dan data GPS asli tidak boleh diubah langsung';
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger laporan_lindungi before insert or update on public.laporan
  for each row execute function public.lindungi_kolom_laporan();

-- ---------------------------------------------------------------------------
-- Riwayat status laporan (audit)
-- ---------------------------------------------------------------------------
create table public.laporan_riwayat (
  id           bigint generated always as identity primary key,
  laporan_id   uuid not null references public.laporan (id) on delete cascade,
  status_lama  public.status_laporan,
  status_baru  public.status_laporan not null,
  oleh         uuid references public.profiles (id),
  catatan      text,
  created_at   timestamptz not null default now()
);
create index laporan_riwayat_laporan_idx on public.laporan_riwayat (laporan_id, created_at);

create or replace function public.laporan_catat_awal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.laporan_riwayat (laporan_id, status_lama, status_baru, oleh, catatan)
  values (new.id, null, new.status, new.pelapor_id, 'Laporan dibuat');
  return new;
end $$;

create trigger laporan_riwayat_awal after insert on public.laporan
  for each row execute function public.laporan_catat_awal();

-- ---------------------------------------------------------------------------
-- Foto laporan (berkas di Storage bucket 'laporan-opt')
-- Path wajib: {auth.uid()}/{laporan_id}/{nama_berkas}
-- ---------------------------------------------------------------------------
create table public.laporan_foto (
  id             uuid primary key default gen_random_uuid(),
  laporan_id     uuid not null references public.laporan (id) on delete cascade,
  storage_path   text not null unique,
  diunggah_oleh  uuid not null default auth.uid() references public.profiles (id),
  created_at     timestamptz not null default now()
);
create index laporan_foto_laporan_idx on public.laporan_foto (laporan_id);

-- ---------------------------------------------------------------------------
-- Tracking petugas (live tracking saat penugasan)
-- ---------------------------------------------------------------------------
create table public.tracking_petugas (
  id            bigint generated always as identity primary key,
  petugas_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  laporan_id    uuid references public.laporan (id) on delete set null,
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  akurasi_m     real check (akurasi_m >= 0),
  lokasi        extensions.geography(Point, 4326),
  direkam_pada  timestamptz not null default now()
);
create index tracking_petugas_waktu_idx on public.tracking_petugas (petugas_id, direkam_pada desc);

create or replace function public.tracking_isi_lokasi()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.lokasi := extensions.st_setsrid(extensions.st_makepoint(new.lng, new.lat), 4326)::extensions.geography;
  return new;
end $$;

create trigger tracking_lokasi before insert on public.tracking_petugas
  for each row execute function public.tracking_isi_lokasi();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.wilayah          enable row level security;
alter table public.profiles         enable row level security;
alter table public.jenis_opt        enable row level security;
alter table public.laporan          enable row level security;
alter table public.laporan_riwayat  enable row level security;
alter table public.laporan_foto     enable row level security;
alter table public.tracking_petugas enable row level security;

-- Tidak ada akses anonim sama sekali.
revoke all on all tables in schema public from anon;

-- wilayah: baca untuk pengguna login; tulis hanya pemilik project (SQL Editor)
create policy wilayah_select on public.wilayah for select to authenticated using (true);

-- jenis_opt: baca untuk pengguna login; kelola oleh admin provinsi
create policy jenis_opt_select on public.jenis_opt for select to authenticated using (true);
create policy jenis_opt_insert on public.jenis_opt for insert to authenticated
  with check (public.peran_saya() = 'admin_provinsi');
create policy jenis_opt_update on public.jenis_opt for update to authenticated
  using (public.peran_saya() = 'admin_provinsi') with check (public.peran_saya() = 'admin_provinsi');

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.peran_saya() = 'admin_provinsi'
    or (public.peran_saya() = 'admin_kabupaten' and public.dalam_cakupan(kode_wilayah))
    -- nama pelapor/petugas pada laporan yang bisa dilihat
    or exists (
      select 1 from public.laporan l
      where (l.pelapor_id = profiles.id or l.petugas_id = profiles.id)
        and (l.pelapor_id = auth.uid() or l.petugas_id = auth.uid() or public.dalam_cakupan(l.kode_wilayah))
    )
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- laporan
create policy laporan_select on public.laporan for select to authenticated
  using (pelapor_id = auth.uid() or petugas_id = auth.uid() or public.dalam_cakupan(kode_wilayah));
create policy laporan_insert on public.laporan for insert to authenticated
  with check (pelapor_id = auth.uid() and status = 'baru' and petugas_id is null);
create policy laporan_update_pelapor on public.laporan for update to authenticated
  using (pelapor_id = auth.uid() and status = 'baru')
  with check (pelapor_id = auth.uid() and status = 'baru');
create policy laporan_delete_pelapor on public.laporan for delete to authenticated
  using (pelapor_id = auth.uid() and status = 'baru');

-- laporan_riwayat: hanya baca (insert lewat trigger/RPC security definer)
create policy laporan_riwayat_select on public.laporan_riwayat for select to authenticated
  using (exists (select 1 from public.laporan l where l.id = laporan_id));

-- laporan_foto
create policy laporan_foto_select on public.laporan_foto for select to authenticated
  using (exists (select 1 from public.laporan l where l.id = laporan_id));
create policy laporan_foto_insert on public.laporan_foto for insert to authenticated
  with check (
    diunggah_oleh = auth.uid()
    and storage_path like auth.uid()::text || '/' || laporan_id::text || '/%'
    and exists (select 1 from public.laporan l where l.id = laporan_id and l.pelapor_id = auth.uid())
  );
create policy laporan_foto_delete on public.laporan_foto for delete to authenticated
  using (
    diunggah_oleh = auth.uid()
    and exists (select 1 from public.laporan l where l.id = laporan_id and l.status = 'baru')
  );

-- tracking_petugas
create policy tracking_insert on public.tracking_petugas for insert to authenticated
  with check (petugas_id = auth.uid() and public.peran_saya() = 'petugas');
create policy tracking_select on public.tracking_petugas for select to authenticated
  using (
    petugas_id = auth.uid()
    or (public.is_admin() and public.dalam_cakupan((select p.kode_wilayah from public.profiles p where p.id = petugas_id)))
  );

-- =============================================================================
-- RPC alur kerja
-- =============================================================================

-- Ubah status laporan dengan validasi transisi & peran.
create or replace function public.ubah_status_laporan(
  p_laporan_id uuid,
  p_status public.status_laporan,
  p_catatan text default null
) returns public.laporan
language plpgsql security definer set search_path = '' as $$
declare
  v_lap public.laporan;
  v_lama public.status_laporan;
  v_peran public.peran_pengguna := public.peran_saya();
  v_admin boolean;
  v_petugas boolean;
  v_boleh boolean;
begin
  if auth.uid() is null then raise exception 'Harus login'; end if;

  select * into v_lap from public.laporan where id = p_laporan_id for update;
  if not found then raise exception 'Laporan tidak ditemukan'; end if;
  v_lama := v_lap.status;

  v_admin := coalesce(v_peran in ('admin_kabupaten', 'admin_provinsi'), false) and public.dalam_cakupan(v_lap.kode_wilayah);
  v_petugas := coalesce(v_peran = 'petugas', false) and v_lap.petugas_id = auth.uid();

  v_boleh := case
    when v_lama = 'baru'         and p_status in ('diverifikasi', 'ditolak') then v_admin
    when v_lama = 'diverifikasi' and p_status in ('ditolak', 'selesai')     then v_admin
    when v_lama = 'ditugaskan'   and p_status = 'ditangani'                 then v_admin or v_petugas
    when v_lama = 'ditugaskan'   and p_status = 'diverifikasi'              then v_admin
    when v_lama = 'ditangani'    and p_status = 'selesai'                   then v_admin or v_petugas
    when v_lama = 'ditolak'      and p_status = 'baru'                      then v_admin
    else false
  end;

  if not coalesce(v_boleh, false) then
    raise exception 'Transisi status % -> % tidak diizinkan untuk pengguna ini', v_lama, p_status;
  end if;
  if p_status = 'ditolak' and length(trim(coalesce(p_catatan, ''))) = 0 then
    raise exception 'Alasan penolakan wajib diisi';
  end if;

  perform set_config('siput.rpc', '1', true);
  update public.laporan
     set status = p_status,
         petugas_id = case when p_status in ('diverifikasi', 'baru') then null else petugas_id end,
         catatan_admin = coalesce(nullif(trim(p_catatan), ''), catatan_admin)
   where id = p_laporan_id
  returning * into v_lap;
  perform set_config('siput.rpc', '', true);

  insert into public.laporan_riwayat (laporan_id, status_lama, status_baru, oleh, catatan)
  values (p_laporan_id, v_lama, p_status, auth.uid(), nullif(trim(p_catatan), ''));

  return v_lap;
end $$;

-- Tugaskan petugas ke laporan (admin dalam cakupan; petugas harus dalam cakupan admin).
create or replace function public.tugaskan_petugas(
  p_laporan_id uuid,
  p_petugas_id uuid,
  p_catatan text default null
) returns public.laporan
language plpgsql security definer set search_path = '' as $$
declare
  v_lap public.laporan;
  v_lama public.status_laporan;
  v_ptg public.profiles;
begin
  if auth.uid() is null then raise exception 'Harus login'; end if;
  if not public.is_admin() then raise exception 'Hanya admin yang dapat menugaskan petugas'; end if;

  select * into v_lap from public.laporan where id = p_laporan_id for update;
  if not found then raise exception 'Laporan tidak ditemukan'; end if;
  if not public.dalam_cakupan(v_lap.kode_wilayah) then raise exception 'Laporan di luar cakupan wilayah Anda'; end if;
  if v_lap.status not in ('diverifikasi', 'ditugaskan') then
    raise exception 'Laporan harus diverifikasi sebelum ditugaskan (status saat ini: %)', v_lap.status;
  end if;

  select * into v_ptg from public.profiles where id = p_petugas_id;
  if not found or v_ptg.role <> 'petugas' then raise exception 'Pengguna yang dipilih bukan petugas'; end if;
  if not public.dalam_cakupan(v_ptg.kode_wilayah) then raise exception 'Petugas di luar cakupan wilayah Anda'; end if;

  v_lama := v_lap.status;
  perform set_config('siput.rpc', '1', true);
  update public.laporan
     set status = 'ditugaskan', petugas_id = p_petugas_id,
         catatan_admin = coalesce(nullif(trim(p_catatan), ''), catatan_admin)
   where id = p_laporan_id
  returning * into v_lap;
  perform set_config('siput.rpc', '', true);

  insert into public.laporan_riwayat (laporan_id, status_lama, status_baru, oleh, catatan)
  values (p_laporan_id, v_lama, 'ditugaskan', auth.uid(),
          coalesce(nullif(trim(p_catatan), ''), 'Ditugaskan ke ' || coalesce(v_ptg.nama_lengkap, v_ptg.email)));

  return v_lap;
end $$;

-- Atur peran & wilayah pengguna.
--   admin_provinsi : semua peran, semua wilayah
--   admin_kabupaten: hanya petani/petugas, wilayah dalam cakupannya
create or replace function public.atur_peran(
  p_user_id uuid,
  p_role public.peran_pengguna,
  p_kode_wilayah text
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_peran public.peran_pengguna := public.peran_saya();
  v_target public.profiles;
begin
  if auth.uid() is null then raise exception 'Harus login'; end if;
  if p_user_id = auth.uid() then raise exception 'Tidak dapat mengubah peran sendiri'; end if;

  select * into v_target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Pengguna tidak ditemukan'; end if;

  if p_kode_wilayah is not null and not exists (select 1 from public.wilayah where kode = p_kode_wilayah) then
    raise exception 'Kode wilayah % tidak ada di master wilayah', p_kode_wilayah;
  end if;
  if p_role <> 'petani' and p_kode_wilayah is null then
    raise exception 'Peran % wajib memiliki kode wilayah', p_role;
  end if;

  if v_peran = 'admin_provinsi' then
    null;
  elsif v_peran = 'admin_kabupaten' then
    if p_role not in ('petani', 'petugas') then raise exception 'Admin kabupaten hanya dapat menetapkan petani/petugas'; end if;
    if v_target.role in ('admin_kabupaten', 'admin_provinsi') then raise exception 'Tidak dapat mengubah akun admin'; end if;
    if v_target.kode_wilayah is not null and not public.dalam_cakupan(v_target.kode_wilayah) then
      raise exception 'Pengguna di luar cakupan wilayah Anda';
    end if;
    if not public.dalam_cakupan(p_kode_wilayah) then raise exception 'Wilayah di luar cakupan Anda'; end if;
  else
    raise exception 'Hanya admin yang dapat mengatur peran';
  end if;

  perform set_config('siput.rpc', '1', true);
  update public.profiles set role = p_role, kode_wilayah = p_kode_wilayah
   where id = p_user_id returning * into v_target;
  perform set_config('siput.rpc', '', true);
  return v_target;
end $$;

-- Cari pengguna berdasarkan email (agar admin kabupaten bisa menemukan akun baru yang belum ber-wilayah).
create or replace function public.cari_pengguna(p_email text)
returns setof public.profiles
language sql stable security definer set search_path = '' as $$
  select p.* from public.profiles p
  where public.is_admin()
    and length(trim(coalesce(p_email, ''))) >= 3
    and p.email ilike '%' || trim(p_email) || '%'
  order by p.email
  limit 20
$$;

-- Posisi terakhir tiap petugas (default 12 jam terakhir), sesuai cakupan admin.
create or replace function public.posisi_terakhir_petugas(p_jam integer default 12)
returns table (
  petugas_id uuid, nama_lengkap text, lat double precision, lng double precision,
  akurasi_m real, laporan_id uuid, direkam_pada timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select distinct on (t.petugas_id)
         t.petugas_id, p.nama_lengkap, t.lat, t.lng, t.akurasi_m, t.laporan_id, t.direkam_pada
  from public.tracking_petugas t
  join public.profiles p on p.id = t.petugas_id
  where t.direkam_pada > now() - make_interval(hours => greatest(1, least(p_jam, 168)))
  order by t.petugas_id, t.direkam_pada desc
$$;

-- Retensi data lokasi (privasi). Jadwalkan via pg_cron bila tersedia:
--   select cron.schedule('hapus-tracking', '0 3 * * *', 'select public.hapus_tracking_lama(30)');
create or replace function public.hapus_tracking_lama(p_hari integer default 30)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.tracking_petugas where direkam_pada < now() - make_interval(days => p_hari);
  get diagnostics n = row_count;
  return n;
end $$;

-- Hak eksekusi fungsi
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.peran_saya(), public.wilayah_saya(), public.dalam_cakupan(text), public.is_admin(),
  public.ubah_status_laporan(uuid, public.status_laporan, text),
  public.tugaskan_petugas(uuid, uuid, text),
  public.atur_peran(uuid, public.peran_pengguna, text),
  public.cari_pengguna(text),
  public.posisi_terakhir_petugas(integer)
to authenticated;
-- hapus_tracking_lama hanya untuk pemilik project / pg_cron (tidak di-grant).

-- =============================================================================
-- Storage: bucket privat 'laporan-opt'
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('laporan-opt', 'laporan-opt', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Upload hanya ke folder {uid}/{laporan_id}/ milik laporan sendiri yang masih 'baru'
create policy "laporan-opt insert pemilik" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'laporan-opt'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.laporan l
      where l.id::text = (storage.foldername(name))[2]
        and l.pelapor_id = auth.uid()
        and l.status = 'baru'
    )
  );

-- Baca: pemilik folder, atau siapa pun yang dapat melihat laporan terkait (RLS laporan berlaku)
create policy "laporan-opt select" on storage.objects for select to authenticated
  using (
    bucket_id = 'laporan-opt'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.laporan l where l.id::text = (storage.foldername(name))[2])
    )
  );

-- Hapus: pemilik folder selama laporan masih 'baru'
create policy "laporan-opt delete pemilik" on storage.objects for delete to authenticated
  using (
    bucket_id = 'laporan-opt'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.laporan l
      where l.id::text = (storage.foldername(name))[2] and l.status = 'baru'
    )
  );

-- =============================================================================
-- Realtime untuk dashboard tracking (RLS tetap berlaku pada postgres_changes)
-- =============================================================================
alter publication supabase_realtime add table public.tracking_petugas;

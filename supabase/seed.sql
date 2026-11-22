-- =============================================================================
-- SIPUT-OPT — Data contoh
-- Jalankan setelah 0001_initial_schema.sql. Aman dijalankan ulang.
-- =============================================================================

-- Wilayah tingkat provinsi & kabupaten/kota Kalimantan Timur (kode Kemendagri).
-- PENTING: verifikasi terhadap Kepmendagri terbaru sebelum produksi.
-- Batas wilayah (geom) sengaja kosong; impor dari sumber resmi berizin (mis. BIG).
insert into public.wilayah (kode, nama, tingkat, kode_induk) values
  ('64',    'Kalimantan Timur',        1, null),
  ('64.01', 'Kabupaten Paser',          2, '64'),
  ('64.02', 'Kabupaten Kutai Kartanegara', 2, '64'),
  ('64.03', 'Kabupaten Berau',          2, '64'),
  ('64.07', 'Kabupaten Kutai Barat',    2, '64'),
  ('64.08', 'Kabupaten Kutai Timur',    2, '64'),
  ('64.09', 'Kabupaten Penajam Paser Utara', 2, '64'),
  ('64.11', 'Kabupaten Mahakam Ulu',    2, '64'),
  ('64.71', 'Kota Balikpapan',          2, '64'),
  ('64.72', 'Kota Samarinda',           2, '64'),
  ('64.74', 'Kota Bontang',             2, '64')
on conflict (kode) do update set nama = excluded.nama, tingkat = excluded.tingkat, kode_induk = excluded.kode_induk;

-- Jenis OPT umum
insert into public.jenis_opt (nama, nama_ilmiah, kategori, komoditas) values
  ('Wereng batang cokelat',     'Nilaparvata lugens',            'hama',     'Padi'),
  ('Penggerek batang padi',     'Scirpophaga incertulas',        'hama',     'Padi'),
  ('Tikus sawah',               'Rattus argentiventer',          'hama',     'Padi'),
  ('Walang sangit',             'Leptocorisa oratorius',         'hama',     'Padi'),
  ('Blas',                      'Pyricularia oryzae',            'penyakit', 'Padi'),
  ('Hawar daun bakteri',        'Xanthomonas oryzae pv. oryzae', 'penyakit', 'Padi'),
  ('Tungro',                    'Rice tungro virus',             'penyakit', 'Padi'),
  ('Ulat grayak jagung',        'Spodoptera frugiperda',         'hama',     'Jagung'),
  ('Bulai',                     'Peronosclerospora maydis',      'penyakit', 'Jagung'),
  ('Kumbang tanduk',            'Oryctes rhinoceros',            'hama',     'Kelapa sawit'),
  ('Busuk pangkal batang',      'Ganoderma boninense',           'penyakit', 'Kelapa sawit'),
  ('Lalat buah',                'Bactrocera spp.',               'hama',     'Hortikultura'),
  ('Antraknosa',                'Colletotrichum spp.',           'penyakit', 'Cabai')
on conflict (nama) do nothing;

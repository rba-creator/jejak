# SIPUT-OPT Starter Project

Starter PWA untuk pelaporan dan pemetaan serangan Organisme Pengganggu Tumbuhan (OPT). Aplikasi berdiri sendiri pada tahap awal; skema dapat dikembangkan untuk integrasi dengan SIPUT-KALTIM di masa mendatang.

## Stack
- React + Vite + TypeScript
- Leaflet / React Leaflet
- Supabase Auth, PostgreSQL, PostGIS, Storage
- vite-plugin-pwa + IndexedDB untuk draft offline
- Cloudflare Pages + GitHub

## 1. Persiapan lokal

Prasyarat: Node.js 22 LTS (lihat `.nvmrc`, minimal Node 20) dan npm.

```bash
npm install
cp .env.example .env.local
```

Isi `.env.local` dengan Supabase Project URL dan publishable key. Jangan pernah memasukkan `service_role` key ke frontend atau Git.

Jalankan:

```bash
npm run dev       # http://localhost:5173 (hanya lokal)
npm run dev:lan   # HTTPS self-signed + terbuka ke LAN, untuk uji GPS dari HP
```

Geolocation API hanya berjalan di HTTPS atau `localhost`. Untuk menguji dari HP, pakai `npm run dev:lan`, buka `https://IP-LAPTOP:5173` di HP, lalu terima peringatan sertifikat self-signed.

Kualitas kode & build:

```bash
npm run lint          # ESLint
npm run format        # Prettier
npm run typecheck
npm run test          # Vitest (file *.test.ts / *.spec.ts di src/)
npm run build
npm run preview
npm run check         # lint + typecheck + test + build sekaligus
```

CI GitHub Actions (`.github/workflows/ci.yml`) menjalankan langkah yang sama pada setiap push/PR.

### Ikon PWA

Ikon PNG (`pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`) dibuat otomatis dari `public/favicon.svg` oleh `vite-plugin-pwa` (`pwaAssets`) saat dev/build, lalu disuntikkan ke manifest dan `<head>`. Gunakan SVG persegi dengan margin cukup agar ikon maskable tidak terpotong. File lama `pwa-192.svg`/`pwa-512.svg` tidak lagi dipakai.

### Leaflet

Import `src/lib/leaflet-icon-fix.ts` sekali di `src/main.tsx` setelah `leaflet/dist/leaflet.css` agar ikon marker default tidak rusak setelah build. Akses env melalui `src/lib/env.ts` (tervalidasi dan bertipe).

## 2. Supabase

1. Buat project baru di Supabase.
2. Buka SQL Editor dan jalankan `supabase/migrations/0001_initial_schema.sql`.
3. Jalankan `supabase/seed.sql` jika ingin memasukkan contoh jenis OPT.
4. Migration membuat bucket `laporan-opt` sebagai private dan menambahkan kebijakan dasar Storage untuk upload pemilik laporan serta pembacaan melalui relasi laporan.
5. Aktifkan email/password di Authentication.
6. Atur URL aplikasi pada Authentication > URL Configuration setelah domain Pages tersedia.
7. Buat akun admin dan petugas melalui Authentication. Trigger otomatis membuat profil awal ber-role `petani`. Ubah role melalui SQL Editor sebagai pemilik project, setelah verifikasi identitas dan kode wilayah.

Contoh menaikkan akun menjadi admin provinsi (ganti UUID dengan user yang benar):

```sql
update public.profiles
set role = 'admin_provinsi', kode_wilayah = '64'
where id = 'UUID-AKUN-ADMIN';
```

Contoh admin kabupaten (kode wilayah harus mengikuti master wilayah resmi):

```sql
update public.profiles
set role = 'admin_kabupaten', kode_wilayah = 'KODE-KABUPATEN'
where id = 'UUID-AKUN-ADMIN-KABUPATEN';
```

**Penting:** SQL migration ini adalah baseline awal, bukan audit keamanan final. Sebelum produksi, lakukan review RLS per operasi dan role, uji dengan akun petani/petugas/admin yang berbeda, tambahkan validasi perubahan status dan penugasan melalui RPC, serta uji `supabase test db`. RLS tidak menggantikan kebijakan Storage. Data batas wilayah belum diisi; impor dari sumber resmi yang berizin dan gunakan kode wilayah resmi.

## 3. Peta Rupa Bumi Indonesia (RBI)

Komponen peta memakai Leaflet. Layer konteks OpenStreetMap ditampilkan sebagai fallback selama layer RBI belum dikonfigurasi. **OSM bukan peta RBI.**

Piksel BIG menyediakan layanan OGC WMS/WMTS/WCS. Periksa GetCapabilities dan ketentuan penggunaan terlebih dahulu untuk mendapatkan nama layer RBI yang tepat:
- https://piksel.big.go.id/docs/services/web-services/
- https://piksel.big.go.id/docs/services/web-services/service-types/
- WMS endpoint: https://ows.piksel.big.go.id/wms

Setelah memastikan layer RBI tersedia, isi:

```env
VITE_RBI_WMS_URL=https://ows.piksel.big.go.id/wms
VITE_RBI_WMS_LAYERS=NAMA_LAYER_DARI_GETCAPABILITIES
VITE_RBI_WMS_FORMAT=image/png
VITE_RBI_WMS_TRANSPARENT=true
```

Nama layer sengaja tidak ditebak atau di-hardcode. Cek kompatibilitas WMS version/CRS (Leaflet default EPSG:3857). Tile WMS dimuat sebagai `<img>` sehingga tidak memerlukan CORS, kecuali tile akan dibaca lewat canvas. Bila BIG menyediakan WMTS yang sesuai, gunakan tile matrix dan URL template yang didokumentasikan.

Service worker meng-cache tile RBI dan OSM yang **sudah pernah dilihat** (RBI maks. 1000 tile/30 hari, OSM maks. 300 tile/7 hari) agar peta tetap tampil saat sinyal hilang. Tidak ada prefetch massal; ini sesuai OSM Tile Usage Policy. Request Supabase tidak di-cache.

## 4. GitHub

```bash
git init
git add .
git commit -m "chore: initial SIPUT-OPT PWA starter"
git branch -M main
git remote add origin https://github.com/USERNAME/siput-opt.git
git push -u origin main
```

Jangan commit `.env.local`. Pastikan `.gitignore` tetap aktif.

## 5. Cloudflare Pages

1. Buka Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git.
2. Pilih repository `siput-opt`.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Build output directory: `dist`.
6. Tambahkan environment variables untuk Production dan Preview:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (publishable key)
   - `VITE_RBI_WMS_URL`
   - `VITE_RBI_WMS_LAYERS`
   - `VITE_RBI_WMS_FORMAT`
   - `VITE_RBI_WMS_TRANSPARENT`
7. Deploy. Cloudflare akan memberikan alamat `*.pages.dev`.
8. Tambahkan alamat Pages ke Supabase Authentication > URL Configuration > Site URL dan Redirect URLs.

Vite SPA fallback perlu dipastikan untuk route client-side. Cloudflare Pages secara default mendukung SPA fallback jika tidak ada `404.html` di root output. Uji refresh langsung pada `/laporan` dan `/peta`.

Versi Node dibaca dari `.nvmrc`. Header keamanan (CSP, HSTS, `Permissions-Policy: geolocation=(self)`, dsb.) dan cache-control diatur di `public/_headers`. Bila memakai domain Supabase kustom atau sumber tile lain, tambahkan domainnya ke `img-src`/`connect-src` pada CSP. Setelah deploy, periksa tab Console browser untuk pelanggaran CSP.

## 6. Fitur GPS

- Geolocation API memerlukan HTTPS (localhost diperbolehkan untuk pengembangan).
- Pengguna harus memberi izin lokasi.
- Akurasi GPS bervariasi berdasarkan perangkat dan kondisi lapangan.
- Aplikasi menyimpan koordinat, akurasi, dan waktu pengambilan.
- Pin dapat dikoreksi manual; untuk produksi sebaiknya simpan koordinat GPS asli dan koordinat final yang dikonfirmasi secara terpisah.

## 7. Batasan starter yang diketahui

Starter ini memberikan kerangka login, profil, form laporan, upload foto, peta fokus, dan penyimpanan draft offline. Hal berikut masih harus diselesaikan sebelum operasional:
- UI admin untuk verifikasi, penugasan, dan pengelolaan master data.
- Marker cluster dan semua titik laporan pada peta.
- Live tracking: watchPosition saat halaman petugas aktif, insert berkala ke `tracking_petugas`, Realtime subscription untuk dashboard, dan tombol mulai/berhenti. Browser PWA tidak menjamin GPS berjalan di background saat aplikasi ditutup.
- Review dan pengujian kebijakan Storage per role (baseline upload/baca sudah dibuat oleh migration; belum diaudit).
- Import kode dan batas administrasi resmi.
- Validasi status dan penugasan melalui RPC.
- Pengujian keamanan dan fungsional lintas perangkat.
- Sinkronisasi draft offline termasuk berkas foto dan konflik data.

## 8. Catatan privasi

Live tracking harus aktif hanya selama penugasan dan setelah petugas diberi informasi serta menyetujui pelacakan. Terapkan retensi data, pembatasan akses, dan audit akses lokasi. Hindari mengirim koordinat lebih sering dari kebutuhan operasional.

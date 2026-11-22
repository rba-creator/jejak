export type Peran = 'petani' | 'petugas' | 'admin_kabupaten' | 'admin_provinsi'
export type StatusLaporan = 'baru' | 'diverifikasi' | 'ditugaskan' | 'ditangani' | 'selesai' | 'ditolak'
export type TingkatSerangan = 'ringan' | 'sedang' | 'berat' | 'puso'

export interface Profil {
  id: string
  email: string | null
  nama_lengkap: string | null
  no_hp: string | null
  role: Peran
  kode_wilayah: string | null
  created_at: string
}

export interface Wilayah {
  kode: string
  nama: string
  tingkat: number
  kode_induk: string | null
}

export interface JenisOpt {
  id: number
  nama: string
  nama_ilmiah: string | null
  kategori: 'hama' | 'penyakit' | 'gulma' | 'lainnya'
  komoditas: string | null
  aktif: boolean
}

/** Data yang diisi pelapor (dipakai juga untuk draft offline). */
export interface LaporanInput {
  client_id: string
  jenis_opt_id: number | null
  jenis_opt_lain: string | null
  komoditas: string
  tingkat: TingkatSerangan
  luas_serangan_ha: number | null
  luas_tanam_ha: number | null
  deskripsi: string | null
  alamat: string | null
  lat: number
  lng: number
  gps_lat: number | null
  gps_lng: number | null
  gps_akurasi_m: number | null
  gps_diambil_pada: string | null
  diamati_pada: string
}

export interface Laporan extends Omit<LaporanInput, 'client_id'> {
  id: string
  client_id: string
  pelapor_id: string
  kode_wilayah: string | null
  status: StatusLaporan
  petugas_id: string | null
  catatan_admin: string | null
  created_at: string
  updated_at: string
  jenis_opt?: Pick<JenisOpt, 'nama' | 'nama_ilmiah'> | null
  pelapor?: Pick<Profil, 'nama_lengkap' | 'no_hp'> | null
  petugas?: Pick<Profil, 'nama_lengkap' | 'no_hp'> | null
}

export interface RiwayatLaporan {
  id: number
  laporan_id: string
  status_lama: StatusLaporan | null
  status_baru: StatusLaporan
  catatan: string | null
  created_at: string
  oleh_profil?: Pick<Profil, 'nama_lengkap'> | null
}

export interface PosisiPetugas {
  petugas_id: string
  nama_lengkap: string | null
  lat: number
  lng: number
  akurasi_m: number | null
  laporan_id: string | null
  direkam_pada: string
}

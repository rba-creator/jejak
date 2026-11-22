import type { Peran, StatusLaporan, TingkatSerangan } from './types'

export const LABEL_STATUS: Record<StatusLaporan, string> = {
  baru: 'Baru',
  diverifikasi: 'Diverifikasi',
  ditugaskan: 'Ditugaskan',
  ditangani: 'Ditangani',
  selesai: 'Selesai',
  ditolak: 'Ditolak'
}

export const WARNA_STATUS: Record<StatusLaporan, string> = {
  baru: 'bg-sky-100 text-sky-800',
  diverifikasi: 'bg-indigo-100 text-indigo-800',
  ditugaskan: 'bg-amber-100 text-amber-800',
  ditangani: 'bg-orange-100 text-orange-800',
  selesai: 'bg-green-100 text-green-800',
  ditolak: 'bg-slate-200 text-slate-700'
}

export const LABEL_TINGKAT: Record<TingkatSerangan, string> = {
  ringan: 'Ringan',
  sedang: 'Sedang',
  berat: 'Berat',
  puso: 'Puso'
}

/** Warna hex untuk marker peta berdasarkan tingkat serangan. */
export const HEX_TINGKAT: Record<TingkatSerangan, string> = {
  ringan: '#16a34a',
  sedang: '#eab308',
  berat: '#ea580c',
  puso: '#b91c1c'
}

export const LABEL_PERAN: Record<Peran, string> = {
  petani: 'Petani',
  petugas: 'Petugas POPT',
  admin_kabupaten: 'Admin Kabupaten/Kota',
  admin_provinsi: 'Admin Provinsi'
}

export const isAdmin = (p: Peran | undefined | null) => p === 'admin_kabupaten' || p === 'admin_provinsi'

export type Aksi = { ke: StatusLaporan; label: string; perluCatatan?: boolean; tugaskan?: boolean }

/**
 * Aksi yang tersedia untuk peran pada status tertentu.
 * HARUS selaras dengan RPC ubah_status_laporan / tugaskan_petugas di database
 * (server tetap menjadi penentu akhir; ini hanya untuk UI).
 */
export function aksiTersedia(status: StatusLaporan, peran: Peran, ditugaskanKeSaya: boolean): Aksi[] {
  const admin = isAdmin(peran)
  const petugas = peran === 'petugas' && ditugaskanKeSaya
  const out: Aksi[] = []
  switch (status) {
    case 'baru':
      if (admin) out.push({ ke: 'diverifikasi', label: 'Verifikasi' }, { ke: 'ditolak', label: 'Tolak', perluCatatan: true })
      break
    case 'diverifikasi':
      if (admin)
        out.push(
          { ke: 'ditugaskan', label: 'Tugaskan petugas', tugaskan: true },
          { ke: 'selesai', label: 'Tandai selesai' },
          { ke: 'ditolak', label: 'Tolak', perluCatatan: true }
        )
      break
    case 'ditugaskan':
      if (admin || petugas) out.push({ ke: 'ditangani', label: 'Mulai penanganan' })
      if (admin) out.push({ ke: 'ditugaskan', label: 'Ganti petugas', tugaskan: true }, { ke: 'diverifikasi', label: 'Batalkan penugasan' })
      break
    case 'ditangani':
      if (admin || petugas) out.push({ ke: 'selesai', label: 'Tandai selesai' })
      break
    case 'ditolak':
      if (admin) out.push({ ke: 'baru', label: 'Buka kembali' })
      break
    case 'selesai':
      break
  }
  return out
}

import { describe, expect, it } from 'vitest'
import { aksiTersedia } from './status'

const tujuan = (...a: Parameters<typeof aksiTersedia>) => aksiTersedia(...a).map((x) => x.ke)

describe('aksiTersedia', () => {
  it('petani tidak punya aksi alur kerja', () => {
    for (const s of ['baru', 'diverifikasi', 'ditugaskan', 'ditangani', 'selesai', 'ditolak'] as const) {
      expect(aksiTersedia(s, 'petani', false)).toEqual([])
    }
  })

  it('admin memverifikasi atau menolak laporan baru', () => {
    expect(tujuan('baru', 'admin_kabupaten', false)).toEqual(['diverifikasi', 'ditolak'])
  })

  it('penolakan wajib catatan', () => {
    expect(aksiTersedia('baru', 'admin_provinsi', false).find((a) => a.ke === 'ditolak')?.perluCatatan).toBe(true)
  })

  it('petugas hanya dapat bertindak bila ditugaskan kepadanya', () => {
    expect(tujuan('ditugaskan', 'petugas', false)).toEqual([])
    expect(tujuan('ditugaskan', 'petugas', true)).toEqual(['ditangani'])
    expect(tujuan('ditangani', 'petugas', true)).toEqual(['selesai'])
  })

  it('laporan selesai bersifat final', () => {
    expect(aksiTersedia('selesai', 'admin_provinsi', false)).toEqual([])
  })
})

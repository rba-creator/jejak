import { supabase } from './supabase'
import type { JenisOpt, Wilayah } from './types'

/**
 * Master data di-cache di localStorage agar form laporan tetap bisa diisi offline.
 */
async function denganCache<T>(kunci: string, ambil: () => Promise<T>): Promise<T> {
  try {
    const data = await ambil()
    localStorage.setItem(kunci, JSON.stringify(data))
    return data
  } catch (e) {
    const c = localStorage.getItem(kunci)
    if (c) return JSON.parse(c) as T
    throw e
  }
}

export function muatJenisOpt(): Promise<JenisOpt[]> {
  return denganCache('siput:jenis_opt', async () => {
    const { data, error } = await supabase
      .from('jenis_opt')
      .select('id, nama, nama_ilmiah, kategori, komoditas, aktif')
      .eq('aktif', true)
      .order('komoditas')
      .order('nama')
    if (error) throw error
    return data as JenisOpt[]
  })
}

export function muatWilayah(): Promise<Wilayah[]> {
  return denganCache('siput:wilayah', async () => {
    const { data, error } = await supabase
      .from('wilayah')
      .select('kode, nama, tingkat, kode_induk')
      .lte('tingkat', 2)
      .order('kode')
    if (error) throw error
    return data as Wilayah[]
  })
}

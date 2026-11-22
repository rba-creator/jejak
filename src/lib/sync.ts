import { BUCKET_FOTO, isNetworkError, pesanError, supabase } from './supabase'
import { daftarDraft, hapusDraft, simpanDraft, tandaiGagal, umumkanDraftBerubah } from './drafts'
import type { LaporanInput } from './types'

const ekstensi = (b: Blob) => (b.type === 'image/png' ? 'png' : b.type === 'image/webp' ? 'webp' : 'jpg')

/**
 * Kirim laporan + foto ke Supabase secara idempoten:
 * - client_id unik mencegah laporan ganda saat retry/sinkron ulang.
 * - nama berkas foto deterministik ({uid}/{laporan_id}/{index}.ext).
 */
export async function kirimLaporan(input: LaporanInput, fotos: Blob[], userId: string): Promise<string> {
  let laporanId: string

  const ins = await supabase.from('laporan').insert({ ...input, pelapor_id: userId }).select('id').single()
  if (ins.error) {
    if (ins.error.code === '23505') {
      // Sudah pernah terkirim (mis. koneksi putus setelah insert). Ambil id-nya.
      const ada = await supabase.from('laporan').select('id').eq('client_id', input.client_id).single()
      if (ada.error) throw ada.error
      laporanId = ada.data.id
    } else {
      throw ins.error
    }
  } else {
    laporanId = ins.data.id
  }

  for (const [i, foto] of fotos.entries()) {
    const path = `${userId}/${laporanId}/${i}.${ekstensi(foto)}`
    const up = await supabase.storage.from(BUCKET_FOTO).upload(path, foto, {
      contentType: foto.type || 'image/jpeg',
      upsert: false
    })
    if (up.error && !/already exists|Duplicate/i.test(up.error.message)) throw up.error

    const rec = await supabase
      .from('laporan_foto')
      .upsert({ laporan_id: laporanId, storage_path: path }, { onConflict: 'storage_path', ignoreDuplicates: true })
    if (rec.error) throw rec.error
  }

  return laporanId
}

export type HasilKirim = { status: 'terkirim'; id: string } | { status: 'draft'; alasan: string }

/** Coba kirim; bila offline/gagal jaringan, simpan sebagai draft di perangkat. */
export async function kirimAtauSimpanDraft(input: LaporanInput, fotos: Blob[], userId: string): Promise<HasilKirim> {
  if (navigator.onLine) {
    try {
      const id = await kirimLaporan(input, fotos, userId)
      return { status: 'terkirim', id }
    } catch (e) {
      if (!isNetworkError(e)) throw e
    }
  }
  await simpanDraft({ client_id: input.client_id, user_id: userId, data: input, fotos, last_error: null })
  umumkanDraftBerubah()
  return { status: 'draft', alasan: 'Tidak ada koneksi. Laporan disimpan di perangkat dan akan dikirim otomatis saat online.' }
}

let sedangSinkron = false

/** Kirim semua draft milik pengguna. Mengembalikan jumlah yang berhasil. */
export async function sinkronDraft(userId: string): Promise<{ berhasil: number; gagal: number }> {
  if (sedangSinkron || !navigator.onLine) return { berhasil: 0, gagal: 0 }
  sedangSinkron = true
  let berhasil = 0
  let gagal = 0
  try {
    for (const d of await daftarDraft(userId)) {
      try {
        await kirimLaporan(d.data, d.fotos, userId)
        await hapusDraft(d.client_id)
        berhasil++
      } catch (e) {
        gagal++
        await tandaiGagal(d.client_id, pesanError(e))
        if (isNetworkError(e)) break
      }
    }
  } finally {
    sedangSinkron = false
    if (berhasil || gagal) umumkanDraftBerubah()
  }
  return { berhasil, gagal }
}

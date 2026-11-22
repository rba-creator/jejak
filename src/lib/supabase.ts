import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Bila env kosong, gunakan placeholder agar import tidak crash;
// App menampilkan layar konfigurasi (lihat configError).
export const supabase = createClient(
  env.supabaseUrl || 'https://placeholder.supabase.co',
  env.supabaseAnonKey || 'placeholder',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }
)

export const BUCKET_FOTO = 'laporan-opt'

/** Ambil pesan error yang ramah dari error Supabase/JS. */
export function pesanError(e: unknown): string {
  if (!e) return 'Terjadi kesalahan'
  if (typeof e === 'string') return e
  if (typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
    const m = e.message
    if (m.includes('Invalid login credentials')) return 'Email atau kata sandi salah'
    if (m.includes('Email not confirmed')) return 'Email belum dikonfirmasi. Periksa kotak masuk Anda.'
    if (m.includes('Failed to fetch')) return 'Tidak dapat terhubung ke server. Periksa koneksi internet.'
    return m
  }
  return 'Terjadi kesalahan'
}

/** True bila error disebabkan jaringan (offline / server tak terjangkau). */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const m = typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e)
  return /Failed to fetch|NetworkError|Load failed|network/i.test(m)
}

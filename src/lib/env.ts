/**
 * Akses env terpusat dengan validasi. Tidak melempar error saat import agar
 * aplikasi dapat menampilkan layar "konfigurasi belum lengkap" yang jelas.
 */
const isPlaceholder = (v: string | undefined) =>
  !v || v.includes('PROJECT_REF') || v.startsWith('YOUR_')

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  rbi: {
    url: import.meta.env.VITE_RBI_WMS_URL || '',
    layers: import.meta.env.VITE_RBI_WMS_LAYERS || '',
    format: import.meta.env.VITE_RBI_WMS_FORMAT || 'image/png',
    transparent: (import.meta.env.VITE_RBI_WMS_TRANSPARENT ?? 'true') === 'true'
  }
} as const

/** Pesan error konfigurasi, atau null bila lengkap. */
export const configError: string | null =
  isPlaceholder(env.supabaseUrl) || isPlaceholder(env.supabaseAnonKey)
    ? 'VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diisi. Salin .env.example ke .env.local (lokal) atau isi Environment Variables di Cloudflare Pages.'
    : null

/** RBI aktif hanya bila URL dan nama layer sudah dikonfigurasi. */
export const isRbiConfigured = Boolean(env.rbi.url && env.rbi.layers)

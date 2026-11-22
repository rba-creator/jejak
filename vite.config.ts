/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

/** Escape string agar aman dipakai di RegExp. */
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Origin dari URL env, atau null bila kosong/tidak valid. */
const originOf = (url: string | undefined): string | null => {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv juga membaca process.env (mis. env var Cloudflare Pages).
  const env = loadEnv(mode, '.', 'VITE_')
  const rbiOrigin = originOf(env.VITE_RBI_WMS_URL)

  // `npm run dev:lan` -> HTTPS self-signed + expose ke LAN, agar Geolocation
  // API dapat diuji dari HP (Geolocation hanya berjalan di HTTPS/localhost).
  const isLan = mode === 'lan'

  const plugins: PluginOption[] = [
    react(),
    tailwindcss(),
    isLan && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      // Ikon PNG (192/512/maskable/apple-touch/favicon.ico) di-generate otomatis
      // dari public/favicon.svg saat dev & build, lalu disuntikkan ke manifest
      // dan <head> index.html.
      pwaAssets: {
        image: 'public/favicon.svg',
        preset: 'minimal-2023',
        overrideManifestIcons: true,
        includeHtmlHeadLinks: true,
        injectThemeColor: false
      },
      manifest: {
        name: 'SIPUT-OPT',
        short_name: 'SIPUT-OPT',
        description: 'Pelaporan dan pemetaan serangan Organisme Pengganggu Tumbuhan',
        lang: 'id',
        theme_color: '#14532d',
        background_color: '#f8fafc',
        display: 'standalone',
        // 'any' agar peta bisa dilihat landscape.
        orientation: 'any',
        start_url: '/',
        scope: '/'
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2,webmanifest}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Tile RBI (BIG/Piksel): cache tile yang sudah pernah dilihat agar
          // tetap tampil saat sinyal hilang di lapangan. Tidak ada prefetch massal.
          ...(rbiOrigin
            ? [
                {
                  urlPattern: new RegExp(`^${escapeRegExp(rbiOrigin)}/.*`, 'i'),
                  handler: 'CacheFirst' as const,
                  options: {
                    cacheName: 'rbi-tiles',
                    expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 30 },
                    cacheableResponse: { statuses: [0, 200] }
                  }
                }
              ]
            : []),
          // Tile OSM (fallback): hanya tile yang dilihat pengguna, jumlah dibatasi,
          // sesuai OSM Tile Usage Policy (dilarang bulk download/prefetch).
          {
            urlPattern: /^https:\/\/([abc]\.)?tile\.openstreetmap\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
          // Catatan: request Supabase sengaja TIDAK di-cache (data & auth harus fresh;
          // offline ditangani oleh draft IndexedDB).
        ]
      }
    })
  ]

  return {
    plugins,
    server: isLan ? { host: '0.0.0.0' } : undefined,
    test: {
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      passWithNoTests: true
    }
  }
})

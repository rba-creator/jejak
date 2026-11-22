/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_RBI_WMS_URL?: string
  readonly VITE_RBI_WMS_LAYERS?: string
  readonly VITE_RBI_WMS_FORMAT?: string
  readonly VITE_RBI_WMS_TRANSPARENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

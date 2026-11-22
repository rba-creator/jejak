import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { LaporanInput } from './types'

/** Draft laporan yang disimpan di perangkat (offline / gagal kirim). */
export interface Draft {
  client_id: string
  user_id: string
  data: LaporanInput
  fotos: Blob[]
  created_at: string
  updated_at: string
  last_error: string | null
}

interface JejakDB extends DBSchema {
  drafts: {
    key: string
    value: Draft
    indexes: { by_user: string }
  }
}

let dbPromise: Promise<IDBPDatabase<JejakDB>> | null = null

function db() {
  dbPromise ??= openDB<JejakDB>('jejak-opt', 1, {
    upgrade(d) {
      const s = d.createObjectStore('drafts', { keyPath: 'client_id' })
      s.createIndex('by_user', 'user_id')
    }
  })
  return dbPromise
}

export async function simpanDraft(d: Omit<Draft, 'created_at' | 'updated_at'> & { created_at?: string }) {
  const now = new Date().toISOString()
  await (await db()).put('drafts', { ...d, created_at: d.created_at ?? now, updated_at: now })
}

export async function daftarDraft(userId: string): Promise<Draft[]> {
  const all = await (await db()).getAllFromIndex('drafts', 'by_user', userId)
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function hapusDraft(clientId: string) {
  await (await db()).delete('drafts', clientId)
}

export async function tandaiGagal(clientId: string, pesan: string) {
  const d = await db()
  const draft = await d.get('drafts', clientId)
  if (draft) await d.put('drafts', { ...draft, last_error: pesan, updated_at: new Date().toISOString() })
}

/** Beri tahu komponen lain bahwa daftar draft berubah. */
export const EVENT_DRAFT = 'jejak:drafts-changed'
export const umumkanDraftBerubah = () => window.dispatchEvent(new Event(EVENT_DRAFT))

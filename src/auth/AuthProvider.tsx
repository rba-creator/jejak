import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { sinkronDraft } from '../lib/sync'
import type { Profil } from '../lib/types'
import { AuthContext, type AuthState } from './context'

const KUNCI_PROFIL = 'siput:profil'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profil, setProfil] = useState<Profil | null>(null)
  const [loading, setLoading] = useState(true)

  const muatProfil = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfil(null)
      localStorage.removeItem(KUNCI_PROFIL)
      return
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
    if (!error && data) {
      setProfil(data as Profil)
      localStorage.setItem(KUNCI_PROFIL, JSON.stringify(data))
    } else {
      // Offline: pakai profil terakhir yang tersimpan
      const c = localStorage.getItem(KUNCI_PROFIL)
      const cached = c ? (JSON.parse(c) as Profil) : null
      setProfil(cached?.id === s.user.id ? cached : null)
    }
  }, [])

  useEffect(() => {
    let aktif = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!aktif) return
      setSession(data.session)
      await muatProfil(data.session)
      if (aktif) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Ditunda agar tidak memanggil Supabase di dalam callback auth (hindari deadlock).
        setTimeout(() => void muatProfil(s), 0)
      }
    })
    return () => {
      aktif = false
      sub.subscription.unsubscribe()
    }
  }, [muatProfil])

  // Sinkron draft offline saat login dan setiap kali kembali online.
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    const jalankan = () => void sinkronDraft(userId)
    jalankan()
    window.addEventListener('online', jalankan)
    return () => window.removeEventListener('online', jalankan)
  }, [userId])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profil,
      loading,
      muatUlangProfil: () => muatProfil(session),
      keluar: async () => {
        await supabase.auth.signOut()
      }
    }),
    [session, profil, loading, muatProfil]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

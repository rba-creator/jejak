import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profil } from '../lib/types'

export interface AuthState {
  session: Session | null
  profil: Profil | null
  loading: boolean
  muatUlangProfil: () => Promise<void>
  keluar: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}

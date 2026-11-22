import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context'
import type { Peran } from '../lib/types'
import { Memuat } from '../components/ui'

export function RequireAuth({ children, peran }: { children: ReactNode; peran?: Peran[] }) {
  const { session, profil, loading } = useAuth()
  const loc = useLocation()

  if (loading) return <Memuat teks="Memeriksa sesi…" />
  if (!session) return <Navigate to="/login" replace state={{ dari: loc.pathname }} />
  if (peran) {
    if (!profil) return <Memuat teks="Memuat profil…" />
    if (!peran.includes(profil.role)) {
      return (
        <div className="p-6 text-center text-slate-600">
          <p className="font-semibold">Akses ditolak</p>
          <p className="text-sm">Halaman ini tidak tersedia untuk peran Anda.</p>
        </div>
      )
    }
  }
  return <>{children}</>
}

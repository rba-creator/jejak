import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilePlus2, Map as MapIcon, CloudOff } from 'lucide-react'
import { useAuth } from '../auth/context'
import { supabase } from '../lib/supabase'
import { daftarDraft, EVENT_DRAFT } from '../lib/drafts'
import { LABEL_STATUS, LABEL_PERAN } from '../lib/status'
import type { StatusLaporan } from '../lib/types'
import { Kartu, Pesan } from '../components/ui'

const STATUS: StatusLaporan[] = ['baru', 'diverifikasi', 'ditugaskan', 'ditangani', 'selesai', 'ditolak']

export function BerandaPage() {
  const { profil, session } = useAuth()
  const [jumlah, setJumlah] = useState<Partial<Record<StatusLaporan, number>>>({})
  const [jumlahDraft, setJumlahDraft] = useState(0)
  const userId = session?.user.id

  useEffect(() => {
    let aktif = true
    Promise.all(
      STATUS.map(async (s) => {
        const { count } = await supabase.from('laporan').select('id', { count: 'exact', head: true }).eq('status', s)
        return [s, count ?? 0] as const
      })
    )
      .then((hasil) => aktif && setJumlah(Object.fromEntries(hasil)))
      .catch(() => {})
    return () => {
      aktif = false
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    const muat = () => void daftarDraft(userId).then((d) => setJumlahDraft(d.length))
    muat()
    window.addEventListener(EVENT_DRAFT, muat)
    return () => window.removeEventListener(EVENT_DRAFT, muat)
  }, [userId])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Halo, {profil?.nama_lengkap || 'Pengguna'}</h1>
        <p className="text-sm text-slate-500">{profil ? LABEL_PERAN[profil.role] : ''}</p>
      </div>

      {profil && profil.role !== 'petani' && !profil.kode_wilayah && (
        <Pesan jenis="peringatan">Akun Anda belum memiliki kode wilayah. Hubungi admin provinsi.</Pesan>
      )}

      {jumlahDraft > 0 && (
        <Link to="/laporan">
          <Pesan jenis="peringatan">
            <span className="inline-flex items-center gap-2">
              <CloudOff className="h-4 w-4" aria-hidden /> {jumlahDraft} laporan menunggu dikirim (draft offline)
            </span>
          </Pesan>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to="/laporan/baru" className="rounded-xl bg-green-800 p-4 text-white shadow hover:bg-green-900">
          <FilePlus2 className="mb-2 h-7 w-7" aria-hidden />
          <span className="font-semibold">Buat laporan</span>
          <span className="block text-xs text-green-100">Laporkan serangan OPT</span>
        </Link>
        <Link to="/peta" className="rounded-xl bg-white p-4 text-slate-800 shadow hover:bg-slate-50">
          <MapIcon className="mb-2 h-7 w-7 text-green-800" aria-hidden />
          <span className="font-semibold">Peta serangan</span>
          <span className="block text-xs text-slate-500">Sebaran laporan</span>
        </Link>
      </div>

      <Kartu>
        <h2 className="mb-3 font-semibold text-slate-800">
          {profil?.role === 'petani' ? 'Laporan saya' : 'Laporan dalam cakupan Anda'}
        </h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          {STATUS.map((s) => (
            <Link key={s} to={`/laporan?status=${s}`} className="rounded-lg bg-slate-50 p-2 hover:bg-slate-100">
              <div className="text-xl font-bold text-slate-900">{jumlah[s] ?? '–'}</div>
              <div className="text-xs text-slate-500">{LABEL_STATUS[s]}</div>
            </Link>
          ))}
        </div>
      </Kartu>
    </div>
  )
}

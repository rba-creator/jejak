import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CloudUpload, Filter, RefreshCw, Trash2, ChevronRight, AlertCircle, Calendar } from 'lucide-react'
import { useAuth } from '../auth/context'
import { supabase, pesanError } from '../lib/supabase'
import { daftarDraft, hapusDraft, umumkanDraftBerubah, EVENT_DRAFT, type Draft } from '../lib/drafts'
import { sinkronDraft } from '../lib/sync'
import { formatTanggal, formatHa } from '../lib/format'
import { LABEL_STATUS } from '../lib/status'
import type { Laporan, StatusLaporan } from '../lib/types'
import { BadgeStatus, BadgeTingkat, Kartu, Memuat, Pesan, Tombol } from '../components/ui'

const DAFTAR_STATUS: (StatusLaporan | 'semua')[] = [
  'semua',
  'baru',
  'diverifikasi',
  'ditugaskan',
  'ditangani',
  'selesai',
  'ditolak'
]

export function DaftarLaporanPage() {
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterStatus = (searchParams.get('status') as StatusLaporan | null) || 'semua'

  const [laporan, setLaporan] = useState<Laporan[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [memuat, setMemuat] = useState(true)
  const [sinkronMemuat, setSinkronMemuat] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userId = session?.user?.id

  const muatData = useCallback(async () => {
    setError(null)
    setMemuat(true)
    try {
      let q = supabase
        .from('laporan')
        .select(`
          id, client_id, pelapor_id, komoditas, tingkat, luas_serangan_ha, luas_tanam_ha,
          lat, lng, kode_wilayah, status, petugas_id, diamati_pada, created_at, updated_at,
          jenis_opt:jenis_opt_id (nama, nama_ilmiah),
          jenis_opt_lain
        `)
        .order('created_at', { ascending: false })

      if (filterStatus !== 'semua') {
        q = q.eq('status', filterStatus)
      }

      const { data, error: err } = await q
      if (err) throw err
      setLaporan((data as unknown as Laporan[]) || [])
    } catch (e) {
      setError(pesanError(e))
    } finally {
      setMemuat(false)
    }
  }, [filterStatus])

  const muatDraft = useCallback(async () => {
    if (!userId) return
    const d = await daftarDraft(userId)
    setDrafts(d)
  }, [userId])

  useEffect(() => {
    muatData()
  }, [muatData])

  useEffect(() => {
    muatDraft()
    window.addEventListener(EVENT_DRAFT, muatDraft)
    return () => window.removeEventListener(EVENT_DRAFT, muatDraft)
  }, [muatDraft])

  async function handleSinkron() {
    if (!userId) return
    setSinkronMemuat(true)
    try {
      const res = await sinkronDraft(userId)
      if (res.berhasil > 0) {
        await muatData()
      }
    } finally {
      setSinkronMemuat(false)
      await muatDraft()
    }
  }

  async function handleHapusDraft(clientId: string) {
    if (confirm('Hapus draft laporan offline ini?')) {
      await hapusDraft(clientId)
      umumkanDraftBerubah()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Daftar Laporan OPT</h1>
        <button
          onClick={() => {
            muatData()
            muatDraft()
          }}
          disabled={memuat}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          title="Segarkan data"
        >
          <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Bagian Draft Offline jika ada */}
      {drafts.length > 0 && (
        <Kartu className="border-amber-300 bg-amber-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>{drafts.length} Draft Tersimpan di Perangkat (Offline)</span>
            </div>
            <Tombol varian="utama" memuat={sinkronMemuat} onClick={handleSinkron} className="py-1 px-3 text-xs">
              <CloudUpload className="h-3.5 w-3.5 mr-1" />
              Kirim Semua
            </Tombol>
          </div>
          <p className="text-xs text-amber-800">
            Laporan berikut belum terkirim ke server karena ketiadaan koneksi saat pengisian.
          </p>

          <div className="space-y-2">
            {drafts.map((d) => (
              <div
                key={d.client_id}
                className="flex items-center justify-between rounded-lg bg-white p-2.5 text-xs shadow-sm border border-amber-200"
              >
                <div>
                  <span className="font-semibold text-slate-900">{d.data.komoditas}</span> —{' '}
                  <span className="text-slate-600">{d.data.jenis_opt_lain || 'OPT Pilihan'}</span>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Dibuat {formatTanggal(d.created_at)} • {d.fotos.length} foto
                  </div>
                  {d.last_error && <p className="text-[11px] text-red-600 mt-1">Gagal kirim: {d.last_error}</p>}
                </div>
                <button
                  onClick={() => handleHapusDraft(d.client_id)}
                  className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50"
                  title="Hapus draft"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Kartu>
      )}

      {/* Filter Status Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
        {DAFTAR_STATUS.map((st) => (
          <button
            key={st}
            onClick={() => {
              if (st === 'semua') searchParams.delete('status')
              else searchParams.set('status', st)
              setSearchParams(searchParams)
            }}
            className={`whitespace-nowrap rounded-full px-3 py-1 font-medium transition ${
              filterStatus === st ? 'bg-green-800 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {st === 'semua' ? 'Semua' : LABEL_STATUS[st]}
          </button>
        ))}
      </div>

      {error && <Pesan jenis="error">{error}</Pesan>}

      {/* Daftar Laporan Server */}
      {memuat ? (
        <Memuat teks="Memuat daftar laporan…" />
      ) : laporan.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          <p className="text-sm font-medium">Belum ada laporan {filterStatus !== 'semua' ? `status "${LABEL_STATUS[filterStatus]}"` : ''}</p>
          <p className="text-xs mt-1">Laporan baru yang dibuat akan muncul di sini.</p>
          <Link to="/laporan/baru" className="mt-3 inline-block font-semibold text-xs text-green-800 underline">
            Buat Laporan Baru
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {laporan.map((item) => {
            const namaOpt = item.jenis_opt?.nama || item.jenis_opt_lain || 'OPT tidak spesifik'
            return (
              <Link
                key={item.id}
                to={`/laporan/${item.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-green-600 hover:shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm">{item.komoditas}</h2>
                    <p className="text-xs text-slate-600">
                      Serangan <span className="font-medium text-slate-800">{namaOpt}</span>
                    </p>
                  </div>
                  <BadgeStatus status={item.status} />
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <BadgeTingkat tingkat={item.tingkat} />
                  {item.luas_serangan_ha != null && <span>Luas: {formatHa(item.luas_serangan_ha)}</span>}
                  <span className="flex items-center gap-1 ml-auto text-[11px] text-slate-400">
                    <Calendar className="h-3 w-3" />
                    {formatTanggal(item.diamati_pada || item.created_at, false)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

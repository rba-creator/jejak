import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Filter, Layers, RefreshCw } from 'lucide-react'
import { supabase, pesanError } from '../lib/supabase'
import { HEX_TINGKAT, LABEL_TINGKAT } from '../lib/status'
import { formatTanggal, formatHa } from '../lib/format'
import type { Laporan, TingkatSerangan } from '../lib/types'
import { BadgeStatus, Pesan } from '../components/ui'
import { BaseMap } from '../components/BaseMap'
import { ClusterLayer, type TitikPeta } from '../components/ClusterLayer'

export function PetaPage() {
  const [laporan, setLaporan] = useState<Laporan[]>([])
  const [memuat, setMemuat] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter
  const [filterTingkat, setFilterTingkat] = useState<string>('semua')
  const [filterStatus, setFilterStatus] = useState<string>('semua')

  const muatTitik = useCallback(async () => {
    setMemuat(true)
    setError(null)
    try {
      let q = supabase
        .from('laporan')
        .select(`
          id, komoditas, tingkat, luas_serangan_ha, lat, lng, status, diamati_pada, created_at,
          jenis_opt:jenis_opt_id (nama), jenis_opt_lain
        `)

      if (filterStatus !== 'semua') {
        q = q.eq('status', filterStatus)
      } else {
        q = q.neq('status', 'ditolak') // default abaikan yang ditolak
      }

      if (filterTingkat !== 'semua') {
        q = q.eq('tingkat', filterTingkat)
      }

      const { data, error: err } = await q
      if (err) throw err
      setLaporan((data as unknown as Laporan[]) || [])
    } catch (e) {
      setError(pesanError(e))
    } finally {
      setMemuat(false)
    }
  }, [filterStatus, filterTingkat])

  useEffect(() => {
    muatTitik()
  }, [muatTitik])

  const titikPeta: TitikPeta[] = useMemo(() => {
    return laporan.map((lap) => {
      const namaOpt = lap.jenis_opt?.nama || lap.jenis_opt_lain || 'OPT'
      return {
        id: lap.id,
        lat: lap.lat,
        lng: lap.lng,
        warna: HEX_TINGKAT[lap.tingkat],
        popup: (
          <div className="min-w-44 text-xs">
            <div className="font-bold text-slate-900">{lap.komoditas}</div>
            <div className="text-slate-600 mb-1.5">{namaOpt}</div>
            <div className="flex items-center gap-1.5 mb-1">
              <BadgeStatus status={lap.status} />
              <span className="font-medium text-slate-700">{LABEL_TINGKAT[lap.tingkat]}</span>
            </div>
            {lap.luas_serangan_ha && <div className="text-slate-500">Luas: {formatHa(lap.luas_serangan_ha)}</div>}
            <div className="text-[10px] text-slate-400 mt-1">{formatTanggal(lap.diamati_pada || lap.created_at, false)}</div>
            <Link
              to={`/laporan/${lap.id}`}
              className="mt-2 block w-full rounded bg-green-800 py-1 text-center font-semibold text-white hover:bg-green-900"
            >
              Lihat Detail
            </Link>
          </div>
        )
      }
    })
  }, [laporan])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Peta Sebaran OPT</h1>
          <p className="text-xs text-slate-500">{titikPeta.length} titik sebaran serangan</p>
        </div>
        <button
          onClick={muatTitik}
          disabled={memuat}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          title="Segarkan peta"
        >
          <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2.5 text-xs shadow-sm border border-slate-200">
        <div className="flex items-center gap-1 text-slate-500 font-medium">
          <Filter className="h-3.5 w-3.5" /> Filter:
        </div>

        <select
          value={filterTingkat}
          onChange={(e) => setFilterTingkat(e.target.value)}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          <option value="semua">Semua Tingkat</option>
          <option value="ringan">Ringan</option>
          <option value="sedang">Sedang</option>
          <option value="berat">Berat</option>
          <option value="puso">Puso</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          <option value="semua">Aktif (Kecuali Ditolak)</option>
          <option value="baru">Baru</option>
          <option value="diverifikasi">Diverifikasi</option>
          <option value="ditugaskan">Ditugaskan</option>
          <option value="ditangani">Ditangani</option>
          <option value="selesai">Selesai</option>
          <option value="ditolak">Ditolak</option>
        </select>
      </div>

      {error && <Pesan jenis="error">{error}</Pesan>}

      {/* Peta Utama */}
      <div className="relative">
        <BaseMap className="h-[68vh] shadow-sm">
          <ClusterLayer titik={titikPeta} />
        </BaseMap>

        {/* Legend Box Floating */}
        <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-white/95 p-2 text-[11px] shadow-md backdrop-blur-sm border border-slate-200 space-y-1">
          <div className="font-semibold text-slate-800 flex items-center gap-1">
            <Layers className="h-3 w-3" /> Tingkat Kerusakan:
          </div>
          {(['ringan', 'sedang', 'berat', 'puso'] as TingkatSerangan[]).map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: HEX_TINGKAT[t] }} />
              <span className="text-slate-600">{LABEL_TINGKAT[t]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

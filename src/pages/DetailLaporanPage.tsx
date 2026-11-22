import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, User, ShieldAlert, History, Phone } from 'lucide-react'
import { useAuth } from '../auth/context'
import { supabase, pesanError, BUCKET_FOTO } from '../lib/supabase'
import { formatTanggal, formatHa } from '../lib/format'
import { formatKoordinat } from '../lib/geo'
import { aksiTersedia, LABEL_STATUS } from '../lib/status'
import type { Laporan, RiwayatLaporan, Profil, StatusLaporan } from '../lib/types'
import { BadgeStatus, BadgeTingkat, Kartu, Memuat, Pesan, Tombol, Field, inputCls } from '../components/ui'
import { BaseMap } from '../components/BaseMap'
import { Marker, Popup } from 'react-leaflet'

export function DetailLaporanPage() {
  const { id } = useParams<{ id: string }>()
  const { profil, session } = useAuth()
  const navigate = useNavigate()

  const [laporan, setLaporan] = useState<Laporan | null>(null)
  const [riwayat, setRiwayat] = useState<RiwayatLaporan[]>([])
  const [fotoUrls, setFotoUrls] = useState<string[]>([])
  const [daftarPetugas, setDaftarPetugas] = useState<Profil[]>([])

  const [memuat, setMemuat] = useState(true)
  const [aksiMemuat, setAksiMemuat] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal dialog aksi
  const [modalAksi, setModalAksi] = useState<{ ke: StatusLaporan; label: string; tugaskan?: boolean } | null>(null)
  const [catatanAksi, setCatatanAksi] = useState('')
  const [petugasTerpilih, setPetugasTerpilih] = useState('')

  const muatData = useCallback(async () => {
    if (!id) return
    setMemuat(true)
    setError(null)
    try {
      // 1. Ambil laporan lengkap
      const { data: lap, error: errLap } = await supabase
        .from('laporan')
        .select(`
          *,
          jenis_opt:jenis_opt_id (nama, nama_ilmiah, kategori),
          pelapor:pelapor_id (nama_lengkap, no_hp, email),
          petugas:petugas_id (nama_lengkap, no_hp, email)
        `)
        .eq('id', id)
        .single()
      if (errLap) throw errLap
      setLaporan(lap as unknown as Laporan)

      // 2. Ambil riwayat status
      const { data: riw } = await supabase
        .from('laporan_riwayat')
        .select('*, oleh_profil:oleh (nama_lengkap)')
        .eq('laporan_id', id)
        .order('created_at', { ascending: false })
      setRiwayat((riw as unknown as RiwayatLaporan[]) || [])

      // 3. Ambil foto
      const { data: fotos } = await supabase.from('laporan_foto').select('storage_path').eq('laporan_id', id)
      if (fotos && fotos.length > 0) {
        const urls: string[] = []
        for (const f of fotos) {
          const { data: signed } = await supabase.storage.from(BUCKET_FOTO).createSignedUrl(f.storage_path, 3600)
          if (signed?.signedUrl) urls.push(signed.signedUrl)
        }
        setFotoUrls(urls)
      } else {
        setFotoUrls([])
      }
    } catch (e) {
      setError(pesanError(e))
    } finally {
      setMemuat(false)
    }
  }, [id])

  useEffect(() => {
    muatData()
  }, [muatData])

  // Muat daftar petugas jika admin
  useEffect(() => {
    if (profil?.role === 'admin_kabupaten' || profil?.role === 'admin_provinsi') {
      supabase
        .from('profiles')
        .select('id, nama_lengkap, no_hp, email, role, kode_wilayah, created_at')
        .eq('role', 'petugas')
        .then(({ data }) => {
          if (data) setDaftarPetugas(data as Profil[])
        })
    }
  }, [profil])

  if (memuat) return <Memuat teks="Memuat detail laporan…" />
  if (error || !laporan) {
    return (
      <div className="space-y-4">
        <Pesan jenis="error">{error || 'Laporan tidak ditemukan'}</Pesan>
        <Link to="/laporan" className="inline-flex items-center gap-1 text-xs text-green-800 font-semibold underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke daftar laporan
        </Link>
      </div>
    )
  }

  const peranUser = profil?.role || 'petani'
  const ditugaskanKeSaya = laporan.petugas_id === session?.user?.id
  const aksi = aksiTersedia(laporan.status, peranUser, ditugaskanKeSaya)

  async function jalankanAksi() {
    if (!modalAksi || !laporan) return
    setAksiMemuat(true)
    setError(null)
    try {
      if (modalAksi.tugaskan) {
        if (!petugasTerpilih) throw new Error('Pilih petugas yang akan ditugaskan')
        const { error: err } = await supabase.rpc('tugaskan_petugas', {
          p_laporan_id: laporan.id,
          p_petugas_id: petugasTerpilih,
          p_catatan: catatanAksi || null
        })
        if (err) throw err
      } else {
        const { error: err } = await supabase.rpc('ubah_status_laporan', {
          p_laporan_id: laporan.id,
          p_status: modalAksi.ke,
          p_catatan: catatanAksi || null
        })
        if (err) throw err
      }
      setModalAksi(null)
      setCatatanAksi('')
      setPetugasTerpilih('')
      await muatData()
    } catch (e) {
      setError(pesanError(e))
    } finally {
      setAksiMemuat(false)
    }
  }

  const namaOpt = laporan.jenis_opt?.nama || laporan.jenis_opt_lain || 'OPT tidak spesifik'

  return (
    <div className="space-y-4">
      {/* Header navigasi */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/laporan')}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Kembali"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900 leading-tight">{laporan.komoditas}</h1>
          <p className="text-xs text-slate-500">Serangan: {namaOpt}</p>
        </div>
        <div className="ml-auto">
          <BadgeStatus status={laporan.status} />
        </div>
      </div>

      {error && <Pesan jenis="error">{error}</Pesan>}

      {/* Tombol aksi alur kerja jika tersedia */}
      {aksi.length > 0 && (
        <Kartu className="bg-slate-50 border-green-200">
          <span className="block text-xs font-semibold text-slate-700 mb-2">Aksi Pengelolaan:</span>
          <div className="flex flex-wrap gap-2">
            {aksi.map((a) => (
              <Tombol
                key={a.ke + (a.tugaskan ? '-tugaskan' : '')}
                varian={a.ke === 'ditolak' ? 'bahaya' : 'utama'}
                onClick={() => setModalAksi(a)}
                className="py-1.5 px-3 text-xs"
              >
                {a.label}
              </Tombol>
            ))}
          </div>
        </Kartu>
      )}

      {/* Rincian data */}
      <Kartu className="space-y-3">
        <h2 className="font-semibold text-sm text-slate-800 border-b pb-2">Informasi Serangan</h2>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block">Tingkat Serangan</span>
            <BadgeTingkat tingkat={laporan.tingkat} />
          </div>
          <div>
            <span className="text-slate-400 block">Waktu Pengamatan</span>
            <span className="font-medium text-slate-800">{formatTanggal(laporan.diamati_pada)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Luas Serangan</span>
            <span className="font-medium text-slate-800">{formatHa(laporan.luas_serangan_ha)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Luas Tanam</span>
            <span className="font-medium text-slate-800">{formatHa(laporan.luas_tanam_ha)}</span>
          </div>
        </div>

        {laporan.deskripsi && (
          <div className="text-xs pt-1">
            <span className="text-slate-400 block">Gejala & Keterangan:</span>
            <p className="mt-0.5 rounded-lg bg-slate-50 p-2 text-slate-700">{laporan.deskripsi}</p>
          </div>
        )}

        {laporan.catatan_admin && (
          <div className="text-xs pt-1">
            <span className="text-amber-800 font-semibold block">Catatan Admin/Petugas:</span>
            <p className="mt-0.5 rounded-lg bg-amber-50 p-2 text-amber-900 border border-amber-200">
              {laporan.catatan_admin}
            </p>
          </div>
        )}
      </Kartu>

      {/* Pelapor & Petugas Penanggung Jawab */}
      <Kartu className="space-y-3">
        <h2 className="font-semibold text-sm text-slate-800 border-b pb-2">Pihak Terkait</h2>
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-2.5">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <User className="h-4 w-4 text-slate-400" />
              <span>Pelapor: {laporan.pelapor?.nama_lengkap || 'Anonim'}</span>
            </div>
            {laporan.pelapor?.no_hp && (
              <a
                href={`tel:${laporan.pelapor.no_hp}`}
                className="mt-1 flex items-center gap-1 text-[11px] text-green-800 hover:underline"
              >
                <Phone className="h-3 w-3" /> {laporan.pelapor.no_hp}
              </a>
            )}
          </div>

          <div className="rounded-lg bg-slate-50 p-2.5">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <ShieldAlert className="h-4 w-4 text-green-700" />
              <span>Petugas: {laporan.petugas?.nama_lengkap || 'Belum ditugaskan'}</span>
            </div>
            {laporan.petugas?.no_hp && (
              <a
                href={`tel:${laporan.petugas.no_hp}`}
                className="mt-1 flex items-center gap-1 text-[11px] text-green-800 hover:underline"
              >
                <Phone className="h-3 w-3" /> {laporan.petugas.no_hp}
              </a>
            )}
          </div>
        </div>
      </Kartu>

      {/* Foto Dokumentasi */}
      {fotoUrls.length > 0 && (
        <Kartu className="space-y-2">
          <h2 className="font-semibold text-sm text-slate-800 border-b pb-2">
            Dokumentasi Foto ({fotoUrls.length})
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {fotoUrls.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border">
                <img src={url} alt={`Bukti serangan ${i + 1}`} className="h-32 w-full object-cover transition hover:scale-105" />
              </a>
            ))}
          </div>
        </Kartu>
      )}

      {/* Peta Lokasi */}
      <Kartu className="space-y-2">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="font-semibold text-sm text-slate-800 flex items-center gap-1">
            <MapPin className="h-4 w-4 text-red-600" /> Lokasi Kejadian
          </h2>
          <span className="text-xs text-slate-500">{formatKoordinat(laporan.lat, laporan.lng)}</span>
        </div>
        {laporan.alamat && <p className="text-xs text-slate-600">{laporan.alamat}</p>}

        <BaseMap center={[laporan.lat, laporan.lng]} zoom={15} className="h-60">
          <Marker position={[laporan.lat, laporan.lng]}>
            <Popup>
              <div className="text-xs font-semibold">{laporan.komoditas}</div>
              <div className="text-[11px] text-slate-600">{namaOpt}</div>
            </Popup>
          </Marker>
        </BaseMap>

        {laporan.gps_lat != null && (
          <p className="text-[11px] text-slate-400">
            GPS Asli: {formatKoordinat(laporan.gps_lat, laporan.gps_lng!)}
            {laporan.gps_akurasi_m ? ` (Akurasi: ±${Math.round(laporan.gps_akurasi_m)}m)` : ''}
          </p>
        )}
      </Kartu>

      {/* Riwayat Alur Status */}
      <Kartu className="space-y-3">
        <h2 className="font-semibold text-sm text-slate-800 border-b pb-2 flex items-center gap-1.5">
          <History className="h-4 w-4 text-slate-500" /> Riwayat Status & Penanganan
        </h2>
        <div className="relative pl-4 space-y-3 border-l-2 border-slate-200 text-xs">
          {riwayat.map((r) => (
            <div key={r.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-green-700 ring-4 ring-white" />
              <div>
                <span className="font-semibold text-slate-900">{LABEL_STATUS[r.status_baru]}</span>
                {r.status_lama && <span className="text-slate-400 text-[11px]"> (sebelumnya {LABEL_STATUS[r.status_lama]})</span>}
              </div>
              <div className="text-[11px] text-slate-500">
                {formatTanggal(r.created_at)} • oleh {r.oleh_profil?.nama_lengkap || 'Sistem'}
              </div>
              {r.catatan && <p className="mt-1 text-slate-700 italic bg-slate-50 p-1.5 rounded">{r.catatan}</p>}
            </div>
          ))}
        </div>
      </Kartu>

      {/* Modal Dialog Form Aksi */}
      {modalAksi && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl space-y-3">
            <h3 className="font-bold text-slate-900">{modalAksi.label}</h3>

            {modalAksi.tugaskan && (
              <Field label="Pilih Petugas Lapangan *">
                <select
                  className={inputCls}
                  value={petugasTerpilih}
                  onChange={(e) => setPetugasTerpilih(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Petugas --</option>
                  {daftarPetugas.map((ptg) => (
                    <option key={ptg.id} value={ptg.id}>
                      {ptg.nama_lengkap || ptg.email}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field
              label={modalAksi.ke === 'ditolak' ? 'Alasan Penolakan *' : 'Catatan / Instruksi (opsional)'}
            >
              <textarea
                rows={3}
                className={inputCls}
                value={catatanAksi}
                onChange={(e) => setCatatanAksi(e.target.value)}
                placeholder={modalAksi.ke === 'ditolak' ? 'Tuliskan alasan penolakan laporan ini...' : 'Catatan tindakan...'}
                required={modalAksi.ke === 'ditolak'}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Tombol varian="sekunder" onClick={() => setModalAksi(null)} disabled={aksiMemuat}>
                Batal
              </Tombol>
              <Tombol
                varian={modalAksi.ke === 'ditolak' ? 'bahaya' : 'utama'}
                onClick={jalankanAksi}
                memuat={aksiMemuat}
              >
                Konfirmasi
              </Tombol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

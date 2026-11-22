import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Crosshair, ImagePlus, X } from 'lucide-react'
import { useAuth } from '../auth/context'
import { ambilPosisi, formatKoordinat, pesanErrorGps, PUSAT_KALTIM } from '../lib/geo'
import { kompresFoto } from '../lib/image'
import { muatJenisOpt } from '../lib/master'
import { kirimAtauSimpanDraft } from '../lib/sync'
import { sekarangLokal, uuid } from '../lib/format'
import { LABEL_TINGKAT } from '../lib/status'
import type { JenisOpt, LaporanInput, TingkatSerangan } from '../lib/types'
import { Field, Kartu, Pesan, Tombol, inputCls } from '../components/ui'
import { PemilihLokasi } from '../components/PemilihLokasi'

interface FotoItem {
  id: string
  blob: Blob
  previewUrl: string
}

export function LaporPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [daftarOpt, setDaftarOpt] = useState<JenisOpt[]>([])
  const [optId, setOptId] = useState<string>('')
  const [optLain, setOptLain] = useState('')
  const [komoditas, setKomoditas] = useState('')
  const [tingkat, setTingkat] = useState<TingkatSerangan>('ringan')
  const [luasSerangan, setLuasSerangan] = useState('')
  const [luasTanam, setLuasTanam] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [alamat, setAlamat] = useState('')
  const [diamatiPada, setDiamatiPada] = useState(sekarangLokal)

  // Koordinat
  const [pin, setPin] = useState<{ lat: number; lng: number }>({ lat: PUSAT_KALTIM[0], lng: PUSAT_KALTIM[1] })
  const [pinDipilih, setPinDipilih] = useState(false)
  const [gpsData, setGpsData] = useState<{ lat: number; lng: number; akurasi: number; waktu: string } | null>(null)
  const [gpsMemuat, setGpsMemuat] = useState(false)
  const [gpsPesan, setGpsPesan] = useState<string | null>(null)

  // Foto
  const [daftarFoto, setDaftarFoto] = useState<FotoItem[]>([])
  const [prosesFoto, setProsesFoto] = useState(false)

  // Submit
  const [memuat, setMemuat] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  useEffect(() => {
    muatJenisOpt().then(setDaftarOpt).catch(() => {})
  }, [])

  // Bersihkan object URL saat unmount
  useEffect(() => {
    return () => {
      daftarFoto.forEach((f) => URL.revokeObjectURL(f.previewUrl))
    }
  }, [daftarFoto])

  function pilihOpt(idStr: string) {
    setOptId(idStr)
    const opt = daftarOpt.find((o) => o.id === Number(idStr))
    if (opt?.komoditas && !komoditas) {
      setKomoditas(opt.komoditas)
    }
  }

  async function tangkapGps() {
    setGpsMemuat(true)
    setGpsPesan(null)
    try {
      const pos = await ambilPosisi()
      setGpsData(pos)
      setPin({ lat: pos.lat, lng: pos.lng })
      setPinDipilih(true)
      setGpsPesan(`Lokasi GPS didapatkan (akurasi ±${Math.round(pos.akurasi)}m)`)
    } catch (e) {
      setGpsPesan(pesanErrorGps(e as Error))
    } finally {
      setGpsMemuat(false)
    }
  }

  async function tambahFoto(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (daftarFoto.length + files.length > 5) {
      setErrorForm('Maksimal 5 foto per laporan')
      return
    }

    setProsesFoto(true)
    setErrorForm(null)
    try {
      const barus: FotoItem[] = []
      for (const file of Array.from(files)) {
        const kompres = await kompresFoto(file)
        barus.push({
          id: uuid(),
          blob: kompres,
          previewUrl: URL.createObjectURL(kompres)
        })
      }
      setDaftarFoto((lama) => [...lama, ...barus])
    } catch {
      setErrorForm('Gagal memproses foto')
    } finally {
      setProsesFoto(false)
      e.target.value = ''
    }
  }

  function hapusFoto(id: string) {
    setDaftarFoto((lama) => {
      const target = lama.find((f) => f.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return lama.filter((f) => f.id !== id)
    })
  }

  async function simpanLaporan(e: FormEvent) {
    e.preventDefault()
    setErrorForm(null)

    if (!session?.user?.id) {
      setErrorForm('Sesi login telah berakhir. Silakan masuk kembali.')
      return
    }

    if (!optId && !optLain.trim()) {
      setErrorForm('Pilih jenis OPT atau masukkan nama jenis lainnya')
      return
    }
    if (!komoditas.trim()) {
      setErrorForm('Komoditas wajib diisi')
      return
    }
    if (!pinDipilih) {
      setErrorForm('Lokasi serangan wajib ditentukan (ambil via GPS atau ketuk peta)')
      return
    }

    const nSerangan = luasSerangan ? Number(luasSerangan) : null
    const nTanam = luasTanam ? Number(luasTanam) : null
    if (nSerangan != null && nTanam != null && nSerangan > nTanam) {
      setErrorForm('Luas serangan tidak boleh melebihi luas tanam')
      return
    }

    setMemuat(true)
    try {
      const input: LaporanInput = {
        client_id: uuid(),
        jenis_opt_id: optId ? Number(optId) : null,
        jenis_opt_lain: optId ? null : optLain.trim(),
        komoditas: komoditas.trim(),
        tingkat,
        luas_serangan_ha: nSerangan,
        luas_tanam_ha: nTanam,
        deskripsi: deskripsi.trim() || null,
        alamat: alamat.trim() || null,
        lat: pin.lat,
        lng: pin.lng,
        gps_lat: gpsData?.lat ?? null,
        gps_lng: gpsData?.lng ?? null,
        gps_akurasi_m: gpsData?.akurasi ?? null,
        gps_diambil_pada: gpsData?.waktu ?? null,
        diamati_pada: new Date(diamatiPada).toISOString()
      }

      const hasil = await kirimAtauSimpanDraft(
        input,
        daftarFoto.map((f) => f.blob),
        session.user.id
      )

      if (hasil.status === 'terkirim') {
        navigate(`/laporan/${hasil.id}`)
      } else {
        alert(hasil.alasan)
        navigate('/laporan')
      }
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'Gagal mengirim laporan')
    } finally {
      setMemuat(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Buat Laporan Serangan OPT</h1>

      <form onSubmit={simpanLaporan} className="space-y-4">
        {/* Identifikasi Serangan */}
        <Kartu className="space-y-3">
          <h2 className="font-semibold text-slate-800">1. Data Serangan</h2>

          <Field label="Jenis OPT *" bantuan="Pilih dari daftar atau pilih 'Lainnya'">
            <select className={inputCls} value={optId} onChange={(e) => pilihOpt(e.target.value)}>
              <option value="">-- Pilih Jenis OPT --</option>
              {daftarOpt.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama} {o.nama_ilmiah ? `(${o.nama_ilmiah})` : ''} — {o.komoditas || o.kategori}
                </option>
              ))}
              <option value="__lain__">Lainnya (tulis manual)</option>
            </select>
          </Field>

          {optId === '__lain__' && (
            <Field label="Nama OPT Lainnya *">
              <input
                className={inputCls}
                placeholder="Contoh: Belalang kembara"
                value={optLain}
                onChange={(e) => setOptLain(e.target.value)}
                required
              />
            </Field>
          )}

          <Field label="Komoditas Tanaman *">
            <input
              className={inputCls}
              placeholder="Contoh: Padi, Jagung, Sawit, Cabai"
              value={komoditas}
              onChange={(e) => setKomoditas(e.target.value)}
              required
            />
          </Field>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1">Tingkat Serangan *</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['ringan', 'sedang', 'berat', 'puso'] as TingkatSerangan[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTingkat(t)}
                  className={`rounded-lg border p-2 text-xs font-medium transition ${
                    tingkat === t ? 'border-green-800 bg-green-50 text-green-900 font-bold ring-2 ring-green-800/20' : 'bg-white text-slate-700'
                  }`}
                >
                  {LABEL_TINGKAT[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Luas Serangan (ha)">
              <input
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.00"
                className={inputCls}
                value={luasSerangan}
                onChange={(e) => setLuasSerangan(e.target.value)}
              />
            </Field>
            <Field label="Luas Hamparan/Tanam (ha)">
              <input
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.00"
                className={inputCls}
                value={luasTanam}
                onChange={(e) => setLuasTanam(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Waktu Pengamatan">
            <input
              type="datetime-local"
              className={inputCls}
              value={diamatiPada}
              onChange={(e) => setDiamatiPada(e.target.value)}
            />
          </Field>
        </Kartu>

        {/* Lokasi */}
        <Kartu className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">2. Lokasi Serangan</h2>
            <button
              type="button"
              onClick={tangkapGps}
              disabled={gpsMemuat}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-900 hover:bg-green-100 disabled:opacity-50"
            >
              <Crosshair className="h-4 w-4 text-green-800" />
              {gpsMemuat ? 'Mencari GPS…' : 'Ambil Lokasi GPS'}
            </button>
          </div>

          {gpsPesan && <Pesan jenis={gpsData ? 'info' : 'peringatan'}>{gpsPesan}</Pesan>}

          <p className="text-xs text-slate-500">
            {pinDipilih
              ? `Koordinat: ${formatKoordinat(pin.lat, pin.lng)}. Geser pin atau ketuk peta bila perlu koreksi manual.`
              : 'Ketuk tombol "Ambil Lokasi GPS" di lapangan atau ketuk langsung pada peta di bawah.'}
          </p>

          <PemilihLokasi
            posisi={pinDipilih ? pin : null}
            akurasi={gpsData?.akurasi}
            onUbah={(p) => {
              setPin(p)
              setPinDipilih(true)
            }}
          />

          <Field label="Alamat / Patokan Lapangan (opsional)">
            <input
              className={inputCls}
              placeholder="Contoh: RT 03 Desa Sebuntal, seberang jembatan kayu"
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
            />
          </Field>
        </Kartu>

        {/* Foto Dokumentasi */}
        <Kartu className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">3. Foto Bukti (Maks. 5)</h2>
            <span className="text-xs text-slate-500">{daftarFoto.length}/5 foto</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {daftarFoto.map((f) => (
              <div key={f.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                <img src={f.previewUrl} alt="Foto serangan" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => hapusFoto(f.id)}
                  className="absolute top-1 right-1 rounded-full bg-red-600/80 p-1 text-white hover:bg-red-700"
                  aria-label="Hapus foto"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {daftarFoto.length < 5 && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-green-700 hover:text-green-800">
                <Camera className="h-5 w-5" />
                <span className="mt-1 text-[10px] font-medium">Kamera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={tambahFoto}
                  disabled={prosesFoto}
                />
              </label>
            )}

            {daftarFoto.length < 5 && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-green-700 hover:text-green-800">
                <ImagePlus className="h-5 w-5" />
                <span className="mt-1 text-[10px] font-medium">Galeri</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={tambahFoto}
                  disabled={prosesFoto}
                />
              </label>
            )}
          </div>
          {prosesFoto && <p className="text-xs text-slate-500 animate-pulse">Mengompresi foto…</p>}
        </Kartu>

        {/* Deskripsi Tambahan */}
        <Kartu className="space-y-3">
          <Field label="Catatan / Gejala Kerusakan (opsional)">
            <textarea
              rows={3}
              className={inputCls}
              placeholder="Deskripsikan gejala yang tampak, populasi hama, atau tindakan yang sudah dilakukan petani..."
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
            />
          </Field>
        </Kartu>

        {errorForm && <Pesan jenis="error">{errorForm}</Pesan>}

        <Tombol type="submit" memuat={memuat} className="w-full py-3 text-base">
          Kirim Laporan
        </Tombol>
      </form>
    </div>
  )
}

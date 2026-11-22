import { useEffect, useState, useRef, useCallback } from 'react'
import { Navigation, Play, Square, ShieldCheck, Radio, AlertTriangle } from 'lucide-react'
import { useAuth } from '../auth/context'
import { supabase, pesanError } from '../lib/supabase'
import { formatTanggal } from '../lib/format'
import { formatKoordinat, jarakMeter } from '../lib/geo'
import { isAdmin } from '../lib/status'
import type { PosisiPetugas } from '../lib/types'
import { Kartu, Pesan, Tombol, Memuat } from '../components/ui'
import { BaseMap } from '../components/BaseMap'
import { Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'

// Ikon khusus petugas
const ikonPetugas = L.divIcon({
  html: `<div class="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow ring-4 ring-blue-300">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
  </div>`,
  className: '',
  iconSize: [28, 28]
})

export function TrackingPage() {
  const { profil, session } = useAuth()
  const peran = profil?.role
  const userId = session?.user?.id
  const admin = isAdmin(peran)

  // Status tracking untuk Petugas
  const [aktifTracking, setAktifTracking] = useState(false)
  const [posisiTerkini, setPosisiTerkini] = useState<{ lat: number; lng: number; akurasi: number; waktu: string } | null>(null)
  const [totalTitikTerkirim, setTotalTitikTerkirim] = useState(0)
  const [statusTeks, setStatusTeks] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const posisiTerakhirKirimRef = useRef<{ lat: number; lng: number; waktu: number } | null>(null)

  // Data pemantauan untuk Admin
  const [daftarPetugas, setDaftarPetugas] = useState<PosisiPetugas[]>([])
  const [memuatAdmin, setMemuatAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // -------------------------------------------------------------
  // Petugas: Logika Pengiriman Lokasi
  // -------------------------------------------------------------
  const kirimPosisi = useCallback(
    async (lat: number, lng: number, akurasi: number) => {
      if (!userId) return
      try {
        const { error: err } = await supabase.from('tracking_petugas').insert({
          petugas_id: userId,
          lat,
          lng,
          akurasi_m: akurasi
        })
        if (err) throw err
        setTotalTitikTerkirim((n) => n + 1)
        setStatusTeks(`Titik koordinat berhasil dikirim (${new Date().toLocaleTimeString()})`)
      } catch (e) {
        setStatusTeks(`Gagal mengirim posisi: ${pesanError(e)}`)
      }
    },
    [userId]
  )

  function mulaiTracking() {
    if (!navigator.geolocation) {
      alert('Perangkat tidak mendukung geolokasi')
      return
    }
    setError(null)
    setAktifTracking(true)
    setStatusTeks('Memulai pelacakan lokasi...')

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy: akurasi } = pos.coords
        const now = Date.now()
        setPosisiTerkini({ lat, lng, akurasi, waktu: new Date(pos.timestamp).toISOString() })

        const last = posisiTerakhirKirimRef.current
        // Kirim jika titik pertama, atau sudah > 30 detik dan bergerak > 15 meter
        const perluKirim =
          !last || (now - last.waktu > 30_000 && jarakMeter(last, { lat, lng }) > 15) || now - last.waktu > 120_000

        if (perluKirim) {
          posisiTerakhirKirimRef.current = { lat, lng, waktu: now }
          kirimPosisi(lat, lng, akurasi)
        }
      },
      (err) => {
        setStatusTeks(`GPS Error: ${err.message}`)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )
  }

  function hentikanTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setAktifTracking(false)
    setStatusTeks('Pelacakan dihentikan')
  }

  // Matikan pelacakan saat unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  // -------------------------------------------------------------
  // Admin: Pemantauan Petugas Realtime
  // -------------------------------------------------------------
  const muatPosisiPetugas = useCallback(async () => {
    if (!admin) return
    setMemuatAdmin(true)
    try {
      const { data, error: err } = await supabase.rpc('posisi_terakhir_petugas', { p_jam: 12 })
      if (err) throw err
      setDaftarPetugas((data as PosisiPetugas[]) || [])
    } catch (e) {
      setError(pesanError(e))
    } finally {
      setMemuatAdmin(false)
    }
  }, [admin])

  useEffect(() => {
    if (!admin) return
    muatPosisiPetugas()

    // Langganan Realtime Postgres Changes
    const channel = supabase
      .channel('tracking-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tracking_petugas' },
        () => {
          muatPosisiPetugas()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [admin, muatPosisiPetugas])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Live Tracking Lapangan</h1>
          <p className="text-xs text-slate-500">
            {admin ? 'Monitoring posisi petugas aktif di wilayah Anda' : 'Pelacakan posisi selama bertugas di lapangan'}
          </p>
        </div>
        {admin && (
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full font-medium">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> Live Realtime
          </div>
        )}
      </div>

      {error && <Pesan jenis="error">{error}</Pesan>}

      {/* Bagian Petugas: Tombol Mulai/Berhenti */}
      {peran === 'petugas' && (
        <Kartu className="space-y-3 border-blue-200 bg-blue-50/30">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-700 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Pelacakan Petugas Lapangan</h2>
              <p className="text-xs text-slate-600">
                Aktifkan pelacakan saat menuju atau berada di lokasi penanganan laporan. Pastikan GPS HP aktif.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-white p-3 border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Status Pelacakan:</span>
              <span className={`font-bold ${aktifTracking ? 'text-green-700' : 'text-slate-500'}`}>
                {aktifTracking ? '● AKTIF (Merekam)' : '○ Nonaktif'}
              </span>
            </div>
            {posisiTerkini && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Koordinat Saat Ini:</span>
                  <span className="font-mono text-slate-800">{formatKoordinat(posisiTerkini.lat, posisiTerkini.lng)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Akurasi GPS:</span>
                  <span className="text-slate-800">±{Math.round(posisiTerkini.akurasi)} meter</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Titik Terkirim ke Server:</span>
              <span className="font-semibold text-slate-800">{totalTitikTerkirim} titik</span>
            </div>
            {statusTeks && <p className="text-[11px] text-blue-800 pt-1 italic">{statusTeks}</p>}
          </div>

          {!aktifTracking ? (
            <Tombol onClick={mulaiTracking} className="w-full bg-blue-700 hover:bg-blue-800">
              <Play className="h-4 w-4 mr-1.5" /> Mulai Pelacakan Penugasan
            </Tombol>
          ) : (
            <Tombol onClick={hentikanTracking} varian="bahaya" className="w-full">
              <Square className="h-4 w-4 mr-1.5" /> Hentikan Pelacakan
            </Tombol>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>PWA memerlukan aplikasi tetap terbuka di layar agar GPS terus mengirim data.</span>
          </div>
        </Kartu>
      )}

      {/* Peta Monitoring Petugas (Bagi Admin dan Petugas) */}
      <Kartu className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 border-b pb-2">
          <Navigation className="h-4 w-4 text-blue-600" />
          {admin ? `Posisi Petugas Terkini (${daftarPetugas.length} aktif)` : 'Posisi Anda di Peta'}
        </h2>

        {memuatAdmin ? (
          <Memuat teks="Memperbarui posisi petugas…" />
        ) : (
          <BaseMap className="h-[60vh]">
            {/* Titik petugas untuk admin */}
            {admin &&
              daftarPetugas.map((ptg) => (
                <div key={ptg.petugas_id}>
                  <Marker position={[ptg.lat, ptg.lng]} icon={ikonPetugas}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-bold text-slate-900">{ptg.nama_lengkap || 'Petugas POPT'}</p>
                        <p className="text-[11px] text-slate-500">Terakhir: {formatTanggal(ptg.direkam_pada)}</p>
                        {ptg.akurasi_m && <p className="text-[11px] text-slate-400">Akurasi: ±{Math.round(ptg.akurasi_m)}m</p>}
                      </div>
                    </Popup>
                  </Marker>
                  {ptg.akurasi_m != null && ptg.akurasi_m > 0 && (
                    <Circle
                      center={[ptg.lat, ptg.lng]}
                      radius={ptg.akurasi_m}
                      pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.1 }}
                    />
                  )}
                </div>
              ))}

            {/* Posisi mandiri petugas */}
            {!admin && posisiTerkini && (
              <>
                <Marker position={[posisiTerkini.lat, posisiTerkini.lng]} icon={ikonPetugas}>
                  <Popup>
                    <div className="text-xs font-semibold">Posisi Anda Saat Ini</div>
                  </Popup>
                </Marker>
                <Circle
                  center={[posisiTerkini.lat, posisiTerkini.lng]}
                  radius={posisiTerkini.akurasi}
                  pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.1 }}
                />
              </>
            )}
          </BaseMap>
        )}
      </Kartu>
    </div>
  )
}

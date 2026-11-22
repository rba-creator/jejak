export interface PosisiGps {
  lat: number
  lng: number
  akurasi: number
  waktu: string
}

/** Pusat default peta: Kalimantan Timur. */
export const PUSAT_KALTIM: [number, number] = [0.5, 116.4]

export function geolocationTersedia(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export function pesanErrorGps(e: GeolocationPositionError | Error): string {
  if ('code' in e) {
    switch (e.code) {
      case 1:
        return 'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser.'
      case 2:
        return 'Lokasi tidak tersedia. Pastikan GPS aktif dan coba di area terbuka.'
      case 3:
        return 'Waktu pengambilan lokasi habis. Coba lagi.'
    }
  }
  if (!window.isSecureContext) return 'GPS memerlukan HTTPS. Buka aplikasi melalui https://'
  return e.message || 'Gagal mengambil lokasi'
}

export function ambilPosisi(timeoutMs = 20000): Promise<PosisiGps> {
  return new Promise((resolve, reject) => {
    if (!geolocationTersedia()) return reject(new Error('Perangkat tidak mendukung GPS/Geolocation'))
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          akurasi: p.coords.accuracy,
          waktu: new Date(p.timestamp).toISOString()
        }),
      reject,
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    )
  })
}

/** Jarak haversine dalam meter. */
export function jarakMeter(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function koordinatValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

export const formatKoordinat = (lat: number, lng: number) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`

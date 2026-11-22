import { useEffect } from 'react'
import { Circle, Marker, useMap, useMapEvents } from 'react-leaflet'
import { BaseMap } from './BaseMap'

interface Props {
  posisi: { lat: number; lng: number } | null
  akurasi?: number | null
  onUbah: (p: { lat: number; lng: number }) => void
}

function Interaksi({ posisi, onUbah }: Pick<Props, 'posisi' | 'onUbah'>) {
  const map = useMap()
  useMapEvents({ click: (e) => onUbah({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  useEffect(() => {
    if (!posisi) return
    // Pusatkan hanya bila pin di luar layar atau peta masih terlalu jauh (mis. setelah GPS).
    if (map.getZoom() < 14 || !map.getBounds().contains([posisi.lat, posisi.lng])) {
      map.setView([posisi.lat, posisi.lng], 16)
    }
  }, [posisi, map])
  return null
}

/** Peta pemilih lokasi: ketuk peta atau geser pin untuk koreksi manual. */
export function PemilihLokasi({ posisi, akurasi, onUbah }: Props) {
  return (
    <BaseMap className="h-72" zoom={posisi ? 16 : 7} center={posisi ? [posisi.lat, posisi.lng] : undefined}>
      <Interaksi posisi={posisi} onUbah={onUbah} />
      {posisi && (
        <>
          <Marker
            position={[posisi.lat, posisi.lng]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = e.target.getLatLng()
                onUbah({ lat: ll.lat, lng: ll.lng })
              }
            }}
          />
          {akurasi != null && akurasi > 0 && (
            <Circle center={[posisi.lat, posisi.lng]} radius={akurasi} pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.08 }} />
          )}
        </>
      )}
    </BaseMap>
  )
}

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CircleMarker, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import Supercluster from 'supercluster'

export interface TitikPeta {
  id: string
  lat: number
  lng: number
  warna: string
  popup: ReactNode
}

const ikonCluster = (n: number) => {
  const ukuran = n < 10 ? 32 : n < 100 ? 40 : 48
  return L.divIcon({
    html: `<div style="width:${ukuran}px;height:${ukuran}px;line-height:${ukuran}px" class="rounded-full bg-green-800/85 text-white text-xs font-bold text-center ring-4 ring-green-800/25">${n}</div>`,
    className: '',
    iconSize: [ukuran, ukuran]
  })
}

/** Marker cluster berbasis supercluster (ringan, tanpa plugin global Leaflet). */
export function ClusterLayer({ titik }: { titik: TitikPeta[] }) {
  const map = useMap()
  const [view, setView] = useState(() => ({ bounds: map.getBounds(), zoom: map.getZoom() }))

  useMapEvents({
    moveend: () => setView({ bounds: map.getBounds(), zoom: map.getZoom() })
  })

  const index = useMemo(() => {
    const sc = new Supercluster<{ i: number }>({ radius: 60, maxZoom: 16 })
    sc.load(
      titik.map((t, i) => ({
        type: 'Feature' as const,
        properties: { i },
        geometry: { type: 'Point' as const, coordinates: [t.lng, t.lat] }
      }))
    )
    return sc
  }, [titik])

  // Sesuaikan tampilan dengan sebaran titik saat data pertama kali dimuat.
  useEffect(() => {
    if (titik.length === 0) return
    const b = L.latLngBounds(titik.map((t) => [t.lat, t.lng] as [number, number]))
    map.fitBounds(b, { padding: [40, 40], maxZoom: 14 })
  }, [titik, map])

  const b = view.bounds
  const cluster = index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], Math.round(view.zoom))

  return (
    <>
      {cluster.map((f) => {
        const [lng, lat] = f.geometry.coordinates
        const props = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; i?: number }
        if (props.cluster && props.cluster_id != null) {
          const cid = props.cluster_id
          return (
            <Marker
              key={`c-${cid}`}
              position={[lat, lng]}
              icon={ikonCluster(props.point_count ?? 0)}
              eventHandlers={{
                click: () => map.flyTo([lat, lng], Math.min(index.getClusterExpansionZoom(cid), 18))
              }}
            />
          )
        }
        const t = titik[props.i ?? 0]
        return (
          <CircleMarker
            key={t.id}
            center={[t.lat, t.lng]}
            radius={8}
            pathOptions={{ color: '#fff', weight: 2, fillColor: t.warna, fillOpacity: 0.95 }}
          >
            <Popup>{t.popup}</Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}

import type { ReactNode } from 'react'
import { LayersControl, MapContainer, ScaleControl, TileLayer, WMSTileLayer } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import { env, isRbiConfigured } from '../lib/env'
import { PUSAT_KALTIM } from '../lib/geo'

interface Props {
  center?: LatLngExpression
  zoom?: number
  className?: string
  children?: ReactNode
}

/**
 * Peta dasar: layer RBI (BIG/Piksel WMS) bila dikonfigurasi, dengan
 * OpenStreetMap sebagai layer konteks/fallback. OSM BUKAN peta RBI.
 */
export function BaseMap({ center = PUSAT_KALTIM, zoom = 7, className = 'h-[60vh]', children }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} className={`w-full rounded-xl border border-slate-200 ${className}`} scrollWheelZoom>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked={!isRbiConfigured} name="OpenStreetMap (konteks, bukan RBI)">
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        {isRbiConfigured && (
          <LayersControl.BaseLayer checked name="Rupa Bumi Indonesia (BIG)">
            <WMSTileLayer
              url={env.rbi.url}
              layers={env.rbi.layers}
              format={env.rbi.format}
              transparent={env.rbi.transparent}
              version="1.3.0"
              attribution='&copy; <a href="https://tanahair.indonesia.go.id">Badan Informasi Geospasial</a>'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        )}
      </LayersControl>
      <ScaleControl imperial={false} />
      {children}
    </MapContainer>
  )
}

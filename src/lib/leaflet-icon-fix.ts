/**
 * Perbaikan ikon marker default Leaflet setelah bundling Vite.
 * Tanpa ini, marker tampil sebagai gambar rusak karena Leaflet mencari ikon
 * berdasarkan path CSS yang berubah saat build.
 *
 * Pemakaian: import sekali di src/main.tsx, SETELAH `import 'leaflet/dist/leaflet.css'`:
 *   import './lib/leaflet-icon-fix'
 */
import L from 'leaflet'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl

L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

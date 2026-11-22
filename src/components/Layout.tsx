import { NavLink, Outlet, Link } from 'react-router-dom'
import { Home, FilePlus2, ListChecks, Map as MapIcon, Navigation, Users, UserCircle, WifiOff } from 'lucide-react'
import { useAuth } from '../auth/context'
import { useOnline } from '../lib/useOnline'
import { isAdmin, LABEL_PERAN } from '../lib/status'

export function Layout() {
  const { profil } = useAuth()
  const online = useOnline()
  const peran = profil?.role

  const menu = [
    { to: '/', label: 'Beranda', ikon: Home, tampil: true },
    { to: '/laporan/baru', label: 'Lapor', ikon: FilePlus2, tampil: true },
    { to: '/laporan', label: 'Laporan', ikon: ListChecks, tampil: true },
    { to: '/peta', label: 'Peta', ikon: MapIcon, tampil: true },
    { to: '/tracking', label: 'Tracking', ikon: Navigation, tampil: peran === 'petugas' || isAdmin(peran) },
    { to: '/admin/pengguna', label: 'Pengguna', ikon: Users, tampil: isAdmin(peran) }
  ].filter((m) => m.tampil)

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-[1000] bg-green-900 text-white shadow pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-wide">
            <img src="/favicon.svg" alt="Logo JEJAK-OPT" className="h-7 w-7 drop-shadow-sm" />
            <span>JEJAK-OPT</span>
          </Link>
          <Link to="/profil" className="flex items-center gap-2 text-sm text-green-50">
            <span className="hidden text-right sm:block">
              <span className="block leading-tight">{profil?.nama_lengkap || profil?.email}</span>
              <span className="block text-xs text-green-200">{peran ? LABEL_PERAN[peran] : ''}</span>
            </span>
            <UserCircle className="h-7 w-7" aria-label="Profil" />
          </Link>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1 text-xs font-medium text-amber-950">
            <WifiOff className="h-3.5 w-3.5" aria-hidden /> Offline — laporan baru disimpan sebagai draft
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-[1000] border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
        aria-label="Navigasi utama"
      >
        <ul className="mx-auto flex max-w-5xl justify-around">
          {menu.map(({ to, label, ikon: Ikon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/' || to === '/laporan'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-green-800 font-semibold' : 'text-slate-500'}`
                }
              >
                <Ikon className="h-5 w-5" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

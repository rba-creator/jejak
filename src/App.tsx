import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { configError } from './lib/env'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { BerandaPage } from './pages/BerandaPage'
import { LaporPage } from './pages/LaporPage'
import { DaftarLaporanPage } from './pages/DaftarLaporanPage'
import { DetailLaporanPage } from './pages/DetailLaporanPage'
import { PetaPage } from './pages/PetaPage'
import { TrackingPage } from './pages/TrackingPage'
import { AdminPenggunaPage } from './pages/AdminPenggunaPage'
import { ProfilPage } from './pages/ProfilPage'

export function App() {
  if (configError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg border border-red-200 space-y-3">
          <div className="rounded-full bg-red-100 p-2.5 w-fit text-red-700 font-bold">⚠️</div>
          <h1 className="text-lg font-bold text-slate-900">Konfigurasi Belum Lengkap</h1>
          <p className="text-xs text-slate-600 leading-relaxed">{configError}</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rute Publik */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rute Terproteksi dengan Layout */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<BerandaPage />} />
            <Route path="laporan" element={<DaftarLaporanPage />} />
            <Route path="laporan/baru" element={<LaporPage />} />
            <Route path="laporan/:id" element={<DetailLaporanPage />} />
            <Route path="peta" element={<PetaPage />} />
            <Route
              path="tracking"
              element={
                <RequireAuth peran={['petugas', 'admin_kabupaten', 'admin_provinsi']}>
                  <TrackingPage />
                </RequireAuth>
              }
            />
            <Route
              path="admin/pengguna"
              element={
                <RequireAuth peran={['admin_kabupaten', 'admin_provinsi']}>
                  <AdminPenggunaPage />
                </RequireAuth>
              }
            />
            <Route path="profil" element={<ProfilPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

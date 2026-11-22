import { useEffect, useState, type FormEvent } from 'react'
import { Search, UserCheck } from 'lucide-react'
import { useAuth } from '../auth/context'
import { supabase, pesanError } from '../lib/supabase'
import { muatWilayah } from '../lib/master'
import { LABEL_PERAN } from '../lib/status'
import type { Peran, Profil, Wilayah } from '../lib/types'
import { Kartu, Pesan, Tombol, Field, inputCls } from '../components/ui'

export function AdminPenggunaPage() {
  const { profil } = useAuth()
  const peranSaya = profil?.role

  const [kataKunci, setKataKunci] = useState('')
  const [hasilCari, setHasilCari] = useState<Profil[]>([])
  const [daftarWilayah, setDaftarWilayah] = useState<Wilayah[]>([])
  const [memuat, setMemuat] = useState(false)
  const [simpanMemuat, setSimpanMemuat] = useState(false)
  const [pesan, setPesan] = useState<{ jenis: 'sukses' | 'error'; teks: string } | null>(null)

  // Pengguna terpilih untuk diedit perannya
  const [targetUser, setTargetUser] = useState<Profil | null>(null)
  const [pilihanRole, setPilihanRole] = useState<Peran>('petani')
  const [pilihanWilayah, setPilihanWilayah] = useState<string>('')

  useEffect(() => {
    muatWilayah().then(setDaftarWilayah).catch(() => {})
  }, [])

  async function handleCari(e?: FormEvent) {
    if (e) e.preventDefault()
    if (!kataKunci.trim() || kataKunci.trim().length < 3) {
      setPesan({ jenis: 'error', teks: 'Masukkan minimal 3 huruf email pengguna' })
      return
    }
    setMemuat(true)
    setPesan(null)
    try {
      const { data, error: err } = await supabase.rpc('cari_pengguna', { p_email: kataKunci.trim() })
      if (err) throw err
      setHasilCari((data as Profil[]) || [])
      if (!data || data.length === 0) {
        setPesan({ jenis: 'error', teks: 'Pengguna tidak ditemukan' })
      }
    } catch (err) {
      setPesan({ jenis: 'error', teks: pesanError(err) })
    } finally {
      setMemuat(false)
    }
  }

  function pilihUntukEdit(u: Profil) {
    setTargetUser(u)
    setPilihanRole(u.role)
    setPilihanWilayah(u.kode_wilayah || '')
    setPesan(null)
  }

  async function simpanPeran(e: FormEvent) {
    e.preventDefault()
    if (!targetUser) return
    setSimpanMemuat(true)
    setPesan(null)
    try {
      const { error: err } = await supabase.rpc('atur_peran', {
        p_user_id: targetUser.id,
        p_role: pilihanRole,
        p_kode_wilayah: pilihanWilayah || null
      })
      if (err) throw err
      setPesan({ jenis: 'sukses', teks: `Peran untuk ${targetUser.email} berhasil diperbarui.` })
      setTargetUser(null)
      handleCari()
    } catch (err) {
      setPesan({ jenis: 'error', teks: pesanError(err) })
    } finally {
      setSimpanMemuat(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pengelolaan Peran & Wilayah</h1>
        <p className="text-xs text-slate-500">
          Cari akun pengguna baru untuk menetapkan status Petugas atau Admin Wilayah.
        </p>
      </div>

      {pesan && <Pesan jenis={pesan.jenis}>{pesan.teks}</Pesan>}

      {/* Form Pencarian */}
      <Kartu>
        <form onSubmit={handleCari} className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Cari berdasarkan email (min. 3 huruf)..."
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
          />
          <Tombol type="submit" memuat={memuat} className="shrink-0">
            <Search className="h-4 w-4 mr-1" /> Cari
          </Tombol>
        </form>
      </Kartu>

      {/* Hasil Pencarian */}
      {hasilCari.length > 0 && (
        <Kartu className="space-y-2">
          <h2 className="text-xs font-semibold text-slate-700 border-b pb-1.5">Hasil Pencarian:</h2>
          <div className="space-y-2">
            {hasilCari.map((u) => {
              const wil = daftarWilayah.find((w) => w.kode === u.kode_wilayah)
              return (
                <div
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-50 p-2.5 text-xs border border-slate-200"
                >
                  <div>
                    <p className="font-bold text-slate-900">{u.nama_lengkap || u.email}</p>
                    <p className="text-slate-500">{u.email}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                      <span className="font-semibold text-green-800">{LABEL_PERAN[u.role]}</span>
                      {wil && <span className="text-slate-500">• {wil.nama}</span>}
                    </div>
                  </div>
                  <Tombol varian="sekunder" onClick={() => pilihUntukEdit(u)} className="py-1 px-3 text-xs">
                    Atur Peran
                  </Tombol>
                </div>
              )
            })}
          </div>
        </Kartu>
      )}

      {/* Modal Dialog Atur Peran */}
      {targetUser && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <UserCheck className="h-5 w-5 text-green-700" />
              Atur Peran Pengguna
            </h3>
            <div className="rounded-lg bg-slate-50 p-2 text-xs">
              <span className="font-semibold text-slate-800">{targetUser.nama_lengkap || 'Pengguna'}</span>
              <p className="text-slate-500">{targetUser.email}</p>
            </div>

            <form onSubmit={simpanPeran} className="space-y-3">
              <Field label="Peran (Role) *">
                <select
                  className={inputCls}
                  value={pilihanRole}
                  onChange={(e) => setPilihanRole(e.target.value as Peran)}
                  required
                >
                  <option value="petani">Petani</option>
                  <option value="petugas">Petugas POPT</option>
                  <option value="admin_kabupaten">Admin Kabupaten/Kota</option>
                  {peranSaya === 'admin_provinsi' && <option value="admin_provinsi">Admin Provinsi</option>}
                </select>
              </Field>

              {pilihanRole !== 'petani' && (
                <Field label="Wilayah Tugas / Wewenang *" bantuan="Pilih kabupaten/kota yang sesuai">
                  <select
                    className={inputCls}
                    value={pilihanWilayah}
                    onChange={(e) => setPilihanWilayah(e.target.value)}
                    required
                  >
                    <option value="">-- Pilih Wilayah --</option>
                    {daftarWilayah.map((w) => (
                      <option key={w.kode} value={w.kode}>
                        {w.nama} (Kode: {w.kode})
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Tombol varian="sekunder" onClick={() => setTargetUser(null)} disabled={simpanMemuat}>
                  Batal
                </Tombol>
                <Tombol type="submit" memuat={simpanMemuat}>
                  Simpan Perubahan
                </Tombol>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

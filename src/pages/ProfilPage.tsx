import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, UserCircle, KeyRound, Save, Info } from 'lucide-react'
import { useAuth } from '../auth/context'
import { supabase, pesanError } from '../lib/supabase'
import { LABEL_PERAN } from '../lib/status'
import { Kartu, Pesan, Tombol, Field, inputCls } from '../components/ui'

export function ProfilPage() {
  const { profil, session, keluar, muatUlangProfil } = useAuth()
  const navigate = useNavigate()

  const [nama, setNama] = useState(profil?.nama_lengkap || '')
  const [hp, setHp] = useState(profil?.no_hp || '')
  const [sandiBaru, setSandiBaru] = useState('')

  const [simpanMemuat, setSimpanMemuat] = useState(false)
  const [sandiMemuat, setSandiMemuat] = useState(false)
  const [pesan, setPesan] = useState<{ jenis: 'sukses' | 'error'; teks: string } | null>(null)

  async function handleUpdateProfil(e: FormEvent) {
    e.preventDefault()
    if (!session?.user?.id) return
    setSimpanMemuat(true)
    setPesan(null)
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({ nama_lengkap: nama.trim() || null, no_hp: hp.trim() || null })
        .eq('id', session.user.id)
      if (err) throw err
      await muatUlangProfil()
      setPesan({ jenis: 'sukses', teks: 'Profil berhasil diperbarui' })
    } catch (e) {
      setPesan({ jenis: 'error', teks: pesanError(e) })
    } finally {
      setSimpanMemuat(false)
    }
  }

  async function handleGantiSandi(e: FormEvent) {
    e.preventDefault()
    if (sandiBaru.length < 8) {
      setPesan({ jenis: 'error', teks: 'Kata sandi baru minimal 8 karakter' })
      return
    }
    setSandiMemuat(true)
    setPesan(null)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: sandiBaru })
      if (err) throw err
      setSandiBaru('')
      setPesan({ jenis: 'sukses', teks: 'Kata sandi berhasil diubah' })
    } catch (e) {
      setPesan({ jenis: 'error', teks: pesanError(e) })
    } finally {
      setSandiMemuat(false)
    }
  }

  async function handleKeluar() {
    if (confirm('Keluar dari aplikasi JEJAK-OPT?')) {
      await keluar()
      navigate('/login')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Profil & Pengaturan Akun</h1>

      {pesan && <Pesan jenis={pesan.jenis}>{pesan.teks}</Pesan>}

      {/* Ringkasan Profil & Peran */}
      <Kartu className="space-y-3">
        <div className="flex items-center gap-3 border-b pb-3">
          <UserCircle className="h-12 w-12 text-green-800 shrink-0" />
          <div>
            <h2 className="font-bold text-slate-900">{profil?.nama_lengkap || 'Pengguna'}</h2>
            <p className="text-xs text-slate-500">{profil?.email}</p>
            <span className="inline-block mt-1 rounded bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
              {profil ? LABEL_PERAN[profil.role] : ''}
            </span>
            {profil?.kode_wilayah && (
              <span className="ml-1.5 text-[11px] text-slate-500">Wilayah: {profil.kode_wilayah}</span>
            )}
          </div>
        </div>

        {/* Form Edit Data Diri */}
        <form onSubmit={handleUpdateProfil} className="space-y-3 pt-1">
          <Field label="Nama Lengkap">
            <input className={inputCls} value={nama} onChange={(e) => setNama(e.target.value)} required />
          </Field>
          <Field label="Nomor WhatsApp / HP">
            <input className={inputCls} value={hp} onChange={(e) => setHp(e.target.value)} inputMode="tel" />
          </Field>
          <Tombol type="submit" memuat={simpanMemuat} className="w-full">
            <Save className="h-4 w-4 mr-1.5" /> Simpan Perubahan Profil
          </Tombol>
        </form>
      </Kartu>

      {/* Ganti Sandi */}
      <Kartu className="space-y-3">
        <h2 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5 border-b pb-2">
          <KeyRound className="h-4 w-4 text-slate-500" /> Ganti Kata Sandi
        </h2>
        <form onSubmit={handleGantiSandi} className="space-y-3">
          <Field label="Kata Sandi Baru (Min. 8 karakter)">
            <input
              type="password"
              className={inputCls}
              value={sandiBaru}
              onChange={(e) => setSandiBaru(e.target.value)}
              minLength={8}
              required
            />
          </Field>
          <Tombol type="submit" varian="sekunder" memuat={sandiMemuat} className="w-full">
            Perbarui Kata Sandi
          </Tombol>
        </form>
      </Kartu>

      {/* Info Aplikasi & Offline Storage */}
      <Kartu className="space-y-2 text-xs text-slate-600">
        <h2 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5 border-b pb-2">
          <Info className="h-4 w-4 text-slate-500" /> Informasi Aplikasi
        </h2>
        <div className="flex justify-between py-1">
          <span>Versi PWA:</span>
          <span className="font-mono font-medium">v0.1.0 (PWA Standalone)</span>
        </div>
        <div className="flex justify-between py-1">
          <span>Penyimpanan Offline:</span>
          <span>IndexedDB (idb) & CacheStorage</span>
        </div>
      </Kartu>

      {/* Tombol Logout */}
      <Tombol varian="bahaya" onClick={handleKeluar} className="w-full py-3">
        <LogOut className="h-4 w-4 mr-1.5" /> Keluar dari Akun
      </Tombol>
    </div>
  )
}

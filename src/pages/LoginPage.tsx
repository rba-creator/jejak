import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase, pesanError } from '../lib/supabase'
import { useAuth } from '../auth/context'
import { Field, Pesan, Tombol, inputCls } from '../components/ui'

type Mode = 'masuk' | 'daftar' | 'lupa'

export function LoginPage() {
  const { session } = useAuth()
  const loc = useLocation()
  const [mode, setMode] = useState<Mode>('masuk')
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [nama, setNama] = useState('')
  const [hp, setHp] = useState('')
  const [memuat, setMemuat] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const dari = (loc.state as { dari?: string } | null)?.dari ?? '/'
  if (session) return <Navigate to={dari} replace />

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setMemuat(true)
    try {
      if (mode === 'masuk') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: sandi })
        if (error) throw error
      } else if (mode === 'daftar') {
        if (sandi.length < 8) throw new Error('Kata sandi minimal 8 karakter')
        const { data, error } = await supabase.auth.signUp({
          email,
          password: sandi,
          options: { data: { nama_lengkap: nama, no_hp: hp }, emailRedirectTo: window.location.origin }
        })
        if (error) throw error
        if (!data.session) setInfo('Pendaftaran berhasil. Periksa email Anda untuk konfirmasi, lalu masuk.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/profil`
        })
        if (error) throw error
        setInfo('Tautan atur ulang kata sandi telah dikirim ke email Anda.')
      }
    } catch (err) {
      setError(pesanError(err))
    } finally {
      setMemuat(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-green-900 to-green-700 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto mb-2 h-14 w-14" />
          <h1 className="text-xl font-bold text-green-900">SIPUT-OPT</h1>
          <p className="text-sm text-slate-500">Pelaporan & Pemetaan Serangan OPT</p>
        </div>

        <form onSubmit={kirim} className="space-y-3">
          {mode === 'daftar' && (
            <>
              <Field label="Nama lengkap">
                <input className={inputCls} value={nama} onChange={(e) => setNama(e.target.value)} required autoComplete="name" />
              </Field>
              <Field label="No. HP (opsional)">
                <input className={inputCls} value={hp} onChange={(e) => setHp(e.target.value)} inputMode="tel" autoComplete="tel" />
              </Field>
            </>
          )}
          <Field label="Email">
            <input
              className={inputCls}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </Field>
          {mode !== 'lupa' && (
            <Field label="Kata sandi">
              <input
                className={inputCls}
                type="password"
                value={sandi}
                onChange={(e) => setSandi(e.target.value)}
                required
                minLength={mode === 'daftar' ? 8 : undefined}
                autoComplete={mode === 'daftar' ? 'new-password' : 'current-password'}
              />
            </Field>
          )}

          {error && <Pesan jenis="error">{error}</Pesan>}
          {info && <Pesan jenis="sukses">{info}</Pesan>}

          <Tombol type="submit" memuat={memuat} className="w-full">
            {mode === 'masuk' ? 'Masuk' : mode === 'daftar' ? 'Daftar' : 'Kirim tautan'}
          </Tombol>
        </form>

        <div className="mt-4 space-y-1 text-center text-sm">
          {mode !== 'masuk' && (
            <button className="text-green-800 underline" onClick={() => setMode('masuk')}>
              Sudah punya akun? Masuk
            </button>
          )}
          {mode === 'masuk' && (
            <>
              <button className="block w-full text-green-800 underline" onClick={() => setMode('daftar')}>
                Belum punya akun? Daftar
              </button>
              <button className="block w-full text-slate-500 underline" onClick={() => setMode('lupa')}>
                Lupa kata sandi
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

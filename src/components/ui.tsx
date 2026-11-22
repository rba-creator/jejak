import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { LABEL_STATUS, LABEL_TINGKAT, WARNA_STATUS, HEX_TINGKAT } from '../lib/status'
import type { StatusLaporan, TingkatSerangan } from '../lib/types'

export function Memuat({ teks = 'Memuat…' }: { teks?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-slate-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{teks}</span>
    </div>
  )
}

export function Pesan({ jenis = 'info', children }: { jenis?: 'info' | 'error' | 'sukses' | 'peringatan'; children: ReactNode }) {
  const warna = {
    info: 'bg-sky-50 text-sky-900 border-sky-200',
    error: 'bg-red-50 text-red-900 border-red-200',
    sukses: 'bg-green-50 text-green-900 border-green-200',
    peringatan: 'bg-amber-50 text-amber-900 border-amber-200'
  }[jenis]
  return (
    <div role={jenis === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${warna}`}>
      {children}
    </div>
  )
}

type TombolProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  varian?: 'utama' | 'sekunder' | 'bahaya'
  memuat?: boolean
}

export function Tombol({ varian = 'utama', memuat, className = '', children, disabled, ...rest }: TombolProps) {
  const gaya = {
    utama: 'bg-green-800 text-white hover:bg-green-900 disabled:bg-green-800/50',
    sekunder: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:opacity-50',
    bahaya: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-red-700/50'
  }[varian]
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${gaya} ${className}`}
      disabled={disabled || memuat}
      {...rest}
    >
      {memuat && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function Kartu({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>
}

export function Field({ label, children, bantuan }: { label: string; children: ReactNode; bantuan?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {bantuan && <span className="block text-xs text-slate-500">{bantuan}</span>}
    </label>
  )
}

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/20'

export function BadgeStatus({ status }: { status: StatusLaporan }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${WARNA_STATUS[status]}`}>
      {LABEL_STATUS[status]}
    </span>
  )
}

export function BadgeTingkat({ tingkat }: { tingkat: TingkatSerangan }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-700">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: HEX_TINGKAT[tingkat] }} aria-hidden />
      {LABEL_TINGKAT[tingkat]}
    </span>
  )
}

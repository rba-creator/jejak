export const formatTanggal = (iso: string | null | undefined, jam = true) =>
  iso
    ? new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        ...(jam ? { timeStyle: 'short' } : {})
      }).format(new Date(iso))
    : '-'

export const formatHa = (n: number | null | undefined) =>
  n == null ? '-' : `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(n)} ha`

/** Nilai default input datetime-local (waktu lokal). */
export function sekarangLokal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback untuk konteks non-secure (HTTP LAN)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

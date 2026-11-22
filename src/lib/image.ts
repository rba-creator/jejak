/** Kompres foto di perangkat sebelum upload (hemat kuota data di lapangan). */
export async function kompresFoto(file: Blob, maxSisi = 1600, kualitas = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Berkas bukan gambar')
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const skala = Math.min(1, maxSisi / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * skala)
    const h = Math.round(bmp.height * skala)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', kualitas))
    return blob && blob.size < file.size ? blob : file
  } catch {
    // Format tak didukung decoder (mis. HEIC di sebagian browser): kirim apa adanya.
    return file
  }
}

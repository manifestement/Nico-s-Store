// Compression des photos avant stockage : JPEG (encodage fiable sur Safari iOS),
// 1600 px de côté maximum pour la photo, 320 px pour la miniature des listes.

async function toJpeg(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Uint8Array> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Compression de la photo impossible')
  return new Uint8Array(await blob.arrayBuffer())
}

export interface CompressedPhoto {
  mime: string
  data: Uint8Array
  thumb: Uint8Array
}

export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    return {
      mime: 'image/jpeg',
      data: await toJpeg(bitmap, 1600, 0.82),
      thumb: await toJpeg(bitmap, 320, 0.75),
    }
  } finally {
    bitmap.close()
  }
}

/**
 * Reduz a imagem escolhida (print ou arte do post) no próprio navegador antes de enviar:
 * no máximo 1200 px no lado maior, JPEG, até ~1,2 MB. Assim o servidor nunca recebe arquivo gigante
 * e a página do site carrega rápido. HEIC do iPhone e outros formatos que o navegador não abre dão erro claro.
 */
const MAX_SIDE = 1200
const MAX_BYTES = 1_200_000

export async function shrinkImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem (print ou arte do post).')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Não deu para abrir esta imagem. Tente um print (PNG/JPG).'))
      i.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Seu navegador não conseguiu preparar a imagem.')
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const q of [0.85, 0.75, 0.62, 0.5]) {
      const data = canvas.toDataURL('image/jpeg', q)
      if (data.length * 0.75 <= MAX_BYTES) return data
    }
    throw new Error('Imagem grande demais mesmo reduzida. Tente um print menor.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

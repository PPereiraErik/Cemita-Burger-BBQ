/**
 * Regras puras dos eventos da Agenda (sem banco, sem rede). Testadas em tests/unit/events.test.js.
 */

/** Quanto tempo um evento sem horário de fim continua na agenda depois de começar. */
export const DEFAULT_DURATION_MS = 6 * 60 * 60 * 1000
export const IMAGE_MAX_BYTES = 1_500_000
const IMAGE_TYPES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/webp': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
}

/** Diferença (ms) entre o relógio local do fuso e UTC naquele instante. */
function offsetMs(instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** "2026-10-31" + "20:00" no fuso da loja → instante UTC. */
export function localToUtc(date, time, timeZone) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let t = guess - offsetMs(new Date(guess), timeZone)
  t = guess - offsetMs(new Date(t), timeZone) // segunda passada: acerta perto de mudança de horário
  return new Date(t)
}

/** Instante UTC → { date: 'YYYY-MM-DD', time: 'HH:MM' } no fuso da loja. */
export function utcToLocal(instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

/** Até quando o evento fica na agenda. */
export const visibleUntil = (e) => new Date(e.endsAt ? new Date(e.endsAt).getTime() : new Date(e.startsAt).getTime() + DEFAULT_DURATION_MS)

/** Aparece no site? Só publicado e ainda não terminado. */
export const isVisible = (e, now) => e.status === 'published' && visibleUntil(e).getTime() >= now.getTime()

/**
 * Imagem enviada pelo painel como data URL (já reduzida no navegador).
 * Confere tipo declarado E assinatura do arquivo (não confia no nome nem no tipo informado).
 * Devolve { mime, data: Buffer } ou lança Error com mensagem para a tela.
 */
export function parseImageDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl ?? ''))
  if (!m) throw new Error('Imagem inválida: use JPG, PNG ou WebP.')
  const data = Buffer.from(m[2], 'base64')
  if (!data.length) throw new Error('Imagem vazia.')
  if (data.length > IMAGE_MAX_BYTES) throw new Error('Imagem grande demais (máximo 1,5 MB).')
  if (!IMAGE_TYPES[m[1]](data)) throw new Error('O arquivo não é a imagem que diz ser.')
  return { mime: m[1], data }
}

/** Link de post do Instagram aceito (só https do próprio Instagram). */
export function isInstagramUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && /^(www\.)?instagram\.com$/.test(u.hostname) && /^\/([A-Za-z0-9._]+\/)?(p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)
  } catch {
    return false
  }
}

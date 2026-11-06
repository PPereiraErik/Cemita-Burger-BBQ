/**
 * AVISO DE PEDIDO NOVO — som forte (três toques), vibração (tablet/celular) e título piscando.
 * O navegador só deixa tocar som depois de um toque na página: o botão "Som de pedido novo" liga
 * (e testa) o som, e a escolha fica lembrada neste aparelho.
 */
const KEY = 'cemita:painel:som'
let ctx: AudioContext | null = null
let blink: number | undefined

export const soundWanted = () => {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}
export function setSoundWanted(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* sem storage: vale até fechar */
  }
}

/** Precisa ser chamado num clique (libera o áudio do navegador). Toca um toque curto de teste. */
export async function unlockSound() {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return false
  ctx ??= new AC()
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)
  beep(0, 880, 0.12)
  return ctx.state === 'running'
}
export const soundReady = () => ctx?.state === 'running'

function beep(at: number, freq: number, dur: number) {
  if (!ctx) return
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'square'
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(ctx.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** Pedido novo chegou. */
export function alertNewOrder(text: string) {
  if (soundWanted() && soundReady()) {
    beep(0, 988, 0.18)
    beep(0.25, 1319, 0.18)
    beep(0.5, 988, 0.3)
  }
  try {
    navigator.vibrate?.([300, 150, 300])
  } catch {
    /* sem vibração */
  }
  // título da aba pisca até alguém voltar para a aba
  window.clearInterval(blink)
  if (document.visibilityState !== 'visible') {
    const base = document.title
    let on = false
    blink = window.setInterval(() => {
      on = !on
      document.title = on ? `🔔 ${text}` : base
    }, 1000)
    const stop = () => {
      if (document.visibilityState !== 'visible') return
      window.clearInterval(blink)
      document.title = base
      document.removeEventListener('visibilitychange', stop)
    }
    document.addEventListener('visibilitychange', stop)
  }
}

import { useSyncExternalStore } from 'react'

/**
 * SOM AMBIENTE — sintetizado com Web Audio (nenhum arquivo para baixar).
 * Desligado por padrão; só liga quando o usuário pede.
 *  - ambiente: ruído marrom bem baixo (noite, vento distante)
 *  - brasa: estalos aleatórios de lenha, intensidade controlada pela cena
 *  - efeitos: rangido (caixão), sopro (abrir), toque (lápides, comanda), carimbo
 */
type Listener = () => void
let enabled = false
const listeners = new Set<Listener>()

let ctx: AudioContext | null = null
let master: GainNode | null = null
let crackleGain: GainNode | null = null
let crackleTimer = 0
let fire = 0.15 // 0..1

const emit = () => listeners.forEach((l) => l())

function noiseBuffer(c: AudioContext, seconds: number, brown = false) {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else d[i] = w
  }
  return buf
}

function boot() {
  if (ctx) return
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  // ambiente
  const amb = ctx.createBufferSource()
  amb.buffer = noiseBuffer(ctx, 4, true)
  amb.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 420
  const ambGain = ctx.createGain()
  ambGain.gain.value = 0.18
  amb.connect(lp).connect(ambGain).connect(master)
  amb.start()

  // chiado de brasa (contínuo, segue a intensidade do fogo)
  const hiss = ctx.createBufferSource()
  hiss.buffer = noiseBuffer(ctx, 2)
  hiss.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1800
  bp.Q.value = 0.6
  crackleGain = ctx.createGain()
  crackleGain.gain.value = 0.015
  hiss.connect(bp).connect(crackleGain).connect(master)
  hiss.start()

  scheduleCrackle()
}

function pop(gain: number, freq: number, dur = 0.03) {
  if (!ctx || !master) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, dur)
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = 1.4
  const g = ctx.createGain()
  const t = ctx.currentTime
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(master)
  src.start()
}

function scheduleCrackle() {
  window.clearTimeout(crackleTimer)
  const wait = 900 - fire * 820 + Math.random() * 500
  crackleTimer = window.setTimeout(() => {
    if (enabled) pop(0.12 + fire * 0.35, 1200 + Math.random() * 2600, 0.02 + Math.random() * 0.04)
    scheduleCrackle()
  }, wait)
}

export const sound = {
  get enabled() {
    return enabled
  },
  toggle() {
    enabled = !enabled
    if (enabled) {
      boot()
      ctx?.resume()
    }
    if (ctx && master) master.gain.setTargetAtTime(enabled ? 0.9 : 0, ctx.currentTime, 0.25)
    emit()
  },
  /** intensidade do fogo da cena atual (0..1) */
  setFire(v: number) {
    fire = Math.max(0, Math.min(1, v))
    if (ctx && crackleGain) crackleGain.gain.setTargetAtTime(0.012 + fire * 0.06, ctx.currentTime, 0.2)
  },
  tap() {
    if (enabled) pop(0.25, 2400, 0.025)
  },
  stamp() {
    if (!enabled || !ctx || !master) return
    pop(0.5, 300, 0.08)
    pop(0.2, 1200, 0.03)
  },
  creak() {
    if (!enabled || !ctx || !master) return
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    const g = ctx.createGain()
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 600
    f.Q.value = 6
    const t = ctx.currentTime
    o.frequency.setValueAtTime(70, t)
    o.frequency.linearRampToValueAtTime(110, t + 0.5)
    o.frequency.linearRampToValueAtTime(85, t + 1.1)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.08, t + 0.1)
    g.gain.linearRampToValueAtTime(0, t + 1.2)
    o.connect(f).connect(g).connect(master)
    o.start()
    o.stop(t + 1.3)
  },
  whoosh() {
    if (!enabled || !ctx || !master) return
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 1.6)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    const g = ctx.createGain()
    const t = ctx.currentTime
    f.frequency.setValueAtTime(200, t)
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.7)
    f.frequency.exponentialRampToValueAtTime(300, t + 1.5)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.35, t + 0.5)
    g.gain.linearRampToValueAtTime(0, t + 1.5)
    src.connect(f).connect(g).connect(master)
    src.start()
  },
  subscribe(l: Listener) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export function useSoundOn() {
  return useSyncExternalStore(sound.subscribe, () => enabled, () => false)
}

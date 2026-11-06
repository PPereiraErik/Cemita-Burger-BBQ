import { useSyncExternalStore } from 'react'

/**
 * PREFERÊNCIAS DE ACESSIBILIDADE
 * Cada opção vira um atributo no <html> (data-a11y-*) e o CSS (index.css, seção "acessibilidade")
 * faz o resto. Assim, qualquer parte do site respeita as escolhas sem código extra.
 * As escolhas ficam só neste navegador (localStorage). Sem storage, valem até fechar a aba.
 */
export type A11yPrefs = {
  /** tamanho do texto (1 = padrão) */
  scale: number
  contrast: boolean
  focus: boolean
  motion: boolean
  spacing: boolean
  colorSafe: boolean
  simpleFont: boolean
}

export const SCALE_STEPS = [0.9, 1, 1.15, 1.3, 1.5] as const
export const A11Y_DEFAULTS: A11yPrefs = { scale: 1, contrast: false, focus: false, motion: false, spacing: false, colorSafe: false, simpleFont: false }

const KEY = 'cemita:a11y:v1'

function load(): A11yPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return A11Y_DEFAULTS
    const p = JSON.parse(raw) as Partial<A11yPrefs>
    const scale = SCALE_STEPS.includes(p.scale as (typeof SCALE_STEPS)[number]) ? (p.scale as number) : 1
    return {
      scale,
      contrast: p.contrast === true,
      focus: p.focus === true,
      motion: p.motion === true,
      spacing: p.spacing === true,
      colorSafe: p.colorSafe === true,
      simpleFont: p.simpleFont === true,
    }
  } catch {
    return A11Y_DEFAULTS
  }
}

let prefs: A11yPrefs = typeof window === 'undefined' ? A11Y_DEFAULTS : load()
const listeners = new Set<() => void>()

/** Escreve as preferências no <html>. Chamado na abertura (antes de desenhar) e a cada mudança. */
export function applyA11y(p: A11yPrefs = prefs) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  html.style.setProperty('--a11y-scale', String(p.scale))
  const flag = (name: string, on: boolean, value = 'on') => (on ? html.setAttribute(`data-a11y-${name}`, value) : html.removeAttribute(`data-a11y-${name}`))
  flag('contrast', p.contrast)
  flag('focus', p.focus)
  flag('motion', p.motion, 'reduce')
  flag('spacing', p.spacing)
  flag('colorsafe', p.colorSafe)
  flag('font', p.simpleFont, 'simple')
}

export function setA11y(next: Partial<A11yPrefs>) {
  prefs = { ...prefs, ...next }
  applyA11y(prefs)
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* modo privado: vale até fechar a aba */
  }
  listeners.forEach((l) => l())
}

export const resetA11y = () => setA11y(A11Y_DEFAULTS)
export const isA11yDefault = (p: A11yPrefs) => (Object.keys(A11Y_DEFAULTS) as (keyof A11yPrefs)[]).every((k) => p[k] === A11Y_DEFAULTS[k])

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useA11y = () => useSyncExternalStore(subscribe, () => prefs, () => prefs)

/* ---------- painel: abrir/fechar de qualquer lugar ---------- */
let panelOpen = false
const panelListeners = new Set<() => void>()
const setPanel = (v: boolean) => {
  panelOpen = v
  panelListeners.forEach((l) => l())
}
export const openA11yPanel = () => setPanel(true)
export const closeA11yPanel = () => setPanel(false)
export const useA11yPanel = () =>
  useSyncExternalStore(
    (l) => {
      panelListeners.add(l)
      return () => panelListeners.delete(l)
    },
    () => panelOpen,
    () => panelOpen,
  )

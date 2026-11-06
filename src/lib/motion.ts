/** true quando o usuário pediu menos movimento: no sistema OU no painel de acessibilidade do site. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  (document.documentElement.getAttribute('data-a11y-motion') === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches)

/** Celular/tablet pequeno: animações mais leves e menos partículas. */
export const isSmallScreen = () => typeof window !== 'undefined' && window.innerWidth < 768

export const INTRO_SEEN_KEY = 'cemita:intro-vista'

export const introAlreadySeen = () => {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}
export const markIntroSeen = () => {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    /* modo privado: tudo bem */
  }
}

export const resetIntro = () => {
  try {
    sessionStorage.removeItem(INTRO_SEEN_KEY)
  } catch {
    /* ok */
  }
}

/** 0..1 → 0..1 dentro de [a,b] */
export const range = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)))
export const smooth = (t: number) => t * t * (3 - 2 * t)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const isFinePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

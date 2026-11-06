import { prefersReducedMotion } from './motion'

/**
 * Rolagem nativa (sem biblioteca): mais leve, mais previsível no celular e na TV.
 * stop/start travam a página enquanto o caixão abre ou uma gaveta está aberta.
 */
export function scrollToTarget(target: HTMLElement | number, immediate = false) {
  const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY
  window.scrollTo({ top, behavior: immediate || prefersReducedMotion() ? 'auto' : 'smooth' })
}

let locks = 0
export const stopScroll = () => {
  locks += 1
  document.documentElement.style.overflow = 'hidden'
}
export const startScroll = () => {
  locks = Math.max(0, locks - 1)
  if (!locks) document.documentElement.style.overflow = ''
}

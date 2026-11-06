import type { MouseEvent } from 'react'
import { prefersReducedMotion } from '../lib/motion'

/**
 * Vai para uma seção depois de fechar um menu que trava a rolagem.
 * (Com a página travada, o salto do link #âncora pode parar no meio do caminho.)
 */
export function irPara(id: string, fechar: () => void) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    fechar()
    window.setTimeout(() => {
      const el = document.getElementById(id)
      if (!el) return
      el.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      history.replaceState(null, '', `#${id}`)
      // leva o foco junto (teclado e leitor de tela continuam de onde a pessoa foi)
      el.setAttribute('tabindex', '-1')
      el.focus({ preventScroll: true })
    }, 0)
  }
}

import { useLayoutEffect, type RefObject } from 'react'

/**
 * "O texto nunca sai da pedra": tira o enfeite "R · I · P" se não sobra espaço; encolhe a letra (variável --fit, até 86%); na frente, encurta o resumo
 * dos ingredientes (ou tira) antes de diminuir a foto até o conteúdo caber
 * na área da lápide. Se ainda não couber (texto grande demais para a pedra, ou letra aumentada no
 * painel de acessibilidade), corta a lista de ingredientes em linhas inteiras com reticências;
 * o texto completo continua no botão "detalhes" e no nome acessível.
 * Recalcula quando a pedra muda de tamanho e quando as fontes terminam de carregar.
 */
export function useCabe(box: RefObject<HTMLElement | null>, deps: unknown[]) {
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    let frame = 0
    const run = () => {
      const desc = el.querySelector<HTMLElement>('[data-corta]')
      const resumo = el.querySelector<HTMLElement>('[data-resumo]')
      el.style.setProperty('--fit', '1')
      el.style.setProperty('--foto', '1')
      el.dataset.cortado = ''
      for (const t of [desc, resumo]) {
        if (!t) continue
        t.style.removeProperty('-webkit-line-clamp')
        t.style.removeProperty('display')
        t.style.removeProperty('overflow')
      }
      const rip = el.querySelector<HTMLElement>('[data-rip]')
      if (rip) rip.hidden = false
      if (!el.clientHeight) return
      const sobra = () => el.scrollHeight - el.clientHeight
      // "R · I · P" é enfeite: é o primeiro a sair quando falta espaço (ou quando encosta no texto)
      if (rip) {
        const antes = rip.previousElementSibling as HTMLElement | null
        const folga = antes ? rip.offsetTop - (antes.offsetTop + antes.offsetHeight) : 0
        if (sobra() > 1 || folga < 6) rip.hidden = true
      }
      const cortar = (t: HTMLElement) => {
        const lh = parseFloat(getComputedStyle(t).lineHeight) || 14
        let linhas = Math.max(1, Math.floor((t.offsetHeight - sobra()) / lh))
        t.style.display = '-webkit-box'
        t.style.overflow = 'hidden'
        t.style.setProperty('-webkit-box-orient', 'vertical')
        do {
          t.style.setProperty('-webkit-line-clamp', String(linhas))
          linhas -= 1
        } while (sobra() > 1 && linhas >= 1)
      }
      // frente: o resumo dos ingredientes encurta (ou some) antes de a foto diminuir
      if (sobra() > 1 && resumo) {
        cortar(resumo)
        if (sobra() > 1) resumo.style.display = 'none'
      }
      let fit = 1
      while (sobra() > 1 && fit > 0.86) {
        fit = Math.round((fit - 0.04) * 100) / 100
        el.style.setProperty('--fit', String(fit))
      }
      if (el.querySelector('.lapide-foto')) {
        let foto = 1
        while (sobra() > 1 && foto > 0.5) {
          foto = Math.round((foto - 0.05) * 100) / 100
          el.style.setProperty('--foto', String(foto))
        }
      }
      if (sobra() > 1 && desc) {
        cortar(desc)
        el.dataset.cortado = '1'
      }
    }
    const later = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(run)
    }
    run()
    const ro = new ResizeObserver(later)
    ro.observe(el)
    void document.fonts?.ready.then(later)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

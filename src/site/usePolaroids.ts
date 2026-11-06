import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'
import type { Foto } from '../config/midia'
import { prefersReducedMotion } from '../lib/motion'
import { avancar, inicio, type Rotacao } from '../lib/rotacao'

export const TROCA_MS = 2600

/** Baixa a próxima foto antes de trocar (sem moldura vazia piscando). Desiste em 2,5 s. */
function preload(f: Foto | undefined, sizes: string): Promise<void> {
  if (!f || !f.src) return Promise.resolve()
  return new Promise((resolve) => {
    const img = new Image()
    const done = () => resolve()
    img.onload = done
    img.onerror = done
    window.setTimeout(done, 2500)
    img.sizes = sizes
    if (f.srcset) img.srcset = f.srcset
    img.src = f.src
  })
}

/**
 * Molduras que trocam sozinhas, uma por vez, a cada ~2,6 s.
 * Para quando: a pessoa pausa, pediu menos movimento, a aba está escondida, o bloco saiu da tela
 * ou o mouse/foco está sobre as fotos (WCAG 2.2.2: conteúdo que se move pode ser pausado).
 * `prev` guarda a foto anterior de cada moldura para a troca ser um cruzamento suave.
 */
export function usePolaroids(fotos: Foto[], slots: number, sizes: string) {
  const [rot, setRot] = useState<Rotacao>(() => inicio(slots, fotos.length))
  const [prev, setPrev] = useState<(number | null)[]>(() => Array(slots).fill(null))
  const [pausadoPelaPessoa, setPausado] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const [hover, setHover] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const reduzido = typeof window !== 'undefined' && prefersReducedMotion()

  // menos molduras (ex.: mural no celular): recomeça a rotação com a nova quantidade
  useEffect(() => {
    setRot(inicio(slots, fotos.length))
    setPrev(Array(slots).fill(null))
  }, [slots, fotos.length])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const rodando = !pausadoPelaPessoa && !reduzido && visivel && !hover && fotos.length > slots

  const rotRef = useRef(rot)
  rotRef.current = rot
  useEffect(() => {
    if (!rodando) return
    let vivo = true
    let ocupado = false
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || ocupado) return
      const r = rotRef.current
      const n = avancar(r, fotos.length)
      ocupado = true
      void preload(fotos[n.slots[r.next]], sizes).then(() => {
        ocupado = false
        if (!vivo) return
        setPrev((p) => p.map((v, i) => (i === r.next ? r.slots[i] : v)))
        setRot(n)
      })
    }, TROCA_MS)
    return () => {
      vivo = false
      window.clearInterval(t)
    }
  }, [rodando, fotos, sizes])

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    onFocus: () => setHover(true),
    onBlur: (e: FocusEvent) => !e.currentTarget.contains(e.relatedTarget as Node) && setHover(false),
  }
  const alternar = useCallback(() => setPausado((v) => !v), [])
  return { ref, slots: rot.slots, prev, handlers, pausado: pausadoPelaPessoa, alternar, podeTrocar: !reduzido && fotos.length > slots }
}

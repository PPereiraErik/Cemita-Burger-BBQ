import { useEffect, useRef, type ReactNode } from 'react'
import { startScroll, stopScroll } from '../lib/scroll'

/**
 * Gaveta/modal acessível: trava a rolagem, foca o primeiro controle,
 * fecha no Esc e no fundo, mantém o foco dentro e devolve o foco ao sair.
 * `side`: "bottom" (gaveta do celular), "right" (gaveta lateral), "center" (modal).
 */
export function Dialog({ label, onClose, children, side = 'center', className = '' }: { label: string; onClose: () => void; children: ReactNode; side?: 'bottom' | 'right' | 'center' | 'auto'; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    stopScroll()
    const first = box.current?.querySelector<HTMLElement>('[data-autofocus], button, a, input, textarea')
    first?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !box.current) return
      const f = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, textarea, [tabindex="0"]')]
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault()
        f[f.length - 1].focus()
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault()
        f[0].focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('keydown', key)
      startScroll()
      prev?.focus?.({ preventScroll: true })
    }
  }, [onClose])

  const place =
    side === 'bottom'
      ? 'items-end justify-center'
      : side === 'right'
        ? 'items-stretch justify-end'
        : side === 'auto'
          ? 'items-end justify-center lg:items-stretch lg:justify-end'
          : 'items-end justify-center sm:items-center sm:p-6'
  const anim = side === 'right' ? 'slide-up .01s' : 'slide-up .28s var(--ease-cine)'
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className={`fixed inset-0 z-[120] flex bg-char-2/70 ${place}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className={className} style={{ animation: anim }}>
        {children}
      </div>
    </div>
  )
}

/* Ícones de traço feitos à mão (SVG). Sempre decorativos: o texto ou o aria-label do botão diz o que é. */
type P = { className?: string; size?: number }
const base = (size = 22) => ({ width: size, height: size, 'aria-hidden': true as const, focusable: 'false' as const })

export const IconMenu = ({ className, size = 24 }: P) => (
  <svg {...base(size)} viewBox="0 0 24 20" className={className}>
    <path d="M2 3 C8 2 16 4 22 3 M2 10 C9 11 15 9 22 10 M2 17 C8 16 16 18 22 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </svg>
)
export const IconClose = ({ className, size = 22 }: P) => (
  <svg {...base(size)} viewBox="0 0 22 22" className={className}>
    <path d="M4 4 C9 9 13 12 18 18 M18 4 C13 9 9 13 4 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
  </svg>
)
export const IconSearch = ({ className, size = 22 }: P) => (
  <svg {...base(size)} viewBox="0 0 24 24" className={className}>
    <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <path d="M15.5 15.5 C17.5 17.4 19 19 21 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
  </svg>
)
export const IconPin = ({ className, size = 26 }: P) => (
  <svg {...base(size)} viewBox="0 0 24 24" className={className}>
    <path d="M12 22 C7 15 5 12 5 9 A7 7 0 0 1 19 9 C19 12 17 15 12 22 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="12" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
)
export const IconClock = ({ className, size = 26 }: P) => (
  <svg {...base(size)} viewBox="0 0 24 24" className={className}>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7 L12 12 L15.5 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
export const IconChat = ({ className, size = 26 }: P) => (
  <svg {...base(size)} viewBox="0 0 24 24" className={className}>
    <path d="M4 20 L5.6 15.4 A8.5 8.5 0 1 1 8.8 18.6 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
)
export const IconArrow = ({ className, size = 26 }: P) => (
  <svg {...base(size)} viewBox="0 0 24 24" className={className}>
    <path d="M4 20 L20 4 M9 4 L20 4 L20 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const IconPlus = ({ className, size = 16 }: P) => (
  <svg {...base(size)} viewBox="0 0 18 18" className={className}>
    <path d="M9 3 C9 7 9 11 9 15 M3 9 C7 9 11 9 15 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
  </svg>
)
export const IconPlay = ({ className, size = 34 }: P) => (
  <svg {...base(size)} viewBox="0 0 34 34" className={className}>
    <circle cx="17" cy="17" r="15" fill="rgba(36,21,13,0.6)" stroke="#efe4cc" strokeWidth="1.6" />
    <path d="M13 10 L24 17 L13 24 Z" fill="#efe4cc" />
  </svg>
)
export const IconPause = ({ className, size = 18 }: P) => (
  <svg {...base(size)} viewBox="0 0 18 18" className={className}>
    <path d="M6 4 L6 14 M12 4 L12 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
)
/** Símbolo internacional de acessibilidade (figura de braços abertos). */
export const IconA11y = ({ className, size = 22 }: P) => (
  <svg {...base(size)} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10.5" />
    <circle cx="12" cy="6.6" r="1.4" fill="currentColor" stroke="none" />
    <path d="M6.5 9.4 12 10.6l5.5-1.2M12 10.6v3.6m0 0-2.6 4.6M12 14.2l2.6 4.6" />
  </svg>
)
/** Risco feito à mão sob a categoria escolhida. */
export const Risco = ({ className }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 100 10" preserveAspectRatio="none" className={className}>
    <path d="M2 6 C20 2 40 8 60 4 C75 2 88 7 98 4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />
  </svg>
)
/** Linha ondulada que separa blocos. */
export const Linha = ({ className }: { className?: string }) => (
  <svg aria-hidden="true" width="100%" height="8" viewBox="0 0 1000 8" preserveAspectRatio="none" className={className}>
    <path d="M2 5 C120 2 240 7 380 4 C520 1 640 7 780 4 C880 2 950 6 998 4" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
  </svg>
)

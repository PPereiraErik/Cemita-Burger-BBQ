/**
 * Os três modelos de lápide (desenho do mockup, viewBox 300×440):
 * 0 — arco com contorno duplo e base · 1 — ombros com rachaduras e base · 2 — arredondada com espessura lateral, rachadura e grama.
 * Frente em creme sobre a pedra; verso com borda laranja.
 */
import { useId } from 'react'

const CREME = '#efe4cc'
const LARANJA = '#ffb766'

export function Pedra({ variant, verso }: { variant: 0 | 1 | 2; verso?: boolean }) {
  const linha = verso ? LARANJA : CREME
  const pedra = verso ? '#3a2316' : '#2e1b11'
  const base = verso ? '#2e1b11' : '#3a2316'
  // textura de pedra: pintas claras e escuras bem leves por cima do corpo da lápide
  const id = `grao-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
  const corpo = CORPO[variant]
  return (
    <svg className="lapide-pedra" aria-hidden="true" focusable="false" viewBox="0 0 300 440" preserveAspectRatio="none">
      <defs>
        <pattern id={id} width="23" height="19" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="5" r="1.1" fill={CREME} fillOpacity="0.07" />
          <circle cx="15" cy="13" r="0.8" fill={CREME} fillOpacity="0.06" />
          <circle cx="19" cy="3" r="1.4" fill="#000" fillOpacity="0.18" />
          <circle cx="9" cy="16" r="1" fill="#000" fillOpacity="0.14" />
        </pattern>
      </defs>
      {variant === 0 && (
        <>
          <path d="M32 390 L29 120 L44 104 C54 52 100 22 150 20 C200 22 246 52 256 104 L271 120 L268 390 Z" fill={pedra} stroke={linha} strokeWidth="3" strokeLinejoin="round" />
          <path d="M46 382 L44 126 L57 114 C66 70 106 40 150 38 C194 40 234 70 243 114 L256 126 L254 382 Z" fill="none" stroke={linha} strokeOpacity={verso ? 0.4 : 0.45} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 390 L288 390 L296 436 L4 436 Z" fill={base} stroke={linha} strokeWidth="3" strokeLinejoin="round" />
          {!verso && <path d="M8 414 L292 414" stroke={linha} strokeOpacity="0.45" strokeWidth="1.6" />}
        </>
      )}
      {variant === 1 && (
        <>
          <path d="M36 400 L34 84 L84 80 C98 56 122 42 152 42 C182 44 202 56 216 70 C232 78 250 80 266 82 L264 400 Z" fill={pedra} stroke={linha} strokeWidth="3" strokeLinejoin="round" />
          {verso ? (
            <path d="M266 96 L246 100 L254 118 L240 124 L246 140" fill="none" stroke={linha} strokeOpacity="0.7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ) : (
            <path d="M34 96 L54 100 L46 118 L60 124 L54 140 M264 228 L250 236 L254 248 L242 252" fill="none" stroke={linha} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          <path d="M18 400 L282 400 L288 436 L12 436 Z" fill={base} stroke={linha} strokeWidth="3" strokeLinejoin="round" />
          {!verso && <path d="M15 418 L285 418" stroke={linha} strokeOpacity="0.4" strokeWidth="1.4" />}
        </>
      )}
      {variant === 2 && (
        <>
          {verso ? (
            <>
              <path d="M52 42 C34 64 20 96 18 130 L14 424 L26 424 L30 126 C30 94 38 64 52 42 Z" fill="#1a0f09" stroke={linha} strokeWidth="2.4" strokeLinejoin="round" />
              <path d="M272 424 L274 126 C274 56 216 18 152 16 C88 18 30 56 30 126 L26 424 Z" fill={pedra} stroke={linha} strokeWidth="3" strokeLinejoin="round" />
            </>
          ) : (
            <>
              <path d="M248 42 C266 64 280 96 282 130 L286 424 L274 424 L270 126 C270 94 262 64 248 42 Z" fill="#1a0f09" stroke={linha} strokeWidth="2.4" strokeLinejoin="round" />
              <path d="M28 424 L26 126 C26 56 84 18 148 16 C212 18 270 56 270 126 L274 424 Z" fill={pedra} stroke={linha} strokeWidth="3" strokeLinejoin="round" />
              <path d="M112 30 L124 56 L110 74 M124 56 L144 62 M26 228 L42 236 L26 244" fill="none" stroke={linha} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}
          <path d="M4 438 L14 414 L20 436 L30 408 L38 436 L48 420 L54 438 L246 438 L252 420 L258 436 L268 406 L276 436 L286 414 L296 438 Z" fill={CREME} fillOpacity="0.85" />
        </>
      )}
      <path className="grao" d={corpo} fill={`url(#${id})`} />
    </svg>
  )
}

/** Corpo de cada modelo (o mesmo desenho de cima), para a textura de pedra. */
const CORPO: Record<0 | 1 | 2, string> = {
  0: 'M32 390 L29 120 L44 104 C54 52 100 22 150 20 C200 22 246 52 256 104 L271 120 L268 390 Z M12 390 L288 390 L296 436 L4 436 Z',
  1: 'M36 400 L34 84 L84 80 C98 56 122 42 152 42 C182 44 202 56 216 70 C232 78 250 80 266 82 L264 400 Z M18 400 L282 400 L288 436 L12 436 Z',
  2: 'M28 424 L26 126 C26 56 84 18 148 16 C212 18 270 56 270 126 L274 424 Z',
}

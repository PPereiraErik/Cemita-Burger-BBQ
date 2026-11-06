import { useState } from 'react'
import { accessibility } from '../config/restaurant'
import { SCALE_STEPS, closeA11yPanel, isA11yDefault, resetA11y, setA11y, useA11y, type A11yPrefs } from '../lib/a11y'
import { Dialog } from './Dialog'

/**
 * PAINEL DE ACESSIBILIDADE
 * Abre pelo botão "Acessibilidade" do topo, do menu do celular e do rodapé.
 * Cada opção é um interruptor de verdade (role="switch") com nome e explicação.
 * A mudança é anunciada para leitores de tela (aria-live).
 */
type ToggleKey = Exclude<keyof A11yPrefs, 'scale'>
const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: 'contrast', label: 'Alto contraste', hint: 'Preto no branco, sem cores claras no texto.' },
  { key: 'focus', label: 'Destacar o foco', hint: 'Contorno grosso no botão ou link selecionado (útil para navegar pelo teclado).' },
  { key: 'motion', label: 'Reduzir animações', hint: 'Desliga movimentos, transições e efeitos.' },
  { key: 'spacing', label: 'Espaçar o texto', hint: 'Mais espaço entre linhas, letras e palavras.' },
  { key: 'colorSafe', label: 'Não depender de cor', hint: 'Links sempre sublinhados e o que está escolhido ganha ✓.' },
  { key: 'simpleFont', label: 'Fonte simples nos títulos', hint: 'Troca a letra decorada dos títulos por uma mais fácil de ler.' },
]
const SCALE_LABEL: Record<number, string> = { 0.9: 'Menor', 1: 'Padrão', 1.15: 'Grande', 1.3: 'Maior', 1.5: 'Máximo' }

function Switch({ on, label, hint, onChange }: { on: boolean; label: string; hint: string; onChange: (v: boolean) => void }) {
  const id = `a11y-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="flex items-start justify-between gap-4 border-b-2 border-dashed border-char/15 py-3 last:border-b-0">
      <div className="min-w-0">
        <p id={id} className="font-semibold">
          {label}
        </p>
        <p id={`${id}-hint`} className="text-[0.9rem] leading-snug text-mute">
          {hint}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        aria-describedby={`${id}-hint`}
        onClick={() => onChange(!on)}
        className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border-2 border-char py-1 pr-3 pl-2 font-mono text-[0.74rem] tracking-[.1em] uppercase transition-colors ${on ? 'bg-char text-bone' : 'bg-sheet text-char'}`}
      >
        <span aria-hidden="true" className={`relative h-6 w-10 rounded-full border-2 ${on ? 'border-bone bg-lilac' : 'border-char bg-bone'}`}>
          <span className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-[left] ${on ? 'left-[18px] bg-char' : 'left-[2px] bg-char'}`} />
        </span>
        <span className="switch-state min-w-[5.6em] text-left whitespace-nowrap">{on ? 'Ligado' : 'Desligado'}</span>
      </button>
    </div>
  )
}

export function A11yPanel() {
  const prefs = useA11y()
  const [said, setSaid] = useState('')
  const step = SCALE_STEPS.indexOf(prefs.scale as (typeof SCALE_STEPS)[number])

  const change = (next: Partial<A11yPrefs>, message: string) => {
    setA11y(next)
    setSaid(message)
  }

  return (
    <Dialog label="Acessibilidade" onClose={closeA11yPanel} side="auto" className="paper paper-grain max-h-[94svh] w-full max-w-[480px] overflow-y-auto rounded-t-[14px] border-2 border-b-0 border-char bg-sheet text-char lg:h-full lg:max-h-none lg:rounded-none lg:border-0 lg:border-l-2">
      <div className="px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="t-display text-[2rem]">Acessibilidade</h2>
          <button type="button" data-autofocus onClick={closeA11yPanel} className="t-label min-h-11 px-2" aria-label="Fechar o painel de acessibilidade">
            Fechar ×
          </button>
        </div>
        <p className="mt-1 text-[0.95rem] text-mute">Ajuste o site do seu jeito. As escolhas ficam salvas neste aparelho.</p>

        {/* tamanho do texto */}
        <section aria-labelledby="a11y-size" className="mt-5 rounded-[10px] border-2 border-char p-4">
          <h3 id="a11y-size" className="font-semibold">
            Tamanho do texto
          </h3>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => step > 0 && change({ scale: SCALE_STEPS[step - 1] }, `Texto ${SCALE_LABEL[SCALE_STEPS[step - 1]].toLowerCase()}`)}
              disabled={step <= 0}
              className="grid h-12 min-w-12 place-items-center rounded-full border-2 border-char px-3 text-lg font-semibold disabled:opacity-35"
              aria-label="Diminuir o texto"
            >
              A−
            </button>
            <p className="flex-1 text-center">
              <span className="t-price block text-[1.25rem]">{Math.round(prefs.scale * 100)}%</span>
              <span className="t-label text-mute">{SCALE_LABEL[prefs.scale]}</span>
            </p>
            <button
              type="button"
              onClick={() => step < SCALE_STEPS.length - 1 && change({ scale: SCALE_STEPS[step + 1] }, `Texto ${SCALE_LABEL[SCALE_STEPS[step + 1]].toLowerCase()}`)}
              disabled={step >= SCALE_STEPS.length - 1}
              className="grid h-12 min-w-12 place-items-center rounded-full border-2 border-char px-3 text-xl font-semibold disabled:opacity-35"
              aria-label="Aumentar o texto"
            >
              A+
            </button>
          </div>
        </section>

        <section aria-label="Opções de visualização" className="mt-4">
          {TOGGLES.map((t) => (
            <Switch key={t.key} on={prefs[t.key]} label={t.label} hint={t.hint} onChange={(v) => change({ [t.key]: v }, `${t.label}: ${v ? 'ligado' : 'desligado'}`)} />
          ))}
        </section>

        {/* Libras: só aparece quando houver um recurso de verdade configurado (restaurant.ts → accessibility.libras) */}
        {accessibility.libras && (
          <section aria-labelledby="a11y-libras" className="mt-4 rounded-[10px] border-2 border-char p-4">
            <h3 id="a11y-libras" className="font-semibold">
              Libras
            </h3>
            <a href={accessibility.libras.url} target="_blank" rel="noopener" className="btn-line">
              {accessibility.libras.label} ↗
            </a>
          </section>
        )}

        <button
          type="button"
          onClick={() => {
            resetA11y()
            setSaid('Configurações restauradas para o padrão')
          }}
          disabled={isA11yDefault(prefs)}
          className="btn-ticket mt-6 w-full disabled:opacity-40"
        >
          Restaurar o padrão
        </button>
        <p className="mt-4 text-[0.86rem] leading-snug text-mute">
          O site também segue as preferências do seu aparelho, como "reduzir movimento". Use Tab para navegar pelo teclado e Esc para fechar janelas.
        </p>
        <p role="status" aria-live="polite" className="sr-only">
          {said}
        </p>
      </div>
    </Dialog>
  )
}


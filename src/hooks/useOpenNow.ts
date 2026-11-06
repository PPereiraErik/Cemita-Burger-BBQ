import { useEffect, useState } from 'react'
import { useLive } from '../lib/live'
import { openNote } from '../lib/liveCore'

/**
 * Aberto agora?
 * Com a API ligada: "aberto" vem do servidor (horário cadastrado no banco) e a frase é montada daqui.
 * Sem API (ou fora do ar): conta local de sempre (Joinville, terça a domingo, 18h–23h — ver restaurant.ts).
 */
function localStatus() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date())
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const monday = wd === 'Mon'
  const open = !monday && h >= 18 && h < 23
  let note: string
  if (open) note = 'até as 23h'
  else if (monday) note = 'segunda é folga · volta terça, 18h'
  else if (h < 18) note = 'abre hoje às 18h'
  else note = wd === 'Sun' ? 'volta terça, 18h' : 'abre amanhã às 18h'
  return { open, note }
}

export function useOpenNow() {
  const { store } = useLive()
  const [local, setLocal] = useState(localStatus)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => {
      setLocal(localStatus())
      setNow(new Date())
    }, 60_000)
    return () => window.clearInterval(t)
  }, [])
  if (store && store.hours.length) return { open: store.open, note: openNote(store, now) }
  return local
}

/**
 * Horário da loja no fuso da loja (America/Sao_Paulo), independente do fuso do servidor.
 * Linhas de store_hours: { weekday 0-6 (0 = domingo), opensAt 'HH:MM:SS', closesAt 'HH:MM:SS' }.
 * closesAt menor que opensAt = fecha depois da meia-noite (vira o dia).
 */
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const toMin = (hms) => {
  const [h, m] = String(hms).split(':').map(Number)
  return h * 60 + m
}

export function localClock(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return { weekday: WD[get('weekday')], minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

export function isOpenAt(date, hours, timeZone) {
  const { weekday, minutes } = localClock(date, timeZone)
  return hours.some((h) => {
    const open = toMin(h.opensAt)
    const close = toMin(h.closesAt)
    if (open < close) return h.weekday === weekday && minutes >= open && minutes < close
    // vira a meia-noite
    return (h.weekday === weekday && minutes >= open) || ((h.weekday + 1) % 7 === weekday && minutes < close)
  })
}

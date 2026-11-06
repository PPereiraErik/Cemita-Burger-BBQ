import { useSyncExternalStore } from 'react'

/**
 * MEUS PEDIDOS — guardados só neste aparelho (localStorage), para o cliente voltar ao acompanhamento.
 * Guarda o código e o token de acompanhamento (o servidor só mostra o pedido com os dois).
 * Nada de nome, telefone ou endereço aqui.
 * Pedidos com mais de 2 dias somem da lista.
 */
export type SavedOrder = { code: string; token: string; placedAt: string }

const KEY = 'cemita:pedidos:v1'
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000

function read(): SavedOrder[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as SavedOrder[]) : []
    const now = Date.now()
    return list.filter((o) => o && typeof o.code === 'string' && typeof o.token === 'string' && now - Date.parse(o.placedAt) < MAX_AGE_MS)
  } catch {
    return []
  }
}

let orders: SavedOrder[] = typeof window === 'undefined' ? [] : read()
/** pedido aberto na tela de acompanhamento */
let open: string | null = null
// volta do Mercado Pago (?pedido=CEM-XXXXXX): abre o acompanhamento, se o pedido é deste aparelho, e limpa a URL
if (typeof window !== 'undefined') {
  try {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('pedido')
    if (code) {
      if (orders.some((o) => o.code === code)) open = code
      url.searchParams.delete('pedido')
      for (const k of ['collection_id', 'collection_status', 'payment_id', 'status', 'external_reference', 'payment_type', 'merchant_order_id', 'preference_id', 'site_id', 'processing_mode', 'merchant_account_id'])
        url.searchParams.delete(k)
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
  } catch {
    /* URL estranha: segue sem abrir nada */
  }
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(orders))
  } catch {
    /* sem storage: vale até fechar a aba */
  }
}

export const myOrders = {
  add(o: SavedOrder) {
    orders = [o, ...orders.filter((x) => x.code !== o.code)].slice(0, 5)
    save()
    emit()
  },
  remove(code: string) {
    orders = orders.filter((x) => x.code !== code)
    if (open === code) open = null
    save()
    emit()
  },
  find: (code: string) => orders.find((o) => o.code === code),
  openTracking(code: string) {
    open = code
    emit()
  },
  closeTracking() {
    open = null
    emit()
  },
}

type Snap = { orders: SavedOrder[]; open: string | null }
let snap: Snap = { orders, open }
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getSnap = () => (snap.orders === orders && snap.open === open ? snap : (snap = { orders, open }))
export const useMyOrders = () => useSyncExternalStore(subscribe, getSnap, getSnap)

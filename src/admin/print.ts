import { ticketLines, type AdminOrder } from './core'

/**
 * Imprime o cupom do pedido (feito para impressora térmica de 58/80 mm; numa impressora comum sai
 * uma tira estreita). Usa a janela de impressão do navegador: na impressora térmica configurada como
 * padrão do tablet/computador do balcão, é um toque.
 */
export function printOrder(o: AdminOrder, withContact: boolean) {
  let area = document.getElementById('print-area')
  if (!area) {
    area = document.createElement('div')
    area.id = 'print-area'
    document.body.appendChild(area)
  }
  area.replaceChildren(
    ...ticketLines(o, withContact).map((l) => {
      const el = document.createElement(l.rule ? 'hr' : 'p')
      if (!l.rule) el.textContent = l.text
      if (l.strong) el.className = 'strong'
      if (l.big) el.className = 'big'
      return el
    }),
  )
  window.print()
}

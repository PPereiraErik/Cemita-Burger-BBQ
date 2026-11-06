/**
 * ============================================================
 *  CONFIGURAÇÃO CENTRAL DO CEMITA
 *  Altere aqui e o site inteiro é atualizado.
 * ============================================================
 *
 *  Legenda dos comentários:
 *   ✅ CONFIRMADO  → dado público oficial (Instagram / delivery / Linktree), conferido em 05/10/2026
 *   ⚠️ A CONFIRMAR → precisa ser validado com o restaurante antes de publicar
 */

/** Use este valor para qualquer link que ainda não existe. */
export const PLACEHOLDER = 'COLOCAR_LINK_AQUI'

const whatsappNumber = '5547996838894' // ✅ CONFIRMADO (Linktree / Facebook)

export const restaurant = {
  name: 'Cemita',
  fullName: 'Cemita Burger & BBQ',
  tagline: 'Burger & BBQ',
  description: 'Especialistas em burger & american BBQ', // ✅ bio oficial

  address: {
    street: 'Rua Ottokar Doerffel, 165', // ✅
    district: 'Anita Garibaldi', // ✅ (Instagram: "anita")
    city: 'Joinville', // ✅
    state: 'SC', // ✅
    zip: '89203-001', // ✅
  },

  /** ✅ CONFIRMADO — bio do Instagram/TikTok e horário do delivery (print de 08/10/2026): domingo e terça a sábado 18:00–23:00, segunda fechado */
  hours: [
    { days: 'Terça a domingo', time: '18h às 23h' },
    { days: 'Segunda', time: 'Fechado' },
  ],

  contact: {
    phoneDisplay: '(47) 99683-8894', // ✅
    phoneHref: 'tel:+5547996838894',
    whatsappNumber,
    whatsappUrl: `https://wa.me/${whatsappNumber}`,
  },

  social: {
    instagramHandle: '@cemitaburger', // ✅
    instagramUrl: 'https://instagram.com/cemitaburger', // ✅
    tiktokUrl: 'https://tiktok.com/@cemitaburger', // ✅
    /** ✅ Playlist oficial divulgada no Linktree do Cemita */
    spotifyUrl: 'https://open.spotify.com/playlist/6DisjgDfLLoUtsCHG2Rrm2',
  },

  /**
   * ✅ Formas de pagamento aceitas no delivery oficial (print de 08/10/2026).
   * Valem para o pedido feito no delivery. O pedido pelo próprio site tem as suas (configuradas na API).
   */
  deliveryPayments: ['Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Pix / transferência'],

  order: {
    /**
     * Link do botão "PEDIR AGORA".
     * ✅ Hoje o cemita.com.br redireciona para este delivery (VucaFood).
     * Para trocar de sistema, altere só esta linha.
     */
    url: 'https://www.vucafood.com.br/cemita/3735/delivery',
    /**
     * Se true, o botão "PEDIR" de cada produto abre o produto direto no VucaFood
     * (usa o `orderId` de cada item em menu.ts). Se trocar de sistema, mude para false
     * e todos os botões passam a usar o link geral acima.
     */
    perItemLinks: true,
  },

  reservation: {
    /**
     * ⚠️ A CONFIRMAR — não encontramos sistema de reservas público.
     * Enquanto for PLACEHOLDER, o botão "RESERVAR" abre o WhatsApp com mensagem pronta.
     */
    url: PLACEHOLDER as string,
    whatsappMessage: 'Olá, Cemita! Gostaria de reservar uma mesa. 🔥',
  },

  /**
   * ⚠️ A CONFIRMAR — eventos não foram confirmados.
   * Preencha com o texto real (ex.: noites temáticas, música ao vivo) ou deixe null para ocultar.
   */
  events: null as string | null,
} as const

/**
 * ACESSIBILIDADE — recursos externos.
 * Libras: deixe null até existir um recurso de verdade (vídeo em Libras gravado por intérprete,
 * ou um serviço de tradução contratado). Quando existir, preencha { label, url } e o painel
 * de acessibilidade passa a mostrar o link. Nada de tradutor improvisado.
 */
export const accessibility = {
  libras: null as { label: string; url: string } | null,
}

/* ---------- Helpers derivados (não precisa mexer) ---------- */

export const fullAddress = `${restaurant.address.street} — ${restaurant.address.district}, ${restaurant.address.city}/${restaurant.address.state}`

const mapsQuery = encodeURIComponent(
  `${restaurant.fullName}, ${restaurant.address.street}, ${restaurant.address.city} - ${restaurant.address.state}, ${restaurant.address.zip}`,
)

/** Abre o Google Maps pela busca do endereço (sem coordenadas inventadas). */
export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`
export const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`
export const mapsEmbedUrl = `https://maps.google.com/maps?q=${mapsQuery}&z=16&output=embed`

export const isPlaceholder = (url: string | null | undefined) => !url || url === PLACEHOLDER

export const reservationHref = isPlaceholder(restaurant.reservation.url)
  ? `${restaurant.contact.whatsappUrl}?text=${encodeURIComponent(restaurant.reservation.whatsappMessage)}`
  : restaurant.reservation.url

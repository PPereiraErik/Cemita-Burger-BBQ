/**
 * SEO E COMPARTILHAMENTO — dados estruturados (schema.org) para o Google e a prévia do link
 * no WhatsApp/Instagram. Funções puras: recebem a configuração (restaurant.ts e menu.ts) e
 * devolvem objetos. Nada aqui é digitado à mão, e nada é inventado: o que não está na
 * configuração não entra. Usado no build (seo.plugin.ts) e na Agenda (eventos).
 * Testado em tests/seo.test.ts.
 */

export const SHARE_IMAGE_PATH = '/og-cemita.jpg'

type Address = { street: string; city: string; state: string; zip: string }
export type SeoRestaurant = {
  fullName: string
  description: string
  address: Address
  hours: readonly { days: string; time: string }[]
  contact: { whatsappNumber: string }
  social: { instagramUrl: string; tiktokUrl: string }
  deliveryPayments: readonly string[]
  orderUrl: string | null
}
export type SeoMenuCategory = {
  label: string
  items: readonly { name: string; description?: string; price: number | null; priceFrom?: boolean }[]
}

/** "https://x.com/" + "/a" → "https://x.com/a". Sem endereço do site → null (não dá para gerar link absoluto). */
export const absUrl = (siteUrl: string | null, path: string) => (siteUrl ? siteUrl.replace(/\/+$/, '') + path : null)

/** VITE_SITE_URL → endereço limpo. Só aceita https (ou http://localhost para teste). Vazio/inválido → null. */
export function normalizeSiteUrl(raw: string | undefined | null): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return null
    return (u.origin + u.pathname).replace(/\/+$/, '')
  } catch {
    return null
  }
}

const WEEK = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const WEEK_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "Terça a domingo" + "18h às 23h" → OpeningHoursSpecification. "Fechado" ou formato desconhecido é ignorado (nunca adivinha). */
export function openingHours(hours: SeoRestaurant['hours']) {
  const out: { '@type': 'OpeningHoursSpecification'; dayOfWeek: string[]; opens: string; closes: string }[] = []
  for (const h of hours) {
    const t = h.time.trim().toLowerCase().match(/^(\d{1,2})h(\d{2})?\s*(?:às|as|-|a)\s*(\d{1,2})h(\d{2})?$/)
    if (!t) continue
    const d = h.days.trim().toLowerCase()
    const range = d.match(/^(\S+)\s+a\s+(\S+)$/)
    let days: number[] = []
    if (range && WEEK.includes(range[1]) && WEEK.includes(range[2])) {
      for (let i = WEEK.indexOf(range[1]); ; i = (i + 1) % 7) {
        days.push(i)
        if (WEEK[i] === range[2]) break
      }
    } else if (WEEK.includes(d)) days = [WEEK.indexOf(d)]
    else continue
    const hhmm = (h: string, m?: string) => `${h.padStart(2, '0')}:${m ?? '00'}`
    out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: days.map((i) => WEEK_EN[i]), opens: hhmm(t[1], t[2]), closes: hhmm(t[3], t[4]) })
  }
  return out
}

const brl = (v: number) => v.toFixed(2)

/** Cardápio no formato do Google (Menu → seções → itens, preço em BRL). "A partir de" vira preço mínimo. */
export function menuSchema(categories: readonly SeoMenuCategory[]) {
  return {
    '@type': 'Menu',
    inLanguage: 'pt-BR',
    hasMenuSection: categories.map((c) => ({
      '@type': 'MenuSection',
      name: c.label,
      hasMenuItem: c.items.map((i) => ({
        '@type': 'MenuItem',
        name: i.name,
        ...(i.description ? { description: i.description } : {}),
        ...(i.price == null
          ? {}
          : { offers: i.priceFrom ? { '@type': 'AggregateOffer', lowPrice: brl(i.price), priceCurrency: 'BRL' } : { '@type': 'Offer', price: brl(i.price), priceCurrency: 'BRL' } }),
      })),
    })),
  }
}

const postal = (a: Address) => ({ '@type': 'PostalAddress', streetAddress: a.street, addressLocality: a.city, addressRegion: a.state, postalCode: a.zip, addressCountry: 'BR' })

/** "5547996838894" → "+55 47 99683-8894" (outro formato fica só com o +). */
export const intlPhone = (n: string) => '+' + n.replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, '$1 $2 $3-$4')

export function restaurantSchema(r: SeoRestaurant, menu: readonly SeoMenuCategory[], siteUrl: string | null) {
  const url = siteUrl
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: r.fullName,
    description: r.description,
    ...(url ? { url, image: absUrl(url, SHARE_IMAGE_PATH), logo: absUrl(url, '/logo-512.png') } : {}),
    servesCuisine: ['Hambúrguer', 'Barbecue americano'],
    telephone: intlPhone(r.contact.whatsappNumber),
    address: postal(r.address),
    openingHoursSpecification: openingHours(r.hours),
    paymentAccepted: r.deliveryPayments.join(', '),
    ...(r.orderUrl ? { potentialAction: { '@type': 'OrderAction', target: r.orderUrl } } : {}),
    sameAs: [r.social.instagramUrl, r.social.tiktokUrl],
    hasMenu: menuSchema(menu),
  }
}

export type SeoEvent = { title: string; startsAt: string; endsAt: string | null; summary: string | null; description: string | null; imageUrl: string | null; instagramUrl: string | null }

/**
 * Eventos da Agenda como schema.org Event (presencial, na Cemita).
 * imageAbs devolve o endereço absoluto da arte (ou null se não houver como).
 */
export function eventsSchema(events: readonly SeoEvent[], r: Pick<SeoRestaurant, 'fullName' | 'address'>, siteUrl: string | null, imageAbs: (path: string) => string | null) {
  return events.map((e) => {
    const img = e.imageUrl ? imageAbs(e.imageUrl) : null
    const url = e.instagramUrl ?? absUrl(siteUrl, '/#agenda')
    const text = [e.summary, e.description].filter(Boolean).join(' — ')
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: e.title,
      startDate: e.startsAt,
      ...(e.endsAt ? { endDate: e.endsAt } : {}),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      ...(text ? { description: text } : {}),
      ...(img && /^https?:\/\//.test(img) ? { image: [img] } : {}),
      ...(url ? { url } : {}),
      location: { '@type': 'Place', name: r.fullName, address: postal(r.address) },
      organizer: { '@type': 'Organization', name: r.fullName, ...(siteUrl ? { url: siteUrl } : {}) },
    }
  })
}

/** JSON seguro dentro de <script>: "<" nunca fecha a tag por acidente. */
export const jsonForScript = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c')

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/**
 * Monta o <head> de SEO: JSON-LD do restaurante, og:image (absoluta quando há endereço do site,
 * senão relativa como antes), og:url e canonical (só com endereço do site).
 * Substitui o bloco entre <!-- seo:inicio --> e <!-- seo:fim --> do index.html.
 */
export function seoHead(r: SeoRestaurant, menu: readonly SeoMenuCategory[], siteUrl: string | null) {
  const img = absUrl(siteUrl, SHARE_IMAGE_PATH) ?? SHARE_IMAGE_PATH
  const lines = [
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(`${r.fullName} — burger na brasa`)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    ...(siteUrl ? [`<meta property="og:url" content="${esc(siteUrl + '/')}" />`, `<link rel="canonical" href="${esc(siteUrl + '/')}" />`] : []),
    `<script type="application/ld+json">${jsonForScript(restaurantSchema(r, menu, siteUrl))}</script>`,
  ]
  return lines.join('\n    ')
}

export const SEO_START = '<!-- seo:inicio -->'
export const SEO_END = '<!-- seo:fim -->'

/** Troca o bloco marcado do HTML. Sem marcadores → HTML intacto (nunca quebra a página). */
export function injectSeo(html: string, head: string) {
  const a = html.indexOf(SEO_START)
  const b = html.indexOf(SEO_END)
  if (a < 0 || b < a) return html
  return html.slice(0, a + SEO_START.length) + '\n    ' + head + '\n    ' + html.slice(b)
}

export const robotsTxt = (siteUrl: string | null) => `User-agent: *\nAllow: /\nDisallow: /admin/\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`
export const sitemapXml = (siteUrl: string, lastmod: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${esc(siteUrl)}/</loc><lastmod>${lastmod}</lastmod></url>\n</urlset>\n`

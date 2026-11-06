/** SEO: dados estruturados e prévia de compartilhamento (src/lib/seoCore.ts). */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isPlaceholder, restaurant } from '../src/config/restaurant.ts'
import { eventsSchema, injectSeo, intlPhone, menuSchema, normalizeSiteUrl, openingHours, restaurantSchema, robotsTxt, seoHead, SEO_END, SEO_START, sitemapXml, type SeoRestaurant } from '../src/lib/seoCore.ts'

const r: SeoRestaurant = { ...restaurant, orderUrl: isPlaceholder(restaurant.order.url) ? null : restaurant.order.url }
const menu = [
  { label: 'Smash', items: [{ name: 'Smash Rib', price: 39, description: 'Brioche e costela.' }] },
  { label: 'Acompanhamentos', items: [{ name: 'Fritas', price: 22, priceFrom: true }, { name: 'Sem preço', price: null }] },
]
const parseLd = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1])

describe('horário', () => {
  it('“Terça a domingo, 18h às 23h” vira os 6 dias e ignora “Fechado”', () => {
    const h = openingHours(restaurant.hours)
    assert.equal(h.length, 1)
    assert.deepEqual(h[0].dayOfWeek, ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    assert.equal(h[0].opens, '18:00')
    assert.equal(h[0].closes, '23:00')
  })
  it('dia único, minutos e formato desconhecido', () => {
    assert.deepEqual(openingHours([{ days: 'Sábado', time: '11h30 às 15h' }])[0], { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday'], opens: '11:30', closes: '15:00' })
    assert.deepEqual(openingHours([{ days: 'Feriados', time: '18h às 23h' }, { days: 'Sexta', time: 'a combinar' }]), [])
  })
})

describe('endereço do site', () => {
  it('aceita https e localhost; recusa o resto', () => {
    assert.equal(normalizeSiteUrl('https://cemita.com.br/'), 'https://cemita.com.br')
    assert.equal(normalizeSiteUrl(' https://x.com.br/site/ '), 'https://x.com.br/site')
    assert.equal(normalizeSiteUrl('http://localhost:5173'), 'http://localhost:5173')
    assert.equal(normalizeSiteUrl('http://cemita.com.br'), null)
    assert.equal(normalizeSiteUrl('cemita'), null)
    assert.equal(normalizeSiteUrl(''), null)
    assert.equal(normalizeSiteUrl(undefined), null)
  })
})

describe('restaurante e cardápio', () => {
  it('cardápio com preço em BRL; “a partir de” vira preço mínimo; sem preço fica sem oferta', () => {
    const m = menuSchema(menu)
    assert.equal(m.hasMenuSection[0].hasMenuItem[0].offers?.['@type'], 'Offer')
    assert.equal((m.hasMenuSection[0].hasMenuItem[0].offers as { price: string }).price, '39.00')
    assert.deepEqual(m.hasMenuSection[1].hasMenuItem[0].offers, { '@type': 'AggregateOffer', lowPrice: '22.00', priceCurrency: 'BRL' })
    assert.equal('offers' in m.hasMenuSection[1].hasMenuItem[1], false)
  })
  it('dados vêm da configuração; sem endereço do site, não inventa url nem imagem', () => {
    const s = restaurantSchema(r, menu, null)
    assert.equal(s.name, 'Cemita Burger & BBQ')
    assert.equal(s.telephone, '+55 47 99683-8894')
    assert.equal(s.address.streetAddress, restaurant.address.street)
    assert.equal('url' in s, false)
    assert.equal('image' in s, false)
    const c = restaurantSchema(r, menu, 'https://exemplo.com.br')
    assert.equal(c.url, 'https://exemplo.com.br')
    assert.equal(c.image, 'https://exemplo.com.br/og-cemita.jpg')
  })
  it('telefone fora do padrão só ganha o +', () => assert.equal(intlPhone('123'), '+123'))
})

describe('index.html', () => {
  const base = `<head>\n<title>x</title>\n${SEO_START}\n${SEO_END}\n</head>`
  it('injeta imagem absoluta, og:url, canonical e JSON-LD válido', () => {
    const html = injectSeo(base, seoHead(r, menu, 'https://exemplo.com.br'))
    assert.match(html, /<meta property="og:image" content="https:\/\/exemplo\.com\.br\/og-cemita\.jpg" \/>/)
    assert.match(html, /<link rel="canonical" href="https:\/\/exemplo\.com\.br\/" \/>/)
    assert.match(html, /og:image:width" content="1200"/)
    const ld = parseLd(html)
    assert.equal(ld['@type'], 'Restaurant')
    assert.equal(ld.hasMenu.hasMenuSection.length, 2)
  })
  it('sem endereço do site: imagem relativa e sem canonical', () => {
    const html = injectSeo(base, seoHead(r, menu, null))
    assert.match(html, /og:image" content="\/og-cemita\.jpg"/)
    assert.doesNotMatch(html, /canonical|og:url/)
  })
  it('sem marcadores, o HTML não muda; injetar de novo não duplica', () => {
    assert.equal(injectSeo('<head></head>', 'x'), '<head></head>')
    const once = injectSeo(base, seoHead(r, menu, null))
    assert.equal(injectSeo(once, seoHead(r, menu, null)), once)
  })
  it('texto com “</script>” não fecha a tag', () => {
    const html = seoHead({ ...r, description: 'a </script><b>' }, menu, null)
    assert.equal(html.match(/<\/script>/g)!.length, 1)
    assert.equal(parseLd(html).description, 'a </script><b>')
  })
  it('robots bloqueia o painel; sitemap só com endereço', () => {
    assert.match(robotsTxt(null), /Disallow: \/admin\//)
    assert.doesNotMatch(robotsTxt(null), /Sitemap/)
    assert.match(robotsTxt('https://exemplo.com.br'), /Sitemap: https:\/\/exemplo\.com\.br\/sitemap\.xml/)
    assert.match(sitemapXml('https://exemplo.com.br', '2026-11-03'), /<loc>https:\/\/exemplo\.com\.br\/<\/loc><lastmod>2026-11-03<\/lastmod>/)
  })
})

describe('eventos', () => {
  const ev = { title: 'Halloween no Cemita', startsAt: '2026-10-31T23:00:00.000Z', endsAt: null, summary: 'Concurso de fantasias', description: null, imageUrl: '/api/v1/events/1/image', instagramUrl: null }
  it('vira Event presencial no endereço da Cemita', () => {
    const [e] = eventsSchema([ev], r, 'https://exemplo.com.br', (p) => 'https://api.exemplo.com.br' + p)
    assert.equal(e['@type'], 'Event')
    assert.equal(e.startDate, ev.startsAt)
    assert.equal(e.eventAttendanceMode, 'https://schema.org/OfflineEventAttendanceMode')
    assert.equal(e.location.address.streetAddress, restaurant.address.street)
    assert.deepEqual(e.image, ['https://api.exemplo.com.br/api/v1/events/1/image'])
    assert.equal(e.url, 'https://exemplo.com.br/#agenda')
    assert.equal(e.description, 'Concurso de fantasias')
    assert.equal('endDate' in e, false)
  })
  it('link do post tem prioridade; imagem sem endereço absoluto fica de fora', () => {
    const [e] = eventsSchema([{ ...ev, instagramUrl: 'https://www.instagram.com/p/x/' }], r, null, () => null)
    assert.equal(e.url, 'https://www.instagram.com/p/x/')
    assert.equal('image' in e, false)
  })
})

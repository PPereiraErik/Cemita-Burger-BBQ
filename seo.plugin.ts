/**
 * Plugin do Vite: SEO e prévia de compartilhamento gerados a partir da configuração.
 * - injeta no index.html (entre <!-- seo:inicio --> e <!-- seo:fim -->) o JSON-LD do restaurante
 *   com o cardápio e os preços, a imagem de compartilhamento e, se houver endereço do site,
 *   og:url e canonical;
 * - com VITE_SITE_URL definida, gera também robots.txt e sitemap.xml no build.
 * Endereço do site: VITE_SITE_URL (ex.: https://cemita.com.br). Sem ela, nada de link absoluto
 * é inventado (a imagem fica relativa, como antes).
 */
import type { Plugin } from 'vite'
import { seoMenu, seoRestaurant } from './src/config/seo'
import { injectSeo, normalizeSiteUrl, robotsTxt, seoHead, sitemapXml } from './src/lib/seoCore'

export function seoPlugin(rawSiteUrl: string | undefined): Plugin {
  const siteUrl = normalizeSiteUrl(rawSiteUrl)
  return {
    name: 'cemita-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // só a página do site; o painel (/admin/) não entra no Google
        if (/admin[\\/]index\.html$/.test(ctx.filename)) return html
        return injectSeo(html, seoHead(seoRestaurant, seoMenu, siteUrl))
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
      if (siteUrl) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl, new Date().toISOString().slice(0, 10)) })
    },
  }
}

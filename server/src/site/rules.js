/**
 * Regras puras para servir o site e o painel pela própria API (um serviço só em produção).
 * Sem dependências: testadas em tests/unit/site.test.js.
 */

/** Política de segurança do site (tudo é servido daqui; nada externo é carregado). */
export const SITE_CSP = Object.freeze({
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  // estilos inline: o React usa style="", e o GSAP anima por estilo
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'blob:'],
  fontSrc: ["'self'", 'data:'],
  mediaSrc: ["'self'"],
  connectSrc: ["'self'"],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
})

/** Cache: arquivos com hash no nome (o Vite gera em /assets) duram 1 ano; HTML sempre confere se mudou. */
export function cacheControlFor(urlPath) {
  if (/\.html?$/i.test(urlPath) || urlPath.endsWith('/')) return 'no-cache'
  if (/^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i.test(urlPath)) return 'public, max-age=31536000, immutable'
  return 'public, max-age=86400'
}

/**
 * Para onde vai um endereço que não é arquivo:
 * - /api/... → null (a API responde, inclusive o 404 dela);
 * - /admin e /admin/... → o painel;
 * - caminho com extensão (ex.: /foto.png que não existe) → null (404 de verdade, não a página);
 * - o resto → a página do site.
 */
export function fallbackFor(urlPath) {
  if (urlPath === '/api' || urlPath.startsWith('/api/')) return null
  if (urlPath === '/admin' || urlPath.startsWith('/admin/')) return 'admin/index.html'
  const last = urlPath.split('/').pop() ?? ''
  if (/\.[A-Za-z0-9]{1,8}$/.test(last)) return null
  return 'index.html'
}

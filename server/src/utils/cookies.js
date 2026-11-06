/**
 * Cookies sem dependência extra.
 * O cookie da sessão do painel é: HttpOnly (JavaScript não lê), SameSite=Strict (outro site não envia),
 * Path=/api/v1/admin (só vai para as rotas do painel) e Secure em produção (só HTTPS).
 */
export const SESSION_COOKIE = 'cemita_sess'
export const COOKIE_PATH = '/api/v1/admin'

export function parseCookies(header = '') {
  const out = {}
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (!k || k in out) continue
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim())
    } catch {
      /* valor malformado: ignora */
    }
  }
  return out
}

export function sessionCookie(token, { maxAgeSeconds, secure }) {
  return [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, `Path=${COOKIE_PATH}`, `Max-Age=${maxAgeSeconds}`, 'HttpOnly', 'SameSite=Strict', ...(secure ? ['Secure'] : [])].join('; ')
}

export const clearSessionCookie = ({ secure }) => sessionCookie('', { maxAgeSeconds: 0, secure })

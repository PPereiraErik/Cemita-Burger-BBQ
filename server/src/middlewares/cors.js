/**
 * CORS só para as origens listadas em CORS_ORIGINS (o site e o painel).
 * - Origem fora da lista: nenhum cabeçalho CORS (o navegador bloqueia a leitura);
 *   pré-verificação (OPTIONS) de origem fora da lista recebe 403.
 * - API pública: sem cookies (Access-Control-Allow-Credentials ausente).
 * - Painel (/api/v1/admin): com cookie de sessão (credentials), PATCH/PUT/DELETE e X-CSRF-Token.
 *   O cookie é SameSite=Strict: o painel precisa estar no MESMO site da API
 *   (ex.: cemita.com.br e api.cemita.com.br; em dev, localhost:5173 e localhost:3333).
 * - Requisição sem Origin (curl, servidor, testes) passa normalmente: CORS é proteção do navegador,
 *   não autenticação.
 */
const PUBLIC = {
  methods: 'GET, POST',
  headers: 'Content-Type, Idempotency-Key, X-Tracking-Token, X-Request-Id',
}
const ADMIN = {
  methods: 'GET, POST, PATCH, PUT, DELETE',
  headers: 'Content-Type, X-CSRF-Token, X-Request-Id',
}
const EXPOSED_HEADERS = 'X-Request-Id'
export const ADMIN_PREFIX = '/api/v1/admin'
const isAdmin = (path = '') => path === ADMIN_PREFIX || path.startsWith(ADMIN_PREFIX + '/')

export function cors(origins) {
  const allowed = new Set(origins)
  return (req, res, next) => {
    const origin = req.get('origin')
    if (!origin) return next()

    res.vary('Origin')
    const ok = allowed.has(origin)
    const admin = isAdmin(req.path)
    const policy = admin ? ADMIN : PUBLIC
    const creds = admin ? { 'Access-Control-Allow-Credentials': 'true' } : {}
    if (req.method === 'OPTIONS') {
      if (!ok) return res.status(403).json({ error: { code: 'CORS_ORIGIN_DENIED', message: 'Origem não autorizada.', requestId: req.id } })
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': policy.methods,
        'Access-Control-Allow-Headers': policy.headers,
        'Access-Control-Max-Age': '600',
        ...creds,
      })
      return res.status(204).end()
    }
    if (ok) res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Expose-Headers': EXPOSED_HEADERS, ...creds })
    next()
  }
}

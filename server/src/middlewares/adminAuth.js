import { can } from '../domain/permissions.js'
import { AppError } from '../utils/errors.js'
import { parseCookies, SESSION_COOKIE } from '../utils/cookies.js'

const UNAUTH = () => new AppError(401, 'UNAUTHENTICATED', 'Entre no painel para continuar.')
const FORBIDDEN = () => new AppError(403, 'FORBIDDEN', 'Seu acesso não permite esta ação.')

/** Cookie → sessão válida → req.admin = { user, session, csrfHash }. */
export function adminAuth(auth) {
  return async (req, _res, next) => {
    const token = parseCookies(req.get('cookie'))[SESSION_COOKIE]
    const ctx = await auth.authenticate(token)
    if (!ctx) return next(UNAUTH())
    req.admin = ctx
    next()
  }
}

/** Toda escrita (POST/PATCH/PUT/DELETE) exige o cabeçalho X-CSRF-Token da sessão. */
export function requireCsrf(auth) {
  return (req, _res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next()
    if (!auth.csrfOk(req.admin.csrfHash, req.get('x-csrf-token'))) return next(new AppError(403, 'CSRF_INVALID', 'Sessão desatualizada. Recarregue a página do painel.'))
    next()
  }
}

/** Confere a permissão na tabela de permissions.js. */
export const requireCan = (action) => (req, _res, next) => next(can(req.admin.user.role, action) ? undefined : FORBIDDEN())
export const forbidden = FORBIDDEN

/**
 * Limite de tentativas de login por IP (memória do processo; some ao reiniciar).
 * Complementa a trava por conta: impede testar muitos e-mails do mesmo lugar.
 * Com mais de uma instância do servidor, isto precisa ir para um armazenamento comum (Etapa 7).
 */
export function loginRateLimit({ max = 10, windowMs = 15 * 60_000, clock = () => new Date() } = {}) {
  const hits = new Map()
  return (req, res, next) => {
    const now = clock().getTime()
    const key = req.ip ?? 'unknown'
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
      return next()
    }
    entry.count++
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      return next(new AppError(429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas deste aparelho. Espere alguns minutos.'))
    }
    next()
  }
}

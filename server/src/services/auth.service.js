import { randomBytes } from 'node:crypto'
import { Op } from 'sequelize'
import { ROLES } from '../domain/constants.js'
import { AppError } from '../utils/errors.js'
import { sameHash, sha256 } from '../utils/ids.js'
import { burnTime, hashPassword, needsRehash, passwordProblem, verifyPassword } from '../utils/password.js'

/**
 * LOGIN DA EQUIPE
 * - Mesma resposta para e-mail inexistente e senha errada (não revela quem tem conta).
 * - 5 erros seguidos travam a conta por 15 minutos (o contador zera no login certo).
 * - Sessão: token aleatório de 32 bytes no cookie; no banco só o sha256 dele.
 * - Anti-CSRF: um segundo token, entregue no corpo da resposta, que o painel manda no cabeçalho
 *   X-CSRF-Token em toda escrita. No banco, só o sha256.
 * - Sem conta padrão: a primeira conta nasce pelo comando `npm run admin:create`.
 */
export const MAX_FAILED = 5
export const LOCK_MINUTES = 15

const INVALID = () => new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
const LOCKED = () => new AppError(429, 'ACCOUNT_LOCKED', `Muitas tentativas. Espere ${LOCK_MINUTES} minutos e tente de novo.`)

export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, lastLoginAt: u.lastLoginAt ?? null })
const normEmail = (e) => String(e ?? '').trim().toLowerCase()
const token = () => randomBytes(32).toString('base64url')

export function createAuthService({ models, env, clock, audit }) {
  const { User, Session } = models
  const ttlMs = env.SESSION_TTL_HOURS * 3600_000

  async function login(email, password, { ip } = {}) {
    const now = clock()
    const user = await User.scope('withPassword').findOne({ where: { email: normEmail(email) } })
    if (!user) {
      await burnTime(String(password ?? ''))
      throw INVALID()
    }
    if (user.lockedUntil && user.lockedUntil > now) {
      await audit.log({ userId: user.id, action: 'login.locked', entity: 'user', entityId: user.id, ip })
      throw LOCKED()
    }
    const ok = user.active && (await verifyPassword(String(password ?? ''), user.passwordHash))
    if (!ok) {
      const failed = user.failedLogins + 1
      const lock = failed >= MAX_FAILED
      await user.update({ failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : user.lockedUntil })
      await audit.log({ userId: user.id, action: lock ? 'login.lock' : 'login.fail', entity: 'user', entityId: user.id, ip })
      throw lock ? LOCKED() : INVALID()
    }

    const patch = { failedLogins: 0, lockedUntil: null, lastLoginAt: now }
    if (needsRehash(user.passwordHash)) patch.passwordHash = await hashPassword(String(password))
    await user.update(patch)

    const sessionToken = token()
    const csrfToken = token()
    await Session.create({ sid: sha256(sessionToken), userId: user.id, expires: new Date(now.getTime() + ttlMs), data: JSON.stringify({ csrfHash: sha256(csrfToken) }) })
    // limpeza preguiçosa: sessões vencidas desta pessoa
    await Session.destroy({ where: { userId: user.id, expires: { [Op.lt]: now } } })
    await audit.log({ userId: user.id, action: 'login.ok', entity: 'user', entityId: user.id, ip })
    return { user: publicUser(user), sessionToken, csrfToken, maxAgeSeconds: Math.floor(ttlMs / 1000) }
  }

  /** Sessão válida → { user, session, csrfHash }. Senão null. */
  async function authenticate(sessionToken) {
    if (!sessionToken || sessionToken.length > 100) return null
    const s = await Session.findByPk(sha256(sessionToken), { include: [{ model: User, as: 'user' }] })
    if (!s) return null
    if (s.expires <= clock() || !s.user || !s.user.active) {
      await s.destroy()
      return null
    }
    let data = {}
    try {
      data = JSON.parse(s.data)
    } catch {
      /* sessão corrompida */
    }
    return { user: s.user, session: s, csrfHash: data.csrfHash ?? '' }
  }

  /** Renova o token anti-CSRF (o painel chama ao recarregar a página). */
  async function refreshCsrf(session) {
    const csrfToken = token()
    await session.update({ data: JSON.stringify({ csrfHash: sha256(csrfToken) }) })
    return csrfToken
  }

  const csrfOk = (csrfHash, header) => !!header && sameHash(csrfHash, sha256(header))

  async function logout(session, { ip } = {}) {
    await audit.log({ userId: session.userId, action: 'logout', entity: 'user', entityId: session.userId, ip })
    await session.destroy()
  }

  async function changePassword(userId, current, next, { ip } = {}) {
    const user = await User.scope('withPassword').findByPk(userId)
    if (!user || !(await verifyPassword(String(current ?? ''), user.passwordHash))) throw new AppError(400, 'WRONG_PASSWORD', 'A senha atual não confere.')
    const problem = passwordProblem(next, user)
    if (problem) throw new AppError(422, 'WEAK_PASSWORD', problem)
    await user.update({ passwordHash: await hashPassword(next) })
    // sai de todas as outras sessões
    await Session.destroy({ where: { userId } })
    await audit.log({ userId, action: 'password.change', entity: 'user', entityId: userId, ip })
  }

  /** Cria conta (painel: só admin; ou o comando admin:create). Nunca com senha padrão. */
  async function createUser({ name, email, role, password }, { actorId = null, ip } = {}) {
    if (!ROLES.includes(role)) throw new AppError(422, 'INVALID_ROLE', 'Papel inválido.')
    const problem = passwordProblem(password, { email, name })
    if (problem) throw new AppError(422, 'WEAK_PASSWORD', problem)
    const exists = await User.findOne({ where: { email: normEmail(email) } })
    if (exists) throw new AppError(409, 'EMAIL_TAKEN', 'Já existe uma conta com este e-mail.')
    const user = await User.create({ name: String(name).trim(), email: normEmail(email), role, passwordHash: await hashPassword(password) })
    await audit.log({ userId: actorId, action: 'user.create', entity: 'user', entityId: user.id, meta: { role }, ip })
    return publicUser(user)
  }

  return { login, authenticate, refreshCsrf, csrfOk, logout, changePassword, createUser }
}

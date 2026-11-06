import { createHmac } from 'node:crypto'

/**
 * REGISTRO (auditoria) do painel: quem fez o quê e quando.
 * Nunca guarda dado pessoal de cliente nem senha. O IP vira um HMAC (dá para ver que foi o
 * mesmo aparelho, sem guardar o IP).
 */
export function createAuditService({ models, env }) {
  const { AuditLog } = models
  const ipHash = (ip) => (ip ? createHmac('sha256', env.TRACKING_TOKEN_SECRET).update(`ip:${ip}`).digest('hex') : null)

  async function log({ userId = null, action, entity, entityId = null, meta = null, ip = null, transaction }) {
    await AuditLog.create({ userId, action, entity, entityId: entityId == null ? null : String(entityId), meta, ipHash: ipHash(ip) }, { transaction })
  }

  async function latest({ limit = 100 } = {}) {
    const rows = await AuditLog.findAll({ order: [['id', 'DESC']], limit: Math.min(limit, 300), include: [{ association: 'user', attributes: ['id', 'name', 'role'] }] })
    return rows.map((r) => ({ id: Number(r.id), at: r.createdAt, action: r.action, entity: r.entity, entityId: r.entityId, meta: r.meta, user: r.user ? { id: r.user.id, name: r.user.name, role: r.user.role } : null }))
  }

  return { log, latest }
}

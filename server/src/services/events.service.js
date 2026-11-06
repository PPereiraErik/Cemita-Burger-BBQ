import { Op } from 'sequelize'
import { DEFAULT_DURATION_MS, isVisible, localToUtc, parseImageDataUrl, utcToLocal } from '../domain/events.js'
import { AppError, notFound } from '../utils/errors.js'

const DEFAULT_TZ = 'America/Sao_Paulo'
const ADMIN_ATTRS = { exclude: ['imageData'] }

/**
 * EVENTOS DA AGENDA. Cadastro pela equipe (painel), leitura pública só do que está publicado e não terminou.
 * `extractor` (opcional): IA que lê arte + legenda do post e devolve um rascunho para conferir.
 */
export function createEventsService({ models, clock, audit, store, extractor = null, logger }) {
  const { Event } = models

  const timeZone = async () => (await store.settings()).store_timezone || DEFAULT_TZ
  const imageUrl = (e) => (e.imageMime ? `/events/${e.id}/image?v=${e.imageVersion}` : null)

  function publicView(e, tz) {
    const start = utcToLocal(e.startsAt, tz)
    return {
      id: e.id,
      title: e.title,
      startsAt: new Date(e.startsAt).toISOString(),
      endsAt: e.endsAt ? new Date(e.endsAt).toISOString() : null,
      date: start.date,
      time: start.time,
      summary: e.summary,
      description: e.description,
      highlights: e.highlights ?? [],
      reservation: e.reservation,
      instagramUrl: e.instagramUrl,
      imageUrl: imageUrl(e),
    }
  }
  const adminView = (e, tz) => ({
    ...publicView(e, tz),
    endTime: e.endsAt ? utcToLocal(e.endsAt, tz).time : null,
    status: e.status,
    // no painel a arte vem pela rota do painel (rascunho também tem imagem)
    imageUrl: e.imageMime ? `/admin/events/${e.id}/image?v=${e.imageVersion}` : null,
    visible: isVisible(e, clock()),
    updatedAt: e.updatedAt,
  })

  // ── público
  async function listPublic() {
    const now = clock()
    const tz = await timeZone()
    // filtro largo no banco; a regra exata (fim ou início + 6 h) é a mesma do isVisible
    const rows = await Event.findAll({
      where: { status: 'published', startsAt: { [Op.gte]: new Date(now.getTime() - 7 * 24 * 3600_000) } },
      attributes: ADMIN_ATTRS,
      order: [['startsAt', 'ASC']],
      limit: 50,
    })
    return rows.filter((e) => isVisible(e, now)).slice(0, 12).map((e) => publicView(e, tz))
  }

  async function image(id) {
    const e = await Event.findByPk(id, { attributes: ['id', 'status', 'imageMime', 'imageData'] })
    if (!e || e.status !== 'published' || !e.imageData) throw notFound('Imagem')
    return { mime: e.imageMime, data: e.imageData }
  }

  // ── painel
  async function adminImage(id) {
    const e = await Event.findByPk(id, { attributes: ['id', 'imageMime', 'imageData'] })
    if (!e || !e.imageData) throw notFound('Imagem')
    return { mime: e.imageMime, data: e.imageData }
  }

  async function listAdmin() {
    const tz = await timeZone()
    const since = new Date(clock().getTime() - 30 * 24 * 3600_000)
    const rows = await Event.findAll({ where: { [Op.or]: [{ startsAt: { [Op.gte]: since } }, { status: 'draft' }] }, attributes: ADMIN_ATTRS, order: [['startsAt', 'ASC']], limit: 200 })
    return rows.map((e) => adminView(e, tz))
  }

  async function toRow(input, tz) {
    const startsAt = localToUtc(input.date, input.time, tz)
    let endsAt = null
    if (input.endTime) {
      endsAt = localToUtc(input.date, input.endTime, tz)
      if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3600_000) // termina depois da meia-noite
      if (endsAt.getTime() - startsAt.getTime() > 3 * DEFAULT_DURATION_MS) throw new AppError(422, 'VALIDATION_ERROR', 'Horário de fim estranho: confira.', { fields: [{ path: 'endTime', message: 'confira o horário de fim' }] })
    }
    const row = {
      title: input.title,
      startsAt,
      endsAt,
      summary: input.summary,
      description: input.description,
      highlights: input.highlights?.length ? input.highlights : null,
      reservation: input.reservation,
      instagramUrl: input.instagramUrl,
      status: input.status,
    }
    if (input.image !== undefined) {
      if (input.image === null) Object.assign(row, { imageMime: null, imageData: null })
      else {
        let img
        try {
          img = parseImageDataUrl(input.image)
        } catch (err) {
          throw new AppError(422, 'VALIDATION_ERROR', err.message, { fields: [{ path: 'image', message: err.message }] })
        }
        Object.assign(row, { imageMime: img.mime, imageData: img.data })
      }
    }
    return row
  }

  async function create(input, user, { ip } = {}) {
    const tz = await timeZone()
    const row = await toRow(input, tz)
    const e = await Event.create({ ...row, imageVersion: row.imageData ? 1 : 0, createdByUserId: user.id, updatedByUserId: user.id })
    await audit.log({ userId: user.id, action: 'event.create', entity: 'event', entityId: e.id, meta: { title: e.title, status: e.status }, ip })
    return adminView(e, tz)
  }

  async function update(id, input, user, { ip } = {}) {
    const tz = await timeZone()
    const e = await Event.findByPk(id)
    if (!e) throw notFound('Evento')
    const row = await toRow(input, tz)
    const before = e.status
    if (input.image !== undefined) row.imageVersion = e.imageVersion + 1
    await e.update({ ...row, updatedByUserId: user.id })
    await audit.log({ userId: user.id, action: 'event.update', entity: 'event', entityId: e.id, meta: { title: e.title, from: before, to: e.status }, ip })
    return adminView(e, tz)
  }

  async function remove(id, user, { ip } = {}) {
    const e = await Event.findByPk(id, { attributes: ADMIN_ATTRS })
    if (!e) throw notFound('Evento')
    await e.destroy()
    await audit.log({ userId: user.id, action: 'event.delete', entity: 'event', entityId: id, meta: { title: e.title }, ip })
  }

  async function extract({ caption, image: dataUrl }) {
    if (!extractor) throw new AppError(409, 'AI_DISABLED', 'A leitura automática não está ligada no servidor. Preencha os campos à mão.')
    let image = null
    if (dataUrl) {
      try {
        image = parseImageDataUrl(dataUrl)
      } catch (err) {
        throw new AppError(422, 'VALIDATION_ERROR', err.message, { fields: [{ path: 'image', message: err.message }] })
      }
    }
    try {
      return await extractor.extract({ caption, image, now: clock(), timeZone: await timeZone() })
    } catch (err) {
      logger?.warn({ err: { message: err.message, status: err.status } }, 'falha na leitura do post pela IA')
      throw new AppError(502, 'AI_UNAVAILABLE', 'Não deu para ler o post agora. Tente de novo ou preencha à mão.')
    }
  }

  return { listPublic, image, adminImage, listAdmin, create, update, remove, extract, aiReady: !!extractor }
}

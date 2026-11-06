import { AppError } from '../utils/errors.js'

/** Rota inexistente: 404 no mesmo formato de erro da API. */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Rota não encontrada.' } })
}

/**
 * Formato único de erro: { error: { code, message, requestId } }.
 * Nunca devolve pilha nem mensagem interna; isso fica só no log.
 */
export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    let status = 500
    let body = { code: 'INTERNAL_ERROR', message: 'Algo deu errado do nosso lado. Tente de novo em instantes.' }

    if (err instanceof AppError) {
      status = err.status
      body = { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) }
    } else if (err?.type === 'entity.parse.failed') {
      status = 400
      body = { code: 'INVALID_JSON', message: 'O corpo da requisição não é um JSON válido.' }
    } else if (err?.type === 'entity.too.large') {
      status = 413
      body = { code: 'PAYLOAD_TOO_LARGE', message: 'Requisição grande demais.' }
    }

    if (status >= 500) logger.error({ err, requestId: req.id }, 'erro não tratado')
    else logger.warn({ code: body.code, status, requestId: req.id }, 'requisição recusada')

    res.status(status).json({ error: { ...body, requestId: req.id } })
  }
}

import { AppError } from '../utils/errors.js'

/**
 * Valida req.body com um schema zod. Erro = 400 com a lista de campos (sem ecoar valores).
 * O controller recebe o valor JÁ normalizado em req.valid.
 */
export function validateBody(schema, message = 'Alguns dados do pedido estão inválidos.') {
  return (req, _res, next) => {
    const r = schema.safeParse(req.body ?? {})
    if (!r.success) {
      const fields = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.code === 'unrecognized_keys' ? `campo não permitido: ${i.keys.join(', ')}` : i.message }))
      return next(new AppError(400, 'VALIDATION_ERROR', message, { fields }))
    }
    req.valid = r.data
    next()
  }
}

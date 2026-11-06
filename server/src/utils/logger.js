import pino from 'pino'

/**
 * Logger estruturado. Dados pessoais e segredos nunca vão para o log:
 * cabeçalhos de autenticação, cookies e campos de cliente são removidos.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.password_hash',
  '*.customerPhone',
  '*.customer_phone',
  '*.customerName',
  '*.customer_name',
  '*.address',
  '*.token',
  '*.trackingToken',
]

export function createLogger({ level = 'info', destination } = {}) {
  return pino({ level, redact: { paths: REDACT_PATHS, censor: '[removido]' }, base: undefined }, destination)
}

/** Mascara um telefone para log: (47) 9****-**94 */
export function maskPhone(phone) {
  const d = String(phone ?? '').replace(/\D/g, '')
  if (d.length < 4) return '***'
  return `${d.slice(0, 3)}****${d.slice(-2)}`
}

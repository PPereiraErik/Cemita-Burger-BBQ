import { randomUUID } from 'node:crypto'

/** Cada requisição ganha um ID (devolvido em X-Request-Id) para ligar erro e log. */
export function requestId() {
  return (req, res, next) => {
    const incoming = req.get('x-request-id')
    req.id = incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID()
    res.set('X-Request-Id', req.id)
    next()
  }
}

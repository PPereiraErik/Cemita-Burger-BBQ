import { randomUUID } from 'node:crypto'
import { createApp } from '../../src/app.js'
import { createLogger } from '../../src/utils/logger.js'

/** Sobe o app numa porta livre, com relógio controlável pelo teste. */
export async function startApi({ env, sequelize, now, gateway, extractor }) {
  const clock = { current: now }
  const app = createApp({ env, sequelize, logger: createLogger({ level: 'silent' }), clock: () => clock.current, ...(gateway !== undefined ? { gateway } : {}), ...(extractor !== undefined ? { extractor } : {}) })
  const server = app.listen(0)
  await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}/api/v1`
  const call = async (method, path, { body, headers = {} } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await res.text()
    const json = (res.headers.get('content-type') ?? '').includes('json')
    return { status: res.status, body: text ? (json ? JSON.parse(text) : text) : null, headers: res.headers }
  }
  return {
    clock,
    get: (p, o) => call('GET', p, o),
    post: (p, body, o = {}) => call('POST', p, { ...o, body }),
    request: call,
    close: () => new Promise((r) => server.close(r)),
  }
}

export const newKey = () => `test-${randomUUID()}`

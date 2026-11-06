import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import helmet from 'helmet'
import { cacheControlFor, fallbackFor, SITE_CSP } from './rules.js'

/**
 * Serve o site (dist/index.html) e o painel (dist/admin/) na mesma origem da API.
 * Assim o cookie do painel (SameSite=Strict) funciona em qualquer domínio, sem CORS.
 */
export function createSiteRouter(dir) {
  const root = path.resolve(dir)
  const router = express.Router()
  router.use(helmet({ contentSecurityPolicy: { directives: SITE_CSP }, crossOriginResourcePolicy: { policy: 'same-origin' } }))
  router.use(
    express.static(root, {
      index: 'index.html',
      redirect: true,
      dotfiles: 'ignore',
      setHeaders: (res, file) => res.setHeader('Cache-Control', cacheControlFor('/' + path.relative(root, file).split(path.sep).join('/'))),
    }),
  )
  router.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const target = fallbackFor(req.path)
    if (!target) return next()
    const file = path.join(root, target)
    if (!fs.existsSync(file)) return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(file)
  })
  return router
}

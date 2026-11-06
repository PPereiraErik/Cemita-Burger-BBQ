/** GET /api/v1/health → 200 quando tudo responde, 503 quando o banco não responde. */
export function createHealthController(healthService) {
  return {
    async show(req, res) {
      const { ok, body } = await healthService.check()
      res.set('Cache-Control', 'no-store').status(ok ? 200 : 503).json(body)
    },
  }
}

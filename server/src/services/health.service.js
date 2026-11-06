/**
 * Verifica as dependências da API. Responde só "ok" ou "unavailable":
 * nada de versão, host ou mensagem do banco (não ajuda um atacante).
 */
export function createHealthService({ sequelize, timeoutMs = 2000 }) {
  return {
    async check() {
      let database = 'ok'
      try {
        await Promise.race([
          sequelize.query('SELECT 1'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs).unref()),
        ])
      } catch {
        database = 'unavailable'
      }
      const ok = database === 'ok'
      return { ok, body: { status: ok ? 'ok' : 'unavailable', checks: { database } } }
    },
  }
}

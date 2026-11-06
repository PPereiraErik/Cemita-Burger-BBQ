/** Erros de conexão comuns viram uma frase clara em vez de uma pilha. */
export function connectionHint(err, env) {
  const name = err?.name ?? ''
  const where = env?.DATABASE_URL?.replace(/\/\/[^@]*@/, '//') ?? ''
  if (name === 'SequelizeConnectionRefusedError') return `MySQL não respondeu em ${where}. O servidor está instalado e ligado? (Windows: serviço "MySQL84" em services.msc)`
  if (name === 'SequelizeAccessDeniedError') return `MySQL recusou usuário ou senha de ${where}. Confira o DATABASE_URL e se o docker/setup-local.sql foi executado.`
  if (name === 'SequelizeConnectionError' && /Unknown database/i.test(err.message)) return `O banco de ${where} não existe. Rode o docker/setup-local.sql.`
  if (name === 'SequelizeDatabaseError' && /doesn't exist/i.test(err.message)) return 'Faltam tabelas. Rode antes: npm run db:migrate'
  return null
}

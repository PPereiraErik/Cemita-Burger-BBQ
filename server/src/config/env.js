import { z } from 'zod'

/**
 * Variáveis de ambiente validadas UMA vez, na subida.
 * Falta algo obrigatório → o processo não sobe e diz qual variável (nunca o valor).
 */
const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .string({ required_error: 'obrigatória' })
    .refine((v) => /^mysql:\/\/[^\s]+\/[A-Za-z0-9_]+$/.test(v), 'precisa ser mysql://usuario:senha@host:porta/banco'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_SSL: bool,
  TRACKING_TOKEN_SECRET: z
    .string({ required_error: 'obrigatória (gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))")' })
    .min(32, 'precisa ter pelo menos 32 caracteres aleatórios'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  /** Painel: quanto tempo a sessão vale depois do login (horas). */
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  /** Custo do scrypt das senhas (2^N). Opcional: padrão 17 (14 em teste). */
  AUTH_SCRYPT_LOG_N: z.coerce.number().int().min(14).max(20).optional(),
  /** Painel: tentativas de login por IP a cada 15 minutos (a trava por conta é à parte: 5 erros). */
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).max(10000).default(10),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url('cada origem precisa ser uma URL (ex.: https://cemita.com.br)'))),
  /** Etapa 6 — pagamento online. "none" (padrão): só pagamento na entrega/retirada. */
  PAYMENT_PROVIDER: z.enum(['none', 'mercadopago']).default('none'),
  /** Mercado Pago: "Access Token" das credenciais (de teste ou de produção). Nunca vai para o site. */
  MP_ACCESS_TOKEN: z.string().min(20, 'parece incompleto').optional(),
  /** Mercado Pago: "Assinatura secreta" da tela de Webhooks (confere que o aviso veio deles). */
  MP_WEBHOOK_SECRET: z.string().min(16, 'parece incompleto').optional(),
  /** Mercado Pago em modo de teste (usa o link de sandbox quando existir). */
  MP_SANDBOX: bool,
  /** Endereço público do site, para o Mercado Pago devolver o cliente ao acompanhamento. */
  PUBLIC_SITE_URL: z.string().url('precisa ser uma URL (ex.: https://cemita.com.br)').optional(),
  /** Eventos: chave da API da Anthropic para o botão "Preencher com IA" no painel (opcional). */
  ANTHROPIC_API_KEY: z.string().min(20, 'parece incompleta').optional(),
  /** Modelo usado na leitura dos posts (opcional; padrão: um modelo rápido e barato com leitura de imagem). */
  AI_MODEL: z.string().min(3).optional(),
  /** Pasta do site compilado (dist/). Definida: o mesmo serviço entrega site, painel e API (produção). */
  SITE_DIR: z.string().min(1).optional(),
  /** Primeira publicação: cria a conta de administração se ainda não existir nenhuma (scripts/deploy.js). */
  BOOTSTRAP_ADMIN_NAME: z.string().min(2).max(80).optional(),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email('precisa ser um e-mail').optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12, 'mínimo de 12 caracteres').max(128).optional(),
  /** Política de privacidade que o cliente aceita ao pedir (publicada pelo scripts/deploy.js). */
  PRIVACY_POLICY_VERSION: z.string().regex(/^[A-Za-z0-9._-]{1,20}$/, 'até 20 letras, números, ponto, hífen ou _ (ex.: 2026-11)').optional(),
  PRIVACY_POLICY_URL: z.string().url('precisa ser uma URL').max(300).optional(),
})

export class EnvError extends Error {}

/** Lê e valida um objeto de ambiente (process.env por padrão). */
export function parseEnv(source = process.env) {
  const result = schema.safeParse(source)
  if (!result.success) {
    const lines = result.error.issues.map((i) => `- ${i.path.join('.') || 'env'}: ${i.message}`)
    throw new EnvError(`Configuração inválida:\n${lines.join('\n')}`)
  }
  const env = result.data
  if (env.PAYMENT_PROVIDER === 'mercadopago') {
    const missing = ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'PUBLIC_SITE_URL'].filter((k) => !env[k])
    if (missing.length) throw new EnvError(`Configuração inválida:\n${missing.map((k) => `- ${k}: obrigatória com PAYMENT_PROVIDER=mercadopago`).join('\n')}`)
  }
  if (Boolean(env.PRIVACY_POLICY_VERSION) !== Boolean(env.PRIVACY_POLICY_URL)) {
    throw new EnvError('Configuração inválida:\n- PRIVACY_POLICY_VERSION e PRIVACY_POLICY_URL: informe as duas juntas')
  }
  if (env.NODE_ENV === 'production') {
    const problems = []
    if (env.PRIVACY_POLICY_URL && !env.PRIVACY_POLICY_URL.startsWith('https://')) problems.push('- PRIVACY_POLICY_URL: em produção, https://')
    if (env.CORS_ORIGINS.some((o) => !o.startsWith('https://'))) problems.push('- CORS_ORIGINS: em produção só origens https://')
    if (/^(dev|test)-/.test(env.TRACKING_TOKEN_SECRET)) problems.push('- TRACKING_TOKEN_SECRET: em produção use um segredo próprio, não o de exemplo')
    if (env.AUTH_SCRYPT_LOG_N !== undefined && env.AUTH_SCRYPT_LOG_N < 17) problems.push('- AUTH_SCRYPT_LOG_N: em produção, 17 ou mais')
    if (env.PAYMENT_PROVIDER !== 'none' && !env.PUBLIC_SITE_URL?.startsWith('https://')) problems.push('- PUBLIC_SITE_URL: em produção, https://')
    if (env.PAYMENT_PROVIDER === 'mercadopago' && env.MP_SANDBOX) problems.push('- MP_SANDBOX: desligue em produção')
    if (problems.length) throw new EnvError(`Configuração inválida para produção:\n${problems.join('\n')}`)
  }
  return Object.freeze(env)
}

let cached
/** Ambiente da aplicação (validado na primeira chamada). */
export function env() {
  cached ??= parseEnv()
  return cached
}

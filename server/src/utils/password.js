import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

/**
 * SENHAS DA EQUIPE — scrypt (embutido no Node, sem dependência nativa).
 * Por que não argon2: o pacote precisa compilar código nativo (Windows e hospedagem ainda indefinida).
 * scrypt é recomendado pela OWASP para senhas quando argon2id não está disponível.
 *
 * Formato guardado: scrypt$<logN>$<r>$<p>$<sal base64url>$<hash base64url>
 * Os parâmetros ficam no próprio hash: dá para aumentar o custo depois sem invalidar senhas antigas
 * (needsRehash avisa e o login regrava com o custo novo).
 * Custo padrão: N = 2^17, r = 8, p = 1 (OWASP). Em teste, 2^14 para não deixar a suíte lenta.
 */
const scrypt = promisify(scryptCb)
const KEYLEN = 32
const R = 8
const P = 1

export const defaultLogN = (env = process.env) => {
  const fromEnv = Number(env.AUTH_SCRYPT_LOG_N)
  if (Number.isInteger(fromEnv) && fromEnv >= 14 && fromEnv <= 20) return fromEnv
  return env.NODE_ENV === 'test' ? 14 : 17
}

const maxmem = (logN) => 256 * 2 ** logN * R

export async function hashPassword(password, { logN = defaultLogN() } = {}) {
  const salt = randomBytes(16)
  const hash = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N: 2 ** logN, r: R, p: P, maxmem: maxmem(logN) })
  return ['scrypt', logN, R, P, salt.toString('base64url'), Buffer.from(hash).toString('base64url')].join('$')
}

export async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, logNs, rs, ps, saltB64, hashB64] = parts
  const logN = Number(logNs)
  const r = Number(rs)
  const p = Number(ps)
  if (!Number.isInteger(logN) || logN < 10 || logN > 22 || !Number.isInteger(r) || !Number.isInteger(p)) return false
  const expected = Buffer.from(hashB64, 'base64url')
  const got = Buffer.from(await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64url'), expected.length, { N: 2 ** logN, r, p, maxmem: 256 * 2 ** logN * r }))
  return got.length === expected.length && timingSafeEqual(got, expected)
}

export const needsRehash = (stored, logN = defaultLogN()) => Number(String(stored).split('$')[1]) < logN

/** Hash de mentira, para gastar o mesmo tempo quando o e-mail não existe (não revela quem tem conta). */
let dummy = null
export async function burnTime(password) {
  dummy ??= await hashPassword('senha-que-nao-existe-' + randomBytes(8).toString('hex'))
  await verifyPassword(password, dummy)
}

/**
 * Regra de senha da equipe (NIST 800-63B): tamanho manda mais que "símbolos obrigatórios".
 * 12 a 128 caracteres, não pode ser só repetição nem conter o e-mail/nome.
 */
export function passwordProblem(password, { email = '', name = '' } = {}) {
  const pw = String(password ?? '')
  if (pw.length < 12) return 'A senha precisa ter pelo menos 12 caracteres.'
  if (pw.length > 128) return 'A senha pode ter no máximo 128 caracteres.'
  if (/^(.)\1+$/.test(pw)) return 'A senha não pode ser um caractere repetido.'
  const lower = pw.toLowerCase()
  const local = email.split('@')[0]?.toLowerCase()
  if (local && local.length >= 4 && lower.includes(local)) return 'A senha não pode conter o seu e-mail.'
  const first = name.trim().split(/\s+/)[0]?.toLowerCase()
  if (first && first.length >= 4 && lower.includes(first)) return 'A senha não pode conter o seu nome.'
  if (['cemita', '123456', 'senha', 'password', 'qwerty'].some((w) => lower.includes(w) && pw.length < 16)) return 'Senha fácil de adivinhar. Use uma frase maior.'
  return null
}

/**
 * Contas do painel pela linha de comando (não existe conta nem senha padrão).
 *
 *   npm run admin:create                      pergunta nome, e-mail, papel e senha (a senha não aparece na tela)
 *   npm run admin:create -- --name "Fulano" --email fulano@exemplo.com --role admin
 *                                             pergunta só a senha
 *   echo "senha" | npm run admin:create -- --name ... --email ... --stdin
 *                                             lê a senha da entrada padrão (para automação; cuidado com o histórico)
 *
 * Papéis: admin (tudo), staff (atendimento), kitchen (cozinha).
 */
import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline'
import { createSequelize } from '../src/config/database.js'
import { env as loadEnv } from '../src/config/env.js'
import { ROLES } from '../src/domain/constants.js'
import { initModels } from '../src/models/index.js'
import { createAuditService } from '../src/services/audit.service.js'
import { createAuthService } from '../src/services/auth.service.js'
import { passwordProblem } from '../src/utils/password.js'
import { connectionHint } from './hint.js'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' }, stdin: { type: 'boolean' } },
})

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a.trim()))))
}

/** Lê sem mostrar o que é digitado. */
function askHidden(question) {
  if (!process.stdin.isTTY) throw new Error('Terminal sem modo interativo: use --stdin para passar a senha.')
  return new Promise((resolve, reject) => {
    process.stdout.write(question)
    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let buf = ''
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          return resolve(buf)
        }
        if (c === '\u0003') {
          stdin.setRawMode(false)
          process.stdout.write('\n')
          return reject(new Error('cancelado'))
        }
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1)
        else buf += c
      }
    }
    stdin.on('data', onData)
  })
}

async function readStdin() {
  let data = ''
  for await (const chunk of process.stdin) data += chunk
  return data.replace(/\r?\n$/, '')
}

const cmd = positionals[0] ?? 'create'
if (cmd !== 'create') {
  console.error('uso: node scripts/admin.js create [--name ...] [--email ...] [--role admin|staff|kitchen] [--stdin]')
  process.exit(1)
}

const env = loadEnv()
const sequelize = createSequelize(env)
try {
  const name = values.name ?? (await ask('Nome: '))
  const email = (values.email ?? (await ask('E-mail: '))).toLowerCase()
  const role = values.role ?? ((await ask('Papel (admin/staff/kitchen) [admin]: ')) || 'admin')
  if (!ROLES.includes(role)) throw new Error(`papel inválido: ${role}`)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('e-mail inválido')

  let password
  if (values.stdin) password = await readStdin()
  else {
    console.log('Senha: de 12 a 128 caracteres. Uma frase longa é melhor que símbolos.')
    for (;;) {
      password = await askHidden('Senha: ')
      const problem = passwordProblem(password, { email, name })
      if (problem) {
        console.log(problem)
        continue
      }
      if ((await askHidden('Repita a senha: ')) !== password) {
        console.log('As senhas não conferem. De novo.')
        continue
      }
      break
    }
  }

  const models = initModels(sequelize)
  const audit = createAuditService({ models, env })
  const auth = createAuthService({ models, env, clock: () => new Date(), audit })
  const user = await auth.createUser({ name, email, role, password })
  console.log(`Conta criada: ${user.name} <${user.email}> (${user.role}). Entre em /admin.`)
} catch (err) {
  const hint = connectionHint(err, env)
  console.error(hint ?? `Não foi possível criar a conta: ${err.message}`)
  process.exitCode = 1
} finally {
  await sequelize.close()
}

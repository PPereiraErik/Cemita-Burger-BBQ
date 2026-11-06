# Segurança — decisões registradas

## Avisos do `npm audit` aceitos (revisados em 07/10/2026)

`npm audit` aponta 6 avisos **moderados** em duas cadeias. Nenhum é alcançável pelo código da Cemita.
**Não rode `npm audit fix --force`**: ele rebaixaria o `umzug` para 2.3.0 e o `sequelize` para 3.30.0, quebrando o projeto.

| Aviso | Por onde entra | Condição para explorar | Por que não nos afeta |
| --- | --- | --- | --- |
| [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) — `sprintf-js` ≤ 1.1.3, negação de serviço (sem versão corrigida) | `umzug` → `@rushstack/ts-command-line` → `argparse` → `sprintf-js` | O atacante precisa **controlar a string de formato** passada ao `sprintf` | Essa cadeia só é usada pela linha de comando própria do Umzug, que não usamos (as migrations rodam por `scripts/db.js`). Nenhuma entrada de usuário chega a `sprintf` |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — `uuid` < 11.1.1, falta de checagem de limite | `sequelize` → `uuid` 8 | Chamar `v3()`, `v5()` ou `v6()` **passando um `buf`** externo | Não usamos colunas UUID nem `uuid` diretamente; o Sequelize não chama essas funções com `buf` no nosso uso. `v4()` não é afetada |

Revisar a cada atualização de dependência e antes de ir para produção (Etapa 10). Se o `umzug` ou o `sequelize` publicarem versões sem essas dependências, atualizar.

## Senhas do painel: scrypt em vez de argon2 (Etapa 5, 19/10/2026)

argon2id é a primeira recomendação da OWASP, mas o pacote `argon2` compila código nativo (precisa de ferramentas de build no Windows e na hospedagem, que ainda não foi definida).
O `scrypt` vem embutido no Node (`node:crypto`) e é a alternativa recomendada pela OWASP quando argon2id não está disponível.
Parâmetros: N = 2^17, r = 8, p = 1, sal de 16 bytes, chave de 32 bytes; comparação em tempo constante. Os parâmetros ficam no próprio hash
(`scrypt$17$8$1$sal$hash`), então dá para aumentar o custo depois: o login regrava a senha com o custo novo.
Se a hospedagem permitir dependência nativa, trocar para argon2id é uma mudança só em `src/utils/password.js` (com regravação no login).

## Limite de tentativas de login em memória

O limite por IP (`LOGIN_RATE_LIMIT`) fica na memória do processo: some ao reiniciar e não é dividido entre instâncias.
A trava por conta (5 erros → 15 minutos) fica no banco e vale sempre. Com mais de uma instância, mover o limite por IP para um armazenamento comum (Etapa 7).
Atrás de proxy, configure `TRUST_PROXY` para o IP real do cliente ser usado (senão todo mundo vira o IP do proxy).

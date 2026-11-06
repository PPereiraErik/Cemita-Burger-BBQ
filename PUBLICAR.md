# Publicar o site do Cemita (e deixar rodando sozinho)

Um serviço só no **Railway** entrega o **site**, o **painel** (`/admin/`) e a **API**, no mesmo endereço,
com um banco **MySQL** ao lado. Depois de publicado:

- cada atualização que você mandar para o GitHub é testada e publicada sozinha;
- se a API cair, o Railway reinicia;
- a cada publicação, o banco é atualizado sozinho (migrations). Se algo der errado, a versão nova não entra
  e a anterior continua no ar;
- o Cemita cuida do dia a dia pelo painel (veja o `MANUAL-DA-EQUIPE.pdf`).

Tempo: umas 2 horas na primeira vez.

---

## 0. Quem é dono de quê (combine antes)

| Conta | Dono | Você |
|---|---|---|
| Railway (hospedagem, cartão de crédito) | **Cemita** | convidado como membro do projeto |
| Domínio `cemita.com.br` | **Cemita** (quem já cuida dele hoje) | só pede para trocar o apontamento |
| Mercado Pago (o dinheiro cai aqui) | **Cemita** | nunca |
| Conta de administração do painel | **alguém do Cemita** | tem uma conta sua, separada, para suporte |
| Repositório no GitHub | você (privado) | dono |

Custo do Railway: plano Hobby, **US$ 5 por mês com US$ 5 de uso incluído** (consultado em 03/11/2026,
em docs.railway.com/pricing/plans). Um restaurante com este volume deve caber nisso ou passar pouco; o
painel do Railway mostra o gasto do mês.

## 1. Código no GitHub (repositório privado)

No PowerShell, na pasta do projeto (o `.gitignore` já deixa de fora os arquivos `.env` com senhas):

```powershell
cd C:\dev\cemita-projeto
npm install                      # gera o package-lock.json (versões travadas)
cd server; npm install; cd ..
git init
git add .
git commit -m "Site e sistema de pedidos do Cemita"
git branch -M main
git remote add origin https://github.com/PPereiraErik/cemita.git   # crie o repositório PRIVADO antes, no site do GitHub
git push -u origin main
```

Confira no GitHub que **não** apareceu nenhum arquivo `.env` (só `.env.example`). Se apareceu, apague o
repositório e me chame antes de continuar.

Na aba **Actions** do GitHub, os testes começam a rodar sozinhos (site, API com MySQL e a montagem da imagem).
Espere ficar tudo verde ✓.

## 2. Railway: projeto, banco e serviço

1. Entre em railway.com com a conta do Cemita → **New Project** → **Deploy from GitHub repo** → escolha o
   repositório. O Railway encontra o `Dockerfile` sozinho.
2. No mesmo projeto: **+ Create** → **Database** → **MySQL**.
3. No MySQL: aba **Backups** → ligue **Daily** (fica 6 dias) e **Weekly** (fica 27 dias).

## 3. Variáveis do serviço (aba Variables do serviço do site, não a do MySQL)

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (o Railway completa com o endereço do banco) |
| `TRACKING_TOKEN_SECRET` | um segredo novo: rode `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` e cole |
| `TRUST_PROXY` | `1` |
| `PUBLIC_SITE_URL` | `https://cemita.com.br` (até ter o domínio: o endereço `…up.railway.app` do passo 4) |
| `VITE_SITE_URL` | o mesmo do `PUBLIC_SITE_URL` |
| `CORS_ORIGINS` | o mesmo do `PUBLIC_SITE_URL` |
| `BOOTSTRAP_ADMIN_NAME` | nome de quem administra no Cemita |
| `BOOTSTRAP_ADMIN_EMAIL` | e-mail dessa pessoa |
| `BOOTSTRAP_ADMIN_PASSWORD` | senha provisória de 12+ caracteres (uma frase longa). A pessoa troca no primeiro acesso, em "Minha conta" |
| `PRIVACY_POLICY_VERSION` | ex.: `2026-11` |
| `PRIVACY_POLICY_URL` | endereço da política de privacidade (ex.: `https://cemita.com.br/politica-de-privacidade.html`) |
| `PAYMENT_PROVIDER` | `none` por enquanto (Pix e cartão: passo 8) |
| `ANTHROPIC_API_KEY` | opcional, para o botão "Preencher com IA" dos eventos |

**Política de privacidade:** o site não aceita pedidos sem ela. O texto vem do Cemita (de preferência revisado
por um advogado). O jeito mais simples: salve como `public/politica-de-privacidade.html`, mande para o GitHub
e use o endereço acima. Mudou o texto? Troque a `PRIVACY_POLICY_VERSION` (ex.: `2027-01`); a nova passa a
valer e a antiga fica no histórico dos pedidos.

## 4. Endereço, verificação de saúde e "esperar os testes"

Na aba **Settings** do serviço do site:

- **Networking → Generate Domain**: gera um `https://…up.railway.app`. Ponha esse endereço nas variáveis do
  passo 3 até o domínio próprio ficar pronto.
- **Deploy → Healthcheck Path**: `/api/v1/health`. O Railway só troca para a versão nova quando ela responde.
- **Deploy → Restart Policy**: **On Failure**.
- **Source → Wait for CI** (se aparecer): ligado. Assim, se um teste falhar no GitHub, nada é publicado.

Clique em **Deploy**. Nos **Deploy Logs**, procure:

- `banco novo: cardápio inicial carregado`
- `conta de administração criada`
- `política de privacidade publicada`
- `Site, painel e API do Cemita no ar`

## 5. Primeiro acesso ao painel

1. Abra `https://<endereço>/admin/` e entre com o e-mail e a senha provisória.
2. **Minha conta**: a pessoa do Cemita troca a senha.
3. **Volte no Railway e APAGUE** `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`.
4. **Equipe → + Nova conta**: crie a sua (papel atendimento ou administração, para suporte), a da cozinha e a do
   atendimento.
5. **Entregas**: cadastre os bairros, as taxas e os prazos de verdade.
6. **Loja**: confira horário e prazos. Quando estiver tudo pronto, mude o **modo de pedido** para o site
   (até lá ele continua levando ao delivery atual, que segue funcionando em paralelo).

## 6. Domínio cemita.com.br

1. No Railway: **Settings → Networking → Custom Domain** → `cemita.com.br` (e `www.cemita.com.br`, se quiser).
   Ele mostra o registro DNS que precisa ser criado.
2. Quem cuida do domínio hoje cria esse registro (e tira o redirecionamento para o VucaFood).
3. Quando o Railway mostrar o domínio como ativo (o certificado https é automático), troque
   `PUBLIC_SITE_URL`, `VITE_SITE_URL` e `CORS_ORIGINS` para `https://cemita.com.br` e publique de novo.

## 7. Aviso se o site cair (grátis)

Em uptimerobot.com, crie um monitor **HTTP(s)** para `https://cemita.com.br/api/v1/health`, a cada 5 minutos,
com alerta por e-mail para **você e o Cemita**. Esse endereço só responde "ok" quando a API e o banco estão no ar.

## 8. Pix e cartão (quando o Cemita tiver a conta no Mercado Pago)

Siga o [PAGAMENTO-MERCADOPAGO.md](PAGAMENTO-MERCADOPAGO.md). Em produção, o endereço do aviso de pagamento
(webhook) é `https://cemita.com.br/api/v1/payments/mercadopago/webhook`. As variáveis `MP_ACCESS_TOKEN`,
`MP_WEBHOOK_SECRET` e `PAYMENT_PROVIDER=mercadopago` vão no Railway, nunca no código.

---

## Depois de publicado: como atualizar

Mudou algo no código? `git add .`, `git commit -m "o que mudou"`, `git push`. O GitHub testa; se passar,
o Railway publica. Não precisa entrar no Railway.

## Quando algo der errado

| Sintoma | O que olhar |
|---|---|
| Publicação falhou | Railway → Deployments → a que falhou → **Deploy Logs**. A versão anterior continua no ar. |
| `Configuração inválida` no log | a mensagem diz qual variável falta ou está errada (nunca mostra o valor) |
| Site no ar, mas "pedidos indisponíveis" | painel → Loja: modo de pedido, horário, pausa; e a política de privacidade (passo 3) |
| Esqueceram a senha | quem é administração redefine em **Equipe → Definir senha**. Se nenhum administrador conseguir entrar: no terminal do serviço no Railway (`railway ssh`), `npm run admin:create` cria uma conta nova. As variáveis `BOOTSTRAP_ADMIN_*` não servem para isso: só valem com o painel vazio. |
| Perdeu dados | MySQL → **Backups** → escolha a data → **Restore** → **Deploy** |

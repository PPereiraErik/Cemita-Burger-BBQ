# API de pedidos da Cemita

Node.js 22 + Express 5 + Sequelize 6 + MySQL 8. Este é o backend do sistema de pedidos próprio da Cemita. A arquitetura completa está no documento "Cemita — sistema de pedidos: arquitetura proposta".

**Estado atual: Etapa 6.** Tem o banco (20 tabelas), as migrations, os models, o seed do cardápio atual, a API pública de cardápio e pedidos e a **API do painel da equipe** (`/api/v1/admin`: login, pedidos, cardápio, loja, entregas, eventos, equipe, registro). O site (`../src`) lê preços, disponibilidade e horário daqui quando `VITE_API_URL` está configurada (veja o README da raiz). O painel fica em `/admin/` do site. **Etapa 6:** Pix e cartão pelo site com o Mercado Pago (Checkout Pro), ligado por variáveis de ambiente — passo a passo em `../PAGAMENTO-MERCADOPAGO.md`.

## Endpoints (`/api/v1`)

| Método e rota | Faz |
| --- | --- |
| `GET /health` | Saúde da API e do banco (200 ou 503) |
| `GET /catalog` | Categorias e produtos ativos, com os adicionais ativos e já revisados |
| `GET /store/status` | Se a loja aceita pedidos agora e por quê não (modo VUCA, pausada, fechada, sem política de privacidade, sem forma de pagamento) |
| `POST /cart/quote` | Recalcula o carrinho no servidor: preços, cupom, taxa de entrega, total. O preço enviado pelo navegador é ignorado |
| `POST /orders` | Cria o pedido. Exige o cabeçalho `Idempotency-Key` (16 a 64 caracteres): repetir a mesma chave devolve o mesmo pedido em vez de duplicar |
| `GET /orders/:code` | Acompanhamento do pedido. Exige o cabeçalho `x-tracking-token` devolvido na criação |
| `POST /orders/:code/cancel` | Cancelamento pelo cliente, só enquanto o pedido ainda não entrou em preparo |
| `POST /orders/:code/pay` | Pix/cartão no site: devolve o link de pagamento do Mercado Pago (cria a cobrança se ainda não existir; nunca uma segunda). Exige `x-tracking-token` |
| `GET /events` | Agenda: eventos publicados e ainda não terminados (data e hora no fuso da loja) |
| `GET /events/:id/image` | Arte do evento publicado (liberada para o site em outra origem; a URL muda quando a arte muda) |
| `POST /payments/mercadopago/webhook` | Aviso do Mercado Pago. Confere a assinatura (`x-signature`), busca o pagamento na API deles e só então muda o pedido. Aviso repetido não faz efeito duas vezes |

Regras que valem para todos os pedidos:
- o servidor recalcula tudo; total, taxa e desconto vindos do navegador não são aceitos;
- o pedido guarda uma cópia do nome e do preço de cada item no momento da compra;
- pagamento na entrega (dinheiro ou maquininha) vai direto para "recebido";
- Pix e cartão no site (só com `PAYMENT_PROVIDER=mercadopago`): o pedido fica "aguardando pagamento" e só vai para a cozinha
  ("pagamento aprovado" → "recebido") quando o webhook confirmar, com valor e moeda iguais aos do pedido.
  Valor diferente, ou pagamento aprovado depois do cancelamento, fica "em análise" para a equipe conferir/estornar.
  Nenhum dado de cartão passa pela API: o cliente paga na página do Mercado Pago;
- troco só para dinheiro, e nunca menor que o total;
- itens +18 exigem confirmação de maioridade;
- o acompanhamento não mostra telefone nem endereço completo;
- duas mudanças de status ao mesmo tempo não se sobrescrevem: a segunda recebe `409 ORDER_CHANGED`.

Com `ordering_mode = vuca` (o padrão), `POST /orders` responde que o site ainda não aceita pedidos. Para testar pedidos localmente, use `npm run db:seed:dev` (veja abaixo).

## Painel da equipe (`/api/v1/admin`) — Etapa 5

**Não existe conta nem senha padrão.** A primeira conta é criada no servidor:

```bash
npm run admin:create
# pergunta nome, e-mail, papel (admin/staff/kitchen) e a senha (não aparece na tela, pede duas vezes)
```

Depois disso, quem tem papel **admin** cria as outras contas pelo painel (aba Equipe).

| Papel | Pode |
| --- | --- |
| `admin` (Administração) | tudo: pedidos, cardápio e preços, loja (modo de pedido, pagamentos, prazos, horário), zonas de entrega, equipe, registro |
| `staff` (Atendimento) | pedidos (todas as mudanças, inclusive cancelar com motivo), marcar produto esgotado/disponível, pausar e retomar os pedidos |
| `kitchen` (Cozinha) | ver a fila (sem telefone e endereço, só o primeiro nome) e levar o pedido de "recebido" para "em preparo" e "pronto" |

A tabela de permissões é uma só (`src/domain/permissions.js`) e o servidor confere em toda rota; esconder botão na tela é só conforto.

| Método e rota | Faz | Quem |
| --- | --- | --- |
| `POST /admin/login` | Entra. Devolve o cookie de sessão e o `csrfToken` | todos |
| `GET /admin/me` | Quem está logado e as permissões; gera um `csrfToken` novo | todos |
| `POST /admin/logout` · `POST /admin/password` | Sai · troca a própria senha (encerra todas as sessões) | todos |
| `GET /admin/orders?scope=active\|recent` · `GET /admin/orders/:id` | Quadro de pedidos · finalizados/cancelados das últimas 12 h | todos (recentes: não cozinha) |
| `POST /admin/orders/:id/status` | `{ to, version, reason? }` — versão desatualizada = `409 ORDER_CHANGED`; cancelar exige motivo | conforme o papel |
| `GET /admin/catalog` · `PATCH /admin/products/:id` | Cardápio completo · `available` (atendimento) ou também `priceCents`, `name`, `description`, `active`, `orderable` (admin) | admin, staff |
| `GET /admin/store` · `PATCH /admin/store/settings` · `PUT /admin/store/hours` | Estado e configurações · `orders_paused` (atendimento) ou também `ordering_mode`, `payment_methods_enabled`, `pickup_eta_minutes`, `min_order_cents`, `data_retention_days` (admin; `null` = ainda não definido) · horário | admin, staff (pausa) |
| `GET/POST /admin/zones` · `PUT/DELETE /admin/zones/:id` | Zonas de entrega (zona já usada em pedido não é apagada: desative) | admin |
| `GET/POST /admin/users` · `PATCH /admin/users/:id` · `POST /admin/users/:id/password` | Equipe: criar, mudar papel, desativar, definir senha nova | admin |
| `GET /admin/audit` | Registro das ações | admin |

**Como a sessão é protegida**
- Senha: `scrypt` (embutido no Node, sem dependência nativa), custo 2^17 em produção, sal aleatório; regra de 12 a 128 caracteres, sem conter e-mail ou nome. Senhas antigas com custo menor são regravadas no próximo login.
- Login: a mesma resposta para e-mail inexistente e senha errada; **5 erros seguidos travam a conta por 15 minutos**; além disso, `LOGIN_RATE_LIMIT` tentativas por IP a cada 15 minutos (memória do processo; com mais de uma instância, vira armazenamento comum na Etapa 7).
- Cookie `cemita_sess`: `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/admin`, `Secure` em produção. No banco fica só o sha256 do token. Sessão vale `SESSION_TTL_HOURS` (padrão 12 h).
- Anti-CSRF: toda escrita exige o cabeçalho `X-CSRF-Token` (entregue no login e no `/me`, guardado só na memória do painel).
- Desativar alguém, mudar o papel ou definir senha nova derruba as sessões dessa pessoa. Ninguém desativa nem rebaixa a própria conta.
- Registro (`audit_logs`): quem, o quê, quando, antes/depois. Sem senha, sem dado de cliente; o IP fica só como HMAC.
- **O painel precisa estar no mesmo site da API** (cookie `SameSite=Strict`): por exemplo `cemita.com.br/admin/` com a API em `api.cemita.com.br`, ou os dois no mesmo domínio. Em desenvolvimento, `localhost:5173` e `localhost:3333` já contam como o mesmo site. A hospedagem ainda não foi definida.

## Rodar localmente

Requisitos: Node.js 22.12+ e Docker (ou um MySQL 8 próprio).

```bash
cd server
npm install
cp .env.example .env
cp .env.test.example .env.test   # já trazem TRACKING_TOKEN_SECRET de desenvolvimento
docker compose up -d          # MySQL com os bancos cemita_dev e cemita_test
npm run db:migrate            # cria as tabelas
npm run db:seed               # carrega o cardápio atual
npm run dev                   # API em http://localhost:3333
curl http://localhost:3333/api/v1/health
```

### Sem Docker (Windows)

1. Instale o **MySQL Community Server 8.4** (Windows, MSI) de https://dev.mysql.com/downloads/mysql/. Use a configuração padrão: porta 3306, serviço do Windows, uma senha de root que você guarde.
2. Crie o usuário e os bancos de desenvolvimento e de teste (PowerShell, dentro de `server`):

   ```powershell
   & "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -p -e "source docker/setup-local.sql"
   ```

3. Siga com `npm run db:migrate`, `npm run db:seed` e `npm test`.

Dica: mantenha o projeto fora de pastas sincronizadas (OneDrive, Google Drive). A sincronização trava arquivos de `node_modules` e atrapalha o `npm install`.

## Testes

```bash
npm test          # tudo: unitários + integração (precisa do MySQL de teste no ar)
npm run test:unit # só os que não precisam de banco
```

Os testes de integração **apagam e recriam** o banco configurado em `.env.test`. Por isso eles se recusam a rodar se o nome do banco não terminar em `_test`.

Para conferir se os dados iniciais continuam iguais ao cardápio do site, rode na raiz do projeto: `node scripts/export-menu.mjs --check`.

## Comandos do banco

| Comando | Faz |
| --- | --- |
| `npm run db:migrate` | Aplica as migrations pendentes |
| `npm run db:status` | Lista as migrations aplicadas e as pendentes |
| `npm run db:rollback` | Desfaz a última migration. Bloqueado em produção, salvo `ALLOW_PRODUCTION_ROLLBACK=yes` depois de um backup |
| `npm run db:seed` | Carrega o cardápio. Pode rodar de novo: não duplica nem sobrescreve o que foi alterado depois |
| `npm run db:seed:dev` | **Só desenvolvimento.** Cria dados fictícios para testar pedidos: uma política de privacidade `DEV-0` (rascunho, sem texto real), duas zonas de entrega marcadas `[DEV]` com bairro e faixa de CEP inexistentes, e liga `ordering_mode = both`. Recusa rodar com `NODE_ENV=production` |

Se o cardápio do site mudar, rode `node scripts/export-menu.mjs` na raiz e depois `npm run db:seed`.

## O que os dados iniciais trazem (e o que não trazem)

Vêm do projeto:
- as 9 categorias e os 56 produtos de `src/config/menu.ts`, com preços em centavos e o id do VUCA (`vuca_ref`);
- o horário "terça a domingo, 18h às 23h", de `src/config/restaurant.ts`;
- os **adicionais, molhos, ponto da carne, carne extra, fritas, acompanhamentos e sobremesa** de `src/config/options.ts`
  (nomes e preços dos prints do delivery de 08/10/2026), ligados às mesmas categorias em que o site já os oferece.
  O **ponto da carne** é obrigatório nos burgers grelhados (`min_select = 1`). As ligações de grelhado e sanduíches
  foram deduzidas do combo e seguem na lista de pendências para a Cemita confirmar;
- o **combo com bebida** (grupo `combo-bebida`): uma opção por bebida ("Combo + Coca-Cola"), a R$ 15,99, em smash,
  burgers e sanduíches. A composição (fritas individual + bebida) está nos prints do delivery.

Entram bloqueados até a Cemita confirmar:
- **Fritas, Fritas Especiais e Monster** entram com `orderable = false`. O preço "a partir de" depende de um tamanho que ainda não está cadastrado.
- O grupo antigo **`combo`** (sem bebida, de antes da confirmação) continua **inativo**, com `pending_review`. O site usa o `combo-bebida`.

Configurações já decididas:
- `ordering_mode = vuca`: o site continua levando ao delivery VUCA durante a transição.
- `payment_methods_enabled`: dinheiro e maquininha na entrega.

**Pendentes** (`null`, nada inventado): tempo de retirada, pedido mínimo, prazo de pagamento e prazo de retenção de dados.

O seed **não cria**:
- usuários: o admin nasce por comando na Etapa 5, sem senha padrão;
- zonas de entrega: sem zona, só retirada;
- cupons;
- política de privacidade.

## CORS

Só as origens em `CORS_ORIGINS` (separadas por vírgula) podem chamar a API pelo navegador. Em desenvolvimento, `http://localhost:5173` (o Vite). Em produção, só `https://`. A API pública não usa cookie. As rotas `/api/v1/admin` liberam credenciais (cookie), `PATCH`/`PUT`/`DELETE` e o cabeçalho `X-CSRF-Token`, sempre só para as mesmas origens.

## Variáveis de ambiente novas na Etapa 2

- `TRACKING_TOKEN_SECRET` (obrigatória, 32+ caracteres): assina o token de acompanhamento do pedido. Em produção, valores começando com `dev-` ou `test-` são recusados. Gere um com `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

## Variáveis de ambiente novas na Etapa 5

- `SESSION_TTL_HOURS` (1 a 72, padrão 12): quanto tempo a sessão do painel vale.
- `LOGIN_RATE_LIMIT` (padrão 10): tentativas de login por IP a cada 15 minutos.
- `AUTH_SCRYPT_LOG_N` (opcional, 14 a 20): custo do scrypt. Sem definir: 17 (14 nos testes). Produção recusa menos de 17. O `.env.test.example` usa 14 para a suíte não ficar lenta.

## Estrutura

```
src/
  config/       env (validado com zod) · database
  db/           migrator (Umzug) · migrations · seeders · seed-data/catalog.json
  domain/       constantes · máquina de status · horário · cálculo do carrinho (funções puras)
  validators/   esquemas zod do carrinho e do pedido
  models/       catalog · team · store · orders (+ pagamentos) · index (relações)
  routes/ controllers/ services/ middlewares/ utils/
scripts/db.js   comandos do banco
scripts/admin.js  criar conta do painel (npm run admin:create)
tests/          unit/ · integration/ · helpers/
```

Por que Umzug: é o migrador mantido pela equipe do Sequelize (o mesmo que o `sequelize-cli` usa por baixo). Com ele, as migrations rodam pelo próprio código, como módulos ES, e os testes conseguem subir e descer o banco sem chamar outro processo.

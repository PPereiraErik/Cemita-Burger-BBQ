# Pix e cartão pelo site — Mercado Pago (Etapa 6)

## Por que o Mercado Pago (Checkout Pro)

- **Pix e cartão** (crédito e débito) num lugar só, com conta para empresa (CNPJ) e muito usado no Brasil.
- **O cliente paga na página do próprio Mercado Pago.** O site e a API da Cemita nunca veem nem guardam
  dados de cartão.
- O Mercado Pago **avisa o servidor** (webhook) com assinatura. O servidor confere a assinatura, **busca o
  pagamento na API deles** e só então manda o pedido para a cozinha. A volta do cliente para o site não
  confirma nada sozinha.
- Trocar de gateway no futuro é possível: o código do Mercado Pago fica isolado em
  `server/src/payments/mercadopago.js`.

> Confirmar com a Cemita: a conta do Mercado Pago precisa estar **no nome da Cemita** (é para ela que o
> dinheiro vai), e as **taxas** de Pix e de cartão estão no site do Mercado Pago (elas mudam; não estão
> fixadas aqui).

## Como funciona

1. No checkout, o cliente escolhe **Pix** ou **Cartão pelo site** → botão **Ir para o pagamento**.
2. O pedido é salvo como **Aguardando pagamento** (não aparece para a cozinha como "Recebido") e o cliente
   vai para a página do Mercado Pago.
3. Pagou → o Mercado Pago avisa o servidor → o pedido passa para **Pagamento aprovado → Recebido** e chega
   ao painel como qualquer pedido, com **"✓ Pago online"**.
4. O cliente volta para o site e o acompanhamento abre sozinho. Enquanto a confirmação não chega, ele mostra
   **"Falta pagar"** e o botão **Pagar agora** (o mesmo link, nunca uma segunda cobrança). Se o cartão for
   recusado, aparece **"O pagamento não foi aprovado"** e dá para tentar de novo.
5. Casos que precisam de alguém olhar aparecem no painel em vermelho:
   - valor pago diferente do pedido;
   - pagamento aprovado depois de o pedido ser cancelado (precisa de estorno);
   - estorno ou disputa.

   **Estornos são feitos no painel do Mercado Pago.**

---

## Testar na sua máquina (credenciais de TESTE, sem dinheiro de verdade)

Antes, deixe funcionando o roteiro do [TESTE-HOJE.md](TESTE-HOJE.md) (banco, API, site e painel).

### 1. Aplicação e credenciais de teste

1. Entre em <https://www.mercadopago.com.br/developers> com a conta do Mercado Pago (para testar, pode ser a sua).
2. **Suas integrações → Criar aplicação**: pagamentos online, produto **Checkout Pro**.
3. Na aplicação, abra **Credenciais de teste** e copie o **Access Token**.

### 2. Endereço público para o aviso de pagamento

O Mercado Pago precisa chamar a sua API pela internet (`https`). Na sua máquina, use um túnel gratuito
da Cloudflare:

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3333
```

Ele mostra um endereço como `https://palavras-aleatorias.trycloudflare.com`. Deixe a janela aberta.
**O endereço muda toda vez** que você roda o comando; quando mudar, atualize-o no passo 3.

### 3. Webhook no painel do Mercado Pago

Na aplicação: **Webhooks → Configurar notificações**.

- **URL de teste**: `https://SEU-ENDERECO.trycloudflare.com/api/v1/payments/mercadopago/webhook`
- **Eventos**: marque **Pagamentos**.
- **Salvar**: aparece a **assinatura secreta**. Copie.

### 4. Variáveis do servidor

Em `server\.env`:

```
PAYMENT_PROVIDER=mercadopago
MP_ACCESS_TOKEN=cole-o-access-token-de-teste
MP_WEBHOOK_SECRET=cole-a-assinatura-secreta
PUBLIC_SITE_URL=http://localhost:5173
```

Depois, no PowerShell, dentro de `server`:

```powershell
npm run db:migrate    # aplica a migration nova (link de pagamento)
npm run dev
```

Se faltar alguma variável, a API não sobe e diz qual. O `teste-celular.ps1` ajusta o `PUBLIC_SITE_URL` para
o IP do computador, para a volta do Mercado Pago abrir no celular.

### 5. Ligar no painel

**Painel → Loja → Formas de pagamento no site**: marque **Pix** e **Cartão pelo site** → **Salvar configurações**.
Enquanto o Mercado Pago não estiver configurado no servidor, essas duas opções ficam desabilitadas.

### 6. Roteiro de teste

**Cartão aprovado**

- [ ] Faça um pedido com **Cartão pelo site** → **Ir para o pagamento**.
- [ ] Na página do Mercado Pago, use o cartão de teste **Mastercard 5480 8328 0103 3311**, CVV **123**,
      validade **11/30**, titular **APRO**, CPF **12345678909** e qualquer e-mail válido.
- [ ] Ao voltar ao site, o acompanhamento abre sozinho e, em alguns segundos, mostra **Recebido · ✓ pago**.
- [ ] No painel, o pedido chega com **"✓ Pago online"**.

**Cartão recusado e nova tentativa**

- [ ] Faça outro pedido e use o titular **OTHE**: a volta mostra **"O pagamento não foi aprovado"**.
- [ ] Toque em **Pagar agora**, pague com **APRO**: o pedido vai para a cozinha.

**Cancelamento e ataque falso**

- [ ] Cancele um pedido que ainda está "Aguardando pagamento": ele some da fila de pagamento.
- [ ] Mande um aviso falso, sem assinatura. No PowerShell:
      ```powershell
      curl.exe -X POST "http://localhost:3333/api/v1/payments/mercadopago/webhook?data.id=1&type=payment"
      ```
      A resposta tem que ser **401** e nada muda.

**Pix**

- [ ] Escolha **Pix** no site: a página do Mercado Pago mostra só o Pix. No modo de teste, a aprovação de Pix
      depende do que o Mercado Pago oferece para contas de teste. O caminho mais garantido para testar o
      fluxo é o cartão de teste.

Cartões e titulares de teste: <https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/test-cards>

### Se o pedido ficar parado em "Aguardando pagamento"

O aviso do Mercado Pago não chegou ou foi recusado. Olhe a janela da API:

- **nenhuma linha com `/payments/mercadopago/webhook`**: o túnel caiu ou a URL no painel do Mercado Pago está
  velha (passos 2 e 3);
- **resposta 401**: a `MP_WEBHOOK_SECRET` não é a do painel, ou o painel gerou uma nova;
- **resposta 502**: o Access Token está errado ou o Mercado Pago está fora do ar (ele tenta de novo a cada
  15 minutos).

No painel do Mercado Pago, em Webhooks, há o histórico de avisos enviados e as respostas.

---

## Colocar no ar (dinheiro de verdade)

1. Conta e aplicação **da Cemita**, com as **credenciais de produção** (Access Token de produção).
2. API publicada com `https`. **URL de produção** do webhook no painel do Mercado Pago:
   `https://API-DA-CEMITA/api/v1/payments/mercadopago/webhook` (evento Pagamentos) e a assinatura secreta.
3. `server` em produção:
   - `NODE_ENV=production` e `PAYMENT_PROVIDER=mercadopago`;
   - o Access Token e a assinatura de **produção**;
   - `PUBLIC_SITE_URL=https://site-da-cemita`;
   - `MP_SANDBOX=false`.

   A API recusa subir em produção com endereço `http` ou modo de teste ligado.
4. Fazer um pedido real de valor baixo, conferir no painel e estornar pelo Mercado Pago.

**Decisões pendentes da Cemita**

- **Prazo para pagar** (`payment_timeout_minutes`): quanto tempo o link vale. Vazio = sem prazo.
- **Quem faz estornos** e em quanto tempo, quando um pedido pago for cancelado.
- **Se Pix e cartão pelo site entram junto** com o pagamento na entrega ou no lugar dele.

## Segurança (resumo)

- O Access Token fica **só** no `server\.env` (nunca no site, no `.env.local` nem no git).
- Nenhum dado de cartão passa pelo site ou pela API.
- O pedido só vai para a cozinha com o aviso **assinado** + o pagamento **consultado** no Mercado Pago, e com
  valor e moeda iguais aos do pedido. Aviso repetido não faz efeito duas vezes.
- O site só redireciona para endereços `https` do Mercado Pago.

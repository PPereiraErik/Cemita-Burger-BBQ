# Testar o pedido pelo site (passo a passo no Windows)

Roteiro para rodar **site + API + painel** na sua máquina e fazer um pedido de ponta a ponta.
Tempo: uns 20 minutos na primeira vez. Os comandos são para o **PowerShell**.

> Tudo aqui é ambiente de **teste**: bairro, zona de entrega e política de privacidade são fictícios
> (marcados `[DEV]` / `DEV-0`). Nada disso vai para produção.

---

## 0. Antes de começar

- **Node.js 22.18 ou mais novo**: `node -v`
- **MySQL 8.4**: com o **Docker Desktop** (mais fácil) ou com o **MySQL Installer** (sem Docker).
- Projeto em `C:\dev\cemita-projeto`. Ao extrair o zip novo por cima, **não apague** os seus arquivos
  `.env`, `.env.local` e `server\.env` (o zip não traz nenhum deles).

## 1. Banco de dados

**Com Docker** (abra o Docker Desktop antes):

```powershell
cd C:\dev\cemita-projeto\server
docker compose up -d
```

**Sem Docker** (MySQL instalado na máquina):

```powershell
cd C:\dev\cemita-projeto\server
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -p -e "source docker/setup-local.sql"
```

## 2. API (janela 1 do PowerShell)

```powershell
cd C:\dev\cemita-projeto\server
if (!(Test-Path .env)) { copy .env.example .env }
npm install
npm run db:migrate       # cria/atualiza as tabelas
npm run db:seed          # cardápio, adicionais, ponto da carne e combo com bebida
npm run db:seed:dev      # dados FICTÍCIOS de teste: zona "Bairro de Teste", política DEV-0 e liga o pedido pelo site
npm run admin:create     # só na primeira vez: cria a sua conta do painel (papel: admin)
npm run dev              # API em http://localhost:3333 — deixe esta janela aberta
```

Já tinha rodado o seed antes? Pode rodar `npm run db:seed` de novo: ele só **acrescenta** o que falta
(os adicionais e o combo com bebida) e não mexe no que você mudou pelo painel.

## 3. Site e painel (janela 2)

```powershell
cd C:\dev\cemita-projeto
if (!(Test-Path .env.local)) { copy .env.example .env.local }
npm install
npm run dev
```

- Site: <http://localhost:5173>
- Painel: <http://localhost:5173/admin/> (entre com a conta do passo 2)

## 4. A loja precisa estar "aberta"

O horário cadastrado é **terça a domingo, 18h às 23h** (horário de Brasília). Fora disso, o botão
"Fazer pedido" aparece desabilitado com o motivo, e isso é o comportamento certo.

Para testar fora do horário: **Painel → Loja → Horário de funcionamento → + Adicionar dia**,
escolha o dia de hoje, `00:00` às `23:59` e **Salvar horário**. Depois do teste, apague essa linha.

## 5. Roteiro de teste (marque o que funcionou)

**Cliente (site)**

- [ ] Em **Na brasa**, toque no **+** de um burger: abre a janela pedindo o **ponto da carne**.
      Marque **Transformar em combo**, escolha a bebida, o ponto e um adicional (ex.: Bacon) → **Anotar**.
- [ ] Em **Smash**, toque no **+** de um lanche (entra direto na comanda). O aviso oferece **Virar combo**:
      toque, escolha a bebida e **Atualizar** — a linha vira combo (não duplica).
- [ ] Em **Cervejas**, adicione uma cerveja.
- [ ] Abra a **Comanda**: embaixo do total aparece **"total conferido pelo Cemita"** e o valor é a soma certa.
- [ ] **Fazer pedido →**: toque em **Enviar** sem preencher nada → aparece a lista do que falta.
- [ ] Preencha nome e telefone, escolha **Entrega**, bairro **`Bairro de Teste`** (qualquer rua/número/CEP):
      a taxa de **R$ 5,00** entra no total.
- [ ] Dinheiro → marque "Vou precisar de troco" e informe um valor.
- [ ] Confirme os 18 anos (por causa da cerveja), aceite a política → **Enviar pedido**.
- [ ] Abre o **acompanhamento** com o código do pedido, os itens e as opções (combo, ponto, adicional).
- [ ] Faça um segundo pedido: **Retirar no balcão** + **cartão na maquininha** (sem taxa e sem endereço).

**Equipe (painel, em outra aba)**

- [ ] Toque em **🔕 Ligar som de pedido novo** (toca um bip de teste). Deixe a aba em segundo plano:
      o pedido novo toca três bipes e o título da aba pisca.
- [ ] O pedido aparece no quadro de **Pedidos** em até 10 s, com destaque de "novo".
- [ ] **🖨 Imprimir** num pedido: abre a janela de impressão com o cupom (na cozinha, sem telefone e endereço).
- [ ] Os itens mostram combo, ponto e adicionais, e o total confere com o do site.
- [ ] Avance o status (aceitar → em preparo → pronto → saiu/finalizado): o acompanhamento do cliente
      atualiza sozinho (até 20 s).
- [ ] Num pedido ainda "Recebido", o cliente consegue **cancelar** pelo acompanhamento.
- [ ] **Loja → Pausar pedidos agora**: o site passa a mostrar o motivo e não deixa enviar. Depois, **Retomar**.
- [ ] **Cardápio → esgotar** um produto: no site ele aparece como esgotado (atualize a página).
- [ ] **Eventos → + Novo evento**: envie um print de um post de evento, preencha nome, data e horário e
      **Publicar no site**. A seção **Agenda** aparece no site (atualize a página). Passo a passo e IA: [EVENTOS.md](EVENTOS.md).

**No celular (mesma rede Wi-Fi)**

Feche as janelas da API e do site (Ctrl+C) e, na pasta do projeto, rode:

```powershell
powershell -ExecutionPolicy Bypass -File .\teste-celular.ps1
```

O script descobre o IP do computador, ajusta `server\.env` e `.env.local`, avisa se a rede está como
"Pública" e abre a API e o site em duas janelas. No fim, ele mostra os dois endereços:

- **no celular**: `http://<IP>:5173`;
- **painel no computador**: `http://<IP>:5173/admin/`. Use o IP, não `localhost`, senão o login do painel não funciona.

Se o celular não abrir a página:
- deixe o Wi-Fi como rede **Privada** (Configurações → Rede e Internet → Wi-Fi → a sua rede → Tipo de perfil de rede);
- libere as portas no Firewall: o script mostra o comando, que roda **uma vez** num PowerShell aberto como administrador;
- confira se o celular está no mesmo Wi-Fi (não no 4G nem numa rede de visitantes).

Para voltar ao normal depois: `powershell -ExecutionPolicy Bypass -File .\teste-celular.ps1 -Desfazer`.

## 6. Testes automáticos (opcional, mas ajuda muito)

```powershell
cd C:\dev\cemita-projeto
npm test                      # regras do site (70 testes)
cd server
if (!(Test-Path .env.test)) { copy .env.test.example .env.test }
npm test                      # API com MySQL de teste (precisa do banco cemita_test do passo 1)
```

## 7. O que ainda NÃO funciona no pedido pelo site (de propósito)

- **Pix e cartão pelo site**: já estão prontos, mas precisam das credenciais do Mercado Pago e de um endereço público para o aviso de pagamento. Veja [PAGAMENTO-MERCADOPAGO.md](PAGAMENTO-MERCADOPAGO.md).
- **Fritas, Fritas Especiais e Monster** ("a partir de"): o preço depende do tamanho, que ainda não está
  cadastrado. Na comanda aparece o aviso, e eles continuam pelo delivery.
- **Zona de entrega, política de privacidade e prazos reais**: dependem da Cemita.

## 8. O que me mandar

- Os itens do roteiro que **não** funcionaram, com um print.
- Se algum comando der erro: o comando e as últimas linhas da mensagem.
- O resultado de `npm test` (site) e de `npm test` dentro de `server`.

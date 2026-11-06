# Cemita Burger & BBQ — site

Apresentação, cardápio digital, comanda e vitrine para a TV do salão do **Cemita Burger & BBQ** (Joinville/SC).
Uma hamburgueria de desenho animado num universo levemente macabro.
React + TypeScript + Vite + Tailwind CSS v4 + GSAP (só no caixão e no burger que desmonta).

## Rodar

Para testar site + API + painel na sua máquina, siga **[TESTE-HOJE.md](TESTE-HOJE.md)**.

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # build de produção (dist/)
npm run preview  # testar o build
npm test         # regras do site: ligação com a API, adicionais e checkout (Node 22.18+)
```

Deploy: Vercel/Netlify (framework "Vite", saída `dist`).

## Ligação com a API de pedidos (`server/`)

O site funciona sozinho, com o cardápio de `src/config`. Com `VITE_API_URL` configurada, ele passa a ler da API:

- **preços** e **esgotado/indisponível** vêm do banco (o que o painel mudar aparece no site);
- **"aberto agora"** vem do horário cadastrado no banco;
- com o pedido pelo site ligado no painel (`ordering_mode` = `native` ou `both`), o **total da comanda é calculado pelo servidor**, e o que não pode ser pedido pelo site aparece marcado na linha. A comanda nunca manda preço: só ids e quantidades.

**Pedido pelo site (Etapa 4).** Com `ordering_mode` = `native` ou `both` e a loja aceitando pedidos, a comanda ganha o botão **Fazer pedido**:
nome e telefone → retirada ou entrega (endereço, com a taxa da zona calculada pelo servidor) → pagamento na entrega/retirada (dinheiro, com troco, ou maquininha)
→ confirmação de maioridade quando há bebida alcoólica → aceite da política de privacidade → **Enviar pedido**.
Adicionais, ponto da carne e combo com bebida vão para o servidor como **ids de opção** (mesmo grupo e mesmo nome
cadastrados pelo seed); o servidor valida (ex.: ponto obrigatório no grelhado) e calcula o preço.
O envio usa uma chave de idempotência: se a conexão cair e a pessoa tocar de novo, o servidor devolve o mesmo pedido (nunca duplica).
Depois do envio abre o **acompanhamento** (atualiza a cada 20 s, permite cancelar antes do preparo); o código e o token do pedido ficam só neste aparelho
(`localStorage`, 2 dias) e o botão "Seu pedido" aparece no topo. Os dados pessoais digitados não são salvos no aparelho.
Fora do horário ou com a cozinha pausada, o botão fica desabilitado com o motivo.

**Pix e cartão pelo site (Etapa 6, Mercado Pago).** Com o Mercado Pago configurado no servidor e as formas ligadas no painel,
o checkout oferece **Pix** e **Cartão pelo site**: o botão vira "Ir para o pagamento", o cliente paga na página do Mercado Pago
e volta para o acompanhamento (`?pedido=CÓDIGO`), que mostra "Falta pagar"/"Pagar agora" até o servidor receber a confirmação.
A volta do Mercado Pago não confirma nada sozinha: só o webhook conferido no servidor. Passo a passo: [PAGAMENTO-MERCADOPAGO.md](PAGAMENTO-MERCADOPAGO.md).

Com `ordering_mode = vuca` (padrão), os botões continuam levando ao delivery VUCA. Se a API estiver fora do ar, o site volta sozinho para o cardápio de `src/config`.

**Agenda de eventos.** Aba **Eventos** no painel (administração e atendimento): print/arte do post do Instagram + legenda →
"✨ Preencher com IA" (opcional, com `ANTHROPIC_API_KEY` no servidor) → conferir → publicar. O site mostra a seção **Agenda**
(e o item no menu) só quando há evento publicado; o evento sai sozinho depois que acontece. Passo a passo: [EVENTOS.md](EVENTOS.md).

**Painel da equipe (Etapa 5).** Segunda página do mesmo projeto: `admin/index.html` → `src/admin/`. Em desenvolvimento, abra `http://localhost:5173/admin/`; no build, sai em `dist/admin/`.
Pedidos (quadro em colunas, atualiza a cada 10 s mesmo com a aba em segundo plano, avisa pedido novo com som de três toques — botão "Ligar som", lembrado no aparelho —, vibração, título piscando, destaque e leitor de tela; botão **🖨 Imprimir** em cada pedido, cupom de 80 mm: a cozinha imprime sem os dados do cliente), Cardápio (esgotado; preço e texto só administração), Loja (pausar; modo de pedido, pagamentos, prazos e horário só administração), Entregas, Equipe, Registro e Minha conta. As abas aparecem conforme o papel.
Precisa de `VITE_API_URL` e de uma conta criada com `npm run admin:create` dentro de `server` (não há conta padrão). Regras puras do painel: `src/admin/core.ts`, testadas em `tests/admin.test.ts`.

**Publicação (rodar sozinho).** Um serviço só (`Dockerfile`) entrega site, painel e API no mesmo endereço; a cada publicação o banco se atualiza sozinho (`server/scripts/deploy.js`) e a primeira conta de administração e a política de privacidade vêm de variáveis do servidor. Testes automáticos no GitHub em `.github/workflows/ci.yml`. Passo a passo: [PUBLICAR.md](PUBLICAR.md). Manual para a equipe do Cemita: `MANUAL-DA-EQUIPE.pdf`.

**"Virar combo".** Depois de anotar um lanche que aceita combo sem o combo, o aviso oferece "Virar combo · + R$ 15,99", e a comanda mostra o mesmo atalho na linha. A linha é trocada (não duplicada).

**Google e prévia do link (WhatsApp/Instagram).** `seo.plugin.ts` (Vite) gera no `index.html`, a partir de `src/config`, o JSON-LD do restaurante com o cardápio e os preços, horário, endereço e redes, e a imagem de compartilhamento `public/og-cemita.jpg` (1200×630, foto real + logo). A Agenda publica cada evento como `Event`. Com `VITE_SITE_URL` (ex.: `https://cemita.com.br`) no build, a imagem vira endereço absoluto (o WhatsApp precisa disso) e saem `og:url`, `canonical`, `robots.txt` e `sitemap.xml`; sem ela, nenhum endereço é inventado. Regras em `src/lib/seoCore.ts`, testadas em `tests/seo.test.ts`.

Para desenvolver com a API: copie `.env.example` para `.env.local` (fica fora do git), suba a API (`npm run dev` dentro de `server`) e rode `npm run dev` aqui. Sem `.env.local`, nada muda.

## Seções (página única, atualização de 20/10/2026)

Referência visual: o mockup "Home — PC e celular" enviado pelo Erik. Componentes em `src/site/`.

| # | Seção | Componente | O que tem |
| --- | --- | --- | --- |
| — | Menu | `Sidebar` (computador, ≥1024 px) · `MobileBars` (celular e tablet) | barra lateral que abre e fecha (a escolha fica lembrada); no celular, barra no topo com menu em tela cheia e barra fixa embaixo (Comanda \| Cardápio) |
| — | Início | `Hero` | selo, título em dois tempos, botão para o cardápio, 3 polaroids que trocam uma por vez a cada ~2,6 s (com botão de pausar), gravuras sem encostar nas fotos, e onde fica / horário (com "aberto agora") / WhatsApp / como chegar |
| — | Faixa | `Faixa` | faixa mostarda que corre (decorativa) |
| 01 | Cardápio | `Cardapio` + `Prato` + `Extras` (e, como opção, `Tombstone`/`Retrato`) | barra fixa com categorias e busca; formato de menu impresso: foto, nome, preço e descrição à vista, "+" para anotar e toque na foto para os detalhes (combo, adicionais, observação); bebidas em lista com miniatura; quadros de combo e adicionais embaixo (ver abaixo) |
| 02 | Joinville em Dobro | `Dobro` | as ofertas e o essencial das regras de `config/promocoes.ts`, link do aplicativo, catedral e placa |
| 03 | A História | `Historia` | 2 parágrafos e 3 curiosidades: **espaços reservados** (`config/site.ts`) |
| 04 | Quem já veio | `Mural` | mural de polaroids (5 no computador, 3 no celular) que trocam sozinhas; vídeo em loop, sem som, com pôster |
| — | Rodapé | `Footer` | despedida, sem botões |
| TV | Modo TV | `scenes/TvMode` | abra o site com `?tv` |

**Modelo do cardápio.** `CATEGORIA_MODELO` em `src/config/site.ts` define o modelo de cada categoria.
Hoje: `prato` (menu impresso) em todas as comidas e `lista` em cervejas e bebidas.
- Prato: foto 4:3 que se dissolve nas bordas no fundo escuro (o produto não é recortado — as fotos atuais são
  closes que cortam o lanche nas bordas, então um recorte de verdade não fica bom), nome, preço com "+" e a descrição
  inteira. 2 colunas no celular, 3 no tablet, 4 em telas grandes. Embaixo, os quadros "Monte seu combo"
  (smash, grelhado e sanduíches) e os adicionais/molhos/acompanhamentos/extras de `src/config/options.ts`.
- Lista: miniatura quadrada com o fundo original da foto, nome, preço e "+"; 1, 2 ou 3 colunas.
- Os modelos anteriores continuam disponíveis: `lapide` (pedra que gira) e `retrato` (quadro pendurado);
  basta trocar o valor da categoria em `site.ts`.
Larguras da grade de lápides: 1 coluna de até 280 px no celular, 2 a partir de 520 px de área útil, 3 a partir de 700 px,
4 a partir de 880 px. Com itens na comanda, o botão "Comanda" (barra inferior no celular e lateral no computador) mostra o valor parcial.
O "R · I · P" fica no pé da pedra, embaixo do texto, e só aparece quando sobra espaço.

**Lápides — o texto nunca sai da pedra.** `src/site/useCabe.ts` mede cada face: primeiro diminui a foto
(frente: primeiro tira o "R · I · P", depois o resumo dos ingredientes, depois a letra até 86%, depois a foto); se ainda não couber, encurta os ingredientes do verso em linhas inteiras com "…".
O texto completo fica em "DETALHES" (e no nome acessível). No celular (1 lápide por linha) e no tablet os ingredientes
aparecem inteiros; só em telas de ~1024 px (3 colunas estreitas) 2 itens longos ficam encurtados.

**Movimento.** Com "reduzir movimento" (sistema ou painel do site): polaroids paradas, faixa parada,
lápide vira sem animação, vídeo do mural vira foto.

A **comanda** está na barra lateral (computador) e na barra de baixo (celular), com contador.
## Pendências para confirmar com a Cemita

- **Textos da História e as 3 curiosidades** (`src/config/site.ts`): espaços reservados entre [colchetes]. Não podem ir ao ar assim.
- **Legenda das polaroids**: está "@cemita", como pedido. O perfil oficial é @cemitaburger (usado no texto "Marque … e apareça aqui"). Confirmar (`HOUSE_CAPTION` em `src/config/midia.ts`).
- **Fotos de Halloween no mural**: mostram fantasias de personagens de filmes de terror conhecidos. Confirmar com a Cemita que as fotos são deles e podem ir para o site. Para tirar, apague a linha em `MURAL`.
- **Mídias de clientes**: nenhuma ainda. Só entram com autorização registrada (`clienteAutorizado: true`).
- **Gravuras em alta**: as do mockup têm de 60 a 460 px. Pedir os arquivos originais (mesmo nome em `src/assets/gravuras/`).
- **Joinville em Dobro**: as ofertas e regras vêm dos prints do app (19/10/2026). Faltam os dias e horários completos de cada cupom (os prints cortavam a tabela) e o preço do tour. O app mostra o bairro como "Atiradores"; o site usa "Anita Garibaldi": confirmar.
- **Brasileiríssima**: a caipirinha de caldo de cana aparece só como oferta do Joinville em Dobro. Não está no cardápio do delivery, então não entrou no cardápio do site.

Atualizado com os prints do delivery de 08/10/2026. O que ainda depende do restaurante:

- **Fotos em alta**: as fotos dos produtos e os banners foram recortados de prints. Pedir os originais (lista em `src/assets/fotos/LEIA-ME.md`). Faltam brisket e os 4 vegetarianos.
- **Adicionais por categoria** (`src/config/options.ts`): nomes e preços vieram dos prints. Smash, vegetariano e BBQ estão como "visto". Grelhado (ponto da carne, carne 150g) e sanduíches estão como "inferido" do combo: confirmar.
- **Fonte dos banners**: a letra dos títulos das artes (SMASH, BURGER GRELHADO…) não foi identificada. Se a Cemita mandar o arquivo da fonte, ela pode substituir a Germania One nos títulos.
- **Fritas com Costela**: aparece no banner de Entradas, mas não está na lista de produtos do delivery. Não foi adicionada.
- **Fanta Ghost Face Punch** (bebida do combo, +R$ 7): era só até o evento de Halloween. Ficou de fora.
- **Heineken Zero**: o delivery marca como +18. O site segue o delivery.

## Sistema visual (atualização de 20/10/2026)

Tudo em `src/index.css` (comentário no topo com a paleta e os contrastes).

- **Paleta** (`@theme`): `fundo` #24150d · `secao` #5a3a24 · `barra` #1a0f09 · `lapide` #2e1b11 · `creme` #efe4cc · `creme-2` #b4a78f ·
  `laranja` #ffb766 · `mostarda` #d9a23a · `papel` #efe6d2 · `tinta` #241a14 · `vinho` #8a2b1d.
  Na seção #5a3a24 o texto secundário usa `creme-3` #e3d6bc (o #b4a78f ali fica em 4,3:1, abaixo do mínimo).
- **Contextos**: a página (escuro), `.secao`, `.laranja` (Joinville em Dobro), `.paper` (comanda, janelas) e `.tinta` (barras).
  Comanda, checkout e painéis usam os tokens `bone`, `char`, `mute`, `sheet`, `lilac`, `lilac-ink`, `blood` e se ajustam sozinhos.
- **Tipo**: Germania One (títulos, nomes, categorias), DM Mono (rótulos, botões, preços), Instrument Sans (texto), Yellowtail (legenda das polaroids).
  As fontes ficam no próprio site (`src/assets/fonts`, WOFF com recorte latino, ~120 KB no total, licenças OFL/Apache ao lado): sem Google Fonts.
- **Títulos em dois tempos**: componente `Titulo` (`src/site/Gravura.tsx`).
- **Regra**: gravura é decoração; nunca fica por cima de foto nem de texto, e nunca é apresentada como foto de produto.

## Onde alterar as coisas

| O quê | Arquivo |
| --- | --- |
| Endereço, horário, WhatsApp, Instagram, link de pedido | `src/config/restaurant.ts` |
| Cardápio, preços e ingredientes (descrição) | `src/config/menu.ts` |
| Textos do site (título do Início, faixa, A História, curiosidades, nome e ícone das categorias) | `src/config/site.ts` |
| Fotos das polaroids e do mural "Quem já veio" | `src/config/midia.ts` + `src/assets/midia/` (veja o `LEIA-ME.md` de lá) |
| Fotos dos produtos (lápides) | `src/assets/fotos/cardapio/` (+ miniatura em `cardapio/mini/`) |
| Gravuras (ilustrações) | `src/assets/gravuras/` + `src/config/gravuras.ts` |
| Ofertas do Joinville em Dobro | `src/config/promocoes.ts` (`active: false` tira a seção e o link do menu) |
| Cores e fontes | `src/index.css` (`@theme` e contextos `.paper`, `.tinta`, `.secao`, `.laranja`) |
| Libras (quando houver recurso de verdade) | `src/config/restaurant.ts` (`accessibility.libras`) |
| Slides da TV | `src/scenes/TvMode.tsx` (`SLIDES`) |

**A comanda**: no modo VUCA o pedido é finalizado no delivery oficial (ou a comanda vai pelo WhatsApp);
com o pedido pelo site ligado no painel, a comanda abre o checkout. Código em `src/world/Comanda.tsx`.
## Estrutura

```
src/
  site/       Sidebar · MobileBars · Hero · Faixa · Cardapio · Tombstone · Pedras · Dobro · Historia · Mural · Footer · Overlays · Polaroid
  world/      Comanda (comanda e detalhes do produto) · Checkout · OrderTracking · A11yPanel · OptionsPicker · Dialog · Objects
  scenes/     TvMode
  config/     restaurant · menu · options · promocoes · site · midia · gravuras · photos · art · illustrations
  lib/        cardapio (busca) · rotacao (polaroids) · comanda · ui · live · api · checkout · orders · a11y · motion · scroll · sound
  admin/      painel da equipe (/admin/)
```

## Acessibilidade e performance

- **Painel de acessibilidade** (barra lateral e menu do celular): tamanho do texto, alto contraste, destaque de foco, reduzir animações,
  espaçamento, não depender de cor, fonte simples e restaurar. Atributos `data-a11y-*` no `<html>` (`src/lib/a11y.ts`).
- Libras: nenhum tradutor improvisado. Existe só o espaço na configuração para um recurso real.
- Contraste mínimo de 4,5:1 em todo texto (contas no topo do `index.css`); foco de 2px laranja (tinta escura sobre fundo claro).
- Alvos de toque de 44px; o "+" da lápide tem 36px visíveis e 44px de altura de toque.
- Botões só de ícone com `aria-label`; a face escondida da lápide fica `inert` (fora do teclado e do leitor de tela); Esc vira de volta.
- Polaroids que trocam sozinhas têm botão de pausar e param com o mouse ou o foco em cima, fora da tela ou com a aba escondida (WCAG 2.2.2).
- `prefers-reduced-motion` (ou o painel) desliga todas as animações.
- Barras fixas não cobrem o que recebe foco (`scroll-padding`).
- Imagens em WebP: 480/960 px com `srcset` nas polaroids, miniatura de 400 px nas lápides, lazy-load fora da primeira tela,
  gravuras com largura e altura reservadas (a página não pula ao carregar). Vídeo: MP4 de 250 KB, sem som, em loop, só toca visível, com pôster.

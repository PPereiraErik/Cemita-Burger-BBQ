# Eventos na Agenda do site

A Cemita posta um evento no Instagram (show, stand-up, festa) → a equipe cadastra no painel em menos de
um minuto → o evento aparece na seção **Agenda** do site e sai sozinho depois que acontece.

## Quem pode

Só quem tem conta no painel: **Administração** e **Atendimento**. A Cozinha não vê a aba.
Contas são criadas pela administração (**Painel → Equipe**) ou, a primeira, com `npm run admin:create`
dentro de `server`. Não existe conta padrão nem cadastro aberto: sem login, ninguém publica nada.

## Passo a passo (pelo celular mesmo)

1. No Instagram, abra o post do evento:
   - tire um **print** e corte para ficar só a arte (ou salve a arte original);
   - se quiser, copie a **legenda** (toque em "mais", segure o texto, Copiar);
   - se quiser, copie o **link** (⋯ ou o avião de papel → Copiar link).
2. No painel, abra **Eventos → + Novo evento**.
3. Escolha o print/arte, cole a legenda e o link.
4. Toque em **✨ Preencher com IA**. Ela lê a arte e a legenda e preenche nome, data, horário, atração,
   destaques e como reservar. Os avisos amarelos dizem o que conferir (ex.: "horário não aparece no post").
5. Confira, complete o que faltar e toque em **Publicar no site**. Ou **Salvar rascunho**, que não aparece
   no site.

Para tirar do site antes da hora, use **Tirar do site** (vira rascunho) ou **Excluir**. Tudo fica no
**Registro** do painel.

## O que aparece no site

A seção **Agenda** aparece logo depois do cardápio, junto com o item "Agenda" no menu, **só quando há evento
publicado**. Cada evento mostra:

- a arte do post;
- dia, dia da semana e horário;
- a atração e os destaques;
- como reservar;
- o botão **Reservar pelo WhatsApp**, já com a mensagem "Quero reservar uma mesa para o evento X (dd/mm)";
- **Ver no Instagram**.

Sem horário de fim, o evento sai do site 6 horas depois do início.

## Ligar a leitura por IA (opcional)

Sem a IA, o painel funciona igual: só não tem o botão, e a equipe preenche os campos.

1. Crie uma conta em <https://console.anthropic.com>, adicione crédito e gere uma **API key**.
   Cada leitura de post custa centavos (confira os preços atuais no site da Anthropic).
2. Em `server\.env`: `ANTHROPIC_API_KEY=sua-chave` e reinicie a API.

A chave fica só no servidor (nunca no site). A IA **nunca publica sozinha**: ela só preenche o rascunho.

## Depois (opcional): ligação direta com o Instagram

Para os posts entrarem sem ninguém colar nada, é preciso um app na Meta e a Cemita autorizar a conta
@cemitaburger. O painel de eventos continua sendo o lugar de conferir e publicar.

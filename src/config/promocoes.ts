/**
 * JOINVILLE EM DOBRO — ofertas do Cemita
 *
 * ✅ FONTE: prints do app Joinville em Dobro enviados pelo Erik em 19/10/2026
 *    (telas "Cemita Burger" e "Cemita Burger | Drinks", com as regras do cupom).
 *    Site oficial do programa: https://www.joinvilleemdobro.com.br/ (confirmado em busca em 19/10/2026).
 *
 * O que NÃO está aqui de propósito (não aparecia nos prints, então não foi inventado):
 *  - o preço do cupom/tour e a forma de comprar;
 *  - os dias e horários completos de cada cupom (os prints cortavam parte da tabela): o site manda conferir no app.
 *
 * ⚠️ O app mostra o endereço como "Rua Ottokar Doerffel, Nº 165, Atiradores". O site usa "Anita Garibaldi"
 *    (bio do Instagram). Confirmar o bairro com a Cemita.
 *
 * Para atualizar: edite as ofertas abaixo. Para tirar a seção do ar, deixe `active: false`.
 */
export type Offer = {
  id: string
  /** nome do estabelecimento no app */
  listing: string
  /** a oferta, com as palavras do app */
  headline: string
  /** o produto do cardápio do site, quando existe (abre os detalhes) */
  productId?: string
  /** foto real: chave em src/assets/fotos */
  photo: string
  photoAlt: string
  /** regra específica do estabelecimento (texto do app) */
  houseRule: string
  adult?: boolean
}

export const EM_DOBRO = {
  active: true,
  checkedAt: '19/10/2026',
  programUrl: 'https://www.joinvilleemdobro.com.br/',
  apps: {
    android: 'https://play.google.com/store/apps/details?id=br.com.joinvilleemdobro',
    ios: 'https://apps.apple.com/br/app/joinville-em-dobro/id6701985309',
  },
  /** "Cupom válido até 09/10/2027" (aparece nas duas telas) */
  validUntil: '09/10/2027',
  offers: [
    {
      id: 'smash-rib',
      listing: 'Cemita Burger',
      headline: 'Na compra de um Smash Rib, ganhe outro igual ou de menor valor.',
      productId: 'smash-rib',
      photo: 'cardapio/smash-rib',
      photoAlt: 'Smash Rib sobre a tábua com a marca Cemita',
      houseRule: 'O desconto é sempre sobre o segundo Smash Rib igual ou de menor valor.',
    },
    {
      id: 'brasileirissima',
      listing: 'Cemita Burger | Drinks',
      headline: 'Na compra de uma Brasileiríssima (caipirinha de caldo de cana), ganhe outra igual ou de menor valor.',
      photo: 'promocoes/brasileirissima',
      photoAlt: 'Caipirinha de caldo de cana servida numa caneca de vidro em forma de caveira',
      houseRule: 'O desconto é sempre sobre a segunda Brasileiríssima (caipirinha de caldo de cana) igual ou de menor valor.',
      adult: true,
    },
  ] satisfies Offer[] as Offer[],
  /** o essencial das regras, em linguagem curta (todas aparecem nas duas telas do app) */
  essentials: [
    'Só para consumo no salão: não vale no delivery nem para viagem.',
    'Para usar com acompanhante (2 pessoas).',
    'Um cupom por estabelecimento; individual e intransferível.',
    'Não vale em feriados e datas comemorativas.',
    'Não é cumulativo com promoções da casa.',
  ],
  /** regras completas, como estão no app */
  fullRules: [
    'Cupom individual e intransferível.',
    'Válido 1 cupom por estabelecimento.',
    'Cupom válido somente para o uso com acompanhante (2 pessoas).',
    'Caso o estabelecimento tenha mais de 1 loja, o cupom é válido no endereço indicado no cupom.',
    'Válido para consumo no local. Não é válido para opção de delivery ou viagem.',
    'Não é válido para feriados e datas comemorativas, incluindo: Carnaval, Páscoa, Dia das Mães, Dia dos Namorados, Dia dos Pais, Natal e Ano Novo.',
    'Taxas de serviço, gorjetas e couvert artístico não estão inclusos no benefício, somente o item descrito. No Smash Rib, bebidas, adicionais e pratos kids também não entram.',
    'No Smash Rib, a taxa de serviço (opcional) é calculada sobre o valor bruto da conta, incluindo o prato do benefício.',
    'Promoção não cumulativa com promoções da casa.',
    'Para produtos com preços diferentes, o desconto é sempre sobre o segundo de menor valor.',
    'O mesmo usuário não pode utilizar mais de um cupom no dia no mesmo estabelecimento.',
    'Horário com traço (-) no app quer dizer que o estabelecimento está fechado ou não aceita o cupom naquele período. Segunda-feira não aceita.',
    'Para usar, é preciso ter o tour (licença) do app Joinville em Dobro.',
  ],
}

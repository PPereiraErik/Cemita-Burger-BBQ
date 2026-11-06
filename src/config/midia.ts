/**
 * MÍDIAS DO SITE — fotos das polaroids do topo e do mural "Quem já veio".
 * Arquivos em src/assets/midia/ (WebP em 480 e 960 px de largura; vídeo MP4 sem som + pôster).
 * Para acrescentar: salve <nome>-480.webp e <nome>-960.webp na pasta e inclua uma linha abaixo.
 *
 * Origem: fotos e vídeo enviados pelo Erik em 20/10/2026 (posts do @cemitaburger).
 * Produto só é nomeado quando foi identificado com segurança:
 *  - Smash Rib: igual ao post "SMASH DE COSTELA DEFUMADA" (costela, catupiry, cheddar, cebola crua);
 *  - Smash Bacon: igual ao post "smash bacon: carne, bacon, cheddar e maionese da casa";
 *  - Burger Bacon Supremo: mesma montagem da foto oficial do delivery (fatia grossa de bacon caramelizado e muçarela);
 *  - Buffalo Wings: mesma foto do delivery.
 * O resto aparece sem nome de produto ("burger com bacon", "carne defumada fatiada").
 */
const files = import.meta.glob('../assets/midia/**/*.{webp,mp4}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const url = (path: string) => files[`../assets/midia/${path}`] ?? ''

export type Foto = { src: string; srcset: string; alt: string; /** ponto de foco no recorte quadrado (object-position) */ focus?: string }
const foto = (dir: string, name: string, alt: string, focus?: string): Foto => ({
  src: url(`${dir}/${name}-960.webp`),
  srcset: `${url(`${dir}/${name}-480.webp`)} 480w, ${url(`${dir}/${name}-960.webp`)} 960w`,
  alt,
  focus,
})

/** Legenda manuscrita das fotos da casa (pedido do Erik: "@cemita"). O perfil oficial é o de restaurant.social. */
export const HOUSE_CAPTION = '@cemita'

/** Polaroids do topo: trocam sozinhas, uma por vez. As 3 primeiras aparecem ao abrir. */
export const HERO_FOTOS: Foto[] = [
  foto('topo', 'smash-rib-cima', 'Smash Rib visto de cima: costela desfiada, catupiry, cheddar cremoso e cebola crua no pão brioche', '50% 40%'),
  foto('topo', 'smash-bacon-cima', 'Smash Bacon visto de cima, com fatias de bacon e cheddar na tábua', '45% 50%'),
  foto('topo', 'bacon-supremo-lado', 'Burger Bacon Supremo: fatia grossa de bacon caramelizado sobre muçarela derretida', '60% 60%'),
  foto('topo', 'buffalo-wings', 'Buffalo Wings ao molho barbecue com gergelim e potinho de molho', '45% 55%'),
  foto('topo', 'carne-fatiada', 'Carne defumada fatiada, rosada por dentro, na chapa de ferro', '50% 55%'),
  foto('topo', 'smash-rib-cebola', 'Smash Rib com cebola crua sobre o cheddar e o catupiry', '50% 55%'),
  foto('topo', 'bacon-coca-fritas', 'Burger com bacon e cheddar, com fritas e uma lata de Coca-Cola ao fundo', '45% 65%'),
  foto('topo', 'bacon-perto', 'Burger com bacon e cheddar derretido, bem de perto', '50% 55%'),
  foto('topo', 'smash-rib-fechado', 'Smash Rib fechado, com o cheddar e a costela escapando do pão', '50% 55%'),
  foto('topo', 'bacon-supremo-perto', 'Bacon caramelizado e muçarela derretida do Burger Bacon Supremo, bem de perto', '50% 50%'),
]

export type MuralItem = {
  id: string
  kind: 'foto' | 'video'
  foto: Foto
  /** vídeo: arquivo MP4 em loop, sem som; `foto` vira o pôster */
  video?: string
  /** legenda manuscrita: @ do cliente SÓ com autorização; foto da casa usa HOUSE_CAPTION */
  caption: string
  /** true = mídia de cliente com autorização registrada (quem, quando) */
  clienteAutorizado?: boolean
}

/**
 * Mural "Quem já veio". Hoje só mídias da casa (nenhuma de cliente chegou com autorização).
 * Mídia de cliente: inclua com caption = '@perfil' e clienteAutorizado = true, e guarde a autorização.
 */
export const MURAL: MuralItem[] = [
  { id: 'salao', kind: 'foto', foto: foto('mural', 'salao-neblina', 'O salão da Cemita com neblina e luz vermelha, o letreiro CEMITA na parede de blocos', '35% 45%'), caption: HOUSE_CAPTION },
  {
    id: 'cozinha',
    kind: 'video',
    foto: { ...foto('mural', 'sacos-de-papel', ''), src: url('mural/sacos-cozinha-poster.webp'), srcset: '', alt: 'Vídeo: a equipe da cozinha com sacos de papel de caveira na cabeça montando os burgers', focus: '50% 30%' },
    video: url('mural/sacos-cozinha.mp4'),
    caption: HOUSE_CAPTION,
  },
  { id: 'palhaco', kind: 'foto', foto: foto('mural', 'halloween-palhaco', 'Entrega de Halloween: palhaço de terror segurando a sacola "Aqui jaz sua fome" na porta', '50% 40%'), caption: HOUSE_CAPTION },
  { id: 'sacos', kind: 'foto', foto: foto('mural', 'sacos-de-papel', 'Equipe com sacos de papel de caveira na cabeça diante dos burgers nas tábuas', '50% 55%'), caption: HOUSE_CAPTION },
  { id: 'boneco', kind: 'foto', foto: foto('mural', 'halloween-boneco', 'Entrega de Halloween: boneco de terror num triciclo vermelho com a sacola da Cemita', '50% 45%'), caption: HOUSE_CAPTION },
  { id: 'mascara', kind: 'foto', foto: foto('mural', 'halloween-mascara', 'Entrega de Halloween: mascarado de macacão com a sacola da Cemita', '50% 40%'), caption: HOUSE_CAPTION },
  { id: 'palhaco-pb', kind: 'foto', foto: foto('mural', 'halloween-palhaco-preto-branco', 'Entrega de Halloween: palhaço preto e branco de cartola com a sacola da Cemita', '50% 40%'), caption: HOUSE_CAPTION },
]

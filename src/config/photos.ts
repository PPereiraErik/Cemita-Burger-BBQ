/**
 * FOTOS DO CEMITA
 * Coloque/troque arquivos em src/assets/fotos/ (jpg, png, webp, avif).
 * Chave = caminho sem extensão: "macro-queijo", "cardapio/smash-rib"...
 * Arquivos ausentes viram espaço reservado (sem erro 404).
 */
import logoUrl from '../assets/brand/logo.webp'

const files = import.meta.glob('../assets/fotos/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const byKey: Record<string, string> = {}
for (const [path, url] of Object.entries(files)) {
  byKey[path.replace('../assets/fotos/', '').replace(/\.[^.]+$/, '').toLowerCase()] = url
}

export const photo = (key: string): string | undefined => byKey[key.toLowerCase()]
export const logo = logoUrl

/**
 * Papel de cada foto na experiência (análise das fotos enviadas):
 * - macro-queijo ......... macro do cheddar escorrendo → revelada pela fumaça na abertura
 * - burger-lateral ....... perfil sobre fundo preto → o burger que desmonta em camadas (cap. 01)
 * - burger-tabua ......... cheddar + catupiry + costela → reaparece no "Ficou com fome?" (cap. 09)
 * - cardapio/smash-rib ... tábua com "CEMITA" gravado → assinatura
 * - cardapio/burger-bacon-supremo, cardapio/smash-blue-cheese, cardapio/buffalo-wings → assinaturas
 * - bacon-topo, burger-combo → galeria e experiência
 */
export const GALLERY = [
  { key: 'macro-queijo', alt: 'Cheddar escorrendo sobre a carne, em macro' },
  { key: 'cardapio/smash-rib', alt: 'Smash Rib sobre a tábua gravada com o nome Cemita' },
  { key: 'bacon-topo', alt: 'Burger com fatias de bacon e cheddar visto de cima' },
  { key: 'cardapio/smash-blue-cheese', alt: 'Smash Blue Cheese com pera defumada e queijo derretido' },
  { key: 'burger-combo', alt: 'Burger com bacon, fritas e refrigerante na mesa' },
  { key: 'cardapio/buffalo-wings', alt: 'Buffalo wings ao molho barbecue com gergelim' },
  { key: 'burger-tabua', alt: 'Burger com cheddar, catupiry e costela desfiada na tábua' },
  { key: 'cardapio/burger-bacon-supremo', alt: 'Burger Bacon Supremo com fatia grossa de bacon caramelizado' },
  { key: 'burger-lateral', alt: 'Burger de perfil: brioche, bacon, cheddar e carne smash' },
]

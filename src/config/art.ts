/**
 * ILUSTRAÇÕES DA MARCA (src/assets/arte)
 * Desenhos enviados pelo Cemita, recortados e convertidos em arte de uma cor só.
 * São usados como máscara: a cor vem do CSS (carvão no claro, creme no escuro).
 * Exceções coloridas (usar como <img>): caveira, ceifador.
 *
 * Papel de cada desenho no site:
 * - morcego ........ voa pelo título da Home (assinatura da marca)
 * - ceifador ....... "a gente leva": faixa do delivery
 * - caveira ........ selo da comanda e estado vazio
 * - osso ........... divisor das faixas de frase
 * - velas .......... o Defumador (fogo baixo, tempo)
 * - arvore, teia ... o Cemitério
 * - mao-zumbi ...... sai do chão do Cemitério
 * - lapide ......... comanda vazia / erro
 * - caldeirao ...... cardápio (categorias quentes)
 * - dentes ......... "anotado!" (feedback de adicionar)
 * - passaro, mariposa, mao, chapeu, bruxa ... reserva para campanhas
 */
const files = import.meta.glob('../assets/arte/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const byName: Record<string, string> = {}
for (const [path, url] of Object.entries(files)) byName[path.replace('../assets/arte/', '').replace(/\.webp$/, '')] = url

export type ArtName =
  | 'arvore'
  | 'bruxa'
  | 'caldeirao'
  | 'caveira'
  | 'ceifador'
  | 'chapeu'
  | 'dentes'
  | 'lapide'
  | 'mao'
  | 'mao-zumbi'
  | 'mariposa'
  | 'morcego'
  | 'osso'
  | 'passaro'
  | 'teia'
  | 'velas'

export const art = (name: ArtName): string | undefined => byName[name]

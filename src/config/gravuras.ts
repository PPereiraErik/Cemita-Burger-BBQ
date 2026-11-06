/**
 * GRAVURAS (traço creme sobre marrom) — as ilustrações do redesign de 20/10/2026.
 * Arquivos em src/assets/gravuras/*.webp (fundo transparente), convertidos dos PNGs do mockup
 * "Home — PC e celular" enviado pelo Erik. `catedral` e `placa-joinville` têm traço escuro:
 * são para fundo claro (seção Joinville em Dobro).
 *
 * Regra: gravura é decoração/identidade. Nunca fica por cima de foto nem de texto,
 * e nunca é apresentada como foto de produto.
 * Para trocar uma arte por uma versão em alta: salve com o MESMO nome. O código não muda.
 */
const files = import.meta.glob('../assets/gravuras/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export type GravuraName =
  | 'batata'
  | 'burger'
  | 'catedral'
  | 'caveira-burger'
  | 'caveira-pingando'
  | 'caveirinha'
  | 'chama'
  | 'copo'
  | 'coroa'
  | 'cutelo'
  | 'esqueleto-celular'
  | 'esqueleto-chapa'
  | 'facas'
  | 'mao-rock'
  | 'mao-zumbi'
  | 'morcego'
  | 'morte-carrinho'
  | 'placa-cemita'
  | 'placa-joinville'
  | 'sacola'
  | 'teia'

const byName: Record<string, string> = {}
for (const [path, url] of Object.entries(files)) byName[path.replace('../assets/gravuras/', '').replace(/\.webp$/, '')] = url

export const gravura = (name: GravuraName): string => byName[name] ?? ''

/** Tamanho original de cada arte (largura × altura): reserva o espaço antes de carregar (sem a página pular). */
export const GRAVURA_TAMANHO: Record<GravuraName, [number, number]> = {
  'batata': [156, 180],
  'burger': [275, 311],
  'catedral': [276, 242],
  'caveira-burger': [291, 340],
  'caveira-pingando': [83, 135],
  'caveirinha': [56, 59],
  'chama': [84, 135],
  'copo': [170, 218],
  'coroa': [61, 55],
  'cutelo': [223, 153],
  'esqueleto-celular': [325, 235],
  'esqueleto-chapa': [460, 414],
  'facas': [120, 130],
  'mao-rock': [138, 322],
  'mao-zumbi': [181, 290],
  'morcego': [258, 158],
  'morte-carrinho': [414, 293],
  'placa-cemita': [352, 252],
  'placa-joinville': [171, 126],
  'sacola': [153, 233],
  'teia': [280, 261],
}

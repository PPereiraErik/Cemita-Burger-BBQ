/**
 * ILUSTRAÇÕES DA MARCA (gravura vintage, creme sobre marrom)
 * Arquivos em src/assets/ilustracoes/*.webp, com fundo transparente.
 *
 * ORIGEM: recortadas das pranchas de referência que o Erik enviou em 19/10/2026
 * (duas pranchas de elementos e o mockup do topo). O fundo marrom foi removido por cor.
 * ⚠️ PROVISÓRIAS: resolução de ~150 a 600 px. Para a versão final, substitua por arquivos
 * em alta (PNG/WebP com transparência ou SVG) com o MESMO nome — nada no código muda.
 *
 * Regra de uso: ilustração é identidade, nunca "foto do produto". Onde há produto à venda,
 * a foto real aparece junto, marcada como foto.
 */
const files = import.meta.glob('../assets/ilustracoes/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const byName: Record<string, string> = {}
for (const [path, url] of Object.entries(files)) byName[path.replace('../assets/ilustracoes/', '').replace(/\.webp$/, '')] = url

export type IllusName =
  | 'mascote-servindo-bbq'
  | 'mascote-churrasqueiro'
  | 'mascote-comendo'
  | 'mascote-bone'
  | 'mascote-coroa'
  | 'mascote-perfil'
  | 'mascote-celular'
  | 'esqueleto-mordendo'
  | 'esqueleto-mesa'
  | 'mao-burger'
  | 'mao-rock'
  | 'burger'
  | 'copo'
  | 'fritas'
  | 'morcego'
  | 'casarao'
  | 'lapide-lanterna'
  | 'entregador'
  | 'entregador-moto'
  | 'placa-cemita'
  | 'joinville'
  | 'placa-joinville'
  | 'caveiras'
  | 'cutelo'
  | 'chama'
  | 'facas'
  | 'caveira-pingando'
  | 'sacola'

export const illus = (name: IllusName): string | undefined => byName[name]

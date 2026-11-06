/**
 * TEXTOS DO SITE (redesign de 20/10/2026).
 * Tudo entre [colchetes] é ESPAÇO RESERVADO: ainda depende da Cemita e não pode ir ao ar assim.
 * Endereço, horário, WhatsApp e @ vêm de config/restaurant.ts; cardápio de config/menu.ts;
 * Joinville em Dobro de config/promocoes.ts.
 */
import type { GravuraName } from './gravuras'

export const HERO = {
  selo: 'BURGER & BBQ',
  cidade: 'JOINVILLE/SC',
  titulo: 'Você não precisa de mais um burger.',
  virada: 'Mas precisa desse.',
  subtitulo: 'Smash, burger na brasa e american BBQ defumado no fogo baixo.',
  cta: 'VER O CARDÁPIO →',
}

/** Faixa mostarda que corre (decorativa; leitores de tela pulam). */
export const FAIXA = ['SMASH', 'NA BRASA', 'AMERICAN BBQ', 'COSTELINHA', 'COMBOS', 'AQUI JAZ A SUA FOME']

/** Como cada categoria do cardápio aparece na barra (nome curto + ícone em gravura). */
export const CATEGORIA_VIEW: Record<string, { titulo: string; icone: GravuraName }> = {
  smash: { titulo: 'Smash', icone: 'burger' },
  grelhado: { titulo: 'Na brasa', icone: 'chama' },
  bbq: { titulo: 'BBQ defumado', icone: 'cutelo' },
  sanduiches: { titulo: 'Sanduíches', icone: 'facas' },
  entradas: { titulo: 'Entradas', icone: 'batata' },
  vegetariano: { titulo: 'Vegetariano', icone: 'caveirinha' },
  sobremesas: { titulo: 'Sobremesa', icone: 'caveira-pingando' },
  cervejas: { titulo: 'Cervejas', icone: 'sacola' },
  bebidas: { titulo: 'Bebidas', icone: 'copo' },
}
/**
 * Como cada categoria aparece no cardápio:
 * - 'prato': formato de menu impresso — foto grande que se dissolve no fundo, nome, preço e descrição à vista,
 *   2 colunas no celular; embaixo, os quadros "Monte seu combo" e adicionais/acompanhamentos/molhos (config/options.ts);
 * - 'lista': lista compacta com miniatura (cervejas e bebidas);
 * - 'lapide': a lápide que vira para mostrar os ingredientes (modelo anterior, continua disponível);
 * - 'retrato': a foto inteira numa moldura pendurada (modelo anterior, continua disponível).
 * `destaque` (lápide/retrato): foto maior. `quadrada` (retrato): quadro quadrado.
 */
export const CATEGORIA_MODELO: Record<string, { modelo: 'prato' | 'lista' | 'lapide' | 'retrato'; destaque?: boolean; quadrada?: boolean }> = {
  smash: { modelo: 'prato' },
  grelhado: { modelo: 'prato' },
  bbq: { modelo: 'prato' },
  sanduiches: { modelo: 'prato' },
  entradas: { modelo: 'prato' },
  vegetariano: { modelo: 'prato' },
  sobremesas: { modelo: 'prato' },
  cervejas: { modelo: 'lista' },
  bebidas: { modelo: 'lista' },
}
export const modeloDe = (categoryId: string) => CATEGORIA_MODELO[categoryId]?.modelo ?? 'prato'

/** Ordem da barra de categorias. */
export const CATEGORIA_ORDEM = ['smash', 'grelhado', 'bbq', 'sanduiches', 'entradas', 'vegetariano', 'sobremesas', 'cervejas', 'bebidas']
/** Categorias sem lista de ingredientes (no verso aparece só nome e preço). */
export const SEM_INGREDIENTES = new Set(['bebidas', 'cervejas'])
/** Comida sem descrição no cardápio oficial: espaço reservado no verso da lápide. */
export const INGREDIENTES_PENDENTES = '[Ingredientes a confirmar]'

export const HISTORIA = {
  titulo: 'Como tudo começou.',
  virada: 'E por que a caveira.',
  paragrafos: [
    '[Parágrafo 1: quem fundou a Cemita, em que ano e onde a primeira chapa foi acesa. Duas ou três frases curtas.]',
    '[Parágrafo 2: de onde veio o nome e a estética de cemitério, e como o BBQ entrou no cardápio além do burger.]',
  ],
  curiosidades: [
    '[Curiosidade: quantas horas a carne passa no defumador.]',
    '[Curiosidade: o lanche mais antigo do cardápio.]',
    '[Curiosidade: a história por trás da caveira da logo.]',
  ],
}

export const MURAL_TEXTO = {
  titulo: 'Quem já passou por aqui.',
  virada: 'E sobreviveu.',
}

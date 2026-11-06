/**
 * Cardápio público: categorias e produtos ativos, com os grupos de opções ATIVOS.
 * Grupos inativos ou pendentes de revisão (ex.: combo ainda não confirmado) não aparecem.
 */
export function createCatalogService({ models }) {
  const { Category, Product, OptionGroup, OptionItem } = models

  const groupView = (g) => ({
    id: g.id,
    key: g.key,
    name: g.name,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    items: (g.items ?? [])
      .filter((i) => i.active)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ id: i.id, name: i.name, priceDeltaCents: i.priceDeltaCents, available: i.available })),
  })

  async function list() {
    const categories = await Category.findAll({
      where: { active: true },
      order: [['position', 'ASC']],
      include: [
        {
          model: Product,
          as: 'products',
          where: { active: true },
          required: false,
          include: [{ model: OptionGroup, as: 'optionGroups', where: { active: true, pendingReview: false }, required: false, include: [{ model: OptionItem, as: 'items' }] }],
        },
      ],
    })
    return categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      shortName: c.shortName,
      note: c.note,
      products: (c.products ?? [])
        .sort((a, b) => a.position - b.position)
        .map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          priceFrom: p.priceFrom,
          orderable: p.orderable,
          available: p.available,
          isAdult: p.isAdult,
          imageKey: p.imageKey,
          optionGroups: (p.optionGroups ?? []).map(groupView).filter((g) => g.items.length),
        })),
    }))
  }

  return { list }
}

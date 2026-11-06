import { ORDER_STATUS as S, ROLE } from './constants.js'

/**
 * QUEM PODE O QUÊ NO PAINEL (uma tabela só; o servidor confere em toda rota).
 *
 * admin ... tudo: pedidos, cardápio completo (preço, nome, ativo), loja, zonas de entrega, equipe, registro.
 * staff ... balcão/atendimento: pedidos (todas as mudanças, inclusive cancelar), marcar produto
 *           esgotado/disponível, pausar e retomar os pedidos da loja, cadastrar eventos da Agenda.
 * kitchen . cozinha: vê a fila (sem telefone e endereço) e só avança "recebido → em preparo → pronto".
 */
export const CAN = Object.freeze({
  viewOrders: [ROLE.ADMIN, ROLE.STAFF, ROLE.KITCHEN],
  viewCustomerContact: [ROLE.ADMIN, ROLE.STAFF],
  setProductAvailability: [ROLE.ADMIN, ROLE.STAFF],
  editProducts: [ROLE.ADMIN],
  pauseStore: [ROLE.ADMIN, ROLE.STAFF],
  editStoreSettings: [ROLE.ADMIN],
  manageZones: [ROLE.ADMIN],
  manageUsers: [ROLE.ADMIN],
  viewAudit: [ROLE.ADMIN],
  manageEvents: [ROLE.ADMIN, ROLE.STAFF],
})

export const can = (role, action) => (CAN[action] ?? []).includes(role)

/** Para onde cada papel pode levar um pedido (além das regras da máquina de status). */
const KITCHEN_TARGETS = new Set([S.PREPARING, S.READY])
export function roleCanMoveTo(role, to) {
  if (role === ROLE.ADMIN || role === ROLE.STAFF) return true
  if (role === ROLE.KITCHEN) return KITCHEN_TARGETS.has(to)
  return false
}

/** Rótulos dos papéis para a tela. */
export const ROLE_LABEL = Object.freeze({ [ROLE.ADMIN]: 'Administração', [ROLE.STAFF]: 'Atendimento', [ROLE.KITCHEN]: 'Cozinha' })

/**
 * Política de privacidade na publicação: PRIVACY_POLICY_VERSION + PRIVACY_POLICY_URL no servidor.
 * Versão nova → publica e passa a valer (as anteriores ficam no histórico, porque cada pedido
 * guarda a versão que o cliente aceitou). Versão que já existe → nada muda.
 */
export function policyPlan(existingVersions, wanted) {
  if (!wanted?.version || !wanted?.url) return { action: 'none' }
  if (existingVersions.includes(wanted.version)) return { action: 'keep' }
  return { action: 'publish', version: wanted.version, url: wanted.url }
}

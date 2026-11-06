/**
 * Erro de aplicação com código estável (o frontend decide a mensagem pelo código).
 * Tudo que não é AppError vira 500 genérico: a pilha fica só no log.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const notFound = (what = 'Recurso') => new AppError(404, 'NOT_FOUND', `${what} não encontrado.`)

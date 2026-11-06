/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endereço da API de pedidos, ex.: http://localhost:3333/api/v1. Vazio = site sem API (como antes). */
  readonly VITE_API_URL?: string
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

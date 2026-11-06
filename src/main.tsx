import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyA11y } from './lib/a11y'
import { startLive } from './lib/live'

// preferências de acessibilidade antes do primeiro desenho (sem "piscar" no tamanho/contraste)
applyA11y()

// cardápio e estado da loja vindos da API (só se VITE_API_URL estiver configurada)
startLive()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

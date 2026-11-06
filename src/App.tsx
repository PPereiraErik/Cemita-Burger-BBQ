import { TvMode } from './scenes/TvMode'
import { Agenda } from './site/Agenda'
import { Cardapio } from './site/Cardapio'
import { Dobro } from './site/Dobro'
import { Faixa } from './site/Faixa'
import { Footer } from './site/Footer'
import { Hero } from './site/Hero'
import { Historia } from './site/Historia'
import { MobileBottom, MobileTop } from './site/MobileBars'
import { Mural } from './site/Mural'
import { Overlays } from './site/Overlays'
import { Sidebar } from './site/Sidebar'

/**
 * CEMITA — página única (atualização de 20/10/2026).
 * Ordem: Início → faixa → Cardápio → Agenda (só com evento publicado) → Joinville em Dobro → A História → Quem já veio → rodapé.
 * Computador: barra lateral que abre e fecha. Celular e tablet: barra no topo + barra fixa embaixo (Comanda | Cardápio).
 * Com ?tv na URL vira a vitrine da TV do salão.
 */
const TV = typeof location !== 'undefined' && new URLSearchParams(location.search).has('tv')

export default function App() {
  if (TV) return <TvMode />
  return (
    <div className="site flex min-h-dvh items-stretch">
      <a href="#cardapio" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:bg-papel focus:px-4 focus:py-3 focus:text-tinta">
        Pular para o cardápio
      </a>
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileTop />
        <main id="conteudo">
          <Hero />
          <Faixa />
          <Cardapio />
          <Agenda />
          <Dobro />
          <Historia />
          <Mural />
        </main>
        <Footer />
        <MobileBottom />
      </div>
      <Overlays />
    </div>
  )
}

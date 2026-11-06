import { restaurant } from '../config/restaurant'
import { Gravura } from './Gravura'

/** RODAPÉ — sem botões: só a despedida (a navegação fica no menu e nas barras). */
export function Footer() {
  return (
    <footer id="rodape" className="tinta bg-barra px-5 pt-14 pb-[calc(var(--bottombar,0px)+56px)] md:px-12 md:pt-[104px] lg:pb-[104px]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-14">
        <div className="flex flex-col gap-5">
          <Gravura name="morte-carrinho" alt="Ilustração da morte levando um esqueleto num carrinho de mão" className="w-full max-w-[360px]" />
          <p className="t-display m-0 text-[clamp(40px,6vw,64px)] leading-none">Até a próxima.</p>
          <p className="t-kicker m-0 text-creme-2">
            © 2026 {restaurant.fullName.toUpperCase()} · {restaurant.address.city.toUpperCase()}/{restaurant.address.state}
          </p>
        </div>
        <div className="flex items-end justify-center gap-6">
          <Gravura name="placa-cemita" alt="Placa de madeira com o nome Cemita" className="w-[62%] max-w-[300px]" />
          <Gravura name="mao-rock" className="w-[18%] max-w-[92px]" />
        </div>
      </div>
    </footer>
  )
}

import { restaurant } from '../config/restaurant'
import { seoRestaurant } from '../config/seo'
import { apiAsset, type ApiEvent } from '../lib/api'
import { eventDateParts, reservaTexto, useEvents } from '../lib/events'
import { eventsSchema, jsonForScript, normalizeSiteUrl } from '../lib/seoCore'
import { Titulo } from './Gravura'

/**
 * AGENDA — shows, stand-up e noites especiais cadastrados pela equipe no painel (aba Eventos).
 * Só aparece quando há evento publicado e ainda não terminado; some sozinho depois.
 * A arte é a do próprio post da Cemita no Instagram.
 */
export function Agenda() {
  const events = useEvents()
  if (!events.length) return null
  const unico = events.length === 1
  // dados estruturados dos eventos (Google mostra a data e o local na busca)
  const siteUrl = normalizeSiteUrl(import.meta.env.VITE_SITE_URL) ?? (typeof location !== 'undefined' ? normalizeSiteUrl(location.origin) : null)
  const ld = jsonForScript(eventsSchema(events, seoRestaurant, siteUrl, (p) => { try { return new URL(apiAsset(p), location.href).href } catch { return null } }))

  return (
    <section id="agenda" aria-labelledby="agenda-titulo" className="relative bg-secao px-5 py-14 md:px-12 md:py-[96px]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
        <div className="flex flex-col gap-3.5">
          <p className="t-kicker flex items-center gap-3">
            <span className="text-laranja">AGENDA</span>
            <span aria-hidden="true" className="h-px w-10 bg-mute" />
            <span className="text-creme-2">{events.length === 1 ? 'próximo evento' : `${events.length} próximos eventos`}</span>
          </p>
          <Titulo id="agenda-titulo" a="Tem coisa rolando." b="Reserve sua mesa." className="text-[clamp(40px,6vw,76px)] leading-[0.95]" />
        </div>
        <ul className={`m-0 grid list-none gap-6 p-0 ${unico ? '' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {events.map((e) => (
            <li key={e.id} className="min-w-0">
              <Cartaz e={e} deitado={unico} />
            </li>
          ))}
        </ul>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
    </section>
  )
}

function Cartaz({ e, deitado }: { e: ApiEvent; deitado: boolean }) {
  const d = eventDateParts(e.date, e.time)
  const whats = `${restaurant.contact.whatsappUrl}?text=${encodeURIComponent(reservaTexto(e))}`
  return (
    <article aria-labelledby={`ev-${e.id}`} className={`cartaz flex h-full flex-col overflow-hidden ${deitado ? 'md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]' : ''}`}>
      <div className="cartaz-arte">
        {e.imageUrl ? (
          <img src={apiAsset(e.imageUrl)} alt={`Arte do evento ${e.title}`} loading="lazy" decoding="async" />
        ) : (
          <span className="grid h-full place-items-center font-display text-[clamp(28px,5vw,44px)] text-creme-2">{e.title}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="flex items-end gap-3">
          <span className="font-display text-[56px] leading-[0.8] text-laranja">{d.day}</span>
          <span className="t-kicker leading-tight text-creme">
            {d.month.toUpperCase()} · {d.weekday.toUpperCase()}
            <span className="block text-creme-2">A PARTIR DAS {d.hour.toUpperCase()}</span>
          </span>
        </p>
        <h3 id={`ev-${e.id}`} className="m-0 font-display text-[clamp(26px,3vw,34px)] leading-[1.02] text-creme">
          {e.title}
        </h3>
        {e.summary && <p className="m-0 text-[17px] font-medium text-creme">{e.summary}</p>}
        {e.highlights.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[15px] text-creme-3">
            {e.highlights.map((h, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-laranja">✦</span>
                {h}
              </li>
            ))}
          </ul>
        )}
        {e.description && <p className="m-0 text-[15px] leading-relaxed text-creme-3">{e.description}</p>}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          {e.reservation && <p className="m-0 font-mono text-[12px] tracking-[0.08em] text-creme-2">{e.reservation}</p>}
          <div className="flex flex-wrap gap-3">
            <a href={whats} target="_blank" rel="noopener" className="btn-ticket is-light">
              Reservar pelo WhatsApp ↗
            </a>
            {e.instagramUrl && (
              <a href={e.instagramUrl} target="_blank" rel="noopener" className="t-kicker inline-flex min-h-11 items-center text-creme underline underline-offset-[6px] hover:text-laranja">
                VER NO INSTAGRAM ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

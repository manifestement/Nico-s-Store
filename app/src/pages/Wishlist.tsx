import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/client'
import { eur, formatItemSize, plural } from '../lib/format'
import { backupIsStale, invalidate, useQuery, useSettings } from '../lib/store'
import { CheckIcon, PlusIcon } from '../ui/icons'
import { BottomNav, Empty, Halos, PageTitle, Thumb } from '../ui/kit'

export default function Wishlist() {
  const navigate = useNavigate()
  const settings = useSettings()
  const { data: items } = useQuery(() => db.listItems('wishlist'), [])

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[560px] pb-28">
      <Halos variant="b" />
      <div className="pt-safe relative flex flex-col gap-4 px-4">
        <div className="mt-3 flex min-h-[52px] items-center justify-between">
          <PageTitle sub={items ? plural(items.length, 'article suivi', 'articles suivis') : '…'}>Wishlist</PageTitle>
          <Link
            to="/article/nouveau?statut=wishlist"
            aria-label="Ajouter à la wishlist"
            className="fill-primary press flex h-[46px] w-[46px] items-center justify-center rounded-2xl"
          >
            <PlusIcon size={22} />
          </Link>
        </div>

        {items && !items.length && (
          <Empty title="Ta wishlist est vide">
            <span className="text-[13px] text-muted">Ajoute les paires que tu vises, avec ton prix cible.</span>
            <Link to="/article/nouveau?statut=wishlist" className="fill-primary flex h-10 items-center rounded-[14px] px-4 text-[13px] font-bold">
              Ajouter
            </Link>
          </Empty>
        )}

        <div className="flex flex-col gap-3">
          {items?.map((w) => {
            const gap = w.market_price != null && w.target_price != null ? w.market_price - w.target_price : null
            const hit = gap != null && gap <= 0
            const size = formatItemSize(w)
            return (
              <article key={w.id} className={`rounded-[22px] ${hit ? 'ring-hero p-[2px] shadow-[0_10px_40px_-12px_var(--glow)]' : 'bg-line p-px'}`}>
                <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-3">
                  <Link to={`/article/${w.id}`} className="flex items-center gap-3 text-ink">
                    <Thumb photoId={w.photo_id} icon={w.category_icon} brand={w.brand} size={60} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[15px] font-semibold">{w.model}</span>
                      <span className="text-xs text-muted">{size ?? w.category_name}</span>
                    </div>
                  </Link>
                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[14px] bg-line">
                    <Stat label="Cote" value={eur(w.market_price)} />
                    <Stat label="Prix cible" value={eur(w.target_price)} />
                    <Stat
                      label="Écart"
                      value={gap == null ? '—' : `${gap > 0 ? '+ ' : '− '}${eur(Math.abs(gap))}`}
                      className={hit ? 'text-gain' : 'text-soft'}
                    />
                  </div>
                  {hit && (
                    <div className="flex items-center gap-2 rounded-xl bg-gain/12 px-2.5 py-2 text-[13px] font-semibold text-gain">
                      <CheckIcon size={16} />
                      Sous ton prix cible : c'est le moment
                    </div>
                  )}
                  <div className="flex gap-2">
                    <a
                      href={w.value_url || `https://stockx.com/fr-fr/search?s=${encodeURIComponent(w.model)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="press flex h-10 flex-1 items-center justify-center rounded-[14px] border border-line-strong text-[13px] font-semibold text-ink"
                    >
                      Voir la cote
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        await db.acquireItem(w.id)
                        invalidate()
                        navigate(`/article/${w.id}/modifier`)
                      }}
                      className="fill-primary press flex h-10 flex-1 cursor-pointer items-center justify-center rounded-[14px] border-0 text-[13px] font-semibold"
                    >
                      Je l'ai eue
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
      <BottomNav settingsBadge={settings ? backupIsStale(settings.lastBackupAt) : false} />
    </div>
  )
}

function Stat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-raise px-2.5 py-2">
      <span className="eyebrow text-[10px] text-muted">{label}</span>
      <span className={`wide tabular text-[15px] font-bold ${className}`} style={{ fontStretch: '112%' }}>
        {value}
      </span>
    </div>
  )
}

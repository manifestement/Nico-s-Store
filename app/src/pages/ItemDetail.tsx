import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/client'
import type { PricePoint } from '../db/repo'
import { estimatedValue, simulateResale } from '../domain/valuation'
import { eur, formatCondition, formatDate, formatItemSize, parseNumber, today } from '../lib/format'
import { compressPhoto } from '../lib/photos'
import { invalidate, usePhotoUrl, useQuery, useSettings } from '../lib/store'
import { CameraIcon, CategoryGlyph, ChevronLeft, EditIcon, ExternalIcon, GalleryIcon, TrashIcon } from '../ui/icons'
import { Button, Field, inputClass, Sheet, tintFor } from '../ui/kit'

export default function ItemDetail() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const settings = useSettings()
  const { data: item, loading } = useQuery(() => db.getItem(id), [id])
  const { data: history } = useQuery(() => db.priceHistory(id), [id])
  const { data: photoIds } = useQuery(() => db.listPhotoIds(id), [id])

  const [sheet, setSheet] = useState(false)
  const [newPrice, setNewPrice] = useState('')
  const [newDate, setNewDate] = useState(today())
  const [salePrice, setSalePrice] = useState<number | null>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  if (!item) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 text-muted">
        {loading ? 'Chargement…' : 'Article introuvable'}
        {!loading && <Link to="/">Retour à la collection</Link>}
      </div>
    )
  }

  const est = settings ? estimatedValue(item.market_price, item.condition, settings.valuation) : null
  const size = formatItemSize(item)
  const price = salePrice ?? item.market_price ?? 0
  const sim = settings ? simulateResale(price, item.purchase_price, settings.fees) : null
  const feePct = settings ? settings.fees.transactionPct + settings.fees.paymentPct : 0
  const searchUrl = item.value_url || `https://stockx.com/fr-fr/search?s=${encodeURIComponent(item.model)}`
  const ids = photoIds ?? []

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const f of Array.from(files)) {
        const p = await compressPhoto(f)
        await db.addPhoto(id, p.mime, p.data, p.thumb)
      }
      invalidate()
    } catch (e) {
      alert(`Photo non enregistrée : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const savePrice = async () => {
    const p = parseNumber(newPrice)
    if (p == null || p < 0) return
    await db.addPrice(id, p, newDate || today())
    setSheet(false)
    setNewPrice('')
    setSalePrice(null)
    invalidate()
  }

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[560px] overflow-x-clip pb-10">
      <div aria-hidden="true" className="pointer-events-none absolute top-[300px] -right-[180px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(closest-side,var(--glow-2),transparent)]" />

      <div className="relative h-[310px] overflow-hidden" style={{ background: ids.length ? 'var(--color-raise)' : tintFor(item.category_icon, item.brand) }}>
        {ids.length ? (
          <div
            className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
            onScroll={(e) => setPhotoIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          >
            {ids.map((pid) => (
              <FullPhoto key={pid} id={pid} />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.22),transparent_60%)] text-white/90">
            <CategoryGlyph icon={item.category_icon} size={110} strokeWidth={1.1} />
          </div>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,var(--color-canvas))]" />

        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          aria-label="Retour"
          className="absolute left-4 flex h-11 w-11 cursor-pointer items-center justify-center press rounded-full border border-line overlay text-ink"
          style={{ top: 'calc(max(env(safe-area-inset-top), 12px) + 8px)' }}
        >
          <ChevronLeft size={22} />
        </button>
        <Link
          to={`/article/${id}/modifier`}
          aria-label="Modifier l'article"
          className="absolute right-4 flex h-11 w-11 items-center justify-center press rounded-full border border-line overlay text-ink"
          style={{ top: 'calc(max(env(safe-area-inset-top), 12px) + 8px)' }}
        >
          <EditIcon />
        </Link>

        <div className="absolute right-4 bottom-5 flex gap-2">
          {ids.length > 0 && (
            <button
              type="button"
              aria-label="Supprimer cette photo"
              onClick={async () => {
                if (!confirm('Supprimer cette photo ?')) return
                await db.deletePhoto(ids[Math.min(photoIndex, ids.length - 1)])
                setPhotoIndex(0)
                invalidate()
              }}
              className="flex h-10 w-10 cursor-pointer items-center justify-center press rounded-full border border-line overlay text-ink"
            >
              <TrashIcon size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            aria-label="Ajouter une photo depuis la galerie"
            className="flex h-10 w-10 cursor-pointer items-center justify-center press rounded-full border border-line overlay text-ink"
          >
            <GalleryIcon size={16} />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraInput.current?.click()}
            className="flex h-10 cursor-pointer items-center gap-1.5 press rounded-full border border-line overlay px-3.5 text-xs font-semibold text-ink"
          >
            <CameraIcon size={16} />
            {busy ? 'Enregistrement…' : ids.length ? `${Math.min(photoIndex + 1, ids.length)} / ${ids.length}` : 'Photo'}
          </button>
        </div>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void addPhotos(e.target.files).then(() => (e.target.value = ''))} />
        <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={(e) => void addPhotos(e.target.files).then(() => (e.target.value = ''))} />
      </div>

      <div className="relative -mt-4 flex flex-col gap-3.5 px-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-accent">
            {item.number != null ? `#${item.number} · ` : ''}
            {item.brand || item.category_name}
            {item.line ? ` · ${item.line}` : ''}
          </span>
          <h1 className="wide m-0 text-[24px] leading-[1.1] font-extrabold tracking-[-0.7px]">{item.model}</h1>
          <div className="flex flex-wrap gap-1.5">
            {size && <Tag>{size}</Tag>}
            <Tag>État {formatCondition(item.condition)}</Tag>
            {item.sku ? <Tag>{item.sku}</Tag> : item.size_type === 'shoe' && <Tag dashed>SKU à renseigner</Tag>}
          </div>
        </div>

        {item.status === 'wishlist' && (
          <section className="card flex items-center justify-between gap-3 rounded-[20px] p-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted">Dans ta wishlist · prix cible</span>
              <span className="wide tabular text-lg font-bold">{eur(item.target_price)}</span>
            </div>
            <Button
              onClick={async () => {
                await db.acquireItem(id)
                invalidate()
                navigate(`/article/${id}/modifier`)
              }}
            >
              Je l'ai eue
            </Button>
          </section>
        )}

        <section className="card flex flex-col gap-2.5 rounded-[20px] p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="eyebrow text-muted">Cote · {formatDate(item.market_price_at)}</span>
              <span className="flex items-center gap-2">
                <span className="wide tabular text-[30px] leading-none font-extrabold tracking-[-1px]" style={{ fontStretch: '112%' }}>
                  {eur(item.market_price)}
                </span>
                <Delta points={history ?? []} />
              </span>
              {item.status === 'owned' && (
                <span className="text-xs text-muted">
                  Estimée ({formatCondition(item.condition)}) : {eur(est)} · achat {eur(item.purchase_price)}
                </span>
              )}
            </div>
            <Button onClick={() => setSheet(true)} className="h-10 min-h-0 px-3.5 text-[13px]">
              Mettre à jour
            </Button>
          </div>
          <PriceChart points={history ?? []} />
          <a href={searchUrl} target="_blank" rel="noreferrer" className="flex min-h-8 items-center gap-1.5 text-[13px] font-semibold text-accent">
            {item.value_url ? 'Ouvrir le lien de cote' : 'Chercher sur StockX'}
            <ExternalIcon size={14} />
          </a>
        </section>

        {item.status === 'owned' && sim && (
          <section className="card flex flex-col gap-3 rounded-[20px] p-3.5">
            <h2 className="wide m-0 text-[15px] font-bold tracking-[-0.2px]">Simuler une revente</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Baisser le prix de 10 €"
                onClick={() => setSalePrice(Math.max(0, price - 10))}
                className="field press h-11 w-11 cursor-pointer rounded-[14px] text-xl text-soft"
              >
                −
              </button>
              <label className="field flex h-11 flex-1 items-center justify-center gap-1 rounded-[14px] transition-colors focus-within:border-primary">
                <span className="sr-only-text">Prix de vente</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setSalePrice(parseNumber(e.target.value) ?? 0)}
                  className="wide tabular w-24 border-0 bg-transparent text-right text-xl font-bold outline-none"
                />
                <span className="wide text-xl font-bold">€</span>
              </label>
              <button
                type="button"
                aria-label="Monter le prix de 10 €"
                onClick={() => setSalePrice(price + 10)}
                className="field press h-11 w-11 cursor-pointer rounded-[14px] text-xl text-soft"
              >
                +
              </button>
            </div>
            <div className="flex flex-col gap-1.5 text-[13px]">
              <div className="flex justify-between text-muted">
                <span>
                  Frais ({String(feePct).replace('.', ',')} %) + envoi {eur(settings!.fees.shippingEur)}
                </span>
                <span>− {eur(sim.fees, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tu touches</span>
                <span className="tabular font-bold">{eur(sim.net, 2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-2">
                <span>Profit vs achat{item.purchase_price != null ? ` (${eur(item.purchase_price)})` : ''}</span>
                {sim.profit == null ? (
                  <Link to={`/article/${id}/modifier`} className="text-[13px] font-semibold text-accent">
                    Ajouter le prix d'achat
                  </Link>
                ) : (
                  <span className={`wide tabular text-base font-bold ${sim.profit >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {sim.profit >= 0 ? '+ ' : '− '}
                    {eur(Math.abs(sim.profit), 2)}
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {(item.purchase_date || item.notes) && (
          <section className="card flex flex-col gap-1.5 rounded-[20px] p-3.5 text-[13px]">
            {item.purchase_date && (
              <div className="flex justify-between">
                <span className="text-muted">Acheté le</span>
                <span>{formatDate(item.purchase_date)}</span>
              </div>
            )}
            {item.notes && <p className="m-0 whitespace-pre-line text-soft">{item.notes}</p>}
          </section>
        )}
      </div>

      <Sheet open={sheet} title="Nouvelle cote" onClose={() => setSheet(false)}>
        <a href={searchUrl} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-accent">
          Ouvrir {item.value_url ? 'le lien de cote' : 'StockX'} pour voir le prix actuel
        </a>
        <Field label={`Prix${item.size_type === 'shoe' && size ? ` (${size})` : ''}`}>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder={item.market_price != null ? String(item.market_price) : 'ex. 145'}
            className={`${inputClass} h-12 text-lg`}
          />
        </Field>
        <Field label="Date">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={`${inputClass} h-12`} />
        </Field>
        <div className="flex gap-2 pb-2">
          <Button variant="ghost" className="h-12 flex-1" onClick={() => setSheet(false)}>
            Annuler
          </Button>
          <Button className="h-12 flex-[2]" disabled={parseNumber(newPrice) == null} onClick={() => void savePrice()}>
            Enregistrer
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function Tag({ children, dashed = false }: { children: React.ReactNode; dashed?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${dashed ? 'border border-dashed border-line-strong text-muted' : 'border border-line bg-raise text-soft'}`}
    >
      {children}
    </span>
  )
}

function FullPhoto({ id }: { id: number }) {
  const url = usePhotoUrl(id, false)
  return <div className="h-full w-full flex-none snap-center">{url && <img src={url} alt="" className="h-full w-full object-cover" />}</div>
}

function PriceChart({ points }: { points: PricePoint[] }) {
  if (points.length < 2) {
    return <p className="m-0 text-xs text-faint">La courbe apparaîtra à la prochaine mise à jour de la cote.</p>
  }
  const W = 330
  const H = 84
  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const t0 = new Date(points[0].recorded_at).getTime()
  const t1 = new Date(points[points.length - 1].recorded_at).getTime()
  const x = (p: PricePoint) => 10 + ((new Date(p.recorded_at).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 20)
  const y = (p: PricePoint) => (max === min ? H / 2 : 10 + (1 - (p.price - min) / (max - min)) * (H - 22))
  const first = points[0]
  const last = points[points.length - 1]
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)} ${y(p).toFixed(1)}`).join(' ')
  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Cote passée de ${eur(first.price)} à ${eur(last.price)}`}>
        <defs>
          <linearGradient id="nb-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-primary)" stopOpacity={0.35} />
            <stop offset="1" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={`${d} L${x(last).toFixed(1)} ${H} L${x(first).toFixed(1)} ${H} Z`} fill="url(#nb-area)" />
        <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {points.slice(0, -1).map((p, i) => (
          <circle key={i} cx={x(p)} cy={y(p)} r={2.5} fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth={1.5} />
        ))}
        <circle cx={x(last)} cy={y(last)} r={8} fill="var(--color-primary)" opacity={0.25} />
        <circle cx={x(last)} cy={y(last)} r={4} fill="var(--color-accent)" />
      </svg>
      <div className="tabular flex justify-between text-[11px] text-faint">
        <span>
          {formatDate(first.recorded_at)} · {eur(first.price)}
        </span>
        <span>
          {formatDate(last.recorded_at)} · {eur(last.price)}
        </span>
      </div>
    </div>
  )
}

/** Variation de la cote depuis le premier relevé. */
function Delta({ points }: { points: PricePoint[] }) {
  if (points.length < 2 || !points[0].price) return null
  const pct = ((points[points.length - 1].price - points[0].price) / points[0].price) * 100
  if (!Number.isFinite(pct)) return null
  const up = pct >= 0
  return (
    <span
      className={`tabular rounded-full px-2 py-0.5 text-xs font-semibold ${up ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'}`}
      aria-label={`${up ? 'Hausse' : 'Baisse'} de ${Math.abs(pct).toFixed(1).replace('.', ',')} % depuis le premier relevé`}
    >
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1).replace('.', ',')} %
    </span>
  )
}

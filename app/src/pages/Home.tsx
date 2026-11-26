import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/client'
import type { ItemView } from '../db/repo'
import { estimatedValue } from '../domain/valuation'
import { eur, formatCondition, formatItemSize, plural } from '../lib/format'
import { backupIsStale, useQuery, useSettings } from '../lib/store'
import { ChevronDown, FilterIcon, PlusIcon, SearchIcon, SortIcon } from '../ui/icons'
import { BottomNav, Chip, Empty, Halos, Sheet, Thumb } from '../ui/kit'

type SortMode = 'line' | 'value' | 'number'
const SORTS: { mode: SortMode; label: string }[] = [
  { mode: 'line', label: 'par ligne' },
  { mode: 'value', label: 'valeur' },
  { mode: 'number', label: 'N°' },
]
const CONDS = [
  { key: 'all', label: 'Tous', min: -1 },
  { key: 'ds', label: 'DS', min: 10 },
  { key: '9', label: '9 et +', min: 9 },
  { key: '8', label: '8 et +', min: 8 },
] as const

// Conservés entre deux visites de l'accueil (retour depuis une fiche).
const memory = { collapsed: false, listTop: 0, cat: 'all' as number | 'all', sort: 'line' as SortMode }

const T = 'max(env(safe-area-inset-top), 16px)'
const EASE = 'all 0.6s cubic-bezier(.2,.8,.2,1)'
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export default function Home() {
  const settings = useSettings()
  const { data: items } = useQuery(() => db.listItems('owned'), [])
  const { data: categories } = useQuery(() => db.listCategories(), [])

  const [collapsed, setCollapsedState] = useState(memory.collapsed)
  const [cat, setCat] = useState<number | 'all'>(memory.cat)
  const [sort, setSort] = useState<SortMode>(memory.sort)
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [brands, setBrands] = useState<string[]>([])
  const [cond, setCond] = useState<(typeof CONDS)[number]['key']>('all')

  const listRef = useRef<HTMLDivElement>(null)
  const lockUntil = useRef(0)
  const touchY = useRef<number | null>(null)

  const setCollapsed = (v: boolean, force = false) => {
    const now = Date.now()
    if (v === memory.collapsed || (!force && now < lockUntil.current)) return
    lockUntil.current = now + 700
    memory.collapsed = v
    setCollapsedState(v)
  }

  useLayoutEffect(() => {
    if (listRef.current && memory.collapsed) listRef.current.scrollTop = memory.listTop
  }, [items])

  const valued = useMemo(
    () =>
      (items ?? []).map((i) => ({
        ...i,
        est: settings ? estimatedValue(i.market_price, i.condition, settings.valuation) : i.market_price,
      })),
    [items, settings],
  )
  const total = valued.reduce((s, i) => s + (i.est ?? 0), 0)
  const rawTotal = valued.reduce((s, i) => s + (i.market_price ?? 0), 0)

  const allBrands = useMemo(() => [...new Set(valued.map((i) => i.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [valued])

  const visible = useMemo(() => {
    const q = fold(query.trim())
    const min = CONDS.find((c) => c.key === cond)!.min
    return valued.filter(
      (i) =>
        (cat === 'all' || i.category_id === cat) &&
        (!brands.length || brands.includes(i.brand)) &&
        (min < 0 || (i.condition ?? 10) >= min) &&
        (!q || fold(`${i.model} ${i.line ?? ''} ${i.brand} ${i.sku ?? ''} ${i.number ?? ''}`).includes(q)),
    )
  }, [valued, cat, brands, cond, query])

  const groups = useMemo(() => {
    const byName = (a: ItemView, b: ItemView) => a.model.localeCompare(b.model, 'fr', { sensitivity: 'base', numeric: true })
    if (sort !== 'line') {
      const list = [...visible].sort(sort === 'value' ? (a, b) => (b.est ?? 0) - (a.est ?? 0) : (a, b) => (a.number ?? 1e9) - (b.number ?? 1e9))
      return list.length ? [{ line: '', items: list, total: 0 }] : []
    }
    const map = new Map<string, typeof visible>()
    for (const i of visible) {
      const key = i.line || 'Sans ligne'
      map.set(key, [...(map.get(key) ?? []), i])
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'fr', { sensitivity: 'base', numeric: true }))
      .map(([line, list]) => ({ line, items: list.sort(byName), total: list.reduce((s, i) => s + (i.est ?? 0), 0) }))
  }, [visible, sort])

  const filterCount = brands.length + (cond === 'all' ? 0 : 1)
  const c = collapsed
  const ring = c ? 4 : 5

  const shape: CSSProperties = c
    ? { top: `calc(${T} + 4px)`, left: 16, width: 'calc(100% - 108px)', height: 60, borderRadius: 20 }
    : { top: `calc(${T} + 96px)`, left: 'calc(50% - 132px)', width: 264, height: 264, borderRadius: 132 }

  return (
    <div
      className="relative mx-auto h-dvh w-full max-w-[560px] overflow-hidden"
      onWheel={(e) => {
        if (filtersOpen) return
        if (!memory.collapsed && e.deltaY > 0) setCollapsed(true)
        else if (memory.collapsed && e.deltaY < 0 && (listRef.current?.scrollTop ?? 0) <= 0) setCollapsed(false)
      }}
      onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
      onTouchEnd={(e) => {
        if (touchY.current == null || filtersOpen) return
        const dy = e.changedTouches[0].clientY - touchY.current
        touchY.current = null
        if (dy < -40 && !memory.collapsed) setCollapsed(true)
        else if (dy > 40 && memory.collapsed && (listRef.current?.scrollTop ?? 0) <= 0) setCollapsed(false)
      }}
    >
      <Halos />

      <div
        className="absolute left-4 z-[2] flex flex-col gap-1.5"
        style={{ top: `calc(${T} + 8px)`, transition: EASE, opacity: c ? 0 : 1, transform: c ? 'translateY(-12px)' : 'none' }}
      >
        <span className="eyebrow leading-none text-accent">Sneakers Nico</span>
        <h1 className="wide m-0 text-[26px] leading-none font-extrabold tracking-[-0.8px]">Ma collection</h1>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed(!memory.collapsed, true)}
        aria-label={`Valeur estimée de la collection : ${eur(total)}. ${c ? 'Afficher la bulle' : 'Afficher la liste'}`}
        className={`absolute z-[3] cursor-pointer overflow-hidden border-0 p-0 ${c ? '' : 'nb-float'}`}
        style={{
          ...shape,
          transition: EASE,
          boxShadow: c ? '0 10px 30px -10px var(--glow)' : '0 0 90px -8px var(--glow)',
        }}
      >
        <span aria-hidden="true" className="ring-hero absolute inset-0" />
        <span
          className="absolute flex items-center"
          style={{
            inset: ring,
            borderRadius: (c ? 20 : 132) - ring,
            transition: EASE,
            background: 'var(--hero-core)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
            flexDirection: c ? 'row' : 'column',
            justifyContent: c ? 'flex-start' : 'center',
            alignItems: 'center',
            gap: c ? 10 : 8,
            padding: c ? '0 18px' : 0,
          }}
        >
          {/* Cadran : fin cercle pointillé, visible seulement sur la bulle. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full border border-dashed border-line-strong"
            style={{ inset: 12, transition: 'opacity .3s', opacity: c ? 0 : 1 }}
          />
          {!c && <span className="eyebrow leading-none text-muted">Valeur estimée</span>}
          <span
            className="wide tabular leading-none font-extrabold whitespace-nowrap"
            style={{ transition: EASE, fontSize: c ? 21 : 40, letterSpacing: c ? -0.6 : -1.6, fontStretch: '112%' }}
          >
            {items ? eur(total) : '…'}
          </span>
          <span className="tabular leading-tight whitespace-nowrap text-muted" style={{ transition: EASE, fontSize: c ? 11 : 13 }}>
            cote brute {eur(rawTotal)}
          </span>
          {!c && (
            <span className="mt-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] leading-none font-semibold text-accent">
              {plural(valued.length, 'article')}
            </span>
          )}
        </span>
      </button>

      <Link
        to="/article/nouveau"
        aria-label="Ajouter un article"
        className="fill-primary press absolute right-4 z-[4] flex items-center justify-center"
        style={{
          transition: EASE,
          top: c ? `calc(${T} + 4px)` : `calc(${T} + 8px)`,
          width: c ? 60 : 46,
          height: c ? 60 : 46,
          borderRadius: c ? 20 : 16,
        }}
      >
        <PlusIcon size={22} />
      </Link>

      <div
        aria-hidden="true"
        className="nb-hint absolute inset-x-0 flex items-center justify-center gap-1.5 text-xs text-muted"
        style={{ top: `calc(${T} + 380px)`, transition: 'opacity .3s', opacity: c ? 0 : 1 }}
      >
        Fais défiler pour voir la liste
        <ChevronDown size={18} />
      </div>

      <section
        aria-label="Articles de la collection"
        className="absolute inset-x-0 bottom-0 z-[1] flex flex-col gap-1.5"
        style={{ top: c ? `calc(${T} + 78px)` : `calc(${T} + 416px)`, transition: EASE }}
      >
        <div className="flex flex-none flex-col gap-2.5 px-4">
          <div className="flex gap-2">
            <label className="field flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3.5 transition-colors focus-within:border-primary">
              <SearchIcon size={18} className="text-muted" />
              <span className="sr-only-text">Rechercher un article</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setCollapsed(true, true)}
                placeholder="Modèle, ligne, SKU…"
                className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-label={`Filtres : marque et état${filterCount ? ` (${filterCount} actif${filterCount > 1 ? 's' : ''})` : ''}`}
              className="field press relative flex h-12 w-12 flex-none cursor-pointer items-center justify-center rounded-2xl text-soft"
            >
              <FilterIcon />
              {filterCount > 0 && (
                <span className="fill-primary absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ring-2 ring-canvas">
                  {filterCount}
                </span>
              )}
            </button>
          </div>

          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <Chip on={cat === 'all'} onClick={() => setCat((memory.cat = 'all'))} className="h-[34px] min-h-0">
              Tout <span className={`tabular ${cat === 'all' ? 'opacity-60' : 'text-faint'}`}>{valued.length}</span>
            </Chip>
            {categories?.map((k) => (
              <Chip key={k.id} on={cat === k.id} onClick={() => setCat((memory.cat = k.id))} className="h-[34px] min-h-0">
                {k.name} <span className={`tabular ${cat === k.id ? 'opacity-60' : 'text-faint'}`}>{k.item_count}</span>
              </Chip>
            ))}
          </div>

          <div className="flex min-h-8 items-center justify-between">
            <span className="text-xs text-muted">
              {sort === 'line' && groups.length ? `${plural(groups.length, 'ligne')} · ` : ''}
              {plural(visible.length, 'article')}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = SORTS[(SORTS.findIndex((s) => s.mode === sort) + 1) % SORTS.length].mode
                memory.sort = next
                setSort(next)
              }}
              className="press flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-soft"
            >
              <SortIcon size={14} />
              Tri : {SORTS.find((s) => s.mode === sort)!.label}
            </button>
          </div>
        </div>

        <div
          ref={listRef}
          onScroll={(e) => (memory.listTop = e.currentTarget.scrollTop)}
          className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 px-4 pb-28"
          style={{ overflowY: c ? 'auto' : 'hidden' }}
        >
          {items && !valued.length && (
            <Empty title="Ta collection est vide">
              <span className="text-[13px] text-muted">Importe ta sauvegarde (Réglages › Importer) ou ajoute ton premier article.</span>
              <div className="flex gap-2">
                <Link to="/reglages" className="press flex h-10 items-center rounded-[14px] border border-line-strong px-4 text-[13px] font-semibold text-ink">
                  Importer
                </Link>
                <Link to="/article/nouveau" className="fill-primary flex h-10 items-center rounded-[14px] px-4 text-[13px] font-bold">
                  Ajouter
                </Link>
              </div>
            </Empty>
          )}
          {items && valued.length > 0 && !visible.length && (
            <Empty title={query || filterCount ? 'Aucun article ne correspond' : 'Aucun article dans cette catégorie'}>
              <Link to="/article/nouveau" className="fill-primary flex h-10 items-center rounded-[14px] px-4 text-[13px] font-bold">
                Ajouter
              </Link>
            </Empty>
          )}
          {groups.map((g) => (
            <div key={g.line || 'flat'} className="flex flex-col gap-2">
              {g.line && (
                <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 bg-canvas px-0.5 pt-3 pb-1.5">
                  <h2 className="wide m-0 flex min-w-0 items-center gap-2 text-[13px] font-bold tracking-[-0.1px] uppercase">
                    <span className="h-3.5 w-1 flex-none rounded-full bg-[image:var(--grad-line)]" />
                    <span className="truncate">{g.line}</span>
                    <span className="tabular rounded-full bg-raise px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted normal-case">{g.items.length}</span>
                  </h2>
                  <span className="tabular flex-none text-xs font-semibold text-soft">{eur(g.total)}</span>
                </div>
              )}
              {g.items.map((i) => (
                <ItemRow key={i.id} item={i} est={i.est} />
              ))}
            </div>
          ))}
        </div>
      </section>

      <BottomNav settingsBadge={settings ? backupIsStale(settings.lastBackupAt) : false} />

      <Sheet open={filtersOpen} title="Filtres" onClose={() => setFiltersOpen(false)}>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">Marque</span>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={!brands.length} onClick={() => setBrands([])}>
              Toutes
            </Chip>
            {allBrands.map((b) => (
              <Chip key={b} on={brands.includes(b)} onClick={() => setBrands((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]))}>
                {b}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">État</span>
          <div className="flex flex-wrap gap-1.5">
            {CONDS.map((k) => (
              <Chip key={k.key} on={cond === k.key} onClick={() => setCond(k.key)}>
                {k.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setBrands([])
              setCond('all')
            }}
            className="press h-12 flex-1 cursor-pointer rounded-[14px] border border-line-strong bg-transparent text-[15px] font-semibold"
          >
            Réinitialiser
          </button>
          <button type="button" onClick={() => setFiltersOpen(false)} className="fill-primary h-12 flex-[2] cursor-pointer rounded-[14px] border-0 text-[15px] font-bold">
            Afficher {visible.length}
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function ItemRow({ item, est }: { item: ItemView; est: number | null }) {
  const size = formatItemSize(item)
  return (
    <Link to={`/article/${item.id}`} className="card press flex flex-none items-center gap-3 rounded-[18px] p-2 pr-3 text-ink">
      <Thumb photoId={item.photo_id} icon={item.category_icon} brand={item.brand} size={58} radius={13} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[14px] font-semibold">{item.model}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <span className="tabular flex-none rounded-md bg-raise px-1.5 py-px text-[11px] font-semibold text-soft">#{item.number ?? '—'}</span>
          <span className="truncate">
            {size ? `${size} · ` : ''}
            {formatCondition(item.condition)}
          </span>
        </span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="wide tabular text-[15px] font-bold tracking-[-0.3px]" style={{ fontStretch: '112%' }}>
          {eur(est)}
        </span>
        <span className="tabular text-[11px] text-faint">cote {eur(item.market_price)}</span>
      </div>
    </Link>
  )
}

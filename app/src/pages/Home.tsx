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

      <h1
        className="absolute left-4 z-[2] m-0 font-display text-2xl font-bold tracking-[-0.6px]"
        style={{ top: `calc(${T} + 12px)`, transition: EASE, opacity: c ? 0 : 1, transform: c ? 'translateY(-12px)' : 'none' }}
      >
        Ma collection
      </h1>

      <button
        type="button"
        onClick={() => setCollapsed(!memory.collapsed, true)}
        aria-label={`Valeur estimée de la collection : ${eur(total)}. ${c ? 'Afficher la bulle' : 'Afficher la liste'}`}
        className={`absolute z-[3] cursor-pointer overflow-hidden border-0 p-0 ${c ? '' : 'au-float'}`}
        style={{
          ...shape,
          transition: EASE,
          boxShadow: c
            ? '0 0 34px rgba(236,72,153,0.40), 0 0 70px rgba(139,92,246,0.30)'
            : '0 0 70px rgba(236,72,153,0.45), 0 0 140px rgba(139,92,246,0.35)',
        }}
      >
        <span aria-hidden="true" className="aurora-ring absolute inset-0" />
        <span
          className="absolute flex items-center"
          style={{
            inset: ring,
            borderRadius: (c ? 20 : 132) - ring,
            transition: EASE,
            background: 'radial-gradient(circle at 35% 28%, #2A1F5C, #150F35 62%)',
            boxShadow: 'inset 0 2px 18px rgba(255,255,255,0.10)',
            flexDirection: c ? 'row' : 'column',
            justifyContent: c ? 'flex-start' : 'center',
            gap: c ? 10 : 6,
            padding: c ? '0 18px' : 0,
          }}
        >
          <span
            className="font-display leading-none font-bold whitespace-nowrap"
            style={{ transition: EASE, fontSize: c ? 21 : 44, letterSpacing: c ? -0.6 : -1.5 }}
          >
            {items ? eur(total) : '…'}
          </span>
          <span className="leading-tight whitespace-nowrap text-muted" style={{ transition: EASE, fontSize: c ? 11 : 13 }}>
            cote brute {eur(rawTotal)}
          </span>
        </span>
      </button>

      <Link
        to="/article/nouveau"
        aria-label="Ajouter un article"
        className="aurora-grad absolute right-4 z-[4] flex items-center justify-center text-white shadow-[0_6px_20px_rgba(236,72,153,0.35)]"
        style={{
          transition: EASE,
          top: c ? `calc(${T} + 4px)` : `calc(${T} + 8px)`,
          width: c ? 60 : 44,
          height: c ? 60 : 44,
          borderRadius: c ? 18 : 14,
        }}
      >
        <PlusIcon size={22} />
      </Link>

      <div
        aria-hidden="true"
        className="au-hint absolute inset-x-0 flex items-center justify-center gap-1.5 text-xs text-muted"
        style={{ top: `calc(${T} + 380px)`, transition: 'opacity .3s', opacity: c ? 0 : 1 }}
      >
        Fais défiler pour voir tes {plural(valued.length, 'article')}
        <ChevronDown size={18} />
      </div>

      <section
        aria-label="Articles de la collection"
        className="absolute inset-x-0 bottom-0 z-[1] flex flex-col gap-1.5"
        style={{ top: c ? `calc(${T} + 78px)` : `calc(${T} + 416px)`, transition: EASE }}
      >
        <div className="flex flex-none flex-col gap-2.5 px-4">
          <div className="flex gap-2">
            <label className="field flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3.5">
              <SearchIcon size={18} className="text-lilac" />
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
              className="field relative flex h-12 w-12 flex-none cursor-pointer items-center justify-center rounded-[14px] text-soft"
            >
              <FilterIcon />
              {filterCount > 0 && (
                <span className="aurora-grad absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white">
                  {filterCount}
                </span>
              )}
            </button>
          </div>

          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <Chip on={cat === 'all'} onClick={() => setCat((memory.cat = 'all'))} className="h-[34px] min-h-0 rounded-xl">
              Tout <span className={cat === 'all' ? 'text-white/80' : 'text-faint'}>{valued.length}</span>
            </Chip>
            {categories?.map((k) => (
              <Chip key={k.id} on={cat === k.id} onClick={() => setCat((memory.cat = k.id))} className="h-[34px] min-h-0 rounded-xl">
                {k.name} <span className={cat === k.id ? 'text-white/80' : 'text-faint'}>{k.item_count}</span>
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
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border-0 bg-transparent px-2.5 text-xs font-semibold text-soft"
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
          {items && !visible.length && (
            <Empty title={query || filterCount ? 'Aucun article ne correspond' : 'Aucun article dans cette catégorie'}>
              <Link to="/article/nouveau" className="aurora-grad flex h-10 items-center rounded-[14px] px-4 text-[13px] font-bold text-white">
                Ajouter
              </Link>
            </Empty>
          )}
          {groups.map((g) => (
            <div key={g.line || 'flat'} className="flex flex-col gap-2">
              {g.line && (
                <div className="sticky top-0 z-[1] flex items-baseline justify-between bg-night px-0.5 pt-2.5 pb-1.5">
                  <h2 className="m-0 font-display text-sm font-semibold">
                    {g.line} <span className="font-sans text-xs font-medium text-muted">· {g.items.length}</span>
                  </h2>
                  <span className="text-xs font-semibold text-soft">{eur(g.total)}</span>
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
            className="h-12 flex-1 cursor-pointer rounded-[14px] border border-lilac/30 bg-transparent text-[15px]"
          >
            Réinitialiser
          </button>
          <button type="button" onClick={() => setFiltersOpen(false)} className="aurora-grad h-12 flex-[2] cursor-pointer rounded-[14px] border-0 text-[15px] font-bold text-white">
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
    <Link to={`/article/${item.id}`} className="glass flex flex-none items-center gap-3 rounded-[18px] p-2.5 text-ink">
      <Thumb photoId={item.photo_id} icon={item.category_icon} brand={item.brand} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-bold">{item.model}</span>
        <span className="truncate text-xs text-muted">
          #{item.number ?? '—'}
          {size ? ` · ${size}` : ''} · {formatCondition(item.condition)}
        </span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-display text-sm font-semibold">{eur(est)}</span>
        <span className="text-[11px] text-muted">cote {eur(item.market_price)}</span>
      </div>
    </Link>
  )
}

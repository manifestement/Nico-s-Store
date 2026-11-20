import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db/client'
import type { CategoryWithCount, ItemStatus, ItemView, NewItem } from '../db/repo'
import { inferLine } from '../domain/lines'
import { CLOTH_SIZES, formatEu, usSizes, usToEu } from '../domain/sizes'
import { parseNumber, today } from '../lib/format'
import { compressPhoto } from '../lib/photos'
import { invalidate, useQuery } from '../lib/store'
import { CameraIcon, CategoryGlyph, GalleryIcon, PlusIcon } from '../ui/icons'
import { Button, Chip, Field, Halos, inputClass, Segmented, tintFor } from '../ui/kit'

const CONDITIONS: { value: number | null; label: string }[] = [
  { value: 10, label: 'DS' },
  ...[9.5, 9, 8.5, 8, 7.5, 7, 6, 5].map((v) => ({ value: v, label: String(v).replace('.', ',') })),
  { value: null, label: '?' },
]

const HINTS: Record<string, [string, string, string]> = {
  shoe: ['Nike, Jordan…', 'ex. Air Max 1 Patta Monarch', 'ex. Air Max 1'],
  cloth: ['Corteiz, Supreme…', 'ex. Hoodie Alcatraz', 'ex. Hoodie'],
  none: ['Yeezy, Supreme…', 'ex. Chaussettes Yeezy', 'ex. Chaussettes'],
  dim: ['Travis Scott…', 'ex. Tapis Cactus Jack', 'ex. Tapis'],
}

interface FormState {
  status: ItemStatus
  categoryId: number | null
  brand: string
  sku: string
  model: string
  line: string
  lineTouched: boolean
  sizeUs: number | null
  sizeLabel: string
  dimA: string
  dimB: string
  condition: number | null
  number: string
  purchasePrice: string
  purchaseDate: string
  targetPrice: string
  initialPrice: string
  valueUrl: string
  notes: string
}

const str = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

function fromItem(i: ItemView): FormState {
  const dim = i.size_label?.match(/([\d.,]+)\s*[×x]\s*([\d.,]+)/)
  return {
    status: i.status,
    categoryId: i.category_id,
    brand: i.brand,
    sku: i.sku ?? '',
    model: i.model,
    line: i.line ?? '',
    lineTouched: true,
    sizeUs: i.size_us,
    sizeLabel: i.size_label ?? '',
    dimA: dim?.[1] ?? '',
    dimB: dim?.[2] ?? '',
    condition: i.condition,
    number: i.number == null ? '' : String(i.number),
    purchasePrice: str(i.purchase_price),
    purchaseDate: i.purchase_date ?? '',
    targetPrice: str(i.target_price),
    initialPrice: '',
    valueUrl: i.value_url ?? '',
    notes: i.notes ?? '',
  }
}

const EMPTY: FormState = {
  status: 'owned', categoryId: null, brand: '', sku: '', model: '', line: '', lineTouched: false,
  sizeUs: null, sizeLabel: '', dimA: '', dimB: '', condition: 10, number: '', purchasePrice: '',
  purchaseDate: '', targetPrice: '', initialPrice: '', valueUrl: '', notes: '',
}

export default function ItemForm() {
  const params = useParams()
  const editId = params.id ? Number(params.id) : null
  const [search] = useSearchParams()
  const navigate = useNavigate()

  const { data: categories } = useQuery(() => db.listCategories(), [])
  const { data: brands } = useQuery(() => db.listBrands(), [])
  const { data: lines } = useQuery(() => db.listLines(), [])
  const { data: existing } = useQuery(() => (editId ? db.getItem(editId) : Promise.resolve(null)), [editId])

  const [f, setF] = useState<FormState>(() => ({ ...EMPTY, status: search.get('statut') === 'wishlist' ? 'wishlist' : 'owned' }))
  const [sizeSystem, setSizeSystem] = useState<'US' | 'FR'>('US')
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const loaded = useRef(false)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (existing && !loaded.current) {
      loaded.current = true
      setF(fromItem(existing))
    }
  }, [existing])

  useEffect(() => {
    if (f.categoryId == null && categories?.length && !editId) setF((s) => ({ ...s, categoryId: categories[0].id }))
  }, [categories, f.categoryId, editId])

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos])

  const category: CategoryWithCount | undefined = categories?.find((c) => c.id === f.categoryId)
  const sizeType = category?.size_type ?? 'none'
  const hints = HINTS[sizeType]
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))

  const sizes = useMemo(() => usSizes(f.brand || 'Nike'), [f.brand])
  const sizeIndex = f.sizeUs == null ? -1 : sizes.indexOf(f.sizeUs)
  const stepSize = (d: number) => {
    const start = sizeIndex < 0 ? sizes.indexOf(9) : sizeIndex
    const next = Math.min(sizes.length - 1, Math.max(0, start + (sizeIndex < 0 ? 0 : d)))
    set('sizeUs', sizes[next])
  }
  const eu = f.sizeUs == null ? null : usToEu(f.sizeUs, f.brand || 'Nike')
  const usText = f.sizeUs == null ? '' : String(f.sizeUs).replace('.', ',')
  const gridName = /adidas|yeezy/i.test(f.brand) ? 'Adidas' : 'Nike'

  const save = async () => {
    if (!f.model.trim()) return setError('Indique au moins le modèle.')
    if (f.categoryId == null) return setError('Choisis une catégorie.')
    setSaving(true)
    setError('')
    try {
      const sizeLabel =
        sizeType === 'cloth' ? f.sizeLabel || null : sizeType === 'dim' && f.dimA && f.dimB ? `${f.dimA} × ${f.dimB} cm` : null
      const data: NewItem = {
        status: f.status,
        category_id: f.categoryId,
        brand: f.brand.trim(),
        model: f.model.trim(),
        line: (f.lineTouched ? f.line : inferLine(f.model)).trim() || null,
        sku: f.sku.trim() || null,
        size_us: sizeType === 'shoe' ? f.sizeUs : null,
        size_label: sizeLabel,
        condition: f.condition,
        purchase_price: parseNumber(f.purchasePrice),
        purchase_date: f.purchaseDate || null,
        target_price: parseNumber(f.targetPrice),
        value_url: f.valueUrl.trim() || null,
        notes: f.notes.trim() || null,
      }
      let id = editId
      if (id) {
        await db.updateItem(id, { ...data, number: f.number ? Number(f.number) : null })
      } else {
        id = await db.createItem(data, parseNumber(f.initialPrice))
      }
      for (const p of photos) {
        const c = await compressPhoto(p.file)
        await db.addPhoto(id, c.mime, c.data, c.thumb)
      }
      invalidate()
      navigate(`/article/${id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!editId || !confirm(`Supprimer « ${f.model} », ses photos et son historique de cote ? C'est définitif.`)) return
    await db.deleteItem(editId)
    invalidate()
    navigate('/', { replace: true })
  }

  const pickFiles = (files: FileList | null) => {
    if (files) setPhotos((cur) => [...cur, ...Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }))])
  }

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-[560px] flex-col">
      <Halos />
      <header className="pt-safe relative flex flex-none items-center justify-between px-2 pb-2">
        <button type="button" onClick={() => navigate(-1)} className="flex min-h-11 cursor-pointer items-center border-0 bg-transparent px-2.5 text-[15px] text-soft">
          Annuler
        </button>
        <h1 className="m-0 font-display text-base font-semibold">{editId ? 'Modifier' : 'Nouvel article'}</h1>
        <span className="w-[74px]" />
      </header>

      <div className="no-scrollbar relative flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pt-1 pb-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">Catégorie</span>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
            {categories?.map((c) => {
              const on = c.id === f.categoryId
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('categoryId', c.id)}
                  className={`flex w-16 flex-none cursor-pointer flex-col items-center gap-1.5 border-0 bg-transparent p-0 ${on ? 'text-ink' : 'text-muted'}`}
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
                    style={
                      on
                        ? { background: tintFor(c.icon), boxShadow: '0 0 0 2px #0E0A24, 0 0 0 4px #F9A8D4' }
                        : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(196,181,253,0.22)', color: '#DDD6FE' }
                    }
                  >
                    <CategoryGlyph icon={c.icon} size={24} />
                  </span>
                  <span className="max-w-16 truncate text-[11px] font-semibold">{c.name}</span>
                </button>
              )
            })}
            <Link to="/reglages#categories" className="flex w-16 flex-none flex-col items-center gap-1.5 text-muted">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-lilac/40">
                <PlusIcon size={20} />
              </span>
              <span className="text-[11px] font-semibold">Nouvelle</span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!editId && (
            <>
              <button type="button" onClick={() => cameraInput.current?.click()} className="aurora-ring h-[76px] w-[76px] flex-none cursor-pointer rounded-[18px] border-0 p-0.5">
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl bg-deep text-[11px] font-semibold text-ink">
                  <CameraIcon size={22} />
                  Photo
                </span>
              </button>
              <button
                type="button"
                onClick={() => galleryInput.current?.click()}
                className="flex h-[76px] w-[76px] flex-none cursor-pointer flex-col items-center justify-center gap-1 rounded-[18px] border border-dashed border-lilac/35 bg-white/5 text-[11px] text-soft"
              >
                <GalleryIcon size={22} />
                Galerie
              </button>
            </>
          )}
          <Segmented
            className="flex-1"
            value={f.status === 'wishlist' ? 'wishlist' : 'owned'}
            onChange={(v) => set('status', v)}
            options={[
              { value: 'owned', label: 'Collection' },
              { value: 'wishlist', label: 'Wishlist' },
            ]}
          />
        </div>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (pickFiles(e.target.files), (e.target.value = ''))} />
        <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={(e) => (pickFiles(e.target.files), (e.target.value = ''))} />
        {photos.length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {photos.map((p, i) => (
              <button
                key={p.url}
                type="button"
                aria-label="Retirer cette photo"
                onClick={() => setPhotos((cur) => cur.filter((_, j) => j !== i))}
                className="h-16 w-16 flex-none cursor-pointer overflow-hidden rounded-xl border-0 p-0"
              >
                <img src={p.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Field label="Marque">
            <input list="brands" value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder={hints[0]} className={inputClass} />
            <datalist id="brands">{brands?.map((b) => <option key={b} value={b} />)}</datalist>
          </Field>
          {(sizeType === 'shoe' || sizeType === 'cloth') && (
            <Field label="SKU / référence">
              <input value={f.sku} onChange={(e) => set('sku', e.target.value)} placeholder="ex. DO9392-200" className={inputClass} autoCapitalize="characters" />
            </Field>
          )}
        </div>

        <Field label="Modèle">
          <input
            value={f.model}
            onChange={(e) => setF((s) => ({ ...s, model: e.target.value, line: s.lineTouched ? s.line : inferLine(e.target.value) }))}
            placeholder={hints[1]}
            className={inputClass}
          />
        </Field>

        <Field label="Ligne (sert au regroupement de la liste)" hint={f.lineTouched ? undefined : 'Proposée automatiquement d’après le modèle, modifiable.'}>
          <input
            list="lines"
            value={f.line}
            onChange={(e) => setF((s) => ({ ...s, line: e.target.value, lineTouched: true }))}
            placeholder={hints[2]}
            className={inputClass}
          />
          <datalist id="lines">{lines?.map((l) => <option key={l} value={l} />)}</datalist>
        </Field>

        {sizeType === 'shoe' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Pointure</span>
            <div className="flex items-center gap-2">
              <Segmented
                value={sizeSystem}
                onChange={setSizeSystem}
                options={[
                  { value: 'US', label: 'US' },
                  { value: 'FR', label: 'FR' },
                ]}
              />
              <button type="button" aria-label="Pointure inférieure" onClick={() => stepSize(-1)} className="field h-11 w-11 flex-none cursor-pointer rounded-[14px] text-lg">
                −
              </button>
              <span className="flex-1 text-center font-display text-lg font-semibold">
                {f.sizeUs == null ? '—' : sizeSystem === 'US' ? `US ${usText}` : `FR ${eu == null ? '?' : formatEu(eu)}`}
              </span>
              <button type="button" aria-label="Pointure supérieure" onClick={() => stepSize(1)} className="field h-11 w-11 flex-none cursor-pointer rounded-[14px] text-lg">
                +
              </button>
            </div>
            <span className="text-xs text-muted">
              {f.sizeUs == null ? (
                'Taille inconnue : appuie sur − ou + pour la choisir.'
              ) : (
                <>
                  {sizeSystem === 'US' ? `= FR ${eu == null ? '?' : formatEu(eu)}` : `= US ${usText}`} (grille {gridName}) ·{' '}
                  <button type="button" onClick={() => set('sizeUs', null)} className="cursor-pointer border-0 bg-transparent p-0 text-xs text-lilac underline">
                    effacer
                  </button>
                </>
              )}
            </span>
          </div>
        )}

        {sizeType === 'cloth' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Taille</span>
            <div className="flex flex-wrap gap-1.5">
              {CLOTH_SIZES.map((s) => (
                <Chip key={s} on={f.sizeLabel === s} onClick={() => set('sizeLabel', f.sizeLabel === s ? '' : s)} className="min-w-12">
                  {s}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {sizeType === 'dim' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Dimensions (cm)</span>
            <div className="flex items-center gap-2">
              <label className="flex-1">
                <span className="sr-only-text">Longueur en cm</span>
                <input type="number" inputMode="decimal" value={f.dimA} onChange={(e) => set('dimA', e.target.value)} placeholder="120" className={`${inputClass} text-center`} />
              </label>
              <span className="text-muted">×</span>
              <label className="flex-1">
                <span className="sr-only-text">Largeur en cm</span>
                <input type="number" inputMode="decimal" value={f.dimB} onChange={(e) => set('dimB', e.target.value)} placeholder="80" className={`${inputClass} text-center`} />
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">État</span>
          <div className="flex flex-wrap gap-1.5">
            {CONDITIONS.map((c) => (
              <Chip key={c.label} on={f.condition === c.value} onClick={() => set('condition', c.value)} className="min-w-12">
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {f.status === 'wishlist' ? (
            <Field label="Prix cible (€)">
              <input type="number" inputMode="decimal" value={f.targetPrice} onChange={(e) => set('targetPrice', e.target.value)} placeholder="ex. 380" className={inputClass} />
            </Field>
          ) : (
            <Field label="Prix d'achat (€)">
              <input type="number" inputMode="decimal" value={f.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} placeholder="ex. 180" className={inputClass} />
            </Field>
          )}
          {!editId ? (
            <Field label="Cote actuelle (€)">
              <input type="number" inputMode="decimal" value={f.initialPrice} onChange={(e) => set('initialPrice', e.target.value)} placeholder="ex. 310" className={inputClass} />
            </Field>
          ) : f.status === 'owned' ? (
            <Field label="Date d'achat">
              <input type="date" value={f.purchaseDate} max={today()} onChange={(e) => set('purchaseDate', e.target.value)} className={`${inputClass} [color-scheme:dark]`} />
            </Field>
          ) : (
            <span />
          )}
        </div>
        {editId && <p className="-mt-2 m-0 text-[11px] text-faint">La cote se met à jour depuis la fiche (bouton « Mettre à jour »), pour garder l'historique.</p>}

        <Field label="Lien de cote (StockX, eBay, Vinted…)">
          <input type="url" inputMode="url" value={f.valueUrl} onChange={(e) => set('valueUrl', e.target.value)} placeholder="https://stockx.com/…" className={inputClass} />
        </Field>

        <div className="flex gap-2">
          {editId && f.status === 'owned' && (
            <Field label="N°">
              <input type="number" inputMode="numeric" value={f.number} onChange={(e) => set('number', e.target.value)} className={inputClass} />
            </Field>
          )}
          <div className="flex-[3]">
            <Field label="Notes">
              <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={`${inputClass} h-auto py-2.5`} />
            </Field>
          </div>
        </div>

        {editId && (
          <button type="button" onClick={() => void remove()} className="mt-2 min-h-11 cursor-pointer rounded-[14px] border border-loss/40 bg-transparent text-sm font-semibold text-loss">
            Supprimer l'article
          </button>
        )}
      </div>

      <div className="pb-safe relative flex flex-none flex-col gap-2 rounded-t-[20px] border-t border-lilac/20 bg-bar px-4 pt-3">
        {error && (
          <p role="alert" className="m-0 text-center text-[13px] text-loss">
            {error}
          </p>
        )}
        <Button className="h-[52px] rounded-2xl text-base" disabled={saving} onClick={() => void save()}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { db } from '../db/client'
import type { CategoryIcon, CategoryWithCount, SizeType } from '../db/repo'
import { conditionFactor } from '../domain/valuation'
import { formatDate, parseNumber, plural } from '../lib/format'
import { backupIsStale, invalidate, useQuery, useSettings } from '../lib/store'
import { CATEGORY_ICONS, CategoryGlyph, ChevronDown, ChevronUp, ClockIcon, EditIcon, PlusIcon } from '../ui/icons'
import { applyTheme, currentTheme, THEMES, type ThemeId } from '../lib/theme'
import { BottomNav, Button, Field, Halos, inputClass, PageTitle, Segmented, Sheet, tintFor } from '../ui/kit'

const SIZE_TYPES: { value: SizeType; label: string; long: string }[] = [
  { value: 'shoe', label: 'Pointure', long: 'Pointure US/FR' },
  { value: 'cloth', label: 'Vêtement', long: 'Taille XS → XXL' },
  { value: 'dim', label: 'Dimensions', long: 'Dimensions' },
  { value: 'none', label: 'Aucune', long: 'Sans taille' },
]

type Draft = { id?: number; name: string; icon: CategoryIcon; size_type: SizeType }

export default function Settings() {
  const settings = useSettings()
  const { data: categories } = useQuery(() => db.listCategories(), [])
  const { data: storage } = useQuery(() => db.storageInfo(), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [catError, setCatError] = useState('')
  const [backupMsg, setBackupMsg] = useState('')
  const importInput = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<ThemeId>(currentTheme)

  useEffect(() => {
    if (location.hash.endsWith('#categories')) document.getElementById('categories')?.scrollIntoView()
  }, [])

  const exportBackup = async () => {
    setBackupMsg('')
    const bytes = await db.exportDb()
    const name = `sneakers-nico-${new Date().toISOString().slice(0, 10)}.sqlite`
    const file = new File([bytes as BlobPart], name, { type: 'application/octet-stream' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Sauvegarde Sneakers Nico' })
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(file)
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      }
      await db.setSetting('backup.last_at', new Date().toISOString())
      setBackupMsg(`Sauvegarde créée (${(bytes.length / 1024 / 1024).toFixed(1).replace('.', ',')} Mo).`)
      invalidate()
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setBackupMsg(`Échec : ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const importBackup = async (file: File | undefined) => {
    if (!file) return
    if (!confirm(`Remplacer toutes les données actuelles par « ${file.name} » ? Les données actuelles seront perdues si elles ne sont pas sauvegardées.`)) return
    try {
      await db.importDb(new Uint8Array(await file.arrayBuffer()))
      location.reload()
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : String(e))
    }
  }

  const saveDraft = async () => {
    if (!draft || !draft.name.trim()) return
    try {
      await db.saveCategory({ ...draft, name: draft.name.trim() })
      setDraft(null)
      invalidate()
    } catch (e) {
      setCatError(String(e instanceof Error ? e.message : e).includes('UNIQUE') ? 'Ce nom existe déjà.' : String(e))
    }
  }

  const removeDraft = async () => {
    if (!draft?.id || !confirm(`Supprimer la catégorie « ${draft.name} » ?`)) return
    try {
      await db.deleteCategory(draft.id)
      setDraft(null)
      invalidate()
    } catch (e) {
      setCatError(e instanceof Error ? e.message : String(e))
    }
  }

  const saveNumber = async (key: string, raw: string) => {
    const n = parseNumber(raw)
    if (n == null || n < 0) return
    await db.setSetting(key, String(n))
    invalidate()
  }

  const stale = settings ? backupIsStale(settings.lastBackupAt) : false
  const v = settings?.valuation

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[560px] pb-28">
      <Halos />
      <div className="pt-safe relative flex flex-col gap-4 px-4">
        <div className="mt-3 flex min-h-[52px] items-center">
          <PageTitle>Réglages</PageTitle>
        </div>

        <Section title="Sauvegarde">
          <div className={`rounded-[20px] border bg-surface ${stale ? 'border-warn/50' : 'border-line'}`}>
            <div className="flex flex-col gap-3 p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-warn/15 text-warn">
                  <ClockIcon />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold">
                    {settings?.lastBackupAt ? `Dernière sauvegarde le ${formatDate(settings.lastBackupAt)}` : "Aucune sauvegarde pour l'instant"}
                  </span>
                  <span className="text-xs text-muted">
                    {stale ? 'Les données ne sont que sur ce téléphone : pense à sauvegarder.' : 'Prochain rappel dans moins de 30 jours.'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void exportBackup()}>
                  Exporter
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => importInput.current?.click()}>
                  Importer
                </Button>
                <input ref={importInput} type="file" hidden onChange={(e) => void importBackup(e.target.files?.[0]).then(() => (e.target.value = ''))} />
              </div>
              {backupMsg && (
                <p role="status" className="m-0 text-xs text-soft">
                  {backupMsg}
                </p>
              )}
              <span className="text-xs text-muted">Un seul fichier .sqlite (photos comprises), à ranger dans iCloud Drive.</span>
            </div>
          </div>
        </Section>

        <Section title="Apparence">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Palette de couleurs">
            {THEMES.map((t) => {
              const on = t.id === theme
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    applyTheme(t.id)
                    setTheme(t.id)
                  }}
                  className={`press flex cursor-pointer flex-col gap-2.5 rounded-[18px] border bg-surface p-2.5 text-left ${on ? 'border-primary ring-1 ring-primary' : 'border-line'}`}
                >
                  <span
                    aria-hidden="true"
                    className="relative flex h-14 items-end gap-1.5 overflow-hidden rounded-xl p-2"
                    style={{ background: t.swatch[0], boxShadow: 'inset 0 0 0 1px rgba(128,140,170,0.25)' }}
                  >
                    <span className="h-7 w-7 rounded-full" style={{ background: `conic-gradient(from 210deg, ${t.swatch[1]}, ${t.swatch[2]}, ${t.swatch[1]})` }} />
                    <span className="h-3 flex-1 rounded-full" style={{ background: t.swatch[1] }} />
                    <span className="h-3 w-5 rounded-full" style={{ background: t.swatch[2], opacity: 0.7 }} />
                  </span>
                  <span className="flex flex-col gap-0.5 px-0.5">
                    <span className="text-sm font-semibold">{t.name}</span>
                    <span className="text-[11px] leading-tight text-muted">{t.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Catégories" id="categories">
          <div className="card flex flex-col rounded-[20px]">
            {categories?.map((c, i) => (
              <CategoryRow
                key={c.id}
                cat={c}
                first={i === 0}
                last={i === categories.length - 1}
                onEdit={() => {
                  setCatError('')
                  setDraft({ id: c.id, name: c.name, icon: c.icon, size_type: c.size_type })
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setCatError('')
                setDraft({ name: '', icon: 'box', size_type: 'none' })
              }}
              className="flex min-h-[52px] cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3.5 text-sm font-semibold text-accent"
            >
              <PlusIcon size={18} />
              Nouvelle catégorie
            </button>
          </div>
          <span className="mx-1 text-xs text-faint">Le type de taille choisit le champ du formulaire : pointure (US/FR), taille de vêtement, dimensions ou aucune.</span>
        </Section>

        <Section title="Frais de revente">
          <div className="card flex flex-col rounded-[20px]">
            {settings &&
              (
                [
                  ['fees.transaction_pct', 'Commission vendeur', '%'],
                  ['fees.payment_pct', 'Frais de paiement', '%'],
                  ['fees.shipping_eur', "Frais d'envoi", '€'],
                ] as const
              ).map(([key, label, unit], i) => (
                <label key={key} className={`flex min-h-12 items-center justify-between px-3.5 text-sm ${i < 2 ? 'border-b border-line' : ''}`}>
                  {label}
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      defaultValue={settings.raw[key]}
                      onBlur={(e) => void saveNumber(key, e.target.value)}
                      className="tabular h-9 w-16 rounded-[10px] border border-line bg-raise px-2 text-right text-sm outline-none focus:border-primary"
                    />
                    <span className="w-4 text-muted">{unit}</span>
                  </span>
                </label>
              ))}
          </div>
        </Section>

        <Section title="Décote selon l'état">
          <div className="card flex flex-col gap-3 rounded-[20px] p-3.5">
            <span className="text-[13px] text-soft">La cote est un prix neuf (DS). Un article porté est estimé à :</span>
            <div className="grid grid-cols-5 gap-1.5">
              {v &&
                [9.5, 9, 8, 7, 5].map((c) => (
                  <div key={c} className="flex flex-col items-center gap-0.5 rounded-xl bg-raise px-1 py-2">
                    <span className="text-[11px] text-muted">{String(c).replace('.', ',')}/10</span>
                    <span className="wide tabular text-[13px] font-bold">{Math.round(conditionFactor(c, v) * 100)} %</span>
                  </div>
                ))}
            </div>
            {v && (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="h-10 min-h-0 flex-1 text-[13px]"
                  onClick={() => void saveNumber('valuation.per_point_pct', String(Math.max(2, v.perPointPct - 2)))}
                >
                  Moins de décote
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 min-h-0 flex-1 text-[13px]"
                  onClick={() => void saveNumber('valuation.per_point_pct', String(Math.min(16, v.perPointPct + 2)))}
                >
                  Plus de décote
                </Button>
              </div>
            )}
          </div>
        </Section>

        <p className="m-0 text-center text-[11px] text-faint">
          Stockage : {storage ? (storage.persisted ? 'sur ce téléphone (OPFS)' : 'temporaire, les données seront perdues') : '…'}
        </p>
      </div>

      <Sheet open={draft != null} title={draft?.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={() => setDraft(null)}>
        {draft && (
          <>
            <Field label="Nom">
              <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ex. Tapis" className={inputClass} />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">Icône</span>
              <div className="flex gap-2">
                {CATEGORY_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    aria-label={`Icône ${ic}`}
                    aria-pressed={draft.icon === ic}
                    onClick={() => setDraft({ ...draft, icon: ic })}
                    className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-[14px] ${draft.icon === ic ? 'border-0 text-white' : 'field text-soft'}`}
                    style={
                      draft.icon === ic
                        ? { background: tintFor(ic), boxShadow: '0 0 0 2px var(--color-sheet), 0 0 0 4px var(--color-primary)' }
                        : undefined
                    }
                  >
                    <CategoryGlyph icon={ic} size={22} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">Type de taille</span>
              <Segmented value={draft.size_type} onChange={(s) => setDraft({ ...draft, size_type: s })} options={SIZE_TYPES} />
            </div>
            {catError && (
              <p role="alert" className="m-0 text-[13px] text-loss">
                {catError}
              </p>
            )}
            <div className="flex gap-2 pb-2">
              {draft.id && (
                <Button variant="danger" className="h-12 flex-1" onClick={() => void removeDraft()}>
                  Supprimer
                </Button>
              )}
              <Button className="h-12 flex-[2]" disabled={!draft.name.trim()} onClick={() => void saveDraft()}>
                Enregistrer
              </Button>
            </div>
          </>
        )}
      </Sheet>

      <BottomNav settingsBadge={stale} />
    </div>
  )
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-2">
      <h2 className="eyebrow mx-1 my-0 text-muted">{title}</h2>
      {children}
    </section>
  )
}

function CategoryRow({ cat, first, last, onEdit }: { cat: CategoryWithCount; first: boolean; last: boolean; onEdit: () => void }) {
  const move = async (d: -1 | 1) => {
    await db.moveCategory(cat.id, d)
    invalidate()
  }
  return (
    <div className="flex min-h-[60px] items-center gap-3 border-b border-line pr-1 pl-3">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-white" style={{ background: tintFor(cat.icon) }}>
        <CategoryGlyph icon={cat.icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">{cat.name}</span>
        <span className="text-xs text-muted">
          {SIZE_TYPES.find((s) => s.value === cat.size_type)?.long} · {plural(cat.item_count, 'article')}
        </span>
      </span>
      <button type="button" aria-label={`Modifier ${cat.name}`} onClick={onEdit} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent text-muted">
        <EditIcon size={18} />
      </button>
      <div className="flex flex-col">
        <button
          type="button"
          aria-label={`Monter ${cat.name}`}
          disabled={first}
          onClick={() => void move(-1)}
          className="flex h-6 w-8 cursor-pointer items-center justify-center border-0 bg-transparent text-faint disabled:opacity-25"
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          aria-label={`Descendre ${cat.name}`}
          disabled={last}
          onClick={() => void move(1)}
          className="flex h-6 w-8 cursor-pointer items-center justify-center border-0 bg-transparent text-faint disabled:opacity-25"
        >
          <ChevronDown size={16} />
        </button>
      </div>
    </div>
  )
}

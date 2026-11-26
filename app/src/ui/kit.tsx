import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { CategoryIcon } from '../db/repo'
import { usePhotoUrl } from '../lib/store'
import { CategoryGlyph, GearIcon, GridIcon, HeartIcon } from './icons'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------- Couleurs des vignettes ----------
// Nuancier fixe (indépendant de la palette) : des bleus et sarcelles, une teinte par marque
// ou par catégorie pour repérer un article d'un coup d'œil.

const BRAND_TINTS: Record<string, string> = {
  nike: 'linear-gradient(140deg, #1D4ED8, #3B82F6)',
  jordan: 'linear-gradient(140deg, #312E81, #4F46E5)',
  adidas: 'linear-gradient(140deg, #0E5A6E, #0891B2)',
}
const ICON_TINTS: Record<CategoryIcon, string> = {
  shoe: 'linear-gradient(140deg, #1D4ED8, #3B82F6)',
  cloth: 'linear-gradient(140deg, #0C4A6E, #0284C7)',
  bag: 'linear-gradient(140deg, #134E4A, #0D9488)',
  box: 'linear-gradient(140deg, #1E293B, #475569)',
  star: 'linear-gradient(140deg, #3730A3, #6366F1)',
}

export function tintFor(icon: CategoryIcon, brand?: string): string {
  if (icon === 'shoe' && brand) return BRAND_TINTS[brand.toLowerCase()] ?? ICON_TINTS.shoe
  return ICON_TINTS[icon]
}

/** Vignette : photo si disponible, sinon icône de la catégorie sur fond coloré. */
export function Thumb({
  photoId,
  icon,
  brand,
  size = 56,
  radius = 14,
}: {
  photoId: number | null
  icon: CategoryIcon
  brand?: string
  size?: number
  radius?: number
}) {
  const url = usePhotoUrl(photoId)
  return (
    <div
      className="relative flex flex-none items-center justify-center overflow-hidden text-white/90"
      style={{ width: size, height: size, borderRadius: radius, background: url ? 'var(--color-raise)' : tintFor(icon, brand) }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <>
          <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.28),transparent_60%)]" />
          <CategoryGlyph icon={icon} size={size * 0.46} className="relative" />
        </>
      )}
    </div>
  )
}

// ---------- Boutons, puces ----------

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'field' | 'danger'; children: ReactNode }

export function Button({ variant = 'primary', className, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'press flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[14px] px-4 text-[15px] font-semibold disabled:opacity-40',
        variant === 'primary' && 'fill-primary border-0',
        variant === 'ghost' && 'border border-line-strong bg-transparent text-ink',
        variant === 'field' && 'field text-ink',
        variant === 'danger' && 'border border-loss/40 bg-loss/10 text-loss',
        className,
      )}
    />
  )
}

/** Puce de filtre : sélectionnée = pastille pleine contrastée (encre sur fond). */
export function Chip({
  on,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      {...rest}
      className={cx(
        'press min-h-10 flex-none cursor-pointer whitespace-nowrap rounded-full px-3.5 text-sm font-medium',
        on ? 'border border-ink bg-ink text-canvas' : 'field text-soft',
        className,
      )}
    />
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div
      className={cx('grid gap-1 rounded-[14px] border border-line bg-surface p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 cursor-pointer rounded-[10px] border-0 whitespace-nowrap transition-colors',
            options.length > 3 ? 'px-1 text-[13px]' : 'px-3 text-sm',
            o.value === value ? 'fill-primary font-semibold' : 'bg-transparent text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- Champs ----------

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-muted">
      {label}
      {children}
      {hint && <span className="text-[11px] font-normal text-faint">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'field h-11 w-full min-w-0 rounded-xl px-3 text-[15px] text-ink outline-none transition-colors focus:border-primary'

// ---------- Panneau du bas ----------

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[var(--scrim)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe mx-auto flex max-h-[88dvh] w-full max-w-[560px] flex-col gap-4 overflow-y-auto rounded-t-[28px] border-t border-line-strong bg-sheet px-4 pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.35)]"
      >
        <div className="h-1 w-9 self-center rounded-full bg-line-strong" />
        <h2 className="wide m-0 text-lg font-bold tracking-[-0.3px]">{title}</h2>
        {children}
      </div>
    </div>
  )
}

// ---------- Fond et navigation ----------

/** Lueur discrète en haut d'écran (couleurs de la palette). */
export function Halos({ variant = 'a' }: { variant?: 'a' | 'b' }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 mx-auto max-w-[560px] overflow-hidden">
      <div
        className="absolute h-[420px] w-[520px] rounded-full"
        style={{
          top: -230,
          left: variant === 'a' ? 'calc(50% - 260px)' : -200,
          background: 'radial-gradient(closest-side, var(--glow), transparent)',
          opacity: 0.75,
        }}
      />
      <div
        className="absolute h-[360px] w-[360px] rounded-full"
        style={{
          top: 260,
          right: -200,
          background: 'radial-gradient(closest-side, var(--glow-2), transparent)',
        }}
      />
    </div>
  )
}

export function BottomNav({ settingsBadge = false }: { settingsBadge?: boolean }) {
  const tab = ({ isActive }: { isActive: boolean }) =>
    cx(
      'press relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-[18px] text-[11px] transition-colors',
      isActive ? 'bg-primary/15 font-semibold text-accent' : 'text-muted',
    )
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[560px] px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
      <nav
        aria-label="Navigation principale"
        className="bar pointer-events-auto mx-auto grid max-w-[400px] grid-cols-3 gap-1 rounded-[24px] border border-line p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
      >
        <NavLink to="/" end className={tab}>
          <GridIcon size={20} />
          Collection
        </NavLink>
        <NavLink to="/wishlist" className={tab}>
          <HeartIcon size={20} />
          Wishlist
        </NavLink>
        <NavLink to="/reglages" className={tab}>
          <GearIcon size={20} />
          Réglages
          {settingsBadge && (
            <span aria-label="Sauvegarde à faire" className="absolute top-1.5 right-[calc(50%-17px)] h-2 w-2 rounded-full bg-warn ring-2 ring-surface" />
          )}
        </NavLink>
      </nav>
    </div>
  )
}

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('relative mx-auto min-h-dvh w-full max-w-[560px]', className)}>{children}</div>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2.5 rounded-[22px] border border-dashed border-line-strong px-4 py-7 text-center">
      <span className="wide text-[15px] font-bold">{title}</span>
      {children}
    </div>
  )
}

/** Titre d'écran (Wishlist, Réglages…). */
export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="wide m-0 text-[26px] leading-none font-extrabold tracking-[-0.8px]">{children}</h1>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  )
}

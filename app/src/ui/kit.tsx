import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { CategoryIcon } from '../db/repo'
import { usePhotoUrl } from '../lib/store'
import { CategoryGlyph, GearIcon, GridIcon, HeartIcon } from './icons'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------- Couleurs des vignettes ----------

const BRAND_TINTS: Record<string, string> = {
  nike: 'linear-gradient(135deg, #F97316, #EC4899)',
  jordan: 'linear-gradient(135deg, #EF4444, #8B5CF6)',
  adidas: 'linear-gradient(135deg, #22D3EE, #6366F1)',
}
const ICON_TINTS: Record<CategoryIcon, string> = {
  shoe: 'linear-gradient(135deg, #F97316, #EC4899)',
  cloth: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
  bag: 'linear-gradient(135deg, #14B8A6, #22D3EE)',
  box: 'linear-gradient(135deg, #F59E0B, #EF4444)',
  star: 'linear-gradient(135deg, #EC4899, #F59E0B)',
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
      className="flex flex-none items-center justify-center overflow-hidden text-white/90"
      style={{ width: size, height: size, borderRadius: radius, background: url ? '#150F35' : tintFor(icon, brand) }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <CategoryGlyph icon={icon} size={size * 0.46} />}
    </div>
  )
}

// ---------- Boutons, puces ----------

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'field'; children: ReactNode }

export function Button({ variant = 'primary', className, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[14px] px-4 text-[15px] transition-opacity disabled:opacity-40',
        variant === 'primary' && 'aurora-grad font-bold text-white shadow-[0_6px_20px_rgba(236,72,153,0.3)]',
        variant === 'ghost' && 'border border-lilac/30 bg-transparent text-ink',
        variant === 'field' && 'field text-ink',
        className,
      )}
    />
  )
}

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
        'min-h-10 flex-none cursor-pointer whitespace-nowrap rounded-[14px] px-3 text-sm',
        on ? 'aurora-grad border-0 font-bold text-white' : 'field text-soft',
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
    <div className={cx('glass grid gap-1 rounded-[14px] p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 cursor-pointer rounded-[11px] whitespace-nowrap',
            options.length > 3 ? 'px-1 text-[13px]' : 'px-3 text-sm',
            o.value === value ? 'aurora-grad font-bold text-white' : 'text-muted',
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
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-muted">
      {label}
      {children}
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </label>
  )
}

export const inputClass = 'field h-11 w-full min-w-0 rounded-[14px] px-3 text-[15px] text-ink outline-none'

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
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[rgba(5,3,15,0.6)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe mx-auto flex max-h-[88dvh] w-full max-w-[560px] flex-col gap-4 overflow-y-auto rounded-t-3xl border-t border-lilac/25 bg-sheet px-4 pt-4"
      >
        <div className="h-1 w-10 self-center rounded-full bg-lilac/35" />
        <h2 className="m-0 font-display text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

// ---------- Fond et navigation ----------

export function Halos({ variant = 'a' }: { variant?: 'a' | 'b' }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        className="absolute h-[360px] w-[360px] rounded-full"
        style={{
          top: -120,
          left: variant === 'a' ? -80 : 'auto',
          right: variant === 'b' ? -90 : 'auto',
          background: `radial-gradient(circle, ${variant === 'a' ? 'rgba(139,92,246,0.45)' : 'rgba(236,72,153,0.35)'}, transparent 70%)`,
        }}
      />
      <div
        className="absolute h-[340px] w-[340px] rounded-full"
        style={{
          top: 220,
          right: variant === 'a' ? -140 : 'auto',
          left: variant === 'b' ? -160 : 'auto',
          background: 'radial-gradient(circle, rgba(34,211,238,0.24), transparent 70%)',
        }}
      />
    </div>
  )
}

export function BottomNav({ settingsBadge = false }: { settingsBadge?: boolean }) {
  const tab = ({ isActive }: { isActive: boolean }) =>
    cx('relative flex h-11 flex-col items-center justify-center gap-0.5 text-[10px]', isActive ? 'font-bold text-ink [&>svg]:text-pink' : 'text-muted')
  return (
    <nav
      aria-label="Navigation principale"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-[560px] grid-cols-3 items-center rounded-t-[20px] border-t border-lilac/20 bg-bar px-6 pt-1.5 shadow-[0_-8px_30px_rgba(14,10,36,0.6)]"
    >
      <NavLink to="/" end className={tab}>
        <GridIcon />
        Collection
      </NavLink>
      <NavLink to="/wishlist" className={tab}>
        <HeartIcon />
        Wishlist
      </NavLink>
      <NavLink to="/reglages" className={tab}>
        <GearIcon />
        Réglages
        {settingsBadge && <span aria-label="Sauvegarde à faire" className="absolute top-1 right-[calc(50%-16px)] h-2 w-2 rounded-full bg-[#F59E0B]" />}
      </NavLink>
    </nav>
  )
}

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('relative mx-auto min-h-dvh w-full max-w-[560px]', className)}>{children}</div>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2.5 rounded-[20px] border border-dashed border-lilac/35 px-4 py-6 text-center">
      <span className="font-display text-[15px] font-semibold">{title}</span>
      {children}
    </div>
  )
}

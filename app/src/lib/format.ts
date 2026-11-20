import type { ItemView } from '../db/repo'
import { formatEu, usToEu } from '../domain/sizes'

export const eur = (n: number | null | undefined, digits = 0): string =>
  n == null
    ? '—'
    : n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + ' €'

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export { localDate as today } from '../domain/dates'

export function formatCondition(c: number | null): string {
  if (c == null) return 'état ?'
  if (c >= 10) return 'DS'
  return `${String(c).replace('.', ',')}/10`
}

export function formatItemSize(item: Pick<ItemView, 'size_type' | 'size_us' | 'size_label' | 'brand'>): string | null {
  if (item.size_type === 'shoe') {
    if (item.size_us == null) return 'taille ?'
    const eu = usToEu(item.size_us, item.brand)
    const us = String(item.size_us).replace('.', ',')
    return eu == null ? `US ${us}` : `US ${us} · FR ${formatEu(eu)}`
  }
  if (item.size_type === 'none') return null
  return item.size_label || 'taille ?'
}

export function parseNumber(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`

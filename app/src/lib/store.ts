import { useCallback, useEffect, useState } from 'react'
import { db } from '../db/client'
import type { FeeSettings, ValuationSettings } from '../domain/valuation'

// Rafraîchissement simple : après une écriture, `invalidate()` relance toutes les requêtes affichées.
const listeners = new Set<() => void>()
export function invalidate(): void {
  listeners.forEach((l) => l())
}

export interface QueryState<T> {
  data: T | undefined
  error: Error | undefined
  loading: boolean
  reload: () => void
}

export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]): QueryState<T> {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true })
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    listeners.add(reload)
    return () => {
      listeners.delete(reload)
    }
  }, [reload])

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      (error: Error) => alive && setState({ error, loading: false }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data: state.data, error: state.error, loading: state.loading, reload }
}

export interface AppSettings {
  valuation: ValuationSettings
  fees: FeeSettings
  lastBackupAt: string
  raw: Record<string, string>
}

export function parseSettings(raw: Record<string, string>): AppSettings {
  const n = (k: string, d: number) => {
    const v = Number(raw[k])
    return Number.isFinite(v) ? v : d
  }
  return {
    valuation: { usedMaxPct: n('valuation.used_max_pct', 90), perPointPct: n('valuation.per_point_pct', 8) },
    fees: {
      transactionPct: n('fees.transaction_pct', 9),
      paymentPct: n('fees.payment_pct', 3),
      shippingEur: n('fees.shipping_eur', 7),
    },
    lastBackupAt: raw['backup.last_at'] ?? '',
    raw,
  }
}

export function useSettings(): AppSettings | undefined {
  const { data } = useQuery(() => db.getSettings(), [])
  return data ? parseSettings(data) : undefined
}

/** Sauvegarde jamais faite ou datant de plus de 30 jours. */
export function backupIsStale(lastBackupAt: string, now = Date.now()): boolean {
  if (!lastBackupAt) return true
  return now - new Date(lastBackupAt).getTime() > 30 * 24 * 3600 * 1000
}

// URL d'objet pour une photo, mise en cache pour ne pas relire la base à chaque rendu.
const photoCache = new Map<string, Promise<string | null>>()
export function photoUrl(id: number, thumb: boolean): Promise<string | null> {
  const key = `${id}:${thumb ? 't' : 'f'}`
  let p = photoCache.get(key)
  if (!p) {
    p = db.getPhoto(id, thumb).then((ph) =>
      ph ? URL.createObjectURL(new Blob([ph.data as BlobPart], { type: ph.mime })) : null,
    )
    photoCache.set(key, p)
  }
  return p
}

export function usePhotoUrl(id: number | null | undefined, thumb = true): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setUrl(null)
    if (id != null) void photoUrl(id, thumb).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [id, thumb])
  return url
}

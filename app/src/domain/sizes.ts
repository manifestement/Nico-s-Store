// Conversion des tailles US homme <-> FR (EU), selon la grille de chaque marque.
// Les grilles Nike et Adidas diffèrent (Adidas utilise des tiers de pointure).

type Grid = ReadonlyArray<readonly [us: number, eu: number]>

const NIKE: Grid = [
  [3.5, 35.5], [4, 36], [4.5, 36.5], [5, 37.5], [5.5, 38], [6, 38.5], [6.5, 39],
  [7, 40], [7.5, 40.5], [8, 41], [8.5, 42], [9, 42.5], [9.5, 43], [10, 44],
  [10.5, 44.5], [11, 45], [11.5, 45.5], [12, 46], [12.5, 47], [13, 47.5],
  [14, 48.5], [15, 49.5],
]

const ADIDAS: Grid = [
  [4, 36], [4.5, 36 + 2 / 3], [5, 37 + 1 / 3], [5.5, 38], [6, 38 + 2 / 3],
  [6.5, 39 + 1 / 3], [7, 40], [7.5, 40 + 2 / 3], [8, 41 + 1 / 3], [8.5, 42],
  [9, 42 + 2 / 3], [9.5, 43 + 1 / 3], [10, 44], [10.5, 44 + 2 / 3], [11, 45 + 1 / 3],
  [11.5, 46], [12, 46 + 2 / 3], [12.5, 47 + 1 / 3], [13, 48], [14, 49 + 1 / 3],
]

const GRIDS: Record<string, Grid> = {
  nike: NIKE,
  jordan: NIKE,
  adidas: ADIDAS,
  yeezy: ADIDAS,
}

function gridFor(brand: string): Grid {
  return GRIDS[brand.trim().toLowerCase()] ?? NIKE
}

/** Pointures US disponibles pour la marque (sert au sélecteur −/+). */
export function usSizes(brand: string): number[] {
  return gridFor(brand).map(([us]) => us)
}

export const CLOTH_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

export function usToEu(sizeUs: number, brand: string): number | null {
  return gridFor(brand).find(([us]) => us === sizeUs)?.[1] ?? null
}

export function euToUs(sizeEu: number, brand: string): number | null {
  // Tolérance pour les tiers de pointure saisis "42.7" ou "42 2/3".
  const hit = gridFor(brand).find(([, eu]) => Math.abs(eu - sizeEu) < 0.1)
  return hit?.[0] ?? null
}

export function formatEu(eu: number): string {
  const whole = Math.floor(eu)
  const frac = eu - whole
  if (Math.abs(frac - 1 / 3) < 0.01) return `${whole} ⅓`
  if (Math.abs(frac - 2 / 3) < 0.01) return `${whole} ⅔`
  if (Math.abs(frac - 0.5) < 0.01) return `${whole},5`
  return String(whole)
}

export function formatSize(sizeUs: number | null, brand: string): string {
  if (sizeUs == null) return '—'
  const eu = usToEu(sizeUs, brand)
  const us = String(sizeUs).replace('.', ',')
  return eu == null ? `US ${us}` : `US ${us} · FR ${formatEu(eu)}`
}

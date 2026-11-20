// Calculs de valeur : décote selon l'état et simulation de revente frais déduits.

export interface ValuationSettings {
  usedMaxPct: number // valeur d'une paire portée en 9,5/10, en % de la cote DS
  perPointPct: number // perte par point d'état en dessous de 9,5
}

export interface FeeSettings {
  transactionPct: number
  paymentPct: number
  shippingEur: number
}

/** Coefficient appliqué à la cote StockX (prix DS). État inconnu = pas de décote. */
export function conditionFactor(condition: number | null, s: ValuationSettings): number {
  if (condition == null || condition >= 10) return 1
  const pct = s.usedMaxPct - Math.max(0, 9.5 - condition) * s.perPointPct
  return Math.min(1, Math.max(0.1, pct / 100))
}

export function estimatedValue(
  marketPrice: number | null,
  condition: number | null,
  s: ValuationSettings,
): number | null {
  if (marketPrice == null) return null
  return Math.round(marketPrice * conditionFactor(condition, s))
}

export interface ResaleSimulation {
  salePrice: number
  fees: number
  net: number
  profit: number | null // null si le prix d'achat est inconnu
}

export function simulateResale(
  salePrice: number,
  purchasePrice: number | null,
  f: FeeSettings,
): ResaleSimulation {
  const fees = salePrice * ((f.transactionPct + f.paymentPct) / 100) + f.shippingEur
  const net = Math.max(0, salePrice - fees)
  return {
    salePrice,
    fees: Math.round(fees * 100) / 100,
    net: Math.round(net * 100) / 100,
    profit: purchasePrice == null ? null : Math.round((net - purchasePrice) * 100) / 100,
  }
}

export function formatCondition(condition: number | null): string {
  if (condition == null) return '—'
  if (condition >= 10) return 'DS'
  return `${String(condition).replace('.', ',')}/10`
}

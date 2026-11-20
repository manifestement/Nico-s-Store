import { localDate } from '../domain/dates'
import { inferBrand, inferLine } from '../domain/lines'
import { countItems, createItem, listCategories, type NewItem } from './repo'
import type { Sql } from './sql'

// La collection d'origine (collection-initiale.md) reste en local, hors du dépôt public.
// Absente (build GitHub Pages), l'appli démarre vide : Nico importe alors la sauvegarde
// initiale créée par `npm run export:initial`.
const local = import.meta.glob<string>('./collection-initiale.md', { query: '?raw', import: 'default', eager: true })
export const LOCAL_COLLECTION_MD: string | undefined = Object.values(local)[0]

export interface SeedRow {
  item: Omit<NewItem, 'category_id'>
  category: 'Sneakers' | 'Accessoires'
  marketPrice: number | null
}

const num = (s: string): number | null => {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** "DS" (deadstock, neuve) = 10/10. */
const condition = (s: string): number | null => (s.trim().toUpperCase() === 'DS' ? 10 : num(s))

/** Lit le tableau Markdown issu de l'Excel. La colonne Profit est ignorée : elle est recalculée. */
export function parseCollectionMarkdown(md: string): SeedRow[] {
  return md
    .split('\n')
    .filter((l) => /^\|\s*\d+\s*\|/.test(l))
    .map((line) => {
      const [n, model, size, purchase, cote, , etat] = line.split('|').slice(1).map((c) => c.trim())
      return {
        category: /chaussette/i.test(model) ? 'Accessoires' : 'Sneakers',
        item: {
          number: Number(n),
          status: 'owned',
          brand: inferBrand(model),
          model,
          line: inferLine(model),
          size_us: num(size),
          purchase_price: num(purchase),
          condition: condition(etat),
        },
        marketPrice: num(cote),
      }
    })
}

export function seedIfEmpty(sql: Sql, md: string | undefined = LOCAL_COLLECTION_MD): number {
  if (!md || countItems(sql) > 0) return 0
  const catId = Object.fromEntries(listCategories(sql).map((c) => [c.name, c.id]))
  const rows = parseCollectionMarkdown(md)
  const at = localDate()
  sql.transaction(() => {
    for (const { item, category, marketPrice } of rows) {
      createItem(sql, { ...item, category_id: catId[category] }, marketPrice, at)
    }
  })
  return rows.length
}

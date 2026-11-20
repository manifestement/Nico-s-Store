import { localDate } from '../domain/dates'
import type { Sql, SqlValue } from './sql'

export type ItemStatus = 'owned' | 'wishlist' | 'sold'
export type CategoryIcon = 'shoe' | 'cloth' | 'bag' | 'box' | 'star'
export type SizeType = 'shoe' | 'cloth' | 'dim' | 'none'

export interface Category {
  id: number
  name: string
  icon: CategoryIcon
  size_type: SizeType
  position: number
}

export interface CategoryWithCount extends Category {
  item_count: number
}

export interface Item {
  id: number
  number: number | null
  status: ItemStatus
  category_id: number
  brand: string
  model: string
  line: string | null
  sku: string | null
  size_us: number | null
  size_label: string | null
  condition: number | null
  purchase_price: number | null
  purchase_date: string | null
  target_price: number | null
  sold_price: number | null
  sold_date: string | null
  value_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** Article + cote la plus récente + catégorie + première photo (sert aux listes). */
export interface ItemView extends Item {
  market_price: number | null
  market_price_at: string | null
  photo_id: number | null
  category_name: string
  category_icon: CategoryIcon
  size_type: SizeType
}

export type NewItem = Partial<Omit<Item, 'id' | 'created_at' | 'updated_at'>> &
  Pick<Item, 'model' | 'category_id'>

const EDITABLE: (keyof NewItem)[] = [
  'number', 'status', 'category_id', 'brand', 'model', 'line', 'sku', 'size_us', 'size_label',
  'condition', 'purchase_price', 'purchase_date', 'target_price', 'sold_price', 'sold_date',
  'value_url', 'notes',
]

const lastId = (sql: Sql) => sql.all<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id

// ---------- Articles ----------

export function createItem(sql: Sql, item: NewItem, initialPrice?: number | null, at?: string): number {
  const data: NewItem = { ...item }
  if (data.number === undefined && (data.status ?? 'owned') === 'owned') data.number = nextNumber(sql)
  const cols = EDITABLE.filter((k) => data[k] !== undefined)
  sql.run(
    `INSERT INTO items (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map((k) => data[k] as SqlValue),
  )
  const id = lastId(sql)
  if (initialPrice != null) addPrice(sql, id, initialPrice, at)
  return id
}

export function nextNumber(sql: Sql): number {
  return sql.all<{ n: number }>('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM items')[0].n
}

export function updateItem(sql: Sql, id: number, patch: Partial<NewItem>): void {
  const cols = EDITABLE.filter((k) => patch[k] !== undefined)
  if (!cols.length) return
  sql.run(
    `UPDATE items SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
    [...cols.map((k) => patch[k] as SqlValue), id],
  )
}

/** Passe un article de la wishlist à la collection, avec le prochain numéro libre. */
export function acquireItem(sql: Sql, id: number): void {
  sql.run(
    `UPDATE items SET status = 'owned', number = COALESCE(number, ?), updated_at = datetime('now') WHERE id = ?`,
    [nextNumber(sql), id],
  )
}

export function deleteItem(sql: Sql, id: number): void {
  sql.run('DELETE FROM items WHERE id = ?', [id])
}

export function addPrice(sql: Sql, itemId: number, price: number, at?: string): void {
  // Date locale du téléphone : date('now') de SQLite serait en UTC (veille après minuit).
  sql.run('INSERT INTO price_history (item_id, price, recorded_at) VALUES (?, ?, ?)', [itemId, price, at ?? localDate()])
}

const VIEW_SQL = `
  SELECT i.*,
    (SELECT price FROM price_history h WHERE h.item_id = i.id ORDER BY recorded_at DESC, id DESC LIMIT 1) AS market_price,
    (SELECT recorded_at FROM price_history h WHERE h.item_id = i.id ORDER BY recorded_at DESC, id DESC LIMIT 1) AS market_price_at,
    (SELECT id FROM photos f WHERE f.item_id = i.id ORDER BY position, id LIMIT 1) AS photo_id,
    c.name AS category_name, c.icon AS category_icon, c.size_type AS size_type
  FROM items i JOIN categories c ON c.id = i.category_id`

export function listItems(sql: Sql, status: ItemStatus): ItemView[] {
  return sql.all<ItemView>(`${VIEW_SQL} WHERE i.status = ? ORDER BY i.number, i.id`, [status])
}

export function getItem(sql: Sql, id: number): ItemView | null {
  return sql.all<ItemView>(`${VIEW_SQL} WHERE i.id = ?`, [id])[0] ?? null
}

export function listBrands(sql: Sql): string[] {
  return sql.all<{ brand: string }>("SELECT DISTINCT brand FROM items WHERE brand <> '' ORDER BY brand").map((r) => r.brand)
}

export function listLines(sql: Sql): string[] {
  return sql.all<{ line: string }>("SELECT DISTINCT line FROM items WHERE line IS NOT NULL AND line <> '' ORDER BY line").map((r) => r.line)
}

export interface PricePoint {
  recorded_at: string
  price: number
}

export function priceHistory(sql: Sql, itemId: number): PricePoint[] {
  return sql.all<PricePoint>(
    'SELECT recorded_at, price FROM price_history WHERE item_id = ? ORDER BY recorded_at, id',
    [itemId],
  )
}

/** Valeur de la collection (cotes brutes) à chaque date de saisie : dernière cote connue de chaque article. */
export function collectionHistory(sql: Sql): PricePoint[] {
  return sql.all<PricePoint>(`
    WITH dates AS (SELECT DISTINCT recorded_at AS d FROM price_history)
    SELECT d AS recorded_at, SUM((
      SELECT h.price FROM price_history h
      WHERE h.item_id = i.id AND h.recorded_at <= d
      ORDER BY h.recorded_at DESC, h.id DESC LIMIT 1
    )) AS price
    FROM dates, items i
    WHERE i.status = 'owned'
    GROUP BY d ORDER BY d`)
}

// ---------- Photos ----------

export function addPhoto(sql: Sql, itemId: number, mime: string, data: Uint8Array, thumb?: Uint8Array): number {
  const [{ pos }] = sql.all<{ pos: number }>(
    'SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM photos WHERE item_id = ?',
    [itemId],
  )
  sql.run('INSERT INTO photos (item_id, position, mime, data, thumb) VALUES (?, ?, ?, ?, ?)', [
    itemId, pos, mime, data, thumb ?? null,
  ])
  return lastId(sql)
}

export function getPhoto(sql: Sql, id: number, thumb = false): { mime: string; data: Uint8Array } | null {
  const col = thumb ? 'COALESCE(thumb, data)' : 'data'
  return sql.all<{ mime: string; data: Uint8Array }>(`SELECT mime, ${col} AS data FROM photos WHERE id = ?`, [id])[0] ?? null
}

export function listPhotoIds(sql: Sql, itemId: number): number[] {
  return sql.all<{ id: number }>('SELECT id FROM photos WHERE item_id = ? ORDER BY position, id', [itemId]).map((r) => r.id)
}

export function deletePhoto(sql: Sql, id: number): void {
  sql.run('DELETE FROM photos WHERE id = ?', [id])
}

// ---------- Catégories ----------

export function listCategories(sql: Sql): CategoryWithCount[] {
  return sql.all<CategoryWithCount>(`
    SELECT c.*, (SELECT COUNT(*) FROM items i WHERE i.category_id = c.id AND i.status = 'owned') AS item_count
    FROM categories c ORDER BY c.position, c.id`)
}

export function saveCategory(sql: Sql, cat: Omit<Category, 'id' | 'position'> & { id?: number }): number {
  if (cat.id) {
    sql.run('UPDATE categories SET name = ?, icon = ?, size_type = ? WHERE id = ?', [cat.name, cat.icon, cat.size_type, cat.id])
    return cat.id
  }
  const [{ pos }] = sql.all<{ pos: number }>('SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM categories')
  sql.run('INSERT INTO categories (name, icon, size_type, position) VALUES (?, ?, ?, ?)', [cat.name, cat.icon, cat.size_type, pos])
  return lastId(sql)
}

/** Déplace une catégorie d'un cran (direction -1 = vers le haut). */
export function moveCategory(sql: Sql, id: number, direction: -1 | 1): void {
  const cats = listCategories(sql)
  const i = cats.findIndex((c) => c.id === id)
  const j = i + direction
  if (i < 0 || j < 0 || j >= cats.length) return
  ;[cats[i], cats[j]] = [cats[j], cats[i]]
  sql.transaction(() => cats.forEach((c, pos) => sql.run('UPDATE categories SET position = ? WHERE id = ?', [pos, c.id])))
}

/** Refuse la suppression si des articles (même en wishlist) utilisent encore la catégorie. */
export function deleteCategory(sql: Sql, id: number): void {
  const [{ n }] = sql.all<{ n: number }>('SELECT COUNT(*) AS n FROM items WHERE category_id = ?', [id])
  if (n > 0) throw new Error(`Cette catégorie contient encore ${n} article${n > 1 ? 's' : ''}`)
  sql.run('DELETE FROM categories WHERE id = ?', [id])
}

// ---------- Réglages ----------

export function getSettings(sql: Sql): Record<string, string> {
  return Object.fromEntries(sql.all<{ key: string; value: string }>('SELECT key, value FROM settings').map((r) => [r.key, r.value]))
}

export function setSetting(sql: Sql, key: string, value: string): void {
  sql.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value])
}

export function countItems(sql: Sql): number {
  return sql.all<{ n: number }>('SELECT COUNT(*) AS n FROM items')[0].n
}

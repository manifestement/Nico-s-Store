import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { beforeEach, describe, expect, it } from 'vitest'
import { inferLine } from '../domain/lines'
import { euToUs, formatSize, usToEu } from '../domain/sizes'
import { conditionFactor, estimatedValue, simulateResale } from '../domain/valuation'
import * as repo from './repo'
import { parseCollectionMarkdown, seedIfEmpty } from './seed'
import { migrate, wrap, type Sql } from './sql'

const sqlite3 = await sqlite3InitModule()
let sql: Sql
let sneakers: number
let objets: number

beforeEach(() => {
  sql = wrap(new sqlite3.oo1.DB(':memory:', 'c'))
  migrate(sql)
  const cats = Object.fromEntries(repo.listCategories(sql).map((c) => [c.name, c.id]))
  sneakers = cats.Sneakers
  objets = cats.Objets
})

describe('import de la collection', () => {
  it('lit les 88 articles et retrouve la valeur totale de l’Excel (20 515 €)', () => {
    expect(seedIfEmpty(sql)).toBe(88)
    const items = repo.listItems(sql, 'owned')
    expect(items).toHaveLength(88)
    expect(items.reduce((s, p) => s + (p.market_price ?? 0), 0)).toBe(20515)
  })

  it('range les chaussettes en accessoire et le reste en sneakers', () => {
    seedIfEmpty(sql)
    const counts = Object.fromEntries(repo.listCategories(sql).map((c) => [c.name, c.item_count]))
    expect(counts).toEqual({ Sneakers: 87, Vêtements: 0, Accessoires: 1, Objets: 0 })
  })

  it('déduit une ligne pour chaque article (32 lignes)', () => {
    seedIfEmpty(sql)
    const items = repo.listItems(sql, 'owned')
    expect(items.every((i) => i.line)).toBe(true)
    expect(new Set(items.map((i) => i.line)).size).toBe(32)
    expect(items.filter((i) => i.line === 'Air Max 1')).toHaveLength(20)
  })

  it('ne réimporte pas si la base contient déjà des articles', () => {
    seedIfEmpty(sql)
    expect(seedIfEmpty(sql)).toBe(0)
    expect(repo.countItems(sql)).toBe(88)
  })

  it('normalise tailles, état et marque', () => {
    const rows = parseCollectionMarkdown(
      [
        '| 4 | Air max 1 MASTER | 8,5 | | 425 | 425 | 9 | | |',
        '| 1 | Air max 1 SUSAN | 9 | | 350 | 350 | DS | | 20515 |',
        '| 22 | Yeezy 350 v2 ZEBRA | 9 | | 240 | 240 | 9 | | |',
        '| 84 | Mak Attack Travis | 9 | 105 | 140 | 35 | 8,5 | | |',
        '| 88 | Travis j1 bébé | | | 200 | 200 | | | |',
      ].join('\n'),
    )
    expect(rows.map((r) => r.item.size_us)).toEqual([8.5, 9, 9, 9, null])
    expect(rows.map((r) => r.item.condition)).toEqual([9, 10, 9, 8.5, null])
    expect(rows.map((r) => r.item.brand)).toEqual(['Nike', 'Nike', 'Adidas', 'Nike', 'Jordan'])
    expect(rows[3].item.purchase_price).toBe(105)
  })
})

describe('articles', () => {
  it('numérote automatiquement les nouveaux articles possédés, pas la wishlist', () => {
    const a = repo.createItem(sql, { model: 'A', category_id: sneakers })
    const w = repo.createItem(sql, { model: 'W', category_id: sneakers, status: 'wishlist' })
    expect(repo.getItem(sql, a)?.number).toBe(1)
    expect(repo.getItem(sql, w)?.number).toBeNull()
    repo.acquireItem(sql, w)
    expect(repo.getItem(sql, w)).toMatchObject({ status: 'owned', number: 2 })
  })

  it('la cote actuelle est la saisie la plus récente', () => {
    const id = repo.createItem(sql, { model: 'Dunk', category_id: sneakers }, 100, '2026-01-01')
    repo.addPrice(sql, id, 130, '2026-03-01')
    repo.addPrice(sql, id, 120, '2026-02-01')
    expect(repo.getItem(sql, id)?.market_price).toBe(130)
    expect(repo.priceHistory(sql, id).map((p) => p.price)).toEqual([100, 120, 130])
  })

  it('l’historique de la collection reprend la dernière cote connue de chaque article', () => {
    const a = repo.createItem(sql, { model: 'A', category_id: sneakers }, 100, '2026-01-01')
    repo.createItem(sql, { model: 'B', category_id: sneakers }, 50, '2026-02-01')
    repo.addPrice(sql, a, 150, '2026-03-01')
    repo.createItem(sql, { model: 'W', category_id: sneakers, status: 'wishlist' }, 999, '2026-03-01')
    expect(repo.collectionHistory(sql)).toEqual([
      { recorded_at: '2026-01-01', price: 100 },
      { recorded_at: '2026-02-01', price: 150 },
      { recorded_at: '2026-03-01', price: 200 },
    ])
  })

  it('supprimer un article supprime ses cotes et photos', () => {
    const id = repo.createItem(sql, { model: 'X', category_id: sneakers }, 10)
    repo.addPhoto(sql, id, 'image/jpeg', new Uint8Array([1, 2, 3]))
    repo.deleteItem(sql, id)
    expect(sql.all('SELECT * FROM price_history')).toHaveLength(0)
    expect(sql.all('SELECT * FROM photos')).toHaveLength(0)
  })

  it('stocke une photo et sa miniature', () => {
    const id = repo.createItem(sql, { model: 'X', category_id: objets, size_label: '120 × 80 cm' })
    const photo = repo.addPhoto(sql, id, 'image/jpeg', new Uint8Array([9, 8, 7]), new Uint8Array([1]))
    expect(Array.from(repo.getPhoto(sql, photo)!.data)).toEqual([9, 8, 7])
    expect(Array.from(repo.getPhoto(sql, photo, true)!.data)).toEqual([1])
    expect(repo.getItem(sql, id)).toMatchObject({ photo_id: photo, size_type: 'dim', category_name: 'Objets' })
  })
})

describe('catégories', () => {
  it('crée, réordonne et renomme', () => {
    const id = repo.saveCategory(sql, { name: 'Tapis', icon: 'box', size_type: 'dim' })
    repo.moveCategory(sql, id, -1)
    expect(repo.listCategories(sql).map((c) => c.name)).toEqual(['Sneakers', 'Vêtements', 'Accessoires', 'Tapis', 'Objets'])
    repo.saveCategory(sql, { id, name: 'Tapis & déco', icon: 'star', size_type: 'dim' })
    expect(repo.listCategories(sql)[3]).toMatchObject({ name: 'Tapis & déco', icon: 'star' })
  })

  it('refuse de supprimer une catégorie utilisée', () => {
    repo.createItem(sql, { model: 'X', category_id: objets, status: 'wishlist' })
    expect(() => repo.deleteCategory(sql, objets)).toThrow(/1 article/)
    const empty = repo.saveCategory(sql, { name: 'Vide', icon: 'box', size_type: 'none' })
    repo.deleteCategory(sql, empty)
    expect(repo.listCategories(sql).some((c) => c.name === 'Vide')).toBe(false)
  })
})

describe('calculs', () => {
  const v = { usedMaxPct: 90, perPointPct: 8 }
  it('décote selon l’état', () => {
    expect(conditionFactor(10, v)).toBe(1)
    expect(conditionFactor(null, v)).toBe(1)
    expect(conditionFactor(9.5, v)).toBeCloseTo(0.9)
    expect(conditionFactor(7, v)).toBeCloseTo(0.7)
    expect(estimatedValue(200, 8.5, v)).toBe(164)
  })

  it('simule une revente frais déduits', () => {
    const s = simulateResale(300, 105, { transactionPct: 9, paymentPct: 3, shippingEur: 7 })
    expect(s.fees).toBe(43)
    expect(s.net).toBe(257)
    expect(s.profit).toBe(152)
    expect(simulateResale(300, null, { transactionPct: 9, paymentPct: 3, shippingEur: 7 }).profit).toBeNull()
  })

  it('convertit les tailles selon la marque', () => {
    expect(usToEu(9, 'Nike')).toBe(42.5)
    expect(usToEu(9, 'Adidas')).toBeCloseTo(42.667)
    expect(euToUs(42.5, 'Jordan')).toBe(9)
    expect(euToUs(42.7, 'Adidas')).toBe(9)
    expect(formatSize(9.5, 'Adidas')).toBe('US 9,5 · FR 43 ⅓')
    expect(formatSize(8.5, 'Nike')).toBe('US 8,5 · FR 42')
  })

  it('déduit la ligne d’un modèle', () => {
    expect(inferLine('Air max 1/97 SW')).toBe('Air Max 1')
    expect(inferLine('AIR MAX 1000')).toBe('Air Max 1000')
    expect(inferLine('Travis j1 bébé')).toBe('Jordan 1')
    expect(inferLine('hoodie Corteiz Alcatraz')).toBe('Corteiz')
    expect(inferLine('tapis cactus jack')).toBe('Tapis cactus')
  })
})

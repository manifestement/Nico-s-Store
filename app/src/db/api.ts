import * as repo from './repo'
import { seedIfEmpty } from './seed'
import type { Sql } from './sql'

/** Fonctions exposées par le worker : celles du repo, avec `sql` déjà fourni. */
export function makeApi(sql: Sql) {
  return {
    listItems: (status: repo.ItemStatus) => repo.listItems(sql, status),
    getItem: (id: number) => repo.getItem(sql, id),
    createItem: (item: repo.NewItem, initialPrice?: number | null) => repo.createItem(sql, item, initialPrice),
    updateItem: (id: number, patch: Partial<repo.NewItem>) => repo.updateItem(sql, id, patch),
    acquireItem: (id: number) => repo.acquireItem(sql, id),
    deleteItem: (id: number) => repo.deleteItem(sql, id),
    listBrands: () => repo.listBrands(sql),
    listLines: () => repo.listLines(sql),
    addPrice: (itemId: number, price: number, at?: string) => repo.addPrice(sql, itemId, price, at),
    priceHistory: (itemId: number) => repo.priceHistory(sql, itemId),
    collectionHistory: () => repo.collectionHistory(sql),
    addPhoto: (itemId: number, mime: string, data: Uint8Array, thumb?: Uint8Array) => repo.addPhoto(sql, itemId, mime, data, thumb),
    getPhoto: (id: number, thumb?: boolean) => repo.getPhoto(sql, id, thumb),
    listPhotoIds: (itemId: number) => repo.listPhotoIds(sql, itemId),
    deletePhoto: (id: number) => repo.deletePhoto(sql, id),
    listCategories: () => repo.listCategories(sql),
    saveCategory: (cat: Parameters<typeof repo.saveCategory>[1]) => repo.saveCategory(sql, cat),
    moveCategory: (id: number, direction: -1 | 1) => repo.moveCategory(sql, id, direction),
    deleteCategory: (id: number) => repo.deleteCategory(sql, id),
    getSettings: () => repo.getSettings(sql),
    setSetting: (key: string, value: string) => repo.setSetting(sql, key, value),
    seedIfEmpty: () => seedIfEmpty(sql),
  }
}

export type DbApi = ReturnType<typeof makeApi>

/** Fonctions propres au worker (fichier de base). */
export interface FileApi {
  exportDb: () => Uint8Array
  importDb: (data: Uint8Array) => Promise<void>
  storageInfo: () => { persisted: boolean; vfs: string }
}

export type WorkerApi = DbApi & FileApi

export type Request = { id: number; method: keyof WorkerApi; args: unknown[] }
export type Response = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string }

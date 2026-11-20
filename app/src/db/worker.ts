/// <reference lib="webworker" />
import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm'
import { makeApi, type DbApi, type FileApi, type Request, type Response } from './api'
import { migrate, wrap } from './sql'

// VFS "opfs-sahpool" : persistance OPFS sans les en-têtes COOP/COEP,
// que GitHub Pages ne permet pas de définir. Fonctionne sur Safari iOS 16.4+.
const DB_FILE = '/sneakers.sqlite3'

const ready = (async () => {
  const sqlite3 = await sqlite3InitModule()
  let pool: Awaited<ReturnType<typeof sqlite3.installOpfsSAHPoolVfs>> | null = null
  try {
    pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'sneakers-pool', initialCapacity: 6 })
  } catch (e) {
    console.warn('OPFS indisponible, base en mémoire (données non conservées)', e)
  }

  const open = (): { db: Database; api: DbApi } => {
    const db = pool ? new pool.OpfsSAHPoolDb(DB_FILE) : new sqlite3.oo1.DB(':memory:', 'c')
    const sql = wrap(db)
    migrate(sql)
    return { db, api: makeApi(sql) }
  }
  let current = open()

  const files: FileApi = {
    exportDb: () => (pool ? pool.exportFile(DB_FILE) : sqlite3.capi.sqlite3_js_db_export(current.db)),
    // L'import remplace le fichier : on ferme, on écrase, on rouvre puis on migre.
    // En cas d'échec (fichier invalide, schéma inconnu), la base précédente est restaurée.
    importDb: async (data: Uint8Array) => {
      if (!pool) throw new Error('Import impossible sans stockage OPFS')
      const previous = pool.exportFile(DB_FILE)
      current.db.close()
      try {
        await pool.importDb(DB_FILE, data)
        current = open()
        current.api.listCategories()
        current.api.listItems('owned')
      } catch (e) {
        try {
          current.db.close()
        } catch {
          // déjà fermée
        }
        await pool.importDb(DB_FILE, previous)
        current = open()
        throw new Error(`Fichier de sauvegarde invalide : ${e instanceof Error ? e.message : String(e)}`)
      }
    },
    storageInfo: () => ({ persisted: pool != null, vfs: pool ? 'opfs-sahpool' : 'memory' }),
  }

  return (method: Request['method']) =>
    (method in files ? files[method as keyof FileApi] : current.api[method as keyof DbApi]) as (
      ...a: unknown[]
    ) => unknown
})()

self.onmessage = async (event: MessageEvent<Request>) => {
  const { id, method, args } = event.data
  let response: Response
  try {
    const resolve = await ready
    response = { id, ok: true, result: await resolve(method)(...args) }
  } catch (e) {
    response = { id, ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  self.postMessage(response)
}

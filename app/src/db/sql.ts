import type { Database } from '@sqlite.org/sqlite-wasm'
import { DEFAULT_SETTINGS, MIGRATIONS } from './schema'

export type SqlValue = string | number | null | Uint8Array
export type Row = Record<string, SqlValue>

/** Accès minimal à SQLite, identique dans le worker (OPFS) et dans les tests Node (mémoire). */
export interface Sql {
  run(sql: string, params?: SqlValue[]): void
  all<T = Row>(sql: string, params?: SqlValue[]): T[]
  transaction(fn: () => void): void
}

export function wrap(db: Database): Sql {
  const sql: Sql = {
    run(text, params = []) {
      db.exec({ sql: text, bind: params.length ? params : undefined })
    },
    all<T>(text: string, params: SqlValue[] = []) {
      return db.exec({
        sql: text,
        bind: params.length ? params : undefined,
        rowMode: 'object',
        returnValue: 'resultRows',
      }) as T[]
    },
    transaction(fn) {
      db.exec('BEGIN')
      try {
        fn()
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  }
  return sql
}

export function migrate(sql: Sql): void {
  sql.run('PRAGMA foreign_keys = ON')
  const [{ user_version: current }] = sql.all<{ user_version: number }>('PRAGMA user_version')
  for (let v = current; v < MIGRATIONS.length; v++) {
    sql.transaction(() => {
      sql.run(MIGRATIONS[v])
      sql.run(`PRAGMA user_version = ${v + 1}`)
    })
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    sql.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value])
  }
}

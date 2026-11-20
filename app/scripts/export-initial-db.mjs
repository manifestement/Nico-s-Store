// Crée la sauvegarde initiale à importer dans l'appli (Réglages > Importer) à partir
// de la collection locale src/db/collection-initiale.md, qui n'est pas dans le dépôt.
// Usage : npm run export:initial  →  ../sauvegarde-initiale.sqlite (ignoré par git)
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'src/db/collection-initiale.md')
const target = resolve(root, '../sauvegarde-initiale.sqlite')

if (!existsSync(source)) {
  console.error(`Fichier introuvable : ${source}`)
  process.exit(1)
}

// Vite charge les modules TypeScript (et l'import ?raw) tels que l'appli les utilise.
const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm')
  const { migrate, wrap } = await vite.ssrLoadModule('/src/db/sql.ts')
  const { seedIfEmpty } = await vite.ssrLoadModule('/src/db/seed.ts')

  const sqlite3 = await sqlite3InitModule()
  const db = new sqlite3.oo1.DB(':memory:', 'c')
  const sql = wrap(db)
  migrate(sql)
  const count = seedIfEmpty(sql)
  if (!count) throw new Error('Aucun article importé : le tableau est-il vide ?')

  const bytes = sqlite3.capi.sqlite3_js_db_export(db)
  writeFileSync(target, bytes)
  console.log(`${count} articles exportés dans ${target} (${(bytes.length / 1024).toFixed(0)} Ko)`)
} finally {
  await vite.close()
}

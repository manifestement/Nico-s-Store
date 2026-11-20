// Migrations SQLite, appliquées dans l'ordre. Une fois l'appli en service, ne plus modifier
// une migration existante : en ajouter une nouvelle à la fin (version dans PRAGMA user_version).
export const MIGRATIONS: string[] = [
  /* 1 */ `
  -- Catégories personnalisables. Le type de taille décide du champ affiché dans le formulaire.
  CREATE TABLE categories (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL UNIQUE,
    icon      TEXT NOT NULL DEFAULT 'box'      -- shoe | cloth | bag | box | star
              CHECK (icon IN ('shoe','cloth','bag','box','star')),
    size_type TEXT NOT NULL DEFAULT 'none'     -- shoe (pointure US) | cloth (XS…XXL) | dim (cm) | none
              CHECK (size_type IN ('shoe','cloth','dim','none')),
    position  INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO categories (name, icon, size_type, position) VALUES
    ('Sneakers', 'shoe', 'shoe', 0),
    ('Vêtements', 'cloth', 'cloth', 1),
    ('Accessoires', 'bag', 'none', 2),
    ('Objets', 'box', 'dim', 3);

  CREATE TABLE items (
    id             INTEGER PRIMARY KEY,
    number         INTEGER,                          -- N° dans la collection
    status         TEXT NOT NULL DEFAULT 'owned'
                   CHECK (status IN ('owned','wishlist','sold')),
    category_id    INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand          TEXT NOT NULL DEFAULT '',
    model          TEXT NOT NULL,
    line           TEXT,                             -- regroupement de la liste (ex. Air Max 1)
    sku            TEXT,
    size_us        REAL,                             -- pointure, en US homme
    size_label     TEXT,                             -- autres tailles : "M", "120 × 80 cm"…
    condition      REAL CHECK (condition IS NULL OR (condition >= 0 AND condition <= 10)), -- 10 = DS
    purchase_price REAL,
    purchase_date  TEXT,
    target_price   REAL,                             -- wishlist : prix visé
    sold_price     REAL,
    sold_date      TEXT,
    value_url      TEXT,                             -- lien de cote (StockX, eBay, Vinted…)
    notes          TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_items_status ON items(status, category_id);

  -- Chaque saisie de cote est conservée : la plus récente est la cote actuelle.
  CREATE TABLE price_history (
    id          INTEGER PRIMARY KEY,
    item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    price       REAL NOT NULL CHECK (price >= 0),
    recorded_at TEXT NOT NULL DEFAULT (date('now'))
  );
  CREATE INDEX idx_price_history_item ON price_history(item_id, recorded_at);

  -- Photos compressées dans la base (avec miniature) : une sauvegarde = un seul fichier .sqlite.
  CREATE TABLE photos (
    id         INTEGER PRIMARY KEY,
    item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL DEFAULT 0,
    mime       TEXT NOT NULL,
    data       BLOB NOT NULL,
    thumb      BLOB,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_photos_item ON photos(item_id, position);

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
]

export const DEFAULT_SETTINGS: Record<string, string> = {
  // Frais de revente StockX (vendeur niveau 1) : commission + frais de paiement en %, envoi en €.
  'fees.transaction_pct': '9',
  'fees.payment_pct': '3',
  'fees.shipping_eur': '7',
  // Décote appliquée à la cote (prix neuf) selon l'état : voir valuation.ts.
  'valuation.used_max_pct': '90',
  'valuation.per_point_pct': '8',
  'backup.last_at': '',
}

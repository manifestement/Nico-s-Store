// Déduit la "ligne" d'un modèle (Air Max 1, Yeezy 350…) pour regrouper la liste.
// L'ordre compte : les motifs les plus précis d'abord.
const LINES: ReadonlyArray<readonly [RegExp, string]> = [
  [/air ?max 1\/97/i, 'Air Max 1'],
  [/air ?max 1000/i, 'Air Max 1000'],
  [/air ?max 1\b/i, 'Air Max 1'],
  [/air ?max 90/i, 'Air Max 90'],
  [/air ?max 95/i, 'Air Max 95'],
  [/air ?max 97/i, 'Air Max 97'],
  [/air ?max 98/i, 'Air Max 98'],
  [/air ?max 270/i, 'Air Max 270'],
  [/air ?max plus|\btn\b/i, 'Air Max Plus (TN)'],
  [/yeezy (boost )?350/i, 'Yeezy 350'],
  [/yeezy (boost )?700/i, 'Yeezy 700'],
  [/yeezy slide/i, 'Yeezy Slide'],
  [/yeezy foam|foam runner/i, 'Yeezy Foam Runner'],
  [/chaussette/i, 'Chaussettes'],
  [/superstar/i, 'Superstar'],
  [/\bmind\b/i, 'Mind 001'],
  [/presto/i, 'Presto'],
  [/zoom fly/i, 'Zoom Fly'],
  [/blazer/i, 'Blazer'],
  [/dunk/i, 'Dunk'],
  [/jumpman/i, 'Jumpman Jack'],
  [/field jaxx/i, 'Zoom Field Jaxx'],
  [/air trainer/i, 'Air Trainer 1'],
  [/vaporwaffle/i, 'Vaporwaffle'],
  [/sacai/i, 'Sacai'],
  [/corteiz/i, 'Corteiz'],
  [/general purpose/i, 'General Purpose Shoe'],
  [/jordan 4\b/i, 'Jordan 4'],
  [/jordan 1\b|\bj1\b/i, 'Jordan 1'],
  [/air force|\baf1\b/i, 'Air Force 1'],
  [/balenciaga.*speed|speed trainer/i, 'Speed Trainer'],
  [/skylon/i, 'Air Skylon 2'],
  [/ma[ck] attack/i, 'Mac Attack'],
  [/cryoshot/i, 'Cryoshot'],
  [/lidl/i, 'Lidl'],
]

/** Ligne connue, sinon les deux premiers mots du modèle ("Hoodie Alcatraz" → "Hoodie Alcatraz"). */
export function inferLine(model: string): string {
  const known = LINES.find(([re]) => re.test(model))
  if (known) return known[1]
  const words = model.trim().split(/\s+/).slice(0, 2).join(' ')
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

export function inferBrand(model: string): string {
  if (/yeezy|adidas/i.test(model)) return 'Adidas'
  if (/balenciaga/i.test(model)) return 'Balenciaga'
  if (/lidl/i.test(model)) return 'Lidl'
  if (/jordan|jumpman|\bj1\b/i.test(model)) return 'Jordan'
  return 'Nike'
}

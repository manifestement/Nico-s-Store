// Palette de l'interface : préférence d'affichage, gardée dans le navigateur (pas dans la base,
// pour qu'une restauration de sauvegarde ne la change pas). Appliquée avant le premier rendu
// par le petit script d'index.html, puis ici quand on la change dans les Réglages.

export type ThemeId = 'cobalt' | 'glacier' | 'indigo' | 'ice'

export const THEMES: { id: ThemeId; name: string; hint: string; swatch: [string, string, string]; bar: string }[] = [
  { id: 'cobalt', name: 'Cobalt', hint: 'Nuit bleue, bleu électrique', swatch: ['#070B16', '#2A62F5', '#38BDF8'], bar: '#070B16' },
  { id: 'glacier', name: 'Glacier', hint: 'Bleu océan, reflets menthe', swatch: ['#061218', '#38BDF8', '#5EEAD4'], bar: '#061218' },
  { id: 'indigo', name: 'Indigo', hint: 'Bleu-violet profond', swatch: ['#090A1C', '#4F5BF0', '#3B82F6'], bar: '#090A1C' },
  { id: 'ice', name: 'Givre', hint: 'Clair, pour le plein jour', swatch: ['#F2F5FB', '#1F56E6', '#38BDF8'], bar: '#F2F5FB' },
]

const KEY = 'sn.theme'

export function currentTheme(): ThemeId {
  const t = document.documentElement.dataset.theme as ThemeId | undefined
  return THEMES.some((x) => x.id === t) ? t! : 'cobalt'
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // stockage indisponible (navigation privée) : le choix vaut pour la session
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', THEMES.find((x) => x.id === id)!.bar)
}

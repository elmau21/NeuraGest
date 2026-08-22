/** Preferencias personales de visibilidad del sidebar (por usuario). */
export type NavVisibilityPrefs = {
  /** `true` = sección oculta */
  sections: Record<string, boolean>
  /** `true` = ítem oculto (path) */
  items: Record<string, boolean>
}

export const NAV_VISIBILITY_CHANGED = 'neuragest:nav-visibility-changed'

const STORAGE_PREFIX = 'neuragest-nav-visibility'

/** Compatibilidad con títulos de sección renombrados en el sidebar. */
const LEGACY_SECTION_KEYS: Record<string, string[]> = {
  'Tu día': ['Tu día', 'Operaciones'],
  Datos: ['Datos', 'Análisis'],
}

function sectionHidden(prefs: NavVisibilityPrefs, sectionTitle: string): boolean {
  const keys = LEGACY_SECTION_KEYS[sectionTitle] ?? [sectionTitle]
  return keys.some((key) => prefs.sections[key] === true)
}

function storageKey(login: string) {
  return `${STORAGE_PREFIX}:${login.toLowerCase()}`
}

export const EMPTY_NAV_VISIBILITY: NavVisibilityPrefs = { sections: {}, items: {} }

export function readNavVisibilityPrefs(login?: string | null): NavVisibilityPrefs {
  if (!login) return EMPTY_NAV_VISIBILITY
  try {
    const raw = localStorage.getItem(storageKey(login))
    if (!raw) return EMPTY_NAV_VISIBILITY
    const parsed = JSON.parse(raw) as Partial<NavVisibilityPrefs>
    return {
      sections: parsed.sections ?? {},
      items: parsed.items ?? {},
    }
  } catch {
    return EMPTY_NAV_VISIBILITY
  }
}

export function saveNavVisibilityPrefs(login: string, prefs: NavVisibilityPrefs): void {
  try {
    localStorage.setItem(storageKey(login), JSON.stringify(prefs))
    window.dispatchEvent(new Event(NAV_VISIBILITY_CHANGED))
  } catch { /* ignore */ }
}

export function isNavSectionHidden(prefs: NavVisibilityPrefs, sectionTitle: string): boolean {
  return sectionHidden(prefs, sectionTitle)
}

export function isNavItemHidden(prefs: NavVisibilityPrefs, path: string, sectionTitle: string): boolean {
  if (sectionHidden(prefs, sectionTitle)) return true
  return prefs.items[path] === true
}

export function setSectionVisibility(
  prefs: NavVisibilityPrefs,
  sectionTitle: string,
  visible: boolean,
): NavVisibilityPrefs {
  const next = { ...prefs, sections: { ...prefs.sections }, items: { ...prefs.items } }
  if (visible) {
    delete next.sections[sectionTitle]
  } else {
    next.sections[sectionTitle] = true
  }
  return next
}

export function setItemVisibility(
  prefs: NavVisibilityPrefs,
  path: string,
  visible: boolean,
): NavVisibilityPrefs {
  const next = { ...prefs, sections: { ...prefs.sections }, items: { ...prefs.items } }
  if (visible) {
    delete next.items[path]
  } else {
    next.items[path] = true
  }
  return next
}

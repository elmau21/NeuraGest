const CACHE_PREFIX = 'ng-cache:'
const RECENT_DOCS_KEY = 'ng-recent-docs'
const MAX_RECENT_DOCS = 40

export type RecentDocument = {
  id: string
  title: string
  path: string
  category?: string
  visitedAt: number
}

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data))
  } catch { /* quota */ }
}

export function trackRecentDocument(doc: Omit<RecentDocument, 'visitedAt'>): void {
  try {
    const current = readCache<RecentDocument[]>(RECENT_DOCS_KEY) ?? []
    const next = [
      { ...doc, visitedAt: Date.now() },
      ...current.filter((item) => item.id !== doc.id),
    ].slice(0, MAX_RECENT_DOCS)
    writeCache(RECENT_DOCS_KEY, next)
  } catch { /* ignore */ }
}

export function getRecentDocuments(query = ''): RecentDocument[] {
  const items = readCache<RecentDocument[]>(RECENT_DOCS_KEY) ?? []
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter(
    (item) => item.title.toLowerCase().includes(q) || item.path.toLowerCase().includes(q),
  )
}

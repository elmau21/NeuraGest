import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ListTodo, Search, Users } from '@/components/icons'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { useTasksStore } from '@/stores/tasks-store'
import { allNavItems, navSections } from '@/services/nav-config'
import { getRecentDocuments } from '@/services/offline-cache'
import {
  canAccessControlCenter,
  canAccessPath,
} from '@/services/permissions'
import {
  isNavItemHidden,
  NAV_VISIBILITY_CHANGED,
  readNavVisibilityPrefs,
} from '@/services/nav-preferences'
import { canViewAudit } from '@/services/audit'
import type { PlatformIcon } from '@/components/icons'

type SearchResult = {
  id: string
  label: string
  hint: string
  to: string
  Icon: PlatformIcon
  group: 'Navegación' | 'Talentos' | 'Tareas' | 'Documentos'
}

type GlobalSearchProps = {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const roles = useAuthStore((s) => s.roles)
  const login = useAuthStore((s) => s.session)?.login
  const talents = useAppStore((s) => s.talents)
  const tasks = useTasksStore((s) => s.tasks)
  const loadTasks = useTasksStore((s) => s.load)
  const showAudit = canViewAudit(roles)
  const showControlCenter = canAccessControlCenter(roles, login)
  const [navPrefs, setNavPrefs] = useState(() => readNavVisibilityPrefs(login))

  useEffect(() => {
    setNavPrefs(readNavVisibilityPrefs(login))
    const onChange = () => setNavPrefs(readNavVisibilityPrefs(login))
    window.addEventListener(NAV_VISIBILITY_CHANGED, onChange)
    return () => window.removeEventListener(NAV_VISIBILITY_CHANGED, onChange)
  }, [login])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    void loadTasks()
  }, [open, loadTasks])

  const navResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allNavItems
      .filter(([to, label]) => {
        if (to === '/ajustes') return false
        if (isNavItemHidden(navPrefs, to, navSections.find((s) => s.items.some(([p]) => p === to))?.title ?? '')) return false
        if (to === '/auditoria' && !showAudit) return false
        if (to === '/control' && !showControlCenter) return false
        if (!canAccessPath(roles, to, login)) return false
        if (!q) return true
        return label.toLowerCase().includes(q) || to.toLowerCase().includes(q)
      })
      .map(([to, label, Icon]): SearchResult => ({
        id: `nav:${to}`,
        label,
        hint: 'Ir a sección',
        to,
        Icon,
        group: 'Navegación',
      }))
  }, [query, navPrefs, roles, login, showAudit, showControlCenter])

  const talentResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return talents
      .filter((t) => t.displayName.toLowerCase().includes(q) || t.login.toLowerCase().includes(q))
      .slice(0, 8)
      .map((t): SearchResult => ({
        id: `talent:${t.login}`,
        label: t.displayName,
        hint: `@${t.login}`,
        to: `/talento/${t.login}`,
        Icon: Users,
        group: 'Talentos',
      }))
  }, [query, talents])

  const taskResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return tasks
      .filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
      .slice(0, 8)
      .map((t): SearchResult => ({
        id: `task:${t.id}`,
        label: t.title,
        hint: t.status,
        to: `/tareas?task=${t.id}`,
        Icon: ListTodo,
        group: 'Tareas',
      }))
  }, [query, tasks])

  const docResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return getRecentDocuments(q)
      .slice(0, 8)
      .map((doc): SearchResult => ({
        id: `doc:${doc.id}`,
        label: doc.title,
        hint: doc.path,
        to: `/documentos?doc=${encodeURIComponent(doc.id)}`,
        Icon: FileText,
        group: 'Documentos',
      }))
  }, [query])

  const results = useMemo(
    () => [...navResults, ...talentResults, ...taskResults, ...docResults],
    [navResults, talentResults, taskResults, docResults],
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)))
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      }
      if (event.key === 'Enter' && results[activeIndex]) {
        event.preventDefault()
        navigate(results[activeIndex].to)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, results, activeIndex, navigate])

  if (!open) return null

  const groups = ['Navegación', 'Talentos', 'Tareas', 'Documentos'] as const

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="command-modal global-search vision-glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Búsqueda global">
        <div className="global-search-input-row">
          <Search size={19} aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar talentos, tareas, documentos…"
            aria-label="Buscar en NeuraGest"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="global-search-results" role="listbox">
          {results.length === 0 ? (
            <p className="global-search-empty">Sin resultados. Prueba con otro término.</p>
          ) : (
            groups.map((group) => {
              const items = results.filter((r) => r.group === group)
              if (items.length === 0) return null
              return (
                <div key={group} className="global-search-group">
                  <span className="global-search-group-label">{group}</span>
                  {items.map((item) => {
                    const index = results.indexOf(item)
                    const active = index === activeIndex
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`global-search-item${active ? ' is-active' : ''}`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          navigate(item.to)
                          onClose()
                        }}
                      >
                        <item.Icon size={17} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />
                        <span className="global-search-item-label">{item.label}</span>
                        <span className="global-search-item-hint">{item.hint}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

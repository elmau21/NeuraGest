import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { ChevronDown, Eye, RefreshCw } from '@/components/icons'
import type { AppRole } from '@/services/app-users'
import { navSections, settingsNav, type NavItem } from '@/services/nav-config'
import {
  EMPTY_NAV_VISIBILITY,
  readNavVisibilityPrefs,
  saveNavVisibilityPrefs,
  setItemVisibility,
  setSectionVisibility,
  type NavVisibilityPrefs,
} from '@/services/nav-preferences'
import {
  canAccessControlCenter,
  canAccessDatosNav,
  canAccessPath,
} from '@/services/permissions'
import { canViewAudit } from '@/services/audit'
import { useAuthStore } from '@/stores/auth-store'
import { toastSuccess } from '@/stores/toast-store'

function permittedItems(
  roles: AppRole[],
  login: string | undefined,
  showAudit: boolean,
  showControlCenter: boolean,
): Array<{ sectionTitle: string; items: NavItem[] }> {
  return navSections
    .map((section) => {
      if (section.title === 'Datos' && !canAccessDatosNav(roles, login)) return null
      const items = section.items.filter(([to]) => {
        if (to === '/auditoria' && !showAudit) return false
        if (to === '/control' && !showControlCenter) return false
        return canAccessPath(roles, to, login)
      })
      if (items.length === 0) return null
      return { sectionTitle: section.title, items: [...items] as NavItem[] }
    })
    .filter((entry): entry is { sectionTitle: string; items: NavItem[] } => entry !== null)
}

function NavSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label
      className={`nav-switch${disabled ? ' nav-switch--disabled' : ''}`}
      title={label}
      onClick={(e) => e.stopPropagation()}
    >
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
      <span className="nav-switch-track" aria-hidden />
      <span className="nav-switch-thumb" aria-hidden />
      <span className="nav-switch-sr">{label}</span>
    </label>
  )
}

export function NavVisibilitySettings() {
  const session = useAuthStore((s) => s.session)
  const roles = useAuthStore((s) => s.roles)
  const login = session?.login
  const showAudit = canViewAudit(roles)
  const showControlCenter = canAccessControlCenter(roles, login)

  const groups = useMemo(
    () => permittedItems(roles, login, showAudit, showControlCenter),
    [roles, login, showAudit, showControlCenter],
  )

  const [prefs, setPrefs] = useState<NavVisibilityPrefs>(() => readNavVisibilityPrefs(login))
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map(({ sectionTitle }) => [sectionTitle, true])),
  )

  useEffect(() => {
    setPrefs(readNavVisibilityPrefs(login))
  }, [login])

  useEffect(() => {
    setExpanded((current) => {
      const next = { ...current }
      for (const { sectionTitle } of groups) {
        if (next[sectionTitle] === undefined) next[sectionTitle] = true
      }
      return next
    })
  }, [groups])

  const persist = (next: NavVisibilityPrefs) => {
    if (!login) return
    setPrefs(next)
    saveNavVisibilityPrefs(login, next)
    setSaved(true)
    toastSuccess('Menú actualizado')
    window.setTimeout(() => setSaved(false), 1500)
  }

  const toggleSection = (sectionTitle: string, visible: boolean) => {
    persist(setSectionVisibility(prefs, sectionTitle, visible))
  }

  const toggleItem = (path: string, visible: boolean) => {
    persist(setItemVisibility(prefs, path, visible))
  }

  const resetDefaults = () => {
    persist(EMPTY_NAV_VISIBILITY)
  }

  const toggleExpanded = (sectionTitle: string) => {
    setExpanded((current) => ({ ...current, [sectionTitle]: !current[sectionTitle] }))
  }

  if (groups.length === 0) return null

  const settingsVisible = canAccessPath(roles, settingsNav[0], login)
  const [, settingsLabel, SettingsIcon] = settingsNav

  return (
    <div className="card nav-visibility-panel">
      <div className="nav-visibility-head">
        <div>
          <h3><Eye size={16} /> Qué quieres ver</h3>
          <p>
            Elige qué secciones e ítems aparecen en tu menú lateral. Solo puedes ocultar lo que tu
            rol ya te permite usar.
          </p>
        </div>
        <button type="button" className="secondary" onClick={resetDefaults}>
          <RefreshCw size={14} /> Restablecer defaults
        </button>
      </div>

      {saved && <p className="integration-note nav-visibility-saved">Cambios guardados</p>}

      <div className="nav-visibility-accordion">
        {groups.map(({ sectionTitle, items }) => {
          const sectionHidden = prefs.sections[sectionTitle] === true
          const visibleCount = sectionHidden
            ? 0
            : items.filter(([path]) => prefs.items[path] !== true).length
          const isExpanded = expanded[sectionTitle] !== false

          return (
            <div
              className={`nav-visibility-section${isExpanded ? '' : ' nav-visibility-section--collapsed'}`}
              key={sectionTitle}
            >
              <div className="nav-visibility-section-header">
                <button
                  type="button"
                  className="nav-visibility-section-toggle"
                  onClick={() => toggleExpanded(sectionTitle)}
                  aria-expanded={isExpanded}
                >
                  <ChevronDown
                    size={14}
                    strokeWidth={1.6}
                    className={`nav-visibility-chevron${isExpanded ? '' : ' collapsed'}`}
                  />
                  <span className="nav-visibility-section-title">{sectionTitle}</span>
                  <span className="nav-visibility-section-count">
                    {visibleCount}/{items.length} visibles
                  </span>
                </button>
                <div className="nav-visibility-section-master">
                  <span className="nav-visibility-master-label">Toda la sección</span>
                  <NavSwitch
                    checked={!sectionHidden}
                    label={`Mostrar sección ${sectionTitle}`}
                    onChange={(e) => toggleSection(sectionTitle, e.target.checked)}
                  />
                </div>
              </div>

              <div className="nav-visibility-section-body">
                <div className="nav-visibility-section-body-inner">
                  <div className="nav-visibility-items">
                    {items.map(([path, label, Icon]) => {
                      const itemVisible = !sectionHidden && prefs.items[path] !== true
                      return (
                        <label
                          className={`nav-visibility-item${sectionHidden ? ' nav-visibility-item--disabled' : ''}${itemVisible ? '' : ' nav-visibility-item--hidden'}`}
                          key={path}
                        >
                          <span className="nav-visibility-item-icon" aria-hidden>
                            <Icon size={15} strokeWidth={1.6} />
                          </span>
                          <span className="nav-visibility-item-label">{label}</span>
                          <NavSwitch
                            checked={itemVisible}
                            disabled={sectionHidden}
                            label={itemVisible ? `Ocultar ${label}` : `Mostrar ${label}`}
                            onChange={(e) => toggleItem(path, e.target.checked)}
                          />
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {settingsVisible && (
          <div className="nav-visibility-section nav-visibility-section--solo">
            <label
              className={`nav-visibility-item nav-visibility-item--solo${prefs.items[settingsNav[0]] !== true ? '' : ' nav-visibility-item--hidden'}`}
            >
              <span className="nav-visibility-item-icon" aria-hidden>
                <SettingsIcon size={15} strokeWidth={1.6} />
              </span>
              <span className="nav-visibility-item-label">{settingsLabel}</span>
              <NavSwitch
                checked={prefs.items[settingsNav[0]] !== true}
                label={prefs.items[settingsNav[0]] !== true ? 'Ocultar Ajustes' : 'Mostrar Ajustes'}
                onChange={(e) => toggleItem(settingsNav[0], e.target.checked)}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

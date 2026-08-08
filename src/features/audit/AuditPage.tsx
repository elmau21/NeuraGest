import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Shield } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { AUDIT_FILTER_LABELS, canViewAudit, fetchAuditActivity, type AuditFilter } from '@/services/audit'
import type { ActivityItem } from '@/services/activity'
import { useAuthStore } from '@/stores/auth-store'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return new Date(iso).toLocaleDateString('es-MX')
}

function actorSubtitle(item: ActivityItem): string | null {
  if (item.actorLogin) {
    const name = item.actorName?.trim()
    if (name && name.toLowerCase() !== item.actorLogin.toLowerCase()) {
      return `${name} · @${item.actorLogin}`
    }
    return `@${item.actorLogin}`
  }
  return item.actorName ?? null
}

export function AuditPage() {
  const roles = useAuthStore((s) => s.roles)
  const [filter, setFilter] = useState<AuditFilter>('all')
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchAuditActivity(filter, 80))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  if (!canViewAudit(roles)) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Auditoría</h1>
          <p>Quién hizo qué: contratos, tareas, wiki, roles, CRM, sesiones y más.</p>
        </div>
        <button className="secondary" disabled={loading} onClick={() => void load()}><RefreshCw size={16}/></button>
      </div>

      <div className="view-tabs">
        {(Object.keys(AUDIT_FILTER_LABELS) as AuditFilter[]).map((key) => (
          <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
            {AUDIT_FILTER_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="activity-list ops-audit-list">
          {loading ? <p className="empty-state">Cargando auditoría…</p> : items.length === 0 ? (
            <p className="empty-state"><Shield size={20}/> Sin eventos para este filtro.</p>
          ) : items.map((item) => {
            const who = actorSubtitle(item)
            return (
              <div key={item.id} className="activity-row ops-audit-row">
                <span>{relativeTime(item.createdAt)}</span>
                <p>{item.label}</p>
                {who ? <small>{who}</small> : null}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

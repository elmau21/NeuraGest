import { useCallback, useEffect, useState } from 'react'
import { Image, RefreshCw } from '@/components/icons'
import {
  INSTAGRAM_MONTHLY_DISCLAIMER,
  syncInstagramMonthlyStatus,
  type InstagramPortfolioTotals,
} from '@/services/instagram-monthly'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'
import { toastError, toastSuccess } from '@/stores/toast-store'

type Props = {
  compact?: boolean
  onSynced?: () => void
}

export function InstagramMonthlyPanel({ compact, onSynced }: Props) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<InstagramPortfolioTotals | null>(null)
  const [error, setError] = useState<string | null>(null)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await syncInstagramMonthlyStatus()
      setStatus(next)
      return next
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload().catch(() => undefined)
  }, [reload])

  const run = async () => {
    if (readonly) return
    try {
      const next = await reload()
      toastSuccess(
        next.handles > 0
          ? `IG mensual · ${next.followers.toLocaleString('es-MX')} followers · ${next.handles} handles`
          : 'Sin snapshot IG del mes — pide sync al equipo',
      )
      onSynced?.()
    } catch {
      toastError('No se pudo cargar el snapshot IG mensual')
    }
  }

  const monthLabel = status?.month
    ? status.month.slice(0, 7)
    : '—'
  const lastSync = status?.syncedAt
    ? new Date(status.syncedAt).toLocaleString('es-MX')
    : 'Nunca'

  if (compact) {
    return (
      <button
        className="secondary ti-instagram-monthly"
        disabled={readonly || loading}
        onClick={() => void run()}
        title={error ? `Error: ${error}` : INSTAGRAM_MONTHLY_DISCLAIMER}
      >
        <Image size={14} />
        {loading ? 'Cargando IG…' : 'Sync IG mensual'}
      </button>
    )
  }

  return (
    <div className="card">
      <h3><Image size={16} /> Instagram mensual</h3>
      <p>{INSTAGRAM_MONTHLY_DISCLAIMER}</p>
      <div className="twitchtracker-status">
        <span>Mes: {monthLabel}</span>
        {status && (
          <>
            <span> · {status.handles} handles</span>
            <span> · {status.followers.toLocaleString('es-MX')} followers</span>
          </>
        )}
        <span> · Última sync: {loading ? '…' : lastSync}</span>
      </div>
      {error && <p className="integration-error">{error}</p>}
      <button className="secondary" disabled={readonly || loading} onClick={() => void run()}>
        <RefreshCw size={14} />{loading ? 'Cargando…' : 'Sync IG mensual'}
      </button>
    </div>
  )
}

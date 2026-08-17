import { useCallback, useEffect, useState } from 'react'
import { BarChart3, RefreshCw } from '@/components/icons'
import {
  fetchTwitchTrackerSyncStatus,
  syncTwitchTracker,
  type TwitchTrackerSyncStatus,
} from '@/services/twitchtracker'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'
import { toastError, toastSuccess } from '@/stores/toast-store'

type Props = {
  compact?: boolean
  onSynced?: () => void
}

export function TwitchTrackerPanel({ compact, onSynced }: Props) {
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<TwitchTrackerSyncStatus | null>(null)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)

  const reloadStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const next = await fetchTwitchTrackerSyncStatus()
      setStatus(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadStatus()
  }, [reloadStatus])

  const run = async () => {
    if (readonly) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const summary = await syncTwitchTracker()
      const errorPreview = summary.errors.length
        ? ` · ${summary.errors.slice(0, 2).join(' · ')}`
        : ''
      setResult(`${summary.synced} guardados · ${summary.skipped} omitidos · ${summary.errors.length} errores${errorPreview}`)
      toastSuccess('Sincronizado')
      await reloadStatus()
      onSynced?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      toastError('No se pudo sincronizar')
    } finally {
      setLoading(false)
    }
  }

  const lastSyncLabel = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString('es-MX')
    : 'Nunca'

  if (compact) {
    return (
      <button
        className="secondary ti-twitchtracker"
        disabled={readonly || loading}
        onClick={() => void run()}
        title={result ?? (error ? `Error: ${error}` : 'Sincronizar historial externo')}
      >
        <BarChart3 size={14} />
        {loading ? 'Sincronizando…' : 'Sincronizar historial'}
      </button>
    )
  }

  return (
    <div className="card">
      <h3><BarChart3 size={16}/> Estadísticas externas</h3>
      <p>Importa resúmenes de 30 días para enriquecer pronósticos.</p>

      <div className="twitchtracker-status">
        <span>Última sync: {statusLoading ? '…' : lastSyncLabel}</span>
        {status && (
          <>
            <span> · {status.lastSyncedCount} talentos</span>
            <span> · {status.totalSnapshots} registros</span>
            {status.lastErrorCount > 0 && <span> · {status.lastErrorCount} errores</span>}
          </>
        )}
      </div>

      <button className="secondary" disabled={readonly || loading} onClick={() => void run()}>
        <RefreshCw size={14}/>{loading ? 'Sincronizando…' : 'Sincronizar'}
      </button>

      {result && <p className="integration-note">{result}</p>}
      {error && <p className="integration-note integration-error">{error}</p>}
      {status?.lastErrors?.length ? (
        <ul className="twitchtracker-errors">
          {status.lastErrors.slice(0, 8).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

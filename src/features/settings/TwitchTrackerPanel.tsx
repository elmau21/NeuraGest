import { useCallback, useEffect, useState } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'
import {
  fetchTwitchTrackerSyncStatus,
  syncTwitchTracker,
  TWITCHTRACKER_DISCLAIMER,
  type TwitchTrackerSyncStatus,
} from '@/services/twitchtracker'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'

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
      await reloadStatus()
      onSynced?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const lastSyncLabel = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString('es-MX')
    : 'Nunca'

  if (compact) {
    const syncHint = result ?? (error ? `Error: ${error}` : undefined)
    return (
      <button
        className="secondary ti-twitchtracker"
        disabled={readonly || loading}
        onClick={() => void run()}
        title={syncHint ?? TWITCHTRACKER_DISCLAIMER}
      >
        <BarChart3 size={14} />
        {loading ? 'Sincronizando…' : 'Sincronizar historial externo'}
      </button>
    )
  }

  return (
    <div className="card">
      <h3><BarChart3 size={16}/> Estadísticas externas</h3>
      <p>
        Importa resúmenes rolling de 30 días (CCV avg/peak, horas, followers) para enriquecer modelos de pronóstico.
      </p>
      <p className="integration-note">{TWITCHTRACKER_DISCLAIMER}</p>

      <div className="twitchtracker-status">
        <span>Última sincronización: {statusLoading ? '…' : lastSyncLabel}</span>
        {status && (
          <>
            <span> · {status.lastSyncedCount} talentos</span>
            <span> · {status.totalSnapshots} registros totales</span>
            {status.lastErrorCount > 0 && <span> · {status.lastErrorCount} errores</span>}
          </>
        )}
      </div>

      <button className="secondary" disabled={readonly || loading} onClick={() => void run()}>
        <RefreshCw size={14}/>{loading ? 'Sincronizando historial externo…' : 'Sincronizar historial externo (roster)'}
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

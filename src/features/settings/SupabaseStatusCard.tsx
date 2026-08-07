import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { checkSupabaseHealth, type SupabaseHealthStatus } from '@/services/supabase-health'

export function SupabaseStatusCard() {
  const [health, setHealth] = useState<SupabaseHealthStatus>({
    configured: false,
    status: 'checking',
    hasSupabaseAuthSession: false,
    authMode: 'twitch_sqlite',
  })

  const refresh = useCallback(async () => {
    setHealth((current) => ({ ...current, status: current.configured ? 'checking' : 'no_credentials' }))
    setHealth(await checkSupabaseHealth())
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const connected = health.status === 'connected'
  const checking = health.status === 'checking'
  const healthOk = connected && health.dbOk !== false

  const statusLabel = checking
    ? 'Comprobando…'
    : health.status === 'no_credentials'
      ? 'Sin credenciales'
      : healthOk
        ? 'OK'
        : 'Error'

  const detail = checking
    ? '…'
    : health.status === 'no_credentials'
      ? 'Falta .env'
      : connected
        ? [
            health.latencyMs != null ? `${health.latencyMs} ms` : null,
            health.lastCheckedAt
              ? `sync ${new Date(health.lastCheckedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
              : null,
          ].filter(Boolean).join(' · ')
        : health.error ?? 'Sin conexión'

  const dotClass = checking ? 'pending-dot' : healthOk ? 'online-dot' : 'offline-dot'

  return (
    <div className="card supabase-status-card">
      <h3>Base de datos</h3>
      <div className={`connection supabase-connection supabase-connection-compact ${health.status}`}>
        <div className={dotClass} aria-hidden />
        <div className="supabase-status-body">
          <b>{statusLabel}</b>
          <span>{detail}</span>
        </div>
        <button className="secondary" disabled={checking} onClick={() => void refresh()} aria-label="Reintentar comprobación">
          <RefreshCw size={14}/>
        </button>
      </div>
    </div>
  )
}

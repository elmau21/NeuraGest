import { useState } from 'react'
import { Download, History } from 'lucide-react'
import { backfillMetricsClips } from '@/services/helix-profiles'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'

type Props = {
  compact?: boolean
}

export function BackfillPanel({ compact }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)

  const run = async () => {
    if (readonly) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const summary = await backfillMetricsClips(30)
      setResult(`${summary.clipsPersisted} clips · ${summary.metricsSnapshots} capturas · historial de ${summary.days ?? 30} días`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <button className="secondary ti-backfill" disabled={readonly || loading} onClick={() => void run()} title="Importar historial de 30 días">
        <History size={14}/>{loading ? 'Importando…' : 'Historial 30d'}
      </button>
    )
  }

  return (
    <div className="card">
      <h3><History size={16}/> Importar historial</h3>
      <p>Trae clips y métricas de los últimos 30 días.</p>
      <button className="secondary" disabled={readonly || loading} onClick={() => void run()}>
        <Download size={14}/>{loading ? 'Importando…' : 'Importar 30 días'}
      </button>
      {result && <p className="integration-note">{result}</p>}
      {error && <p className="integration-note">{error}</p>}
    </div>
  )
}

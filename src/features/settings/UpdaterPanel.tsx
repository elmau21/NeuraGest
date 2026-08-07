import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { checkForAppUpdate, installAppUpdate, type UpdateCheckResult } from '@/services/updater'

export function UpdaterPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)

  const check = async () => {
    setLoading(true)
    const info = await checkForAppUpdate()
    setResult(info)
    setLoading(false)
  }

  const install = async () => {
    setLoading(true)
    const info = await installAppUpdate()
    setResult(info)
    setLoading(false)
  }

  const message = result
    ? result.status === 'available'
      ? `Disponible: v${result.version}${result.notes ? ` — ${result.notes}` : ''}`
      : result.status === 'up-to-date'
        ? `Al día (v${result.currentVersion})`
        : result.status === 'installed'
          ? `Instalado v${result.version}. Reinicia NeuraGest para aplicar.`
          : result.message
    : null

  return (
    <div className="card">
      <h3>Actualizaciones</h3>
      <p>Canal estable · versión 1.0.0. Requiere configuración de firma (ver documentación de publicación).</p>
      <div className="settings-session-actions">
        <button className="secondary" disabled={loading} onClick={() => void check()}>
          <RefreshCw size={15}/>{loading ? 'Comprobando…' : 'Buscar actualizaciones'}
        </button>
        {result?.status === 'available' && (
          <button className="primary" disabled={loading} onClick={() => void install()}>
            Instalar v{result.version}
          </button>
        )}
      </div>
      {message && <p className="integration-note">{message}</p>}
    </div>
  )
}

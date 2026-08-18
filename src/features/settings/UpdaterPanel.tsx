import { useState } from 'react'
import { RefreshCw } from '@/components/icons'
import { checkForAppUpdate, getAppVersion, installAppUpdate, type UpdateCheckResult } from '@/services/updater'

export function UpdaterPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const currentVersion = getAppVersion()

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
      ? `Hay una actualización disponible: v${result.version}${result.notes ? ` — ${result.notes}` : ''}`
      : result.status === 'up-to-date'
        ? `NeuraGest está al día (v${result.currentVersion})`
        : result.status === 'installed'
          ? `Actualización v${result.version} instalada. Reinicia NeuraGest para aplicar los cambios.`
          : result.message
    : null

  return (
    <div className="card">
      <h3>Actualizaciones</h3>
      <p>Versión instalada: v{currentVersion}. NeuraGest puede actualizarse automáticamente cuando publiques un release.</p>
      <div className="settings-session-actions">
        <button className="secondary" disabled={loading} onClick={() => void check()}>
          <RefreshCw size={15}/>{loading ? 'Comprobando…' : 'Buscar actualizaciones'}
        </button>
        {result?.status === 'available' && (
          <button className="primary" disabled={loading} onClick={() => void install()}>
            Actualizar ahora (v{result.version})
          </button>
        )}
      </div>
      {message && <p className="integration-note">{message}</p>}
    </div>
  )
}

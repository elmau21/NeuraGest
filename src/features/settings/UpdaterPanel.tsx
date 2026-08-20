import { useState } from 'react'
import { RefreshCw } from '@/components/icons'
import { checkForAppUpdate, getAppVersion, type UpdateCheckResult } from '@/services/updater'
import { useUpdatePromptStore } from '@/stores/update-prompt-store'

export function UpdaterPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const currentVersion = getAppVersion()
  const promptOpen = useUpdatePromptStore((s) => s.open)
  const promptPhase = useUpdatePromptStore((s) => s.phase)

  const check = async () => {
    setLoading(true)
    const info = await checkForAppUpdate()
    setResult(info)
    setLoading(false)
    if (info.status === 'available') {
      useUpdatePromptStore.getState().offer(
        { version: info.version, notes: info.notes },
        { force: true },
      )
    }
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

  const searching = loading || (promptOpen && (promptPhase === 'downloading' || promptPhase === 'installing'))

  return (
    <div className="card">
      <h3>Actualizaciones</h3>
      <p>Versión instalada: v{currentVersion}. NeuraGest puede actualizarse automáticamente cuando publiques un release.</p>
      <div className="settings-session-actions">
        <button className="secondary" disabled={searching} onClick={() => void check()}>
          <RefreshCw size={15}/>{loading ? 'Comprobando…' : 'Buscar actualizaciones'}
        </button>
        {result?.status === 'available' && !promptOpen && (
          <button
            className="primary"
            disabled={searching}
            onClick={() =>
              useUpdatePromptStore.getState().offer(
                { version: result.version, notes: result.notes },
                { force: true },
              )
            }
          >
            Actualizar ahora (v{result.version})
          </button>
        )}
      </div>
      {message && <p className="integration-note">{message}</p>}
    </div>
  )
}

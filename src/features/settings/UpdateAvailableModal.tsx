import { Download, Loader2, RefreshCw, X } from '@/components/icons'
import { useUpdatePromptStore } from '@/stores/update-prompt-store'

export function UpdateAvailableModal() {
  const open = useUpdatePromptStore((s) => s.open)
  const version = useUpdatePromptStore((s) => s.version)
  const notes = useUpdatePromptStore((s) => s.notes)
  const phase = useUpdatePromptStore((s) => s.phase)
  const percent = useUpdatePromptStore((s) => s.percent)
  const errorMessage = useUpdatePromptStore((s) => s.errorMessage)
  const dismiss = useUpdatePromptStore((s) => s.dismiss)
  const install = useUpdatePromptStore((s) => s.install)

  if (!open || !version) return null

  const busy = phase === 'downloading' || phase === 'installing'
  const done = phase === 'done'

  const title = done
    ? 'Actualización lista'
    : phase === 'error'
      ? 'No se pudo actualizar'
      : 'Actualización disponible'

  const body = done
    ? `La versión ${version} ya está instalada. Cierra y vuelve a abrir NeuraGest para usarla.`
    : phase === 'error'
      ? (errorMessage ?? 'Algo salió mal al descargar la actualización. Inténtalo de nuevo más tarde.')
      : `Hay una versión nueva de NeuraGest (v${version}). Puedes instalarla ahora o seguir trabajando y hacerlo después.`

  const progressLabel =
    phase === 'installing'
      ? 'Instalando…'
      : percent != null
        ? `Descargando… ${percent}%`
        : 'Descargando…'

  return (
    <div
      className="modal-backdrop update-prompt-backdrop"
      onClick={() => {
        if (!busy) dismiss()
      }}
    >
      <div
        className="agency-modal card update-prompt-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-prompt-title"
      >
        <div className="update-prompt-head">
          <div className="update-prompt-icon" aria-hidden>
            {busy ? <Loader2 size={18} className="ml-spin" /> : <Download size={18} />}
          </div>
          <div className="update-prompt-head-text">
            <h3 id="update-prompt-title">{title}</h3>
            {!done && phase !== 'error' && (
              <span className="update-prompt-version">v{version}</span>
            )}
          </div>
          {!busy && (
            <button
              type="button"
              className="update-prompt-close"
              onClick={() => dismiss()}
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <p className="update-prompt-body">{body}</p>

        {notes && !done && phase !== 'error' && !busy && (
          <p className="update-prompt-notes">{notes}</p>
        )}

        {busy && (
          <div className="update-prompt-progress" aria-live="polite">
            <div className="update-prompt-progress-track">
              <div
                className="update-prompt-progress-bar"
                style={{ width: percent != null ? `${percent}%` : '35%' }}
                data-indeterminate={percent == null ? 'true' : undefined}
              />
            </div>
            <span>{progressLabel}</span>
          </div>
        )}

        <div className="agency-modal-actions">
          {done || phase === 'error' ? (
            <button type="button" className="secondary" onClick={() => dismiss()}>
              Cerrar
            </button>
          ) : (
            <>
              <button type="button" className="secondary" disabled={busy} onClick={() => dismiss()}>
                Más tarde
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => void install()}
              >
                {busy ? (
                  <>
                    <Loader2 size={15} className="ml-spin" />
                    Actualizando…
                  </>
                ) : (
                  <>
                    <RefreshCw size={15} />
                    Actualizar ahora
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { motion } from 'framer-motion'
import { Check, ExternalLink, Loader2, Radio, XCircle } from '@/components/icons'
import type { OAuthFlowPhase } from '@/stores/auth-store'

type Props = {
  phase: OAuthFlowPhase
  error: string | null
  onCancel: () => void
  onRetry: () => void
}

export function OAuthWaitingPanel({ phase, error, onCancel, onRetry }: Props) {
  if (phase === 'idle') return null

  return (
    <motion.div
      className="auth-device-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {phase === 'error' ? (
        <div className="auth-device-error">
          <XCircle size={22} />
          <div>
            <b>No se pudo completar la autorización</b>
            <p>{error ?? 'Intenta de nuevo.'}</p>
          </div>
          <div className="auth-device-actions">
            <button type="button" className="auth-twitch-btn" onClick={onRetry}>
              <Radio size={17} />
              Reintentar
            </button>
            <button type="button" className="auth-secondary-btn" onClick={onCancel}>
              Volver
            </button>
          </div>
        </div>
      ) : phase === 'success' ? (
        <div className="auth-device-success">
          <Check size={22} />
          <div>
            <b>Sesión iniciada</b>
            <p>Entrando al panel de operaciones…</p>
          </div>
        </div>
      ) : (
        <>
          <div className="auth-device-head">
            <span>Autoriza NeuraGest con Twitch</span>
            <small>{phase === 'waiting' ? 'Ventana de acceso abierta' : 'Preparando…'}</small>
          </div>

          <p className="auth-device-copy">
            {phase === 'waiting'
              ? 'Completa el acceso a Twitch en la ventana de NeuraGest (no en Arc/Chrome). Al autorizar, esa ventana se cierra sola.'
              : 'Preparando el retorno seguro a la app. Se abrirá una ventana de acceso Twitch en un momento.'}
          </p>

          <div className="auth-device-actions">
            <button type="button" className="auth-twitch-btn" disabled>
              <ExternalLink size={16} />
              {phase === 'waiting' ? 'Esperando autorización…' : 'Preparando…'}
            </button>
            <button type="button" className="auth-secondary-btn" onClick={onCancel}>
              Cancelar
            </button>
          </div>

          <div className="auth-device-waiting">
            <Loader2 size={16} className="spinning" />
            <span>
              {phase === 'opening'
                ? 'Preparando inicio de sesión seguro con Twitch…'
                : 'Esperando que completes la autorización en Twitch…'}
            </span>
          </div>
        </>
      )}
    </motion.div>
  )
}

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Radio } from '@/components/icons'
import { OAuthWaitingPanel } from '@/features/auth/OAuthWaitingPanel'
import { neuraliveLogotype } from '@/assets/brand'
import { useAuthStore } from '@/stores/auth-store'
import { isTauri } from '@/services/twitch'
import { toastError } from '@/stores/toast-store'

export function LoginScreen() {
  const oauthFlow = useAuthStore((s) => s.oauthFlow)
  const error = useAuthStore((s) => s.error)
  const startTwitchLogin = useAuthStore((s) => s.startTwitchLogin)
  const cancelOAuthFlow = useAuthStore((s) => s.cancelOAuthFlow)

  const isBusy = oauthFlow === 'opening' || oauthFlow === 'waiting'
  const showOAuthPanel = oauthFlow !== 'idle'

  useEffect(() => {
    if (oauthFlow === 'success') {
      const timer = window.setTimeout(() => cancelOAuthFlow(), 1200)
      return () => window.clearTimeout(timer)
    }
  }, [oauthFlow, cancelOAuthFlow])

  useEffect(() => {
    if (!error) return
    if (oauthFlow === 'idle' || oauthFlow === 'error') {
      toastError('No se pudo iniciar sesión. Inténtalo de nuevo.')
    }
  }, [error, oauthFlow])

  return (
    <div className="auth-screen">
      <div className="auth-bg-glow auth-bg-glow--purple" />
      <div className="auth-bg-glow auth-bg-glow--blue" />

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="auth-brand">
          <img
            src={neuraliveLogotype}
            alt="NeuraGest by NeuraLive"
            className="auth-brand-logotype"
            draggable={false}
          />
        </div>

        <motion.div
          className="auth-hero"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.4 }}
        >
          <span className="auth-overline">CENTRO DE OPERACIONES TWITCH</span>
          <h1>Gestiona talentos con precisión</h1>
          <p>
            Inicia sesión con tu cuenta Twitch para acceder al panel de operaciones,
            analítica y gestión de la agencia.
          </p>
        </motion.div>

        {!showOAuthPanel ? (
          <motion.div
            className="auth-cta-block"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <button
              type="button"
              className="auth-twitch-btn auth-twitch-btn--hero"
              disabled={isBusy}
              onClick={() => void startTwitchLogin()}
            >
              <Radio size={18} />
              Continuar con Twitch
            </button>
            {!isTauri && (
              <p className="auth-note auth-note--warn">
                Ejecuta la app de escritorio NeuraGest para autenticarte.
              </p>
            )}
            {error && oauthFlow === 'idle' && (
              <p className="auth-note auth-note--error">{error}</p>
            )}
            <p className="auth-note">
              NeuraGest inicia sesión con tu cuenta Twitch de forma segura. La sesión se guarda en este
              equipo y se restaura al volver a abrir la app.
            </p>
          </motion.div>
        ) : (
          <OAuthWaitingPanel
            phase={oauthFlow}
            error={error}
            onCancel={cancelOAuthFlow}
            onRetry={() => void startTwitchLogin()}
          />
        )}

        <footer className="auth-footer">
          <span>NeuraLive · Gestión profesional de talentos</span>
        </footer>
      </motion.div>
    </div>
  )
}

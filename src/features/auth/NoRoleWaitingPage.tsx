import { motion } from 'framer-motion'
import { Clock, LogOut } from '@/components/icons'
import { neuraliveLogotype } from '@/assets/brand'
import { useAuthStore } from '@/stores/auth-store'

export function NoRoleWaitingPage() {
  const session = useAuthStore((s) => s.session)
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="auth-screen no-role-screen">
      <div className="auth-bg-glow auth-bg-glow--purple" />
      <div className="auth-bg-glow auth-bg-glow--blue" />

      <motion.div
        className="auth-card no-role-card"
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

        <div className="no-role-icon-wrap" aria-hidden>
          <Clock size={28} strokeWidth={1.5} />
        </div>

        <div className="auth-hero no-role-hero">
          <span className="auth-overline">CUENTA EN REVISIÓN</span>
          <h1>Tu acceso está en camino</h1>
          <p>
            Hola{session?.displayName ? `, ${session.displayName}` : ''}. Tu cuenta ya está vinculada,
            pero aún no tienes un rol asignado en NeuraGest.
          </p>
          <p className="no-role-sub">
            El equipo de NeuraLive configurará tus permisos pronto. Cuando te asignen un rol,
            verás las secciones que correspondan a tu trabajo — no necesitas hacer nada más por ahora.
          </p>
        </div>

        {session && (
          <div className="connection oauth-connection session-connection no-role-session">
            {session.avatarUrl
              ? <img src={session.avatarUrl} alt="" className="session-avatar" />
              : <div className="avatar-placeholder">{session.displayName.slice(0, 2).toUpperCase()}</div>}
            <div>
              <b>{session.displayName}</b>
              <span>@{session.login}</span>
            </div>
          </div>
        )}

        <div className="no-role-actions">
          <p className="no-role-tip">
            Si crees que deberías tener acceso ya, avisa a tu manager o al equipo de NeuraLive.
          </p>
          <button type="button" className="secondary ghost-btn" onClick={() => void logout()}>
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </motion.div>
    </div>
  )
}

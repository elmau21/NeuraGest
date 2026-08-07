import { motion } from 'framer-motion'
import { neuralivePrimary } from '@/assets/brand'

export function SplashScreen() {
  return (
    <div className="splash-screen" aria-live="polite" aria-busy="true">
      <div className="splash-glow splash-glow--purple" />
      <div className="splash-glow splash-glow--blue" />

      <motion.div
        className="splash-logo-wrap"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <img
          src={neuralivePrimary}
          alt="NeuraLive"
          className="splash-logo"
          draggable={false}
        />
      </motion.div>

      <motion.p
        className="splash-status"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        Cargando…
      </motion.p>
    </div>
  )
}

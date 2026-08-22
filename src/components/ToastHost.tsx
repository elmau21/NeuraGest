import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, CircleAlert, Info, X } from '@/components/icons'
import { useToastStore } from '@/stores/toast-store'

const TOAST_ICONS = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
} as const

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  const reduceMotion = useReducedMotion()

  return (
    <div className="toast-host" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = TOAST_ICONS[toast.tone]
          return (
          <motion.div
            key={toast.id}
            className={`toast-item toast-${toast.tone}`}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
          >
            <Icon className="toast-icon" size={16} strokeWidth={1.6} aria-hidden />
            <span>{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.onClick()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Cerrar aviso"
              onClick={() => dismiss(toast.id)}
            >
              <X size={13} />
            </button>
          </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

import { create } from 'zustand'
import { installAppUpdate, type UpdateInstallProgress } from '@/services/updater'

const SESSION_DISMISS_KEY = 'neuragest-update-dismissed'

export type UpdatePromptPhase = 'prompt' | 'downloading' | 'installing' | 'done' | 'error'

type UpdatePromptState = {
  open: boolean
  version: string | null
  notes?: string
  phase: UpdatePromptPhase
  percent: number | null
  errorMessage?: string
  /** Abre el modal si hay update. Con force=true ignora el dismiss de sesión (p. ej. Buscar en Ajustes). */
  offer: (info: { version: string; notes?: string }, options?: { force?: boolean }) => boolean
  dismiss: () => void
  install: () => Promise<void>
}

function wasDismissed(version: string) {
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === version
  } catch {
    return false
  }
}

function markDismissed(version: string) {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, version)
  } catch {
    /* ignore */
  }
}

export const useUpdatePromptStore = create<UpdatePromptState>((set, get) => ({
  open: false,
  version: null,
  notes: undefined,
  phase: 'prompt',
  percent: null,
  errorMessage: undefined,

  offer: (info, options) => {
    if (!info.version) return false
    if (!options?.force && wasDismissed(info.version)) return false
    set({
      open: true,
      version: info.version,
      notes: info.notes,
      phase: 'prompt',
      percent: null,
      errorMessage: undefined,
    })
    return true
  },

  dismiss: () => {
    const { version, phase } = get()
    if (version && phase !== 'downloading' && phase !== 'installing') {
      markDismissed(version)
    }
    if (phase === 'downloading' || phase === 'installing') return
    set({
      open: false,
      version: null,
      notes: undefined,
      phase: 'prompt',
      percent: null,
      errorMessage: undefined,
    })
  },

  install: async () => {
    const { version, phase } = get()
    if (!version || phase === 'downloading' || phase === 'installing') return

    set({ phase: 'downloading', percent: null, errorMessage: undefined })

    const handleProgress = (progress: UpdateInstallProgress) => {
      set({
        phase: progress.phase === 'installing' ? 'installing' : 'downloading',
        percent: progress.percent,
      })
    }

    try {
      const result = await installAppUpdate(handleProgress)
      if (result.status === 'installed') {
        set({ phase: 'done', percent: 100, errorMessage: undefined })
        return
      }
      if (result.status === 'up-to-date') {
        set({
          open: false,
          version: null,
          notes: undefined,
          phase: 'prompt',
          percent: null,
          errorMessage: undefined,
        })
        return
      }
      set({
        phase: 'error',
        errorMessage: result.status === 'unavailable' ? result.message : 'No se pudo instalar la actualización.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ phase: 'error', errorMessage: message || 'No se pudo instalar la actualización.' })
    }
  },
}))

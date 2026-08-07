import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cachedTalents, isTauri, refreshTalents } from '@/services/twitch'
import { persistTwitchSnapshots } from '@/services/supabase'
import { notifyLiveTalents } from '@/services/discord'
import { notifyTalentStreamChanges } from '@/services/native-alerts'
import { logTalentLive } from '@/services/activity'
import type { CalendarItem, Talent, TaskStatus, WorkTask } from '@/types'

export type HelixStatus = 'idle' | 'connecting' | 'connected' | 'error'

const REQUIRED_TWITCH_LOGINS = [
  'arikyu_', 'nosomevt', 'kumitacui', 'ryonikku', 'suimivt',
  'tesitoazul', 'shisuvr', 'bhikoruvt', 'ashitakaseiren', 'cold__vt',
] as const

const preloadedTalents: Talent[] = REQUIRED_TWITCH_LOGINS.map((login) => ({
  id: `pending-${login}`,
  login,
  displayName: login === 'nosomevt' ? 'Nosome' : login,
  avatar: '',
  description: '',
  isLive: false,
  viewers: 0,
  followers: 0,
  category: 'Consultando Twitch…',
  title: '',
  createdAt: '',
}))

function completeTalentList(talents: Talent[], fallback: Talent[] = []): Talent[] {
  return REQUIRED_TWITCH_LOGINS.map((login) => {
    const talent = talents.find((item) => item.login.toLowerCase() === login)
      ?? fallback.find((item) => item.login.toLowerCase() === login)
      ?? preloadedTalents.find((item) => item.login === login)!
    return login === 'nosomevt' ? { ...talent, displayName: 'Nosome' } : talent
  })
}

type AppState = {
  talents: Talent[]
  tasks: WorkTask[]
  events: CalendarItem[]
  demoMode: boolean
  helixStatus: HelixStatus
  hasCompletedTwitchSync: boolean
  twitchLoading: boolean
  twitchError?: string
  lastTwitchUpdate?: string
  persistedToSupabase: boolean
  commandOpen: boolean
  refreshTalentData: () => Promise<void>
  moveTask: (id: string, status: TaskStatus) => void
  addTask: (task: WorkTask) => void
  setCommandOpen: (open: boolean) => void
}

let refreshInFlight: Promise<void> | null = null

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      talents: preloadedTalents,
      tasks: [],
      events: [],
      demoMode: !isTauri,
      helixStatus: 'idle',
      hasCompletedTwitchSync: false,
      twitchLoading: false,
      persistedToSupabase: false,
      commandOpen: false,
      refreshTalentData: async () => {
        if (refreshInFlight) return refreshInFlight
        if (!isTauri) {
          set({
            helixStatus: 'error',
            hasCompletedTwitchSync: true,
            twitchError: 'Ejecuta NeuraGest en la app de escritorio para consultar Twitch.',
          })
          return
        }
        refreshInFlight = (async () => {
          set({ helixStatus: 'connecting', twitchLoading: true, twitchError: undefined })
          try {
            const current = useAppStore.getState().talents
            if (current.every((talent) => talent.id.startsWith('pending-'))) {
              const cached = await cachedTalents().catch(() => [])
              if (cached.length > 0) set({ talents: cached })
            }
            const previousLive = new Set(
              useAppStore.getState().talents.filter((t) => t.isLive).map((t) => t.streamId ?? t.id),
            )
            const previousTalents = useAppStore.getState().talents
            const talents = completeTalentList(await refreshTalents(), useAppStore.getState().talents)
            set({
              talents,
              helixStatus: 'connected',
              hasCompletedTwitchSync: true,
              twitchLoading: false,
              twitchError: undefined,
              lastTwitchUpdate: new Date().toISOString(),
            })
            void persistTwitchSnapshots(talents)
              .then((persistedToSupabase) => set({ persistedToSupabase }))
              .catch(() => set({ persistedToSupabase: false }))
            void notifyLiveTalents(talents, previousLive)
            void notifyTalentStreamChanges(talents, previousLive, previousTalents)
            for (const talent of talents) {
              if (talent.isLive && !previousLive.has(talent.streamId ?? talent.id)) {
                void logTalentLive(talent.displayName, talent.viewers, talent.login)
              }
            }
          } catch (error) {
            set({
              helixStatus: 'error',
              hasCompletedTwitchSync: true,
              twitchLoading: false,
              twitchError: error instanceof Error ? error.message : String(error),
            })
          } finally {
            refreshInFlight = null
          }
        })()
        return refreshInFlight
      },
      moveTask: (id, status) =>
        set((state) => ({ tasks: state.tasks.map((task) => task.id === id ? { ...task, status } : task) })),
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    {
      name: 'neuragest-real-data-v3',
      partialize: ({ talents, tasks, events, lastTwitchUpdate }) => ({ talents, tasks, events, lastTwitchUpdate }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState>
        return {
          ...currentState,
          ...persisted,
          talents: completeTalentList(persisted.talents ?? [], currentState.talents),
        }
      },
    },
  ),
)

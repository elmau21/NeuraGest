import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { cachedTalents, isTauri, refreshTalents } from '@/services/twitch'
import { persistTwitchSnapshots } from '@/services/supabase'
import { notifyLiveTalents } from '@/services/discord'
import { notifyTalentStreamChanges } from '@/services/native-alerts'
import { notifyLiveSoundChanges } from '@/services/live-sound'
import { logTalentLive } from '@/services/activity'
import type { CalendarItem, Talent, TaskStatus, WorkTask } from '@/types'

export type HelixStatus = 'idle' | 'connecting' | 'connected' | 'error'

const REQUIRED_TWITCH_LOGINS = [
  'arikyu_', 'nosomevt', 'lakumita', 'ryonikku', 'suimivt',
  'tesitoazul', 'shisuvr', 'bhikoruvt', 'ashitakaseiren', 'cold__vt',
  'shirookouwu', 'creeperdutyvt', 'alexyshai', 'yosoyastra', 'niel',
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
  const incomingByLogin = new Map(
    talents.map((item) => [item.login.toLowerCase(), item] as const),
  )
  const incomingById = new Map(
    talents
      .filter((item) => item.id && !item.id.startsWith('pending-'))
      .map((item) => [item.id, item] as const),
  )
  const fallbackByLogin = new Map(
    fallback.map((item) => [item.login.toLowerCase(), item] as const),
  )

  return REQUIRED_TWITCH_LOGINS.map((login) => {
    const prev = fallbackByLogin.get(login)
    // Tras un rename de Twitch, Helix trae el nuevo login pero el mismo id estable.
    const talent =
      incomingByLogin.get(login)
      ?? (prev && !prev.id.startsWith('pending-') ? incomingById.get(prev.id) : undefined)
      ?? prev
      ?? preloadedTalents.find((item) => item.login === login)!

    const isNosome =
      login === 'nosomevt' || talent.login.toLowerCase() === 'nosomevt'
    return isNosome ? { ...talent, displayName: 'Nosome' } : talent
  })
}

type HelixEventSubPayload = {
  type?: string
  login?: string
  streamId?: string | null
  categoryName?: string | null
  title?: string | null
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
  shortcutsOpen: boolean
  refreshTalentData: () => Promise<void>
  applyTalentSnapshots: (talents: Talent[]) => void
  moveTask: (id: string, status: TaskStatus) => void
  addTask: (task: WorkTask) => void
  setCommandOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
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
      shortcutsOpen: false,
      applyTalentSnapshots: (incoming) => {
        const previousTalents = useAppStore.getState().talents
        const previousLive = new Set(
          previousTalents.filter((t) => t.isLive).map((t) => t.streamId ?? t.id),
        )
        const hadCompletedSync = useAppStore.getState().hasCompletedTwitchSync
        const talents = completeTalentList(incoming, previousTalents)
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
        if (hadCompletedSync) {
          notifyLiveSoundChanges(talents, previousTalents)
        }
        for (const talent of talents) {
          if (talent.isLive && !previousLive.has(talent.streamId ?? talent.id)) {
            void logTalentLive(talent.displayName, talent.viewers, talent.login)
          }
        }
      },
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
            const talents = completeTalentList(await refreshTalents(), useAppStore.getState().talents)
            useAppStore.getState().applyTalentSnapshots(talents)
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
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
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

/** EventSub / refresh Rust → store en vivo (sin esperar poll 60s). */
export function bindTalentLiveBridge(): () => void {
  if (!isTauri) return () => {}
  const unlisteners: UnlistenFn[] = []
  let cancelled = false

  void (async () => {
    const pushUnlisten = (fn: UnlistenFn) => {
      if (cancelled) fn()
      else unlisteners.push(fn)
    }

    pushUnlisten(
      await listen<Talent[]>('talents-updated', (event) => {
        if (!Array.isArray(event.payload) || event.payload.length === 0) return
        useAppStore.getState().applyTalentSnapshots(event.payload)
      }),
    )

    pushUnlisten(
      await listen<HelixEventSubPayload>('helix-eventsub', (event) => {
        const type = event.payload.type ?? ''
        const login = (event.payload.login ?? '').toLowerCase()
        if (!login) return

        if (type === 'stream.online') {
          useAppStore.setState((state) => ({
            talents: state.talents.map((talent) =>
              talent.login.toLowerCase() === login
                ? {
                    ...talent,
                    isLive: true,
                    streamId: event.payload.streamId ?? talent.streamId,
                    title: event.payload.title ?? talent.title,
                    category: event.payload.categoryName || talent.category,
                  }
                : talent,
            ),
            lastTwitchUpdate: new Date().toISOString(),
          }))
          return
        }

        if (type === 'stream.offline') {
          useAppStore.setState((state) => ({
            talents: state.talents.map((talent) =>
              talent.login.toLowerCase() === login
                ? { ...talent, isLive: false, viewers: 0, streamId: undefined, startedAt: undefined }
                : talent,
            ),
            lastTwitchUpdate: new Date().toISOString(),
          }))
        }
      }),
    )
  })()

  return () => {
    cancelled = true
    for (const unlisten of unlisteners) unlisten()
  }
}

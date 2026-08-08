import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'

export type ToastItem = {
  id: string
  message: string
  tone: ToastTone
  createdAt: number
}

const DEFAULT_DURATION_MS = 3500
const MAX_VISIBLE = 4

type ToastState = {
  toasts: ToastItem[]
  push: (message: string, tone?: ToastTone, durationMs?: number) => string
  dismiss: (id: string) => void
  clear: () => void
}

let seq = 0
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function nextId() {
  seq += 1
  return `toast-${Date.now()}-${seq}`
}

export function enqueueToast(
  current: ToastItem[],
  message: string,
  tone: ToastTone = 'info',
): ToastItem[] {
  const trimmed = message.trim()
  if (!trimmed) return current
  const item: ToastItem = {
    id: nextId(),
    message: trimmed,
    tone,
    createdAt: Date.now(),
  }
  return [...current, item].slice(-MAX_VISIBLE)
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'info', durationMs = DEFAULT_DURATION_MS) => {
    const next = enqueueToast(get().toasts, message, tone)
    const item = next[next.length - 1]
    if (!item || next === get().toasts) return ''
    set({ toasts: next })
    if (durationMs > 0) {
      const prev = timers.get(item.id)
      if (prev) clearTimeout(prev)
      timers.set(
        item.id,
        setTimeout(() => {
          timers.delete(item.id)
          get().dismiss(item.id)
        }, durationMs),
      )
    }
    return item.id
  },
  dismiss: (id) => {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
  clear: () => {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    set({ toasts: [] })
  },
}))

export function toastSuccess(message: string) {
  return useToastStore.getState().push(message, 'success')
}

export function toastError(message: string) {
  return useToastStore.getState().push(message, 'error')
}

export function toastInfo(message: string) {
  return useToastStore.getState().push(message, 'info')
}

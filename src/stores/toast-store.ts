import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'

export type ToastAction = {
  label: string
  onClick: () => void
}

export type ToastItem = {
  id: string
  message: string
  tone: ToastTone
  createdAt: number
  action?: ToastAction
}

const DEFAULT_DURATION_MS = 3500
const MAX_VISIBLE = 4

type ToastPushOptions = {
  tone?: ToastTone
  durationMs?: number
  action?: ToastAction
}

type ToastState = {
  toasts: ToastItem[]
  push: (message: string, options?: ToastPushOptions | ToastTone, durationMs?: number, action?: ToastAction) => string
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
  action?: ToastAction,
): ToastItem[] {
  const trimmed = message.trim()
  if (!trimmed) return current
  const item: ToastItem = {
    id: nextId(),
    message: trimmed,
    tone,
    createdAt: Date.now(),
    action,
  }
  return [...current, item].slice(-MAX_VISIBLE)
}

function resolvePushArgs(
  options?: ToastPushOptions | ToastTone,
  durationMs?: number,
  action?: ToastAction,
): Required<Pick<ToastPushOptions, 'tone' | 'durationMs'>> & Pick<ToastPushOptions, 'action'> {
  if (typeof options === 'string') {
    return { tone: options, durationMs: durationMs ?? DEFAULT_DURATION_MS, action }
  }
  return {
    tone: options?.tone ?? 'info',
    durationMs: options?.durationMs ?? DEFAULT_DURATION_MS,
    action: options?.action ?? action,
  }
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, options, durationMs, action) => {
    const resolved = resolvePushArgs(options, durationMs, action)
    const next = enqueueToast(get().toasts, message, resolved.tone, resolved.action)
    const item = next[next.length - 1]
    if (!item || next === get().toasts) return ''
    set({ toasts: next })
    if (resolved.durationMs > 0) {
      const prev = timers.get(item.id)
      if (prev) clearTimeout(prev)
      timers.set(
        item.id,
        setTimeout(() => {
          timers.delete(item.id)
          get().dismiss(item.id)
        }, resolved.durationMs),
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

export function toastSuccess(message: string, action?: ToastAction) {
  return useToastStore.getState().push(message, { tone: 'success', action, durationMs: action ? 6000 : DEFAULT_DURATION_MS })
}

export function toastError(message: string, action?: ToastAction) {
  return useToastStore.getState().push(message, { tone: 'error', action, durationMs: action ? 6000 : DEFAULT_DURATION_MS })
}

export function toastInfo(message: string, action?: ToastAction) {
  return useToastStore.getState().push(message, { tone: 'info', action, durationMs: action ? 6000 : DEFAULT_DURATION_MS })
}

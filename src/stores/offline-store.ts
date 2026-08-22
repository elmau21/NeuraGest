import { create } from 'zustand'

type OfflineState = {
  usingCache: boolean
  setUsingCache: (value: boolean) => void
}

export const useOfflineStore = create<OfflineState>((set) => ({
  usingCache: false,
  setUsingCache: (usingCache) => set({ usingCache }),
}))

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSupabaseAuthStorage,
  resetSupabaseAuthStorageMemoryForTests,
} from './supabase-auth-storage'

vi.mock('@/services/twitch', () => ({
  isTauri: false,
}))

describe('createSupabaseAuthStorage', () => {
  beforeEach(() => {
    resetSupabaseAuthStorageMemoryForTests()
    localStorage.clear()
  })

  it('persiste y lee valores vía localStorage cuando no hay Tauri', async () => {
    const storage = createSupabaseAuthStorage()
    await storage.setItem('sb-test-auth-token', '{"access_token":"abc"}')
    expect(localStorage.getItem('sb-test-auth-token')).toBe('{"access_token":"abc"}')
    expect(await storage.getItem('sb-test-auth-token')).toBe('{"access_token":"abc"}')
  })

  it('sirve desde memoria tras el primer set', async () => {
    const storage = createSupabaseAuthStorage()
    await storage.setItem('k', 'v1')
    localStorage.removeItem('k')
    expect(await storage.getItem('k')).toBe('v1')
  })

  it('elimina de memoria y localStorage', async () => {
    const storage = createSupabaseAuthStorage()
    await storage.setItem('k', 'v')
    await storage.removeItem('k')
    expect(localStorage.getItem('k')).toBeNull()
    expect(await storage.getItem('k')).toBeNull()
  })
})

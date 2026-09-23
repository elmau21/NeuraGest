import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()

vi.mock('@/services/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}))

vi.mock('@/services/twitch', () => ({
  isTauri: true,
}))

describe('syncSupabaseAuthBridge', () => {
  beforeEach(() => {
    rpc.mockReset()
    vi.resetModules()
  })

  it('llama sync_auth_user_from_app con el auth_user_id', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const { syncSupabaseAuthBridge } = await import('./supabase-auth')
    await expect(syncSupabaseAuthBridge('auth-123')).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('sync_auth_user_from_app', {
      p_auth_user_id: 'auth-123',
    })
  })

  it('devuelve false si PostgREST reporta error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function missing' } })
    const { syncSupabaseAuthBridge } = await import('./supabase-auth')
    await expect(syncSupabaseAuthBridge('auth-123')).resolves.toBe(false)
  })

  it('devuelve false si la RPC lanza', async () => {
    rpc.mockRejectedValue(new Error('network'))
    const { syncSupabaseAuthBridge } = await import('./supabase-auth')
    await expect(syncSupabaseAuthBridge('auth-123')).resolves.toBe(false)
  })

  it('no llama RPC sin authUserId', async () => {
    const { syncSupabaseAuthBridge } = await import('./supabase-auth')
    await expect(syncSupabaseAuthBridge('')).resolves.toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
})

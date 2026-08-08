import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { WarRoomPage } from '@/features/war-room/WarRoomPage'
import { CrmPage } from '@/features/crm/CrmPage'
import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'

vi.mock('@/services/twitch', () => ({
  isTauri: true,
  twitchAuthState: vi.fn(async () => ({ connected: true })),
  disconnectTwitch: vi.fn(),
  refreshTalents: vi.fn(async () => []),
  cachedTalents: vi.fn(async () => []),
}))

vi.mock('@/services/supabase-twitch-oauth', () => ({
  getActiveSupabaseTwitchProfile: vi.fn(async () => null),
  signInWithSupabaseTwitch: vi.fn(),
  signOutSupabase: vi.fn(),
}))

vi.mock('@/services/app-users', () => ({
  ensureAppUser: vi.fn(async () => ({ id: 'user-1' })),
  fetchMyRoles: vi.fn(async () => ['manager']),
  canAccessAdminPanel: vi.fn(() => true),
}))

vi.mock('@/services/agency', () => ({
  listSponsorshipDeals: vi.fn(async () => []),
  listDbTalents: vi.fn(async () => [{ id: 't1', login: 'arikyu_', displayName: 'Arikyu' }]),
  saveSponsorshipDeal: vi.fn(async (input) => ({
    id: 'deal-1',
    brandName: input.brandName,
    progressPercent: input.progressPercent ?? 0,
    status: input.status ?? 'lead',
    currency: input.currency ?? 'MXN',
  })),
  deleteSponsorshipDeal: vi.fn(),
  SPONSORSHIP_STATUS_LABELS: { lead: 'Lead', negotiating: 'Negociación', active: 'Activo', completed: 'Completado', lost: 'Perdido' },
}))

vi.mock('@/services/ops', () => ({
  listBrandRestrictions: vi.fn(async () => []),
  saveBrandRestriction: vi.fn(),
  deleteBrandRestriction: vi.fn(),
  RESTRICTION_KIND_LABELS: { exclusivity: 'Exclusividad', blackout: 'Blackout' },
}))

vi.mock('@/hooks/useMetricHistory', () => ({
  useMetricHistory: () => ({
    snapshots: [],
    events: [],
    eventSub: null,
    displayNames: {},
    loading: false,
    reload: vi.fn(),
  }),
}))

vi.mock('@/services/org-presence', () => ({
  subscribeOrgPresence: vi.fn(() => () => {}),
  upsertMyPresence: vi.fn(),
  clearMyPresence: vi.fn(),
}))

vi.mock('@/stores/toast-store', () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  useToastStore: Object.assign(
    vi.fn(() => ({ toasts: [] })),
    { getState: () => ({ toasts: [], push: vi.fn(), dismiss: vi.fn() }) },
  ),
}))

describe('E2E manager flow (Vitest + Testing Library)', () => {
  beforeEach(() => {
    cleanup()
    useAuthStore.setState({
      status: 'unauthenticated',
      session: null,
      roles: [],
      oauthFlow: 'idle',
      error: null,
    })
    useAppStore.setState({
      hasCompletedTwitchSync: true,
      twitchLoading: false,
      helixStatus: 'connected',
    })
  })

  it('login → war room → crear deal', async () => {
    const user = userEvent.setup()

    render(<LoginScreen />)
    expect(screen.getByRole('button', { name: /continuar con twitch/i })).toBeInTheDocument()

    useAuthStore.setState({
      status: 'authenticated',
      session: {
        login: 'manager_test',
        displayName: 'Manager Test',
        avatarUrl: '',
        authUserId: 'auth-1',
      },
      roles: ['manager'],
      oauthFlow: 'idle',
    })

    cleanup()
    render(
      <MemoryRouter initialEntries={['/war-room']}>
        <Routes>
          <Route path="/war-room" element={<WarRoomPage />} />
          <Route path="/crm" element={<CrmPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /war room \/ noc/i })).toBeInTheDocument()

    cleanup()
    render(
      <MemoryRouter initialEntries={['/crm']}>
        <Routes>
          <Route path="/crm" element={<CrmPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: /nuevo deal/i }))
    const brandInput = await screen.findByLabelText(/^marca$/i)
    await user.type(brandInput, 'Marca E2E Test')
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    await waitFor(() => {
      expect(screen.getByText('Marca E2E Test')).toBeInTheDocument()
    })
  })
})

import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'

export type ChannelInfo = {
  login: string
  broadcasterId: string
  language: string
  title: string
  gameName: string
  tags: string[]
  contentClassificationLabels: string[]
  isBrandedContent: boolean
}

export type CreatedClip = {
  id: string
  editUrl: string
  url: string
}

export type SubscriptionKpi = {
  login: string
  total: number
  points: number
  tier1: number
  tier2: number
  tier3: number
  gifts: number
  available: boolean
  note?: string | null
}

export type PortfolioSubscriptionKpi = {
  total: number
  points: number
  channelsTotal: number
  channelsLive: number
  channelsCached: number
  channelsMissing: number
  /** false → no inventar 0 de cartera (mostrar —). */
  hasCoverage: boolean
  channels: SubscriptionKpi[]
  note?: string | null
}

export type ChattersInfo = {
  login: string
  chatters: number
  viewers: number
  available: boolean
  note?: string | null
}

export type AdsSchedule = {
  login: string
  nextAdAt?: string | null
  lastAdAt?: string | null
  duration?: number | null
  prerollFreeTime?: number | null
  snoozeCount?: number | null
  snoozeRefreshAt?: string | null
  available: boolean
  note?: string | null
}

export type CreatorGoal = {
  id: string
  goalType: string
  description: string
  currentAmount: number
  targetAmount: number
}

export type GoalsInfo = {
  login: string
  goals: CreatorGoal[]
  available: boolean
  note?: string | null
}

export type LiveExtras = {
  login: string
  channel?: ChannelInfo | null
  chatters?: ChattersInfo | null
  subscriptions?: SubscriptionKpi | null
  ads?: AdsSchedule | null
  goals?: GoalsInfo | null
}

export async function fetchChannelInfo(login: string): Promise<ChannelInfo> {
  if (!isTauri) throw new Error('Esta consulta requiere la app de escritorio.')
  return invoke<ChannelInfo>('fetch_channel_info', { login })
}

export async function createTwitchClip(login: string): Promise<CreatedClip> {
  if (!isTauri) throw new Error('Crear clip requiere la app de escritorio y permiso de clips.')
  return invoke<CreatedClip>('create_twitch_clip', { login })
}

export async function fetchSubscriptionKpi(login: string): Promise<SubscriptionKpi> {
  if (!isTauri) throw new Error('Subs KPI requiere la app de escritorio.')
  return invoke<SubscriptionKpi>('fetch_subscription_kpi', { login })
}

/** Subs activas de toda la cartera (roster completo, Helix live + caché local). */
export async function fetchPortfolioSubscriptionKpi(): Promise<PortfolioSubscriptionKpi> {
  if (!isTauri) {
    return {
      total: 0,
      points: 0,
      channelsTotal: 0,
      channelsLive: 0,
      channelsCached: 0,
      channelsMissing: 0,
      hasCoverage: false,
      channels: [],
      note: 'Requiere la app de escritorio.',
    }
  }
  return invoke<PortfolioSubscriptionKpi>('fetch_portfolio_subscription_kpi')
}

export async function fetchChattersCount(login: string, viewers = 0): Promise<ChattersInfo> {
  if (!isTauri) throw new Error('Chatters requiere la app de escritorio.')
  return invoke<ChattersInfo>('fetch_chatters_count', { login, viewers })
}

export async function fetchAdsSchedule(login: string): Promise<AdsSchedule> {
  if (!isTauri) throw new Error('Ads requiere la app de escritorio.')
  return invoke<AdsSchedule>('fetch_ads_schedule', { login })
}

export async function fetchCreatorGoals(login: string): Promise<GoalsInfo> {
  if (!isTauri) throw new Error('Goals requiere la app de escritorio.')
  return invoke<GoalsInfo>('fetch_creator_goals', { login })
}

export async function fetchLiveExtras(login: string, viewers = 0): Promise<LiveExtras> {
  if (!isTauri) throw new Error('Live extras requiere la app de escritorio.')
  return invoke<LiveExtras>('fetch_live_extras', { login, viewers })
}

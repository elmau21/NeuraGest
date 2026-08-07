import { getDiscordSettings, saveDiscordSettings, type DiscordEventKind } from '@/services/settings'
import type { Talent } from '@/types'

const EVENT_PLACEHOLDERS: Record<string, string> = {
  talent: '{talent}',
  raider: '{raider}',
  viewers: '{viewers}',
  milestone: '{milestone}',
  brand: '{brand}',
}

export function renderDiscordEventTemplate(
  template: string,
  vars: Record<string, string | number | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key]
    return value != null ? String(value) : EVENT_PLACEHOLDERS[key] ?? `{${key}}`
  })
}

export async function postDiscordEvent(
  kind: DiscordEventKind,
  vars: Record<string, string | number | undefined>,
): Promise<boolean> {
  const settings = await getDiscordSettings()
  if (!settings.enabled || !settings.webhookUrl.trim()) return false
  const templates = settings.eventTemplates
  const template = kind === 'raid'
    ? templates?.raid
    : kind === 'milestone'
      ? templates?.milestone
      : templates?.campaignEnd
  if (!template?.trim()) return false

  const content = renderDiscordEventTemplate(template, vars)
  try {
    const response = await fetch(settings.webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, embeds: [{ footer: { text: 'NeuraGest · plantilla evento' } }] }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function postLiveToDiscord(talent: Talent): Promise<boolean> {
  const settings = await getDiscordSettings()
  if (!settings.enabled || !settings.webhookUrl.trim()) return false
  const streamKey = talent.streamId ?? `${talent.login}-${talent.startedAt ?? 'live'}`
  if (settings.postedLive[streamKey]) return false

  const content = `🔴 **${talent.displayName}** en vivo · **${talent.viewers.toLocaleString('es-MX')}** viewers`
  const body = {
    content,
    embeds: [{
      title: talent.title || 'En directo',
      description: talent.category || 'Twitch',
      color: 0x9146ff,
      footer: { text: 'NeuraGest · Twitch' },
    }],
  }

  try {
    const response = await fetch(settings.webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) return false
    await saveDiscordSettings({
      ...settings,
      postedLive: { ...settings.postedLive, [streamKey]: new Date().toISOString() },
    })
    return true
  } catch {
    return false
  }
}

export async function notifyLiveTalents(talents: Talent[], previousLiveIds: Set<string>): Promise<void> {
  const settings = await getDiscordSettings()
  if (!settings.enabled || !settings.webhookUrl.trim()) return
  for (const talent of talents) {
    if (!talent.isLive) continue
    const key = talent.streamId ?? talent.id
    if (previousLiveIds.has(key)) continue
    await postLiveToDiscord(talent)
  }
}

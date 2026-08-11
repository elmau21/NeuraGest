import type { CreativeDriveItem } from '@/services/creative-drive'
import { detectAssetKind, CHANNEL_ASSET_SPECS, type ChannelAssetSpec } from '@/services/twitch-asset-rules'

export type GapStatus = 'ok' | 'missing' | 'partial'

export type ChannelGapSlot = {
  kind: ChannelAssetSpec['kind']
  label: string
  hint: string
  status: GapStatus
  driveMatches: CreativeDriveItem[]
  liveOnTwitch?: boolean
}

export type TalentChannelGap = {
  login: string
  displayName: string
  avatar?: string
  talentId?: string
  folder?: CreativeDriveItem
  slots: ChannelGapSlot[]
  missingCount: number
  readyCount: number
}

export type GapTalentInput = {
  id?: string
  login: string
  displayName: string
  avatar?: string
  offlineImageUrl?: string
}

function itemsUnderFolder(all: CreativeDriveItem[], folderId: string): CreativeDriveItem[] {
  const folder = all.find((i) => i.id === folderId)
  if (!folder) return []
  const prefix = folder.path.endsWith('/') ? folder.path : `${folder.path}/`
  return all.filter((i) => i.id === folderId || i.path === folder.path || i.path.startsWith(prefix))
}

export function buildChannelGaps(input: {
  talents: GapTalentInput[]
  driveItems: CreativeDriveItem[]
  findFolder: (login: string, displayName: string) => CreativeDriveItem | undefined
}): TalentChannelGap[] {
  return input.talents.map((t) => {
    const folder = input.findFolder(t.login, t.displayName)
    const scope = folder ? itemsUnderFolder(input.driveItems, folder.id) : []
    const files = scope.filter((i) => i.kind === 'file')

    const slots: ChannelGapSlot[] = CHANNEL_ASSET_SPECS.map((spec) => {
      const driveMatches = files.filter((f) => {
        const kind = f.assetKind ?? detectAssetKind(f.name, f.assetKind)
        return kind === spec.kind
      })
      const liveOnTwitch = spec.kind === 'offline' ? Boolean(t.offlineImageUrl?.trim()) : undefined

      let status: GapStatus = 'missing'
      if (driveMatches.length > 0 || liveOnTwitch) {
        const anyReady = driveMatches.some((f) => f.readyForTwitch)
        status = anyReady || liveOnTwitch ? 'ok' : 'partial'
      }

      return {
        kind: spec.kind,
        label: spec.label,
        hint: spec.hint,
        status,
        driveMatches,
        liveOnTwitch,
      }
    })

    const missingCount = slots.filter((s) => s.status === 'missing').length
    const readyCount = slots.filter((s) => s.status === 'ok').length

    return {
      login: t.login,
      displayName: t.displayName,
      avatar: t.avatar,
      talentId: t.id && !t.id.startsWith('pending-') ? t.id : undefined,
      folder,
      slots,
      missingCount,
      readyCount,
    }
  }).sort((a, b) => b.missingCount - a.missingCount || a.displayName.localeCompare(b.displayName, 'es'))
}

export function suggestedSubfolders(): string[] {
  return CHANNEL_ASSET_SPECS.map((s) => s.label)
}

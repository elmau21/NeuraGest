import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Users } from '@/components/icons'
import {
  DEFAULT_VRCHAT_GROUP_ID,
  fetchVrchatConfigStatus,
  fetchVrchatGroupSnapshots,
  syncVrchatGroup,
  verifyVrchat2fa,
  VRCHAT_DISCLAIMER,
  type VrchatConfigStatus,
  type VrchatGroupSnapshot,
  type VrchatGroupSyncResult,
} from '@/services/vrchat-groups'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'
import { toastError, toastSuccess } from '@/stores/toast-store'

type Props = {
  compact?: boolean
  onSynced?: () => void
}

export function VrchatGroupsPanel({ compact, onSynced }: Props) {
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<VrchatConfigStatus | null>(null)
  const [latest, setLatest] = useState<VrchatGroupSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needs2fa, setNeeds2fa] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)

  const reloadStatus = useCallback(async () => {
    const [cfg, rows] = await Promise.all([
      fetchVrchatConfigStatus().catch(() => null),
      fetchVrchatGroupSnapshots(2).catch(() => [] as VrchatGroupSnapshot[]),
    ])
    setConfig(cfg)
    setLatest(rows[0] ?? null)
    return { cfg, rows }
  }, [])

  useEffect(() => {
    void reloadStatus().catch(() => undefined)
  }, [reloadStatus])

  const applyResult = (result: VrchatGroupSyncResult) => {
    setNeeds2fa(result.needsTwoFactor)
    if (result.ok) {
      toastSuccess(result.message)
      onSynced?.()
    } else if (result.needsTwoFactor) {
      toastError(result.message)
    } else {
      toastError(result.message)
    }
  }

  const runSync = async () => {
    if (readonly || !isTauri) return
    setLoading(true)
    setError(null)
    try {
      const result = await syncVrchatGroup()
      applyResult(result)
      await reloadStatus()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toastError(msg)
    } finally {
      setLoading(false)
    }
  }

  const run2fa = async () => {
    if (readonly || !twoFactorCode.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await verifyVrchat2fa(twoFactorCode.trim(), 'totp')
      applyResult(result)
      if (result.ok) {
        setTwoFactorCode('')
        setNeeds2fa(false)
      }
      await reloadStatus()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toastError(msg)
    } finally {
      setLoading(false)
    }
  }

  const lastSync = latest?.syncedAt
    ? new Date(latest.syncedAt).toLocaleString('es-MX')
    : 'Nunca'
  const notConfigured = config != null && !config.configured
  const groupLabel = latest?.name || config?.groupId || DEFAULT_VRCHAT_GROUP_ID

  if (compact) {
    return (
      <button
        className="secondary ti-vrchat-sync"
        disabled={readonly || loading || !isTauri || notConfigured}
        onClick={() => void runSync()}
        title={
          notConfigured
            ? (config?.missingHint ?? 'Falta configurar bot VRChat en .env')
            : error
              ? `Error: ${error}`
              : VRCHAT_DISCLAIMER
        }
      >
        <Users size={14} />
        {loading
          ? 'Sync VRChat…'
          : notConfigured
            ? 'VRChat: falta bot'
            : 'Sync VRChat'}
      </button>
    )
  }

  return (
    <div className="card">
      <h3>
        <Users size={16} /> VRChat Groups
      </h3>
      <p>{VRCHAT_DISCLAIMER}</p>
      {notConfigured && (
        <p className="integration-error" role="status">
          {config?.missingHint ??
            'Falta configurar el bot VRChat en `.env` (VRCHAT_USERNAME + VRCHAT_PASSWORD o VRCHAT_AUTH_COOKIE).'}
        </p>
      )}
      <div className="twitchtracker-status">
        <span>{groupLabel}</span>
        {latest && (
          <>
            <span> · {latest.memberCount.toLocaleString('es-MX')} miembros</span>
            <span> · {latest.onlineMemberCount.toLocaleString('es-MX')} online</span>
          </>
        )}
        <span> · Última sync: {loading ? '…' : lastSync}</span>
      </div>
      {config?.groupUrl && (
        <p>
          <a href={config.groupUrl} target="_blank" rel="noreferrer">
            Abrir grupo en VRChat
          </a>
        </p>
      )}
      {error && <p className="integration-error">{error}</p>}
      {needs2fa && (
        <div className="ops-field" style={{ marginTop: 8 }}>
          <label>
            Código 2FA
            <input
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              placeholder="TOTP"
              autoComplete="one-time-code"
              disabled={loading || readonly}
            />
          </label>
          <button
            className="secondary"
            disabled={readonly || loading || !twoFactorCode.trim()}
            onClick={() => void run2fa()}
          >
            Verificar 2FA
          </button>
        </div>
      )}
      <button
        className="secondary"
        disabled={readonly || loading || !isTauri || notConfigured}
        onClick={() => void runSync()}
      >
        <RefreshCw size={14} />
        {loading ? 'Sincronizando…' : 'Sync VRChat'}
      </button>
      {!isTauri && (
        <p className="integration-note">Disponible solo en la app de escritorio.</p>
      )}
    </div>
  )
}

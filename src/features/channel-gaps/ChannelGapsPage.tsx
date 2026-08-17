import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  EyeOff,
  FolderOpen,
  FolderPlus,
  RefreshCw,
} from '@/components/icons'
import { listDbTalents } from '@/services/agency'
import {
  createDriveFolder,
  findTalentRootFolder,
  listAllDriveItems,
  type CreativeDriveItem,
} from '@/services/creative-drive'
import { buildChannelGaps, type TalentChannelGap } from '@/services/channel-gaps'
import {
  ignoreLoginSet,
  listDesignGapIgnores,
  listDesignGapResolutions,
  markDesignGapIgnored,
  markDesignGapResolved,
  resolutionLoginSet,
  unmarkDesignGapIgnored,
  unmarkDesignGapResolved,
} from '@/services/design-gap-resolutions'
import { TWITCH_RULES_BLURB } from '@/services/twitch-asset-rules'
import { isTauri } from '@/services/twitch'
import { canMutateDesign } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'
import { toastError, toastSuccess } from '@/stores/toast-store'

function SlotIcon({ status }: { status: TalentChannelGap['slots'][0]['status'] }) {
  if (status === 'ok') return <CheckCircle2 size={14} className="dg-slot-ok" />
  if (status === 'partial') return <CircleDashed size={14} className="dg-slot-partial" />
  return <CircleAlert size={14} className="dg-slot-missing" />
}

export function ChannelGapsPage() {
  const navigate = useNavigate()
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutateDesign(roles, session?.login)
  const twitchTalents = useAppStore((s) => s.talents)

  const [driveItems, setDriveItems] = useState<CreativeDriveItem[]>([])
  const [dbTalents, setDbTalents] = useState<Awaited<ReturnType<typeof listDbTalents>>>([])
  const [loading, setLoading] = useState(true)
  const [busyLogin, setBusyLogin] = useState<string | null>(null)
  const [busyResolveLogin, setBusyResolveLogin] = useState<string | null>(null)
  const [busyIgnoreLogin, setBusyIgnoreLogin] = useState<string | null>(null)
  const [resolvedLogins, setResolvedLogins] = useState<Set<string>>(new Set())
  const [ignoredLogins, setIgnoredLogins] = useState<Set<string>>(new Set())
  const [showResolved, setShowResolved] = useState(false)
  const [showIgnored, setShowIgnored] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [items, talents, resolutions, ignores] = await Promise.all([
        listAllDriveItems(),
        listDbTalents().catch(() => []),
        listDesignGapResolutions().catch(() => []),
        listDesignGapIgnores().catch(() => []),
      ])
      setDriveItems(items)
      setDbTalents(talents)
      setResolvedLogins(resolutionLoginSet(resolutions))
      setIgnoredLogins(ignoreLoginSet(ignores))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const gaps = useMemo(() => {
    const byLogin = new Map(twitchTalents.map((t) => [t.login.toLowerCase(), t]))
    const source = dbTalents.length > 0 ? dbTalents : twitchTalents
    const roster = source.map((t) => {
      const live = byLogin.get(t.login.toLowerCase())
      const avatarFromDb = 'avatarUrl' in t ? t.avatarUrl : undefined
      const avatarFromTwitch = 'avatar' in t ? t.avatar : undefined
      return {
        id: t.id,
        login: t.login,
        displayName: t.displayName,
        avatar: live?.avatar ?? avatarFromDb ?? avatarFromTwitch,
        offlineImageUrl: live?.offlineImageUrl,
      }
    })
    return buildChannelGaps({
      talents: roster,
      driveItems,
      findFolder: (login, displayName) => findTalentRootFolder(driveItems, login, displayName),
    })
  }, [dbTalents, driveItems, twitchTalents])

  const loginKey = (login: string) => login.toLowerCase()

  const visibleGaps = useMemo(() => {
    const open = gaps.filter(
      (g) => !resolvedLogins.has(loginKey(g.login)) && !ignoredLogins.has(loginKey(g.login)),
    )
    const resolved = gaps.filter((g) => resolvedLogins.has(loginKey(g.login)))
    const ignored = gaps.filter(
      (g) => ignoredLogins.has(loginKey(g.login)) && !resolvedLogins.has(loginKey(g.login)),
    )
    let result = open
    if (showIgnored) result = [...result, ...ignored]
    if (showResolved) result = [...result, ...resolved]
    return result
  }, [gaps, resolvedLogins, ignoredLogins, showResolved, showIgnored])

  const resolvedCount = useMemo(
    () => gaps.filter((g) => resolvedLogins.has(loginKey(g.login))).length,
    [gaps, resolvedLogins],
  )

  const ignoredCount = useMemo(
    () =>
      gaps.filter(
        (g) => ignoredLogins.has(loginKey(g.login)) && !resolvedLogins.has(loginKey(g.login)),
      ).length,
    [gaps, ignoredLogins, resolvedLogins],
  )

  const toggleResolved = async (row: TalentChannelGap, resolve: boolean) => {
    if (readonly) return
    setBusyResolveLogin(row.login)
    try {
      if (resolve) {
        await markDesignGapResolved({
          talentLogin: row.login,
          talentId: row.talentId,
          displayName: row.displayName,
        })
        setResolvedLogins((prev) => new Set([...prev, row.login.toLowerCase()]))
        setIgnoredLogins((prev) => {
          const next = new Set(prev)
          next.delete(row.login.toLowerCase())
          return next
        })
        toastSuccess(`@${row.login} marcado como resuelto.`)
      } else {
        await unmarkDesignGapResolved(row.login, row.displayName)
        setResolvedLogins((prev) => {
          const next = new Set(prev)
          next.delete(row.login.toLowerCase())
          return next
        })
        toastSuccess(`@${row.login} vuelve a la lista activa.`)
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo actualizar el estado.')
    } finally {
      setBusyResolveLogin(null)
    }
  }

  const toggleIgnored = async (row: TalentChannelGap, ignore: boolean) => {
    if (readonly) return
    setBusyIgnoreLogin(row.login)
    try {
      if (ignore) {
        await markDesignGapIgnored({
          talentLogin: row.login,
          talentId: row.talentId,
          displayName: row.displayName,
        })
        setIgnoredLogins((prev) => new Set([...prev, row.login.toLowerCase()]))
        setResolvedLogins((prev) => {
          const next = new Set(prev)
          next.delete(row.login.toLowerCase())
          return next
        })
        toastSuccess(`@${row.login} movido a ignorados (pendientes).`)
      } else {
        await unmarkDesignGapIgnored(row.login, row.displayName)
        setIgnoredLogins((prev) => {
          const next = new Set(prev)
          next.delete(row.login.toLowerCase())
          return next
        })
        toastSuccess(`@${row.login} vuelve a la lista activa.`)
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo actualizar el estado.')
    } finally {
      setBusyIgnoreLogin(null)
    }
  }

  const ensureFolder = async (row: TalentChannelGap) => {
    if (readonly) return
    setBusyLogin(row.login)
    try {
      let folder = row.folder
      if (!folder) {
        folder = await createDriveFolder(row.login, null, '/')
        toastSuccess(`Carpeta @${row.login} creada`)
      }
      for (const slot of row.slots.filter((s) => s.status === 'missing')) {
        const subName = slot.label
        const kids = driveItems.filter((i) => i.parentId === folder!.id && i.kind === 'folder')
        if (!kids.some((k) => k.name.toLowerCase() === subName.toLowerCase())) {
          await createDriveFolder(subName, folder.id, folder.path)
        }
      }
      await reload()
      toastSuccess('Carpetas sugeridas listas')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear la carpeta')
    } finally {
      setBusyLogin(null)
    }
  }

  const openDrive = (folderId?: string) => {
    if (folderId) navigate(`/diseno?folder=${folderId}`)
    else navigate('/diseno')
  }

  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>Huecos de canal requiere la app de escritorio NeuraGest.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Huecos de canal</h1>
          <p>
            Qué assets debería tener cada talento frente a lo que hay en Diseño gráfico.
          </p>
        </div>
        <div className="page-actions">
          {resolvedCount > 0 ? (
            <button
              className={`secondary${showResolved ? ' active' : ''}`}
              onClick={() => setShowResolved((v) => !v)}
            >
              <CheckCircle2 size={16} /> Resueltos ({resolvedCount})
            </button>
          ) : null}
          {ignoredCount > 0 ? (
            <button
              className={`secondary ignored${showIgnored ? ' active' : ''}`}
              onClick={() => setShowIgnored((v) => !v)}
            >
              <EyeOff size={16} /> Ignorados ({ignoredCount})
            </button>
          ) : null}
          <button className="secondary" disabled={loading} onClick={() => void reload()}>
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      {readonly && (
        <p className="integration-note staff-readonly-banner">
          Modo solo lectura: puedes revisar huecos, pero no crear carpetas.
        </p>
      )}
      {error && <p className="integration-note">{error}</p>}

      <p className="dg-rules-note">{TWITCH_RULES_BLURB}</p>

      {loading ? (
        <div className="card"><p className="empty-state">Revisando roster y archivos…</p></div>
      ) : gaps.length === 0 ? (
        <div className="card"><p className="empty-state">No hay talentos en el roster.</p></div>
      ) : visibleGaps.length === 0 ? (
        <div className="card"><p className="empty-state">No hay huecos pendientes. Activa «Resueltos» o «Ignorados» para revisar los marcados.</p></div>
      ) : (
        <div className="dg-gap-list">
          {visibleGaps.map((row) => {
            const isResolved = resolvedLogins.has(row.login.toLowerCase())
            const isIgnored = ignoredLogins.has(row.login.toLowerCase()) && !isResolved
            return (
            <article key={row.login} className={`card dg-gap-card${isResolved ? ' is-resolved' : ''}${isIgnored ? ' is-ignored' : ''}`}>
              <header className="dg-gap-head">
                <div className="dg-gap-talent">
                  {row.avatar ? (
                    <img src={row.avatar} alt="" />
                  ) : (
                    <div className="avatar-placeholder">{row.displayName.slice(0, 2).toUpperCase()}</div>
                  )}
                  <div>
                    <b>{row.displayName}</b>
                    <span>@{row.login}</span>
                  </div>
                </div>
                <div className="dg-gap-meta">
                  {isResolved ? (
                    <span className="dg-badge ok">
                      <CheckCircle2 size={12} /> Resuelto
                    </span>
                  ) : isIgnored ? (
                    <span className="dg-badge ignored">
                      <EyeOff size={12} /> Ignorado
                    </span>
                  ) : (
                    <span className={row.missingCount > 0 ? 'dg-badge warn' : 'dg-badge ok'}>
                      {row.missingCount > 0
                        ? `${row.missingCount} hueco${row.missingCount === 1 ? '' : 's'}`
                        : 'Completo'}
                    </span>
                  )}
                  <span className="dg-badge muted">{row.readyCount}/{row.slots.length} listos</span>
                </div>
              </header>

              <ul className="dg-slot-list">
                {row.slots.map((slot) => (
                  <li key={slot.kind} className={`dg-slot is-${slot.status}`}>
                    <SlotIcon status={slot.status} />
                    <div>
                      <b>{slot.label}</b>
                      <small>
                        {slot.status === 'ok' && slot.liveOnTwitch && slot.driveMatches.length === 0
                          ? 'Ya en el canal Twitch'
                          : slot.driveMatches.length > 0
                            ? `${slot.driveMatches.length} en Drive${slot.driveMatches.some((f) => f.readyForTwitch) ? ' · Listo para Twitch' : ' · pendiente de marcar'}`
                            : 'Falta en Drive'}
                        {' · '}
                        {slot.hint}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>

              <footer className="dg-gap-actions">
                {!readonly && row.missingCount > 0 ? (
                  isResolved ? (
                    <button
                      className="secondary"
                      disabled={busyResolveLogin === row.login}
                      onClick={() => void toggleResolved(row, false)}
                    >
                      <CircleDashed size={15} /> Quitar resuelto
                    </button>
                  ) : isIgnored ? (
                    <button
                      className="secondary"
                      disabled={busyIgnoreLogin === row.login}
                      onClick={() => void toggleIgnored(row, false)}
                    >
                      <EyeOff size={15} /> Quitar de ignorados
                    </button>
                  ) : (
                    <>
                      <button
                        className="secondary"
                        disabled={busyResolveLogin === row.login}
                        onClick={() => void toggleResolved(row, true)}
                      >
                        <CheckCircle2 size={15} /> Marcar resuelto
                      </button>
                      <button
                        className="secondary"
                        disabled={busyIgnoreLogin === row.login}
                        onClick={() => void toggleIgnored(row, true)}
                        title="Ocultar de la cola activa; sigue pendiente en Drive"
                      >
                        <EyeOff size={15} /> Ignorar
                      </button>
                    </>
                  )
                ) : null}
                <button
                  className="secondary"
                  disabled={!row.folder}
                  title={row.folder ? undefined : 'Aún no hay carpeta del talento'}
                  onClick={() => openDrive(row.folder?.id)}
                >
                  <FolderOpen size={15} /> Ir al Drive
                </button>
                {!readonly && (
                  <button
                    className="primary"
                    disabled={busyLogin === row.login}
                    onClick={() => void ensureFolder(row)}
                  >
                    <FolderPlus size={15} />
                    {row.folder ? 'Crear carpetas faltantes' : 'Crear carpeta del talento'}
                  </button>
                )}
              </footer>
            </article>
          )})}
        </div>
      )}
    </>
  )
}

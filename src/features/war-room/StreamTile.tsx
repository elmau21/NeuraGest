import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ExternalLink,
  Film,
  Maximize2,
  MessageSquare,
  Minimize2,
  UserCheck,
  Volume2,
  VolumeX,
  X,
  UserRound,
} from '@/components/icons'
import type { Talent } from '@/types'
import {
  buildTwitchChannelUrl,
  buildTwitchChatUrl,
  buildTwitchPlayerUrl,
  canEmbedTwitchPlayer,
} from './twitch-embed'
import { openTwitchWithAccount } from '@/services/twitch-watch'
import { createTwitchClip, fetchLiveExtras, type LiveExtras } from '@/services/helix-live'
import { toastError, toastSuccess } from '@/stores/toast-store'

type StreamTileProps = {
  talent: Talent
  muted: boolean
  chatOpen: boolean
  maximized: boolean
  onToggleMute: () => void
  onToggleChat: () => void
  onToggleMaximize: () => void
  onRemove: () => void
}

export function StreamTile({
  talent,
  muted,
  chatOpen,
  maximized,
  onToggleMute,
  onToggleChat,
  onToggleMaximize,
  onRemove,
}: StreamTileProps) {
  const embedOk = canEmbedTwitchPlayer()
  const playerSrc = buildTwitchPlayerUrl(talent.login, { muted, autoplay: true })
  const chatSrc = buildTwitchChatUrl(talent.login)
  const channelUrl = buildTwitchChannelUrl(talent.login)
  const [extras, setExtras] = useState<LiveExtras | null>(null)
  const [clipBusy, setClipBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      void fetchLiveExtras(talent.login, talent.viewers)
        .then((row) => {
          if (!cancelled) setExtras(row)
        })
        .catch(() => {
          if (!cancelled) setExtras(null)
        })
    }
    load()
    const timer = window.setInterval(load, 45_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [talent.login, talent.viewers])

  const watchWithAccount = () => {
    void openTwitchWithAccount(talent.login).then((mode) => {
      toastSuccess(
        mode === 'window'
          ? 'Ventana abierta: inicia sesión en Twitch ahí si aún no lo has hecho; así sí cuenta tu view.'
          : 'Abierto en el navegador. Con tu sesión de Twitch, sí cuenta tu view.',
      )
    })
  }

  const clipNow = () => {
    setClipBusy(true)
    void createTwitchClip(talent.login)
      .then((clip) => {
        toastSuccess('Clip creado — se abre el editor de Twitch')
        window.open(clip.editUrl || clip.url, '_blank', 'noopener,noreferrer')
      })
      .catch((err) => toastError(err instanceof Error ? err.message : String(err)))
      .finally(() => setClipBusy(false))
  }

  const chattersLabel = extras?.chatters?.available
    ? extras.chatters.chatters.toLocaleString('es-MX')
    : '—'
  const adsNote = extras?.ads?.available
    ? (extras.ads.nextAdAt
        ? `Próx. ad ${new Date(extras.ads.nextAdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
        : 'Sin ad programado')
    : extras?.ads?.note ?? null
  const goal = extras?.goals?.goals?.[0]

  return (
    <article
      className={`card wr-stream-tile${maximized ? ' is-maximized' : ''}${chatOpen ? ' has-chat' : ''}`}
      data-login={talent.login}
    >
      <header className="wr-stream-head">
        <div className="wr-stream-identity">
          {talent.avatar ? (
            <img src={talent.avatar} alt="" />
          ) : (
            <div className="avatar-placeholder">{talent.displayName.slice(0, 2)}</div>
          )}
          <div>
            <b>{talent.displayName}</b>
            <span>
              @{talent.login}
              {talent.category ? ` · ${talent.category}` : ''}
            </span>
          </div>
        </div>
        <span className="ops-live-pill">● LIVE</span>
        <strong className="wr-stream-viewers" title="Viewers en vivo">
          {talent.viewers.toLocaleString('es-MX')}
          <small className="wr-chatters-vs">chat {chattersLabel}</small>
        </strong>
        <div className="wr-stream-actions">
          <button
            type="button"
            className="wr-icon-btn"
            title="Clip ahora"
            aria-label={`Crear clip de ${talent.displayName}`}
            disabled={clipBusy}
            onClick={clipNow}
          >
            <Film size={14} />
          </button>
          <button
            type="button"
            className="wr-icon-btn wr-icon-account"
            title="Ver con mi cuenta (sí cuenta view)"
            aria-label={`Ver ${talent.displayName} con mi cuenta de Twitch`}
            onClick={watchWithAccount}
          >
            <UserCheck size={14} />
          </button>
          <button
            type="button"
            className="wr-icon-btn"
            title={muted ? 'Activar sonido' : 'Silenciar'}
            aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            onClick={onToggleMute}
            disabled={!embedOk}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            type="button"
            className={`wr-icon-btn${chatOpen ? ' is-active' : ''}`}
            title={chatOpen ? 'Ocultar chat' : 'Mostrar chat'}
            aria-label={chatOpen ? 'Ocultar chat' : 'Mostrar chat'}
            onClick={onToggleChat}
            disabled={!embedOk}
          >
            <MessageSquare size={14} />
          </button>
          <button
            type="button"
            className="wr-icon-btn"
            title={maximized ? 'Restaurar mosaico' : 'Maximizar'}
            aria-label={maximized ? 'Restaurar mosaico' : 'Maximizar'}
            onClick={onToggleMaximize}
          >
            {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <a
            className="wr-icon-btn"
            href={channelUrl}
            target="_blank"
            rel="noreferrer"
            title="Abrir en Twitch (navegador)"
            aria-label={`Abrir ${talent.displayName} en Twitch`}
          >
            <ExternalLink size={14} />
          </a>
          <Link
            className="wr-icon-btn"
            to={`/talento/${talent.login}`}
            title="Ver perfil"
            aria-label={`Ver perfil de ${talent.displayName}`}
          >
            <UserRound size={14} />
          </Link>
          <button
            type="button"
            className="wr-icon-btn wr-icon-danger"
            title="Quitar del mosaico"
            aria-label={`Quitar a ${talent.displayName} del mosaico`}
            onClick={onRemove}
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="wr-stream-body">
        <div className="wr-player-wrap">
          {embedOk ? (
            <iframe
              key={`${talent.login}-${muted ? 'm' : 'u'}`}
              src={playerSrc}
              title={`Stream de ${talent.displayName}`}
              allow="autoplay; fullscreen"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <div className="wr-player-fallback" role="status">
              <b>No se puede mostrar el stream aquí</b>
              <span>
                Twitch bloquea el reproductor en esta ventana. Usa «Ver con mi cuenta» para abrirlo
                con tu sesión (así sí cuenta tu view).
              </span>
              <button type="button" className="secondary" onClick={watchWithAccount}>
                Ver con mi cuenta
              </button>
            </div>
          )}
        </div>
        {chatOpen && embedOk && (
          <div className="wr-chat-wrap">
            <iframe
              src={chatSrc}
              title={`Chat de ${talent.displayName}`}
              loading="lazy"
            />
          </div>
        )}
      </div>

      <div className="wr-stream-foot">
        {talent.title ? <p className="wr-stream-title">{talent.title}</p> : null}
        <div className="wr-helix-meta">
          {(talent.tags ?? extras?.channel?.tags ?? []).slice(0, 4).map((tag) => (
            <span key={tag} className="signal-chip">{tag}</span>
          ))}
          {(talent.language || extras?.channel?.language) && (
            <span className="signal-chip">{talent.language || extras?.channel?.language}</span>
          )}
          {(talent.contentClassificationLabels ?? extras?.channel?.contentClassificationLabels ?? [])
            .slice(0, 2)
            .map((label) => (
              <span key={label} className="signal-chip ccl">{label}</span>
            ))}
          {adsNote ? <span className="signal-chip ads" title="Ventana de ads">{adsNote}</span> : null}
          {goal ? (
            <span className="signal-chip goal" title={goal.description}>
              Goal {goal.currentAmount}/{goal.targetAmount}
            </span>
          ) : null}
          {extras?.subscriptions?.available ? (
            <span className="signal-chip subs">
              Subs {extras.subscriptions.total} · pts {extras.subscriptions.points}
            </span>
          ) : null}
        </div>
        <button type="button" className="wr-account-cta" onClick={watchWithAccount}>
          <UserCheck size={13} />
          Ver con mi cuenta
        </button>
      </div>
    </article>
  )
}

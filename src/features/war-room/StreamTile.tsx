import { Link } from 'react-router-dom'
import {
  ExternalLink,
  Maximize2,
  MessageSquare,
  Minimize2,
  Volume2,
  VolumeX,
  X,
  UserRound,
} from 'lucide-react'
import type { Talent } from '@/types'
import {
  buildTwitchChannelUrl,
  buildTwitchChatUrl,
  buildTwitchPlayerUrl,
  canEmbedTwitchPlayer,
} from './twitch-embed'

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
        <strong className="wr-stream-viewers">{talent.viewers.toLocaleString('es-MX')}</strong>
        <div className="wr-stream-actions">
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
            title="Abrir en Twitch"
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
                Twitch bloquea el reproductor en esta ventana. Ábrelo en el navegador para ver el
                directo.
              </span>
              <a className="secondary" href={channelUrl} target="_blank" rel="noreferrer">
                Ver en Twitch
              </a>
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

      {talent.title ? <p className="wr-stream-title">{talent.title}</p> : null}
    </article>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, Plus, Trash2 } from 'lucide-react'
import type { Talent } from '@/types'
import { StreamTile } from './StreamTile'
import { MAX_MOSAIC_STREAMS } from './twitch-embed'

type MultiStreamMosaicProps = {
  liveTalents: Talent[]
}

function sameLogins(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  return a.every((login, i) => login === b[i])
}

export function MultiStreamMosaic({ liveTalents }: MultiStreamMosaicProps) {
  const [mosaicLogins, setMosaicLogins] = useState<string[]>([])
  const [muted, setMuted] = useState<Record<string, boolean>>({})
  const [chatLogin, setChatLogin] = useState<string | null>(null)
  const [maximizedLogin, setMaximizedLogin] = useState<string | null>(null)
  const skipAutoFill = useRef(false)

  const liveByLogin = useMemo(() => {
    const map = new Map<string, Talent>()
    for (const talent of liveTalents) map.set(talent.login, talent)
    return map
  }, [liveTalents])

  useEffect(() => {
    const liveOrder = liveTalents.map((t) => t.login)
    const liveSet = new Set(liveOrder)

    setMosaicLogins((prev) => {
      const kept = prev.filter((login) => liveSet.has(login))
      let next = kept
      if (kept.length === 0 && liveOrder.length > 0 && !skipAutoFill.current) {
        next = liveOrder.slice(0, MAX_MOSAIC_STREAMS)
      }
      return sameLogins(prev, next) ? prev : next
    })

    setMaximizedLogin((prev) => (prev && liveSet.has(prev) ? prev : null))
    setChatLogin((prev) => (prev && liveSet.has(prev) ? prev : null))
  }, [liveTalents])

  const mosaicTalents = useMemo(
    () => mosaicLogins.map((login) => liveByLogin.get(login)).filter((t): t is Talent => Boolean(t)),
    [mosaicLogins, liveByLogin],
  )

  const availableToAdd = useMemo(
    () => liveTalents.filter((t) => !mosaicLogins.includes(t.login)),
    [liveTalents, mosaicLogins],
  )

  const atCapacity = mosaicLogins.length >= MAX_MOSAIC_STREAMS
  const gridClass = maximizedLogin
    ? 'wr-mosaic-grid is-maximized-mode'
    : `wr-mosaic-grid wr-cols-${Math.min(Math.max(mosaicTalents.length, 1), 3)}`

  function addToMosaic(login: string) {
    skipAutoFill.current = false
    setMosaicLogins((prev) => {
      if (prev.includes(login) || prev.length >= MAX_MOSAIC_STREAMS) return prev
      return [...prev, login]
    })
    setMuted((prev) => ({ ...prev, [login]: prev[login] ?? true }))
  }

  function removeFromMosaic(login: string) {
    setMosaicLogins((prev) => {
      const next = prev.filter((l) => l !== login)
      if (next.length === 0) skipAutoFill.current = true
      return next
    })
    if (chatLogin === login) setChatLogin(null)
    if (maximizedLogin === login) setMaximizedLogin(null)
  }

  function addAllLive() {
    skipAutoFill.current = false
    const next = liveTalents.slice(0, MAX_MOSAIC_STREAMS).map((t) => t.login)
    setMosaicLogins(next)
    setMuted((prev) => {
      const copy = { ...prev }
      for (const login of next) copy[login] = copy[login] ?? true
      return copy
    })
  }

  function clearMosaic() {
    skipAutoFill.current = true
    setMosaicLogins([])
    setChatLogin(null)
    setMaximizedLogin(null)
  }

  if (liveTalents.length === 0) return null

  return (
    <section className="wr-mosaic card" aria-label="Mosaico multi-stream">
      <div className="wr-mosaic-toolbar">
        <div className="wr-mosaic-title">
          <LayoutGrid size={16} />
          <div>
            <h2>Mosaico en vivo</h2>
            <p>
              Hasta {MAX_MOSAIC_STREAMS} streams a la vez · {mosaicTalents.length} en el mosaico
            </p>
          </div>
        </div>
        <div className="wr-mosaic-toolbar-actions">
          <button
            type="button"
            className="secondary"
            disabled={liveTalents.length === 0}
            onClick={addAllLive}
          >
            <Plus size={14} />
            Añadir en directo
          </button>
          <button
            type="button"
            className="secondary"
            disabled={mosaicLogins.length === 0}
            onClick={clearMosaic}
          >
            <Trash2 size={14} />
            Vaciar
          </button>
        </div>
      </div>

      <div className="wr-mosaic-picker" role="group" aria-label="Talentos en directo">
        {liveTalents.map((talent) => {
          const selected = mosaicLogins.includes(talent.login)
          const disabled = !selected && atCapacity
          return (
            <button
              key={talent.id}
              type="button"
              className={`wr-picker-pill${selected ? ' is-selected' : ''}`}
              disabled={disabled}
              title={
                disabled
                  ? `Máximo ${MAX_MOSAIC_STREAMS} streams`
                  : selected
                    ? 'Quitar del mosaico'
                    : 'Añadir al mosaico'
              }
              onClick={() => (selected ? removeFromMosaic(talent.login) : addToMosaic(talent.login))}
            >
              {talent.avatar ? <img src={talent.avatar} alt="" /> : null}
              <span>{talent.displayName}</span>
              <em>{talent.viewers.toLocaleString('es-MX')}</em>
            </button>
          )
        })}
      </div>

      {mosaicTalents.length === 0 ? (
        <div className="wr-mosaic-empty">
          <b>Ningún stream en el mosaico</b>
          <span>
            Elige talentos arriba
            {availableToAdd.length > 0 ? ` (${availableToAdd.length} disponibles)` : ''} o pulsa
            «Añadir en directo».
          </span>
        </div>
      ) : (
        <div className={gridClass}>
          {mosaicTalents.map((talent) => {
            const isMax = maximizedLogin === talent.login
            if (maximizedLogin && !isMax) return null
            return (
              <StreamTile
                key={talent.login}
                talent={talent}
                muted={muted[talent.login] ?? true}
                chatOpen={chatLogin === talent.login}
                maximized={isMax}
                onToggleMute={() =>
                  setMuted((prev) => ({
                    ...prev,
                    [talent.login]: !(prev[talent.login] ?? true),
                  }))
                }
                onToggleChat={() =>
                  setChatLogin((prev) => (prev === talent.login ? null : talent.login))
                }
                onToggleMaximize={() =>
                  setMaximizedLogin((prev) => (prev === talent.login ? null : talent.login))
                }
                onRemove={() => removeFromMosaic(talent.login)}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

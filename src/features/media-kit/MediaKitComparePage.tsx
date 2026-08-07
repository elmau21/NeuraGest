import { useCallback, useEffect, useMemo, useState } from 'react'
import { Columns2, Download, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { isTauri } from '@/services/twitch'
import { computeMediaKitStats, generateMediaKitPdf, loadMediaKitData, type MediaKitStats } from '@/services/media-kit'

function MetricRow({ label, left, right, format = (v: number) => v.toLocaleString('es-MX') }: {
  label: string
  left: number
  right: number
  format?: (v: number) => string
}) {
  const delta = left - right
  const winner = delta > 0 ? 'left' : delta < 0 ? 'right' : 'tie'
  return (
    <div className="mk-compare-row">
      <span className={winner === 'left' ? 'mk-compare-win' : ''}>{format(left)}</span>
      <span className="mk-compare-label">{label}</span>
      <span className={winner === 'right' ? 'mk-compare-win' : ''}>{format(right)}</span>
    </div>
  )
}

function TalentColumn({ login, stats, displayName, avatar }: {
  login: string
  displayName: string
  avatar?: string
  stats: MediaKitStats | null
}) {
  return (
    <div className="mk-compare-col">
      <header>
        {avatar ? <img src={avatar} alt="" /> : <div className="avatar-placeholder">{displayName.slice(0, 2)}</div>}
        <div><b>{displayName}</b><span>@{login}</span></div>
      </header>
      {stats ? (
        <dl>
          <div><dt>Followers</dt><dd>{stats.followers.toLocaleString('es-MX')}</dd></div>
          <div><dt>Avg viewers</dt><dd>{stats.avgViewers.toLocaleString('es-MX')}</dd></div>
          <div><dt>Peak viewers</dt><dd>{stats.peakViewers.toLocaleString('es-MX')}</dd></div>
          <div><dt>Días stream</dt><dd>{stats.streamDays}</dd></div>
          <div><dt>Estado</dt><dd>{stats.isLive ? `En vivo · ${stats.viewers.toLocaleString('es-MX')}` : 'Offline'}</dd></div>
        </dl>
      ) : (
        <p className="empty-state">Cargando…</p>
      )}
    </div>
  )
}

export function MediaKitComparePage() {
  const talents = useAppStore((s) => s.talents)
  const [leftLogin, setLeftLogin] = useState(talents[0]?.login ?? '')
  const [rightLogin, setRightLogin] = useState(talents[1]?.login ?? talents[0]?.login ?? '')
  const [leftStats, setLeftStats] = useState<MediaKitStats | null>(null)
  const [rightStats, setRightStats] = useState<MediaKitStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const leftTalent = useMemo(() => talents.find((t) => t.login === leftLogin), [talents, leftLogin])
  const rightTalent = useMemo(() => talents.find((t) => t.login === rightLogin), [talents, rightLogin])

  const reload = useCallback(async () => {
    if (!isTauri || !leftLogin || !rightLogin) return
    setLoading(true)
    setError(null)
    try {
      const [leftData, rightData] = await Promise.all([
        loadMediaKitData(leftLogin, talents),
        loadMediaKitData(rightLogin, talents),
      ])
      setLeftStats(leftData ? computeMediaKitStats(leftData) : null)
      setRightStats(rightData ? computeMediaKitStats(rightData) : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [leftLogin, rightLogin, talents])

  useEffect(() => { void reload() }, [reload])

  const exportBoth = async () => {
    for (const login of [leftLogin, rightLogin]) {
      const data = await loadMediaKitData(login, talents)
      if (data) await generateMediaKitPdf(data)
    }
  }

  if (!isTauri) {
    return <div className="card agency-gate"><p>Comparador de media kits requiere la app de escritorio y conexión con Twitch.</p></div>
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1><Columns2 size={22} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />Comparador media kits</h1>
          <p>Compara dos talentos lado a lado con métricas de Twitch de la última semana.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" disabled={loading} onClick={() => void reload()}>
            <RefreshCw size={16} />{loading ? '…' : 'Actualizar'}
          </button>
          <button className="primary" disabled={!leftLogin || !rightLogin} onClick={() => void exportBoth()}>
            <Download size={16} /> Exportar ambos PDF
          </button>
        </div>
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="card mk-compare-selectors">
        <label className="ops-field">
          Talento A
          <select value={leftLogin} onChange={(e) => setLeftLogin(e.target.value)}>
            {talents.map((t) => <option key={t.login} value={t.login}>{t.displayName}</option>)}
          </select>
        </label>
        <span className="mk-compare-vs">vs</span>
        <label className="ops-field">
          Talento B
          <select value={rightLogin} onChange={(e) => setRightLogin(e.target.value)}>
            {talents.map((t) => <option key={t.login} value={t.login}>{t.displayName}</option>)}
          </select>
        </label>
      </div>

      <div className="mk-compare-grid">
        <TalentColumn
          login={leftLogin}
          displayName={leftTalent?.displayName ?? leftLogin}
          avatar={leftTalent?.avatar}
          stats={leftStats}
        />
        <div className="card mk-compare-delta">
          <h3>Comparativa</h3>
          {leftStats && rightStats ? (
            <>
              <MetricRow label="Followers" left={leftStats.followers} right={rightStats.followers} />
              <MetricRow label="Avg viewers" left={leftStats.avgViewers} right={rightStats.avgViewers} />
              <MetricRow label="Peak viewers" left={leftStats.peakViewers} right={rightStats.peakViewers} />
              <MetricRow label="Días stream" left={leftStats.streamDays} right={rightStats.streamDays} />
            </>
          ) : (
            <p className="empty-state">Selecciona dos talentos distintos.</p>
          )}
        </div>
        <TalentColumn
          login={rightLogin}
          displayName={rightTalent?.displayName ?? rightLogin}
          avatar={rightTalent?.avatar}
          stats={rightStats}
        />
      </div>
    </>
  )
}

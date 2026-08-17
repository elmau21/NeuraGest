import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, ExternalLink, RefreshCw } from '@/components/icons'
import { Link } from 'react-router-dom'
import { fetchStreamEvents } from '@/services/metrics'
import { listCalendarEventsOps } from '@/services/ops'
import { listDbTalents } from '@/services/agency'
import { isTauri } from '@/services/twitch'
import {
  buildScheduleCompliance,
  complianceSummary,
  COMPLIANCE_STATUS_LABELS,
  type ScheduleComplianceRow,
} from '@/services/schedule-compliance'

const STATUS_CLASS: Record<ScheduleComplianceRow['status'], string> = {
  on_time: 'ok',
  late: 'warning',
  early: 'info',
  missed: 'critical',
  unscheduled: 'neutral',
}

export function ScheduleCompliancePanel() {
  const [rows, setRows] = useState<ScheduleComplianceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(undefined)
    try {
      const [events, streams, talents] = await Promise.all([
        listCalendarEventsOps(),
        fetchStreamEvents(14 * 24),
        listDbTalents(),
      ])
      const loginsByTalentId = Object.fromEntries(talents.map((t) => [t.id, t.login]))
      setRows(buildScheduleCompliance(events, streams, loginsByTalentId, 14))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const summary = useMemo(() => complianceSummary(rows), [rows])

  if (!isTauri) {
    return <div className="ti-empty">Cumplimiento schedule requiere la app de escritorio y sincronización en la nube.</div>
  }

  return (
    <section className="ti-panel">
      <header>
        <div>
          <h2><CalendarCheck size={14} /> Cumplimiento de schedule</h2>
          <p>Integrado con calendario ops y eventos de transmisión · ver detalle en <Link to="/schedule">Schedule</Link></p>
        </div>
        <div className="ti-header-actions">
          <Link to="/schedule" className="ti-link"><ExternalLink size={13} /> Vista completa</Link>
          <button className="ti-sync" disabled={loading} onClick={() => void reload()}>
            <RefreshCw size={13} />{loading ? '…' : 'Actualizar'}
          </button>
        </div>
      </header>

      {error && <p className="integration-note">{error}</p>}

      <div className="ti-compliance-summary">
        <article><span>Cumplimiento</span><strong>{summary.compliancePct}%</strong></article>
        <article><span>A tiempo</span><strong>{summary.onTime}/{summary.total}</strong></article>
        <article><span>No realizado</span><strong className={summary.missed > 0 ? 'critical' : ''}>{summary.missed}</strong></article>
        <article><span>Sin programar</span><strong>{summary.unscheduled}</strong></article>
      </div>

      <div className="ti-compliance-table">
        <div className="table-header">
          <span>Talento</span><span>Evento</span><span>Planificado</span><span>Real</span><span>Estado</span>
        </div>
        {rows.slice(0, 12).map((row) => (
          <div className="table-row" key={row.id}>
            <span>@{row.talentLogin}</span>
            <span><b>{row.title}</b></span>
            <span>{row.scheduledAt ? new Date(row.scheduledAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
            <span>{row.actualAt ? new Date(row.actualAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
            <span className={`ti-status ${STATUS_CLASS[row.status]}`}>{COMPLIANCE_STATUS_LABELS[row.status]}</span>
          </div>
        ))}
        {!loading && rows.length === 0 && (
          <div className="ti-empty">Sin eventos stream en calendario ops (ventana 14 días).</div>
        )}
      </div>
    </section>
  )
}

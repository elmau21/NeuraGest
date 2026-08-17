import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarCheck, RefreshCw } from '@/components/icons'
import { isTauri } from '@/services/twitch'
import { fetchStreamEvents } from '@/services/metrics'
import { listCalendarEventsOps } from '@/services/ops'
import { listDbTalents } from '@/services/agency'
import {
  buildScheduleCompliance,
  complianceSummary,
  COMPLIANCE_STATUS_LABELS,
} from '@/services/schedule-compliance'

export function ScheduleCompliancePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState(14)

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [events, streams, talents] = await Promise.all([
        listCalendarEventsOps(),
        fetchStreamEvents(windowDays * 24),
        listDbTalents(),
      ])
      const loginsByTalentId = Object.fromEntries(talents.map((t) => [t.id, t.login]))
      const rows = buildScheduleCompliance(events, streams, loginsByTalentId, windowDays)
      setRows(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [windowDays])

  const [rows, setRows] = useState<ReturnType<typeof buildScheduleCompliance>>([])

  useEffect(() => { void reload() }, [reload])

  const summary = useMemo(() => complianceSummary(rows), [rows])

  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>Comparativa schedule vs streams reales requiere la app de escritorio y sincronización en la nube.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Cumplimiento de schedule</h1>
          <p>Calendario planificado vs streams reales detectados en Twitch.</p>
        </div>
        <div className="page-actions">
          <label className="ops-inline-select">
            Ventana
            <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
              <option value={7}>7 días</option>
              <option value={14}>14 días</option>
              <option value={30}>30 días</option>
            </select>
          </label>
          <button className="secondary" disabled={loading} onClick={() => void reload()}>
            <RefreshCw size={16} />{loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="kpi-grid ops-kpi-4">
        <div className="card"><span>Cumplimiento</span><b>{summary.compliancePct}%</b></div>
        <div className="card"><span>A tiempo</span><b>{summary.onTime}</b></div>
        <div className="card"><span>No realizado</span><b>{summary.missed}</b></div>
        <div className="card"><span>Sin programar</span><b>{summary.unscheduled}</b></div>
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="card">
        <div className="ops-table-head">
          <CalendarCheck size={16} />
          <span>Comparativa calendario ↔ Twitch ({rows.length} filas)</span>
        </div>
        <div className="agency-crm-table ops-compliance-table">
          <div className="table-header ops-compliance-head">
            <span>Talento</span><span>Evento</span><span>Programado</span><span>Real (Twitch)</span><span>Estado</span><span>Detalle</span>
          </div>
          {rows.map((row) => (
            <div className="table-row ops-compliance-row" key={row.id}>
              <span>@{row.talentLogin}</span>
              <span className="agency-truncate">{row.title}</span>
              <span>{row.scheduledAt ? new Date(row.scheduledAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
              <span>{row.actualAt ? new Date(row.actualAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
              <span className={`ops-compliance-badge ${row.status}`}>{COMPLIANCE_STATUS_LABELS[row.status]}</span>
              <span className="agency-truncate">{row.detail}</span>
            </div>
          ))}
          {!loading && rows.length === 0 && (
            <p className="empty-state"><AlertTriangle size={14} /> No hay eventos stream en la ventana seleccionada.</p>
          )}
        </div>
      </div>
    </>
  )
}

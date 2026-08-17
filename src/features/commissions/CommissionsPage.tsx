import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Trash2, TrendingUp, FileText, Receipt } from '@/components/icons'
import { isTauri } from '@/services/twitch'
import {
  COMMISSION_STATUS_LABELS,
  deleteCommissionEntry,
  listCommissionEntries,
  saveCommissionEntry,
  type CommissionEntry,
  type CommissionStatus,
} from '@/services/ops'
import { listDbTalents, listSponsorshipDeals, type SponsorshipDeal } from '@/services/agency'
import { downloadCommissionFactura, downloadCommissionRecibo } from '@/services/commission-pdf'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

function monthStart(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function addMonths(isoMonth: string, delta: number) {
  const d = new Date(`${isoMonth}T12:00:00`)
  d.setMonth(d.getMonth() + delta)
  return monthStart(d)
}

export function CommissionsPage() {
  const [entries, setEntries] = useState<CommissionEntry[]>([])
  const [deals, setDeals] = useState<SponsorshipDeal[]>([])
  const [talents, setTalents] = useState<Awaited<ReturnType<typeof listDbTalents>>>([])
  const [month, setMonth] = useState(monthStart())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<Partial<CommissionEntry> & { label: string; periodMonth: string; grossAmount: number; agencyRatePct: number; status: CommissionStatus }>({
    label: '',
    periodMonth: monthStart(),
    grossAmount: 0,
    agencyRatePct: 20,
    status: 'forecast',
  })

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [rows, dealRows, dbTalents] = await Promise.all([
        listCommissionEntries(month),
        listSponsorshipDeals(),
        listDbTalents(),
      ])
      setEntries(rows)
      setDeals(dealRows)
      setTalents(dbTalents)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { void reload() }, [reload])

  const totals = useMemo(() => {
    const gross = entries.reduce((s, e) => s + e.grossAmount, 0)
    const agency = entries.reduce((s, e) => s + e.agencyAmount, 0)
    const talent = entries.reduce((s, e) => s + e.talentAmount, 0)
    const forecast = entries.filter((e) => e.status === 'forecast').reduce((s, e) => s + e.agencyAmount, 0)
    return { gross, agency, talent, forecast }
  }, [entries])

  const nextMonthForecast = useMemo(() => {
    const activeDeals = deals.filter((d) => d.status === 'active' || d.status === 'negotiating')
    return activeDeals.reduce((sum, deal) => {
      const monthly = (deal.dealValue ?? 0) / 12
      return sum + monthly * 0.2
    }, 0)
  }, [deals, month])

  const openNew = () => {
    setDraft({
      label: '',
      periodMonth: month,
      grossAmount: 0,
      agencyRatePct: 20,
      status: 'forecast',
    })
    setEditorOpen(true)
  }

  const save = async () => {
    if (!draft.label.trim()) return
    try {
      const saved = await saveCommissionEntry({
        id: draft.id,
        dealId: draft.dealId,
        talentId: draft.talentId,
        label: draft.label.trim(),
        periodMonth: draft.periodMonth,
        grossAmount: draft.grossAmount,
        agencyRatePct: draft.agencyRatePct,
        status: draft.status,
        notes: draft.notes,
      })
      setEntries((prev) => {
        const exists = prev.some((e) => e.id === saved.id)
        return exists ? prev.map((e) => e.id === saved.id ? saved : e) : [saved, ...prev]
      })
      setEditorOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteCommissionEntry(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const importFromDeals = async () => {
    const active = deals.filter((d) => (d.status === 'active' || d.status === 'negotiating') && d.dealValue)
    for (const deal of active.slice(0, 5)) {
      const existing = entries.some((e) => e.dealId === deal.id && e.periodMonth === month)
      if (existing) continue
      const saved = await saveCommissionEntry({
        dealId: deal.id,
        talentId: deal.talentId,
        label: `Comisión ${deal.brandName}`,
        periodMonth: month,
        grossAmount: Math.round((deal.dealValue ?? 0) / 12),
        agencyRatePct: 20,
        status: 'forecast',
        notes: 'Importado desde CRM',
      })
      setEntries((prev) => [saved, ...prev])
    }
  }

  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>Ledger de comisiones requiere la app de escritorio y sincronización en la nube.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Ledger de comisiones</h1>
          <p>Registro mensual, split agencia/talento y forecast del mes siguiente.</p>
        </div>
        <div className="page-actions">
          <label className="ops-inline-select">
            Mes
            <input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(`${e.target.value}-01`)} />
          </label>
          <button className="secondary" disabled={loading} onClick={() => void reload()}>
            <RefreshCw size={16} />{loading ? '…' : 'Actualizar'}
          </button>
          <button className="secondary" onClick={() => void importFromDeals()}>Importar CRM</button>
          <button className="primary" onClick={openNew}><Plus size={16} />Nueva línea</button>
        </div>
      </div>

      <div className="kpi-grid ops-kpi-4">
        <div className="card"><span>Bruto ({month.slice(0, 7)})</span><b>{currency.format(totals.gross)}</b></div>
        <div className="card"><span>Agencia</span><b>{currency.format(totals.agency)}</b></div>
        <div className="card"><span>Talento</span><b>{currency.format(totals.talent)}</b></div>
        <div className="card"><span><TrendingUp size={12} /> Forecast {addMonths(month, 1).slice(0, 7)}</span><b>{currency.format(nextMonthForecast + totals.forecast)}</b></div>
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="card">
        <div className="agency-crm-table ops-commission-table">
          <div className="table-header ops-commission-head">
            <span>Concepto</span><span>Talento</span><span>Bruto</span><span>% Agencia</span><span>Agencia</span><span>Talento</span><span>Estado</span><span>PDF</span><span />
          </div>
          {entries.map((entry) => (
            <div className="table-row ops-commission-row" key={entry.id}>
              <span><b>{entry.label}</b></span>
              <span>{entry.talentLogin ? `@${entry.talentLogin}` : '—'}</span>
              <span>{currency.format(entry.grossAmount)}</span>
              <span>{entry.agencyRatePct}%</span>
              <span>{currency.format(entry.agencyAmount)}</span>
              <span>{currency.format(entry.talentAmount)}</span>
              <span className={`ops-commission-status ${entry.status}`}>{COMMISSION_STATUS_LABELS[entry.status]}</span>
              <span className="ops-commission-pdf">
                <button className="icon-btn" title="Factura agencia" onClick={() => void downloadCommissionFactura(entry)} aria-label="Factura"><FileText size={14} /></button>
                <button className="icon-btn" title="Recibo talento" onClick={() => void downloadCommissionRecibo(entry)} aria-label="Recibo"><Receipt size={14} /></button>
              </span>
              <button className="icon-btn" onClick={() => void remove(entry.id)} aria-label="Eliminar"><Trash2 size={14} /></button>
            </div>
          ))}
          {!loading && entries.length === 0 && <p className="empty-state">Sin entradas para este mes.</p>}
        </div>
      </div>

      {editorOpen && (
        <div className="modal-backdrop" onClick={() => setEditorOpen(false)}>
          <div className="agency-modal card" onClick={(e) => e.stopPropagation()}>
            <h3>Nueva comisión</h3>
            <label>Concepto<input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
            <label>Deal CRM
              <select value={draft.dealId ?? ''} onChange={(e) => {
                const deal = deals.find((d) => d.id === e.target.value)
                setDraft({
                  ...draft,
                  dealId: e.target.value || undefined,
                  talentId: deal?.talentId,
                  label: deal ? `Comisión ${deal.brandName}` : draft.label,
                  grossAmount: deal?.dealValue ? Math.round(deal.dealValue / 12) : draft.grossAmount,
                })
              }}>
                <option value="">Sin deal</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.brandName}</option>)}
              </select>
            </label>
            <label>Talento
              <select value={draft.talentId ?? ''} onChange={(e) => setDraft({ ...draft, talentId: e.target.value || undefined })}>
                <option value="">—</option>
                {talents.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
              </select>
            </label>
            <div className="agency-form-row">
              <label>Bruto (MXN)<input type="number" value={draft.grossAmount} onChange={(e) => setDraft({ ...draft, grossAmount: Number(e.target.value) })} /></label>
              <label>% Agencia<input type="number" value={draft.agencyRatePct} onChange={(e) => setDraft({ ...draft, agencyRatePct: Number(e.target.value) })} /></label>
            </div>
            <label>Estado
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CommissionStatus })}>
                {Object.entries(COMMISSION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Notas<textarea value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} /></label>
            <div className="agency-modal-actions">
              <button className="secondary" onClick={() => setEditorOpen(false)}>Cancelar</button>
              <button className="primary" onClick={() => void save()}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertOctagon, CalendarDays, CheckSquare, Clock, Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  deleteSponsorshipDeal,
  listDbTalents,
  listSponsorshipDeals,
  saveSponsorshipDeal,
  SPONSORSHIP_STATUS_LABELS,
  type DbTalent,
  type SponsorshipDeal,
  type SponsorshipStatus,
} from '@/services/agency'
import { deleteBrandRestriction, listBrandRestrictions, saveBrandRestriction, type BrandRestriction, type BrandRestrictionKind, RESTRICTION_KIND_LABELS } from '@/services/ops'
import { detectDealConflicts, hasBlockingConflicts } from '@/services/deal-conflicts'
import { summarizeCrmSla } from '@/services/crm-sla'
import { isTauri } from '@/services/twitch'
import { logCrmDealActivity } from '@/services/audit'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

export function CrmPage() {
  const [deals, setDeals] = useState<SponsorshipDeal[]>([])
  const [talents, setTalents] = useState<DbTalent[]>([])
  const [restrictions, setRestrictions] = useState<BrandRestriction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [restrictionsOpen, setRestrictionsOpen] = useState(false)
  const [restrictionDraft, setRestrictionDraft] = useState<Partial<BrandRestriction> & { talentId: string; kind: BrandRestrictionKind; brandName: string }>({
    talentId: '',
    kind: 'exclusivity',
    brandName: '',
    blockedCategories: [],
  })
  const [draft, setDraft] = useState<Partial<SponsorshipDeal> & { brandName: string; progressPercent: number; status: SponsorshipStatus }>({
    brandName: '',
    progressPercent: 0,
    status: 'lead',
    currency: 'MXN',
  })

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [rows, dbTalents, restrictionRows] = await Promise.all([
        listSponsorshipDeals(),
        listDbTalents(),
        listBrandRestrictions(),
      ])
      setDeals(rows)
      setTalents(dbTalents)
      setRestrictions(restrictionRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const filtered = useMemo(() => deals.filter((deal) =>
    `${deal.brandName} ${deal.talentLogin ?? ''} ${deal.deliverables ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  ), [deals, query])

  const pipelineValue = useMemo(() =>
    filtered.filter((d) => d.status === 'active' || d.status === 'negotiating')
      .reduce((sum, d) => sum + (d.dealValue ?? 0), 0),
  [filtered])

  const conflicts = useMemo(
    () => detectDealConflicts({ draft, deals, restrictions }),
    [draft, deals, restrictions],
  )

  const blocking = hasBlockingConflicts(conflicts)

  const sla = useMemo(() => summarizeCrmSla(deals), [deals])

  const openNew = () => {
    setDraft({ brandName: '', progressPercent: 0, status: 'lead', currency: 'MXN', deliverables: '', notes: '' })
    setEditorOpen(true)
  }

  const openEdit = (deal: SponsorshipDeal) => {
    setDraft(deal)
    setEditorOpen(true)
  }

  const save = async () => {
    if (!draft.brandName.trim()) return
    if (blocking) {
      setError('Resuelve los conflictos de exclusividad/blackout antes de guardar.')
      return
    }
    try {
      const saved = await saveSponsorshipDeal({
        id: draft.id,
        brandName: draft.brandName.trim(),
        talentId: draft.talentId,
        dealValue: draft.dealValue,
        currency: draft.currency,
        deliverables: draft.deliverables,
        startDate: draft.startDate,
        endDate: draft.endDate,
        progressPercent: draft.progressPercent ?? 0,
        status: draft.status ?? 'lead',
        taskId: draft.taskId,
        calendarEventId: draft.calendarEventId,
        notes: draft.notes,
      })
      setDeals((prev) => {
        const exists = prev.some((d) => d.id === saved.id)
        return exists ? prev.map((d) => d.id === saved.id ? saved : d) : [saved, ...prev]
      })
      void logCrmDealActivity('saved', saved.brandName, saved.id)
      setEditorOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const saveRestriction = async () => {
    if (!restrictionDraft.talentId || !restrictionDraft.brandName.trim()) return
    try {
      const saved = await saveBrandRestriction({
        id: restrictionDraft.id,
        talentId: restrictionDraft.talentId,
        kind: restrictionDraft.kind,
        brandName: restrictionDraft.brandName,
        startsAt: restrictionDraft.startsAt,
        endsAt: restrictionDraft.endsAt,
        notes: restrictionDraft.notes,
      })
      setRestrictions((prev) => {
        const exists = prev.some((r) => r.id === saved.id)
        return exists ? prev.map((r) => r.id === saved.id ? saved : r) : [saved, ...prev]
      })
      setRestrictionDraft({ talentId: talents[0]?.id ?? '', kind: 'exclusivity', brandName: '', blockedCategories: [] })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const removeRestriction = async (id: string) => {
    try {
      await deleteBrandRestriction(id)
      setRestrictions((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const remove = async (id: string) => {
    try {
      const brand = deals.find((d) => d.id === id)?.brandName ?? 'patrocinio'
      await deleteSponsorshipDeal(id)
      void logCrmDealActivity('deleted', brand, id)
      setDeals((prev) => prev.filter((d) => d.id !== id))
      setEditorOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>Usa la app de escritorio NeuraGest para el CRM de patrocinios.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>CRM Patrocinios</h1>
          <p>Marcas, valor de deal, entregables y avance comercial.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" disabled={loading} onClick={() => void reload()}>
            <RefreshCw size={16} />{loading ? 'Cargando…' : 'Actualizar'}
          </button>
          <button className="secondary" onClick={() => setRestrictionsOpen(true)}>
            <ShieldAlert size={16} /> Exclusividad
          </button>
          <button className="primary" onClick={openNew}><Plus size={16} />Nuevo deal</button>
        </div>
      </div>

      <div className="kpi-grid agency-kpi">
        <div className="card"><span>Deals activos</span><b>{filtered.filter((d) => d.status === 'active').length}</b></div>
        <div className="card"><span>En negociación</span><b>{filtered.filter((d) => d.status === 'negotiating').length}</b></div>
        <div className="card"><span>Pipeline (MXN)</span><b>{currency.format(pipelineValue)}</b></div>
        <div className="card crm-sla-kpi"><span><Clock size={12} /> SLA respuesta</span><b>{sla.critical > 0 ? `${sla.critical} críticos` : sla.warning > 0 ? `${sla.warning} en alerta` : 'Al día'}</b><small>{sla.total} deals monitoreados</small></div>
      </div>

      {(sla.critical > 0 || sla.warning > 0) && (
        <div className={`card crm-sla-banner ${sla.critical > 0 ? 'critical' : 'warning'}`}>
          <Clock size={16} />
          <div>
            <b>{sla.critical > 0 ? `${sla.critical} deal(s) sin movimiento ≥14 días` : `${sla.warning} deal(s) sin movimiento ≥7 días`}</b>
            <p>Revisa leads y negociaciones activas — última actualización del deal determina el SLA.</p>
          </div>
        </div>
      )}

      {error && <p className="integration-note">{error}</p>}

      <div className="card">
        <div className="toolbar">
          <label className="search">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar marca o talento…" />
          </label>
        </div>
        <div className="agency-crm-table">
          <div className="table-header agency-crm-head">
            <span>Marca</span><span>Talento</span><span>Valor</span><span>Entregables</span><span>Fechas</span><span>Avance</span><span>SLA</span><span>Estado</span><span />
          </div>
          {filtered.map((deal) => {
            const slaInfo = sla.byDealId[deal.id]
            return (
            <div className="table-row agency-crm-row" key={deal.id}>
              <button className="agency-crm-brand" onClick={() => openEdit(deal)}><b>{deal.brandName}</b></button>
              <span>{deal.talentLogin ? `@${deal.talentLogin}` : '—'}</span>
              <span>{deal.dealValue != null ? currency.format(deal.dealValue) : '—'}</span>
              <span className="agency-truncate">{deal.deliverables || '—'}</span>
              <span>{deal.startDate ? `${deal.startDate}${deal.endDate ? ` → ${deal.endDate}` : ''}` : '—'}</span>
              <span className="agency-progress">
                <i style={{ width: `${deal.progressPercent}%` }} />
                {deal.progressPercent}%
              </span>
              <span>
                {slaInfo ? (
                  <span className={`crm-sla-badge ${slaInfo.level}`} title={`Último movimiento: ${new Date(slaInfo.lastMovement).toLocaleString('es-MX')}`}>
                    {slaInfo.daysIdle}d
                  </span>
                ) : '—'}
              </span>
              <span className={`agency-deal-status ${deal.status}`}>{SPONSORSHIP_STATUS_LABELS[deal.status]}</span>
              <span className="agency-crm-links">
                {deal.taskId && <Link to="/tareas" title="Ver tareas"><CheckSquare size={14} /></Link>}
                {deal.calendarEventId && <Link to="/calendario" title="Ver calendario"><CalendarDays size={14} /></Link>}
                <button className="icon-btn" onClick={() => void remove(deal.id)} aria-label="Eliminar"><Trash2 size={14} /></button>
              </span>
            </div>
          )})}
          {!loading && filtered.length === 0 && <p className="empty-state">No hay patrocinios registrados.</p>}
        </div>
      </div>

      {editorOpen && (
        <div className="modal-backdrop" onClick={() => setEditorOpen(false)}>
          <div className="agency-modal card" onClick={(e) => e.stopPropagation()}>
            <h3>{draft.id ? 'Editar patrocinio' : 'Nuevo patrocinio'}</h3>
            <label>Marca<input value={draft.brandName} onChange={(e) => setDraft({ ...draft, brandName: e.target.value })} /></label>
            <label>Talento
              <select value={draft.talentId ?? ''} onChange={(e) => setDraft({ ...draft, talentId: e.target.value || undefined })}>
                <option value="">Sin asignar</option>
                {talents.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
              </select>
            </label>
            <div className="agency-form-row">
              <label>Valor (MXN)<input type="number" value={draft.dealValue ?? ''} onChange={(e) => setDraft({ ...draft, dealValue: e.target.value ? Number(e.target.value) : undefined })} /></label>
              <label>Estado
                <select value={draft.status ?? 'lead'} onChange={(e) => setDraft({ ...draft, status: e.target.value as SponsorshipStatus })}>
                  {Object.entries(SPONSORSHIP_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
            <label>Entregables<textarea value={draft.deliverables ?? ''} onChange={(e) => setDraft({ ...draft, deliverables: e.target.value })} rows={2} /></label>
            <div className="agency-form-row">
              <label>Inicio<input type="date" value={draft.startDate ?? ''} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></label>
              <label>Fin<input type="date" value={draft.endDate ?? ''} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></label>
            </div>
            <label>Avance (%)
              <input type="range" min={0} max={100} value={draft.progressPercent ?? 0} onChange={(e) => setDraft({ ...draft, progressPercent: Number(e.target.value) })} />
              {draft.progressPercent ?? 0}%
            </label>
            <label>Notas<textarea value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} /></label>
            {conflicts.length > 0 && (
              <div className="ops-conflict-panel">
                <h4><AlertOctagon size={14} /> Detector exclusividad / blackout</h4>
                {conflicts.map((c) => (
                  <p key={`${c.code}-${c.detail}`} className={`ops-conflict ${c.severity}`}>
                    <b>{c.message}</b> — {c.detail}
                  </p>
                ))}
              </div>
            )}
            <p className="integration-note">Vincula tareas o eventos desde sus módulos copiando el UUID al guardar el deal.</p>
            <label>ID tarea (opcional)<input value={draft.taskId ?? ''} onChange={(e) => setDraft({ ...draft, taskId: e.target.value || undefined })} placeholder="uuid de tarea" /></label>
            <label>ID evento calendario (opcional)<input value={draft.calendarEventId ?? ''} onChange={(e) => setDraft({ ...draft, calendarEventId: e.target.value || undefined })} placeholder="uuid de evento" /></label>
            <div className="agency-modal-actions">
              <button className="secondary" onClick={() => setEditorOpen(false)}>Cancelar</button>
              <button className="primary" disabled={blocking} onClick={() => void save()} title={blocking ? 'Hay conflictos críticos' : undefined}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {restrictionsOpen && (
        <div className="modal-backdrop" onClick={() => setRestrictionsOpen(false)}>
          <div className="agency-modal card ops-restrictions-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reglas de exclusividad y blackout</h3>
            <div className="ops-restrictions-list">
              {restrictions.map((rule) => (
                <div className="ops-restriction-row" key={rule.id}>
                  <span className={`ops-restriction-kind ${rule.kind}`}>{RESTRICTION_KIND_LABELS[rule.kind]}</span>
                  <b>{rule.brandName}</b>
                  <span>@{rule.talentLogin ?? '—'} · {rule.startsAt ?? '—'} → {rule.endsAt ?? '—'}</span>
                  <button className="icon-btn" onClick={() => void removeRestriction(rule.id)} aria-label="Eliminar"><Trash2 size={14} /></button>
                </div>
              ))}
              {restrictions.length === 0 && <p className="empty-state">Sin reglas configuradas.</p>}
            </div>
            <label>Talento
              <select value={restrictionDraft.talentId} onChange={(e) => setRestrictionDraft({ ...restrictionDraft, talentId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {talents.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
              </select>
            </label>
            <div className="agency-form-row">
              <label>Tipo
                <select value={restrictionDraft.kind} onChange={(e) => setRestrictionDraft({ ...restrictionDraft, kind: e.target.value as BrandRestrictionKind })}>
                  {Object.entries(RESTRICTION_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>Marca<input value={restrictionDraft.brandName} onChange={(e) => setRestrictionDraft({ ...restrictionDraft, brandName: e.target.value })} /></label>
            </div>
            <div className="agency-form-row">
              <label>Inicio<input type="date" value={restrictionDraft.startsAt ?? ''} onChange={(e) => setRestrictionDraft({ ...restrictionDraft, startsAt: e.target.value })} /></label>
              <label>Fin<input type="date" value={restrictionDraft.endsAt ?? ''} onChange={(e) => setRestrictionDraft({ ...restrictionDraft, endsAt: e.target.value })} /></label>
            </div>
            <label>Notas<textarea value={restrictionDraft.notes ?? ''} onChange={(e) => setRestrictionDraft({ ...restrictionDraft, notes: e.target.value })} rows={2} /></label>
            <div className="agency-modal-actions">
              <button className="secondary" onClick={() => setRestrictionsOpen(false)}>Cerrar</button>
              <button className="primary" onClick={() => void saveRestriction()}>Agregar regla</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

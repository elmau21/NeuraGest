import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileCode, Plus, RefreshCw, Trash2 } from '@/components/icons'
import { listDbTalents, listSponsorshipDeals, type DbTalent, type SponsorshipDeal } from '@/services/agency'
import {
  briefFromDeal,
  deleteCampaignBrief,
  downloadBriefHtml,
  downloadBriefPdf,
  listCampaignBriefs,
  saveCampaignBrief,
  type CampaignBrief,
} from '@/services/brief'
import { isTauri } from '@/services/twitch'
import { logBriefActivity } from '@/services/audit'

export function BriefPage() {
  const [briefs, setBriefs] = useState<CampaignBrief[]>([])
  const [deals, setDeals] = useState<SponsorshipDeal[]>([])
  const [talents, setTalents] = useState<DbTalent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dealId, setDealId] = useState('')
  const [draft, setDraft] = useState<Partial<CampaignBrief> & { title: string }>({ title: '' })

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [rows, dealRows, dbTalents] = await Promise.all([
        listCampaignBriefs(),
        listSponsorshipDeals(),
        listDbTalents(),
      ])
      setBriefs(rows)
      setDeals(dealRows)
      setTalents(dbTalents)
      if (!dealId && dealRows[0]) setDealId(dealRows[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => { void reload() }, [reload])

  const selectedDeal = useMemo(() => deals.find((d) => d.id === dealId), [deals, dealId])

  const importFromCrm = () => {
    if (!selectedDeal) return
    const seed = briefFromDeal(selectedDeal, talents)
    setDraft({ ...seed, id: undefined })
  }

  const save = async () => {
    if (!draft.title.trim()) return
    try {
      const saved = await saveCampaignBrief({
        id: draft.id,
        dealId: draft.dealId ?? (dealId || undefined),
        title: draft.title.trim(),
        brandName: draft.brandName,
        talentIds: draft.talentIds,
        objectives: draft.objectives,
        deliverables: draft.deliverables,
        startDate: draft.startDate,
        endDate: draft.endDate,
        kpiNotes: draft.kpiNotes,
        timelineNotes: draft.timelineNotes,
        extraNotes: draft.extraNotes,
      })
      setBriefs((prev) => [saved, ...prev.filter((b) => b.id !== saved.id)])
      void logBriefActivity(draft.id ? 'updated' : 'created', saved.title, saved.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const remove = async (id: string) => {
    try {
      const title = briefs.find((b) => b.id === id)?.title ?? 'campaña'
      await deleteCampaignBrief(id)
      void logBriefActivity('deleted', title, id)
      setBriefs((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const docInput = (b: Partial<CampaignBrief>) => {
    const names = (b.talentIds ?? [])
      .map((id) => talents.find((t) => t.id === id)?.displayName)
      .filter(Boolean) as string[]
    return {
      title: b.title ?? 'Brief de campaña',
      brandName: b.brandName,
      talentNames: names.length ? names : (b.talentLogins ?? []),
      objectives: b.objectives,
      deliverables: b.deliverables,
      startDate: b.startDate,
      endDate: b.endDate,
      kpiNotes: b.kpiNotes,
      timelineNotes: b.timelineNotes,
      extraNotes: b.extraNotes,
    }
  }

  if (!isTauri) {
    return <div className="card agency-gate"><p>Brief de campaña requiere la app de escritorio NeuraGest.</p></div>
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Brief de campaña</h1>
          <p>CRM + talentos + fechas + entregables → documento exportable.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" disabled={loading} onClick={() => void reload()}><RefreshCw size={16}/></button>
          <button className="secondary" disabled={!draft.title} onClick={() => downloadBriefHtml(docInput(draft))}><FileCode size={16}/> HTML</button>
          <button className="secondary" disabled={!draft.title} onClick={() => void downloadBriefPdf(docInput(draft))}><Download size={16}/> PDF</button>
          <button className="primary" onClick={() => void save()}><Plus size={16}/> Guardar brief</button>
        </div>
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="ops-two-col">
        <div className="card">
          <h3>Origen CRM</h3>
          <label className="ops-field">
            Deal
            <select value={dealId} onChange={(e) => { setDealId(e.target.value); setDraft({ title: '' }) }}>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.brandName} {d.talentLogin ? `@${d.talentLogin}` : ''}</option>)}
            </select>
          </label>
          <button className="secondary" disabled={!selectedDeal} onClick={importFromCrm}>Importar desde CRM</button>
          {selectedDeal && (
            <dl className="ops-dl">
              <div><dt>Entregables</dt><dd>{selectedDeal.deliverables || '—'}</dd></div>
              <div><dt>Fechas</dt><dd>{selectedDeal.startDate ?? '—'} → {selectedDeal.endDate ?? '—'}</dd></div>
              <div><dt>Valor</dt><dd>{selectedDeal.dealValue?.toLocaleString('es-MX') ?? '—'} {selectedDeal.currency}</dd></div>
            </dl>
          )}
        </div>

        <div className="card">
          <h3>Contenido del brief</h3>
          <label className="ops-field">Título<input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}/></label>
          <label className="ops-field">Objetivos<textarea rows={2} value={draft.objectives ?? ''} onChange={(e) => setDraft((d) => ({ ...d, objectives: e.target.value }))}/></label>
          <label className="ops-field">Entregables<textarea rows={3} value={draft.deliverables ?? ''} onChange={(e) => setDraft((d) => ({ ...d, deliverables: e.target.value }))}/></label>
          <div className="agency-form-row">
            <label className="ops-field">Inicio<input type="date" value={draft.startDate ?? ''} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}/></label>
            <label className="ops-field">Fin<input type="date" value={draft.endDate ?? ''} onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}/></label>
          </div>
          <label className="ops-field">KPIs<textarea rows={2} value={draft.kpiNotes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, kpiNotes: e.target.value }))}/></label>
          <label className="ops-field">Timeline<textarea rows={2} value={draft.timelineNotes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, timelineNotes: e.target.value }))}/></label>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Briefs guardados ({briefs.length})</h3>
        {briefs.length === 0 ? <p className="empty-state">Sin briefs — importa un deal CRM y guarda.</p> : (
          <div className="ops-brief-list">
            {briefs.map((b) => (
              <div key={b.id} className="ops-brief-row">
                <button className="agency-crm-brand" onClick={() => setDraft(b)}><b>{b.title}</b><span>{b.brandName}</span></button>
                <div className="ops-brief-actions">
                  <button className="secondary" onClick={() => downloadBriefHtml(docInput(b))}>HTML</button>
                  <button className="secondary" onClick={() => void downloadBriefPdf(docInput(b))}>PDF</button>
                  <button className="icon-btn" onClick={() => void remove(b.id)}><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

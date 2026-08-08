import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileCode, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { listDbTalents, type DbTalent } from '@/services/agency'
import {
  deleteRateCard,
  downloadPitchHtml,
  downloadPitchPdf,
  listRateCards,
  RATE_CARD_CATEGORY_LABELS,
  saveRateCard,
  type RateCardCategory,
  type RateCardItem,
} from '@/services/rate-card'
import { useAppStore } from '@/stores/app-store'
import { isTauri } from '@/services/twitch'
import { logRateCardActivity } from '@/services/audit'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export function RateCardPage() {
  const helixTalents = useAppStore((s) => s.talents)
  const [dbTalents, setDbTalents] = useState<DbTalent[]>([])
  const [items, setItems] = useState<RateCardItem[]>([])
  const [talentId, setTalentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<Partial<RateCardItem> & { label: string; category: RateCardCategory; unitPrice: number }>({
    label: '',
    category: 'stream',
    unitPrice: 0,
    currency: 'MXN',
    isActive: true,
  })

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [talents, cards] = await Promise.all([
        listDbTalents(),
        listRateCards(talentId || undefined),
      ])
      setDbTalents(talents)
      setItems(cards)
      if (!talentId && talents[0]) setTalentId(talents[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [talentId])

  useEffect(() => { void reload() }, [reload])

  const selectedTalent = useMemo(
    () => dbTalents.find((t) => t.id === talentId),
    [dbTalents, talentId],
  )
  const helix = useMemo(
    () => helixTalents.find((t) => t.login === selectedTalent?.login),
    [helixTalents, selectedTalent],
  )
  const activeItems = useMemo(() => items.filter((i) => i.talentId === talentId), [items, talentId])

  const openNew = () => {
    setDraft({ label: '', category: 'stream', unitPrice: 0, currency: 'MXN', isActive: true, talentId })
    setEditorOpen(true)
  }

  const save = async () => {
    if (!draft.label.trim() || !talentId) return
    try {
      const saved = await saveRateCard({
        id: draft.id,
        talentId,
        label: draft.label.trim(),
        category: draft.category,
        unitPrice: draft.unitPrice,
        currency: draft.currency,
        notes: draft.notes,
        isActive: draft.isActive ?? true,
        position: draft.position ?? items.length,
      })
      setItems((prev) => {
        const filtered = prev.filter((i) => i.id !== saved.id)
        return [saved, ...filtered]
      })
      void logRateCardActivity(draft.id ? 'updated' : 'created', saved.label, saved.id)
      setEditorOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const remove = async (id: string) => {
    try {
      const label = items.find((i) => i.id === id)?.label ?? 'tarifa'
      await deleteRateCard(id)
      void logRateCardActivity('deleted', label, id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const pitchInput = {
    talentDisplayName: selectedTalent?.displayName ?? 'Talento',
    talentLogin: selectedTalent?.login ?? '',
    followers: helix?.followers,
    category: helix?.category,
    items: activeItems,
  }

  if (!isTauri) {
    return <div className="card agency-gate"><p>Rate card requiere la app de escritorio y sincronización en la nube.</p></div>
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Rate Card</h1>
          <p>Tarifas comerciales por talento y exportación de pitch HTML/PDF.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" disabled={loading} onClick={() => void reload()}><RefreshCw size={16}/></button>
          <button className="secondary" disabled={!activeItems.length} onClick={() => downloadPitchHtml(pitchInput)}><FileCode size={16}/> HTML</button>
          <button className="secondary" disabled={!activeItems.length} onClick={() => void downloadPitchPdf(pitchInput)}><Download size={16}/> PDF</button>
          <button className="primary" onClick={openNew}><Plus size={16}/> Tarifa</button>
        </div>
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="ops-two-col">
        <div className="card">
          <label className="ops-field">
            Talento
            <select value={talentId} onChange={(e) => setTalentId(e.target.value)}>
              {dbTalents.map((t) => <option key={t.id} value={t.id}>{t.displayName} (@{t.login})</option>)}
            </select>
          </label>
          {selectedTalent && (
            <div className="ops-media-preview">
              {helix?.avatar ? <img src={helix.avatar} alt="" /> : <div className="avatar-placeholder">{selectedTalent.displayName.slice(0, 2)}</div>}
              <div>
                <b>{selectedTalent.displayName}</b>
                <span>@{selectedTalent.login}</span>
                {helix && <small>{helix.followers > 0 ? `${helix.followers.toLocaleString('es-MX')} followers` : 'Sin datos Twitch'}</small>}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Tarifas ({activeItems.length})</h3>
          {loading ? <p className="empty-state">Cargando…</p> : activeItems.length === 0 ? (
            <p className="empty-state">Sin tarifas — añade la primera.</p>
          ) : (
            <div className="ops-rate-list">
              {activeItems.map((item) => (
                <div key={item.id} className={`ops-rate-row${item.isActive ? '' : ' inactive'}`}>
                  <span className="agency-badge">{RATE_CARD_CATEGORY_LABELS[item.category]}</span>
                  <div>
                    <b>{item.label}</b>
                    <span>{currency.format(item.unitPrice)} {item.currency !== 'MXN' ? item.currency : ''}</span>
                    {item.notes && <small>{item.notes}</small>}
                  </div>
                  <div className="ops-rate-actions">
                    <button className="secondary" onClick={() => { setDraft(item); setEditorOpen(true) }}>Editar</button>
                    <button className="icon-btn" onClick={() => void remove(item.id)}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editorOpen && (
        <div className="modal-backdrop" onClick={() => setEditorOpen(false)}>
          <div className="agency-modal card" onClick={(e) => e.stopPropagation()}>
            <h3>{draft.id ? 'Editar tarifa' : 'Nueva tarifa'}</h3>
            <label>Servicio<input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}/></label>
            <div className="agency-form-row">
              <label>Categoría
                <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as RateCardCategory }))}>
                  {Object.entries(RATE_CARD_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>Precio<input type="number" min={0} value={draft.unitPrice} onChange={(e) => setDraft((d) => ({ ...d, unitPrice: Number(e.target.value) }))}/></label>
            </div>
            <label>Notas<textarea rows={2} value={draft.notes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}/></label>
            <label className="ops-check"><input type="checkbox" checked={draft.isActive ?? true} onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}/> Activa en pitch</label>
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

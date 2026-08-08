import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Link2, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { listDbTalents, listSponsorshipDeals, type DbTalent, type SponsorshipDeal } from '@/services/agency'
import {
  COMMON_ASSET_TAGS,
  createLinkAsset,
  deleteAgencyAsset,
  listAgencyAssets,
  signedAssetUrl,
  uploadAgencyAssetFile,
  type AgencyAsset,
} from '@/services/assets'
import { isTauri } from '@/services/twitch'
import { logAssetActivity } from '@/services/audit'

export function AssetsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [assets, setAssets] = useState<AgencyAsset[]>([])
  const [talents, setTalents] = useState<DbTalent[]>([])
  const [deals, setDeals] = useState<SponsorshipDeal[]>([])
  const [tagFilter, setTagFilter] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [draft, setDraft] = useState({ title: '', externalUrl: '', tags: '', talentId: '', dealId: '' })

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [rows, dbTalents, dealRows] = await Promise.all([
        listAgencyAssets(tagFilter || undefined),
        listDbTalents(),
        listSponsorshipDeals(),
      ])
      const withUrls = await Promise.all(rows.map(async (asset) => {
        if (asset.storagePath) {
          const url = await signedAssetUrl(asset.storagePath)
          return { ...asset, url }
        }
        return asset
      }))
      setAssets(withUrls)
      setTalents(dbTalents)
      setDeals(dealRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [tagFilter])

  useEffect(() => { void reload() }, [reload])

  const filtered = useMemo(() => assets.filter((a) =>
    `${a.title} ${a.tags.join(' ')} ${a.talentLogin ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  ), [assets, query])

  const onUpload = async (file: File) => {
    const title = file.name.replace(/\.[^.]+$/, '')
    try {
      const saved = await uploadAgencyAssetFile(file, {
        title,
        tags: tagFilter ? [tagFilter] : ['marca'],
      })
      if (saved?.storagePath) {
        const url = await signedAssetUrl(saved.storagePath)
        setAssets((prev) => [{ ...saved, url }, ...prev])
        void logAssetActivity('created', saved.title, saved.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const saveLink = async () => {
    if (!draft.title.trim() || !draft.externalUrl.trim()) return
    try {
      const saved = await createLinkAsset({
        title: draft.title.trim(),
        externalUrl: draft.externalUrl.trim(),
        tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
        talentId: draft.talentId || undefined,
        dealId: draft.dealId || undefined,
      })
      setAssets((prev) => [saved, ...prev])
      void logAssetActivity('created', saved.title, saved.id)
      setLinkOpen(false)
      setDraft({ title: '', externalUrl: '', tags: '', talentId: '', dealId: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const remove = async (id: string) => {
    try {
      const title = assets.find((a) => a.id === id)?.title ?? 'archivo'
      await deleteAgencyAsset(id)
      void logAssetActivity('deleted', title, id)
      setAssets((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!isTauri) {
    return <div className="card agency-gate"><p>Biblioteca de assets requiere la app de escritorio NeuraGest.</p></div>
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Biblioteca de assets</h1>
          <p>Almacenamiento en la nube, tags y vínculos a talentos, deals y tareas.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" disabled={loading} onClick={() => void reload()}><RefreshCw size={16}/></button>
          <button className="secondary" onClick={() => setLinkOpen(true)}><Link2 size={16}/> Enlace</button>
          <button className="primary" onClick={() => fileRef.current?.click()}><Upload size={16}/> Subir</button>
          <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); e.target.value = '' }}/>
        </div>
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="card">
        <div className="toolbar">
          <label className="search"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar asset…"/></label>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">Todos los tags</option>
            {COMMON_ASSET_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {loading ? <p className="empty-state">Cargando…</p> : filtered.length === 0 ? (
          <p className="empty-state">Sin assets — sube un archivo o añade un enlace.</p>
        ) : (
          <div className="ops-asset-grid">
            {filtered.map((asset) => (
              <div key={asset.id} className="ops-asset-tile">
                <div className="ops-asset-head">
                  <b>{asset.title}</b>
                  <button className="icon-btn" onClick={() => void remove(asset.id)}><Trash2 size={14}/></button>
                </div>
                <div className="ops-asset-tags">
                  {asset.tags.map((t) => <span key={t} className="agency-badge">{t}</span>)}
                </div>
                {asset.talentLogin && <small>@{asset.talentLogin}</small>}
                {asset.fileName && <small>{asset.fileName}</small>}
                <div className="ops-asset-actions">
                  {(asset.url || asset.externalUrl) && (
                    <a href={asset.url ?? asset.externalUrl} target="_blank" rel="noreferrer" className="secondary">
                      <ExternalLink size={14}/> Abrir
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {linkOpen && (
        <div className="modal-backdrop" onClick={() => setLinkOpen(false)}>
          <div className="agency-modal card" onClick={(e) => e.stopPropagation()}>
            <h3><Link2 size={16}/> Asset por enlace</h3>
            <label>Título<input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}/></label>
            <label>URL<input value={draft.externalUrl} onChange={(e) => setDraft((d) => ({ ...d, externalUrl: e.target.value }))} placeholder="https://…"/></label>
            <label>Tags (coma)<input value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} placeholder="overlay, marca"/></label>
            <label>Talento
              <select value={draft.talentId} onChange={(e) => setDraft((d) => ({ ...d, talentId: e.target.value }))}>
                <option value="">—</option>
                {talents.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
              </select>
            </label>
            <label>Deal CRM
              <select value={draft.dealId} onChange={(e) => setDraft((d) => ({ ...d, dealId: e.target.value }))}>
                <option value="">—</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.brandName}</option>)}
              </select>
            </label>
            <div className="agency-modal-actions">
              <button className="secondary" onClick={() => setLinkOpen(false)}>Cancelar</button>
              <button className="primary" onClick={() => void saveLink()}><Plus size={16}/> Crear</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

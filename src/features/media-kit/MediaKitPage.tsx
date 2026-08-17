import { useCallback, useMemo, useState } from 'react'
import { Download, FileText, RefreshCw, Columns2 } from '@/components/icons'
import { Link } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { isTauri } from '@/services/twitch'
import { generateMediaKitPdf, loadMediaKitData } from '@/services/media-kit'

export function MediaKitPage() {
  const talents = useAppStore((s) => s.talents)
  const refreshTalentData = useAppStore((s) => s.refreshTalentData)
  const [selectedLogin, setSelectedLogin] = useState(talents[0]?.login ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(
    () => talents.find((t) => t.login === selectedLogin),
    [talents, selectedLogin],
  )

  const generate = useCallback(async () => {
    if (!selectedLogin) return
    setLoading(true)
    setError(null)
    try {
      const data = await loadMediaKitData(selectedLogin, talents)
      if (!data) throw new Error('Talento no encontrado.')
      await generateMediaKitPdf(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [selectedLogin, talents])

  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>Ejecuta NeuraGest con la app de escritorio para generar media kits con datos de Twitch.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Media Kit PDF</h1>
          <p>Generación automática con métricas de Twitch, historial y clips guardados.</p>
        </div>
        <div className="page-actions">
          <Link className="secondary" to="/media-kit/comparar"><Columns2 size={16} /> Comparar</Link>
          <button className="secondary" onClick={() => void refreshTalentData()}>
            <RefreshCw size={16} /> Actualizar datos Twitch
          </button>
          <button className="primary" disabled={loading || !selectedLogin} onClick={() => void generate()}>
            <Download size={16} />{loading ? 'Generando…' : 'Descargar PDF'}
          </button>
        </div>
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="ops-two-col">
        <div className="card">
          <h3>Seleccionar talento</h3>
          <p>El PDF incluye followers, avg/peak viewers, días de stream y top clips.</p>
          <label className="ops-field">
            Talento
            <select value={selectedLogin} onChange={(e) => setSelectedLogin(e.target.value)}>
              {talents.map((t) => (
                <option key={t.login} value={t.login}>{t.displayName} (@{t.login})</option>
              ))}
            </select>
          </label>
        </div>

        <div className="card ops-preview">
          <h3><FileText size={16} /> Vista previa</h3>
          {selected ? (
            <div className="ops-media-preview">
              {selected.avatar ? <img src={selected.avatar} alt="" /> : <div className="avatar-placeholder">{selected.displayName.slice(0, 2)}</div>}
              <div>
                <b>{selected.displayName}</b>
                <span>@{selected.login}</span>
                <dl>
                  <div><dt>Followers</dt><dd>{selected.followers > 0 ? selected.followers.toLocaleString('es-MX') : '—'}</dd></div>
                  <div><dt>Estado</dt><dd>{selected.isLive ? `En vivo · ${selected.viewers.toLocaleString('es-MX')}` : 'Offline'}</dd></div>
                  <div><dt>Categoría</dt><dd>{selected.category || '—'}</dd></div>
                </dl>
              </div>
            </div>
          ) : (
            <p className="empty-state">Selecciona un talento.</p>
          )}
          <p className="integration-note">Sin servicios de pago · PDF generado localmente · datos del historial NeuraGest.</p>
        </div>
      </div>
    </>
  )
}

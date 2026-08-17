import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ExternalLink, Eye, FileDown, Share2, Users } from '@/components/icons'
import { useAppStore } from '@/stores/app-store'
import { isTauri } from '@/services/twitch'
import { listSponsorshipDeals, listOnboardingItems, type SponsorshipDeal, type OnboardingItem } from '@/services/agency'
import { generateMediaKitPdf, loadMediaKitData } from '@/services/media-kit'
import { SPONSORSHIP_STATUS_LABELS } from '@/services/agency'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

export function PortalPage() {
  const { login: routeLogin } = useParams<{ login?: string }>()
  const navigate = useNavigate()
  const talents = useAppStore((s) => s.talents)
  const refreshTalentData = useAppStore((s) => s.refreshTalentData)
  const [selectedLogin, setSelectedLogin] = useState(routeLogin ?? talents[0]?.login ?? '')
  const [deals, setDeals] = useState<SponsorshipDeal[]>([])
  const [onboarding, setOnboarding] = useState<OnboardingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (routeLogin) setSelectedLogin(routeLogin)
  }, [routeLogin])

  const talent = useMemo(
    () => talents.find((t) => t.login.toLowerCase() === selectedLogin.toLowerCase()),
    [talents, selectedLogin],
  )

  const reload = useCallback(async () => {
    if (!isTauri || !selectedLogin) return
    setLoading(true)
    setError(null)
    try {
      const [allDeals, allOnboarding] = await Promise.all([
        listSponsorshipDeals(),
        listOnboardingItems(),
      ])
      setDeals(allDeals.filter((d) => d.talentLogin?.toLowerCase() === selectedLogin.toLowerCase()))
      setOnboarding(allOnboarding.filter((o) => o.talentLogin.toLowerCase() === selectedLogin.toLowerCase()))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [selectedLogin, talents])

  useEffect(() => { void reload() }, [reload])

  const stats = useMemo(() => {
    if (!talent) return null
    return {
      followers: talent.followers,
      viewers: talent.viewers,
      isLive: talent.isLive,
      category: talent.category,
    }
  }, [talent])

  const onboardingDone = onboarding.filter((o) => o.completed).length

  const shareLink = `${window.location.origin}/portal/${selectedLogin}`

  const downloadKit = async () => {
    if (!selectedLogin) return
    setPdfLoading(true)
    try {
      const data = await loadMediaKitData(selectedLogin, talents)
      if (!data) throw new Error('Talento no encontrado.')
      await generateMediaKitPdf(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPdfLoading(false)
    }
  }

  const onSelectTalent = (login: string) => {
    setSelectedLogin(login)
    navigate(login ? `/portal/${login}` : '/portal')
  }

  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>Portal de talento requiere la app de escritorio NeuraGest.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-title portal-readonly-banner">
        <div>
          <h1>Portal talento</h1>
          <p>Vista de solo lectura para compartir con talentos — métricas, deals y onboarding.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" disabled={loading} onClick={() => void refreshTalentData()}>
            <Activity size={16} /> Actualizar
          </button>
          <button className="secondary" onClick={() => void navigator.clipboard.writeText(shareLink)}>
            <Share2 size={16} /> Copiar enlace
          </button>
          <button className="primary" disabled={pdfLoading || !selectedLogin} onClick={() => void downloadKit()}>
            <FileDown size={16} />{pdfLoading ? '…' : 'Media kit PDF'}
          </button>
        </div>
      </div>

      <p className="portal-readonly-note">Modo solo lectura — sin edición de CRM, comisiones ni ajustes.</p>
      {error && <p className="integration-note">{error}</p>}

      <div className="ops-two-col portal-layout">
        <div className="card">
          <h3><Users size={16} /> Seleccionar talento</h3>
          <label className="ops-field">
            Talento
            <select value={selectedLogin} onChange={(e) => onSelectTalent(e.target.value)}>
              {talents.map((t) => (
                <option key={t.login} value={t.login}>{t.displayName} (@{t.login})</option>
              ))}
            </select>
          </label>
          {talent && (
            <div className="ops-media-preview portal-profile">
              {talent.avatar ? <img src={talent.avatar} alt="" /> : <div className="avatar-placeholder">{talent.displayName.slice(0, 2)}</div>}
              <div>
                <b>{talent.displayName}</b>
                <span>@{talent.login}</span>
                <p className={talent.isLive ? 'status live' : 'status'}>{talent.isLive ? '● En directo' : 'Offline'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3><Eye size={16} /> Métricas Twitch</h3>
          {stats ? (
            <dl className="portal-metrics">
              <div><dt>Followers</dt><dd>{stats.followers > 0 ? stats.followers.toLocaleString('es-MX') : '—'}</dd></div>
              <div><dt>Viewers</dt><dd>{stats.viewers.toLocaleString('es-MX')}</dd></div>
              <div><dt>Categoría</dt><dd>{stats.category || '—'}</dd></div>
              <div><dt>Estado</dt><dd>{stats.isLive ? 'En vivo' : 'Offline'}</dd></div>
            </dl>
          ) : (
            <p className="empty-state">Selecciona un talento.</p>
          )}
        </div>
      </div>

      <div className="ops-two-col">
        <div className="card">
          <h3>Patrocinios activos</h3>
          {deals.length === 0 ? (
            <p className="empty-state">Sin deals visibles para este talento.</p>
          ) : (
            <ul className="portal-deal-list">
              {deals.map((deal) => (
                <li key={deal.id}>
                  <b>{deal.brandName}</b>
                  <span className={`agency-deal-status ${deal.status}`}>{SPONSORSHIP_STATUS_LABELS[deal.status]}</span>
                  <small>{deal.dealValue != null ? currency.format(deal.dealValue) : '—'} · {deal.progressPercent}% avance</small>
                  {deal.deliverables && <p>{deal.deliverables}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>Onboarding</h3>
          {onboarding.length === 0 ? (
            <p className="empty-state">Sin checklist de onboarding.</p>
          ) : (
            <>
              <p className="portal-onboarding-progress">{onboardingDone}/{onboarding.length} completados</p>
              <ul className="portal-onboarding-list">
                {onboarding.map((item) => (
                  <li key={item.id} className={item.completed ? 'done' : ''}>
                    <span>{item.completed ? '✓' : '○'}</span>
                    <div><b>{item.title}</b>{item.description && <small>{item.description}</small>}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="card portal-share">
        <p>Enlace compartible: <code>{shareLink}</code></p>
        <a className="secondary" href={`https://twitch.tv/${selectedLogin}`} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> Ver canal Twitch
        </a>
      </div>
    </>
  )
}

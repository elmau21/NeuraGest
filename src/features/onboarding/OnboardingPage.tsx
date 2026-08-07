import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle, RefreshCw, Sparkles } from 'lucide-react'
import {
  listDbTalents,
  listOnboardingItems,
  onboardingProgress,
  seedTalentOnboarding,
  toggleOnboardingItem,
  type DbTalent,
  type OnboardingItem,
} from '@/services/agency'
import { isTauri } from '@/services/twitch'

export function OnboardingPage() {
  const [talents, setTalents] = useState<DbTalent[]>([])
  const [selectedTalentId, setSelectedTalentId] = useState<string>('')
  const [items, setItems] = useState<OnboardingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reloadTalents = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const dbTalents = await listDbTalents()
      setTalents(dbTalents)
      if (!selectedTalentId && dbTalents[0]) setSelectedTalentId(dbTalents[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [selectedTalentId])

  const reloadItems = useCallback(async (talentId: string) => {
    if (!isTauri || !talentId) return
    setError(null)
    try {
      const rows = await listOnboardingItems(talentId)
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => { void reloadTalents() }, [reloadTalents])
  useEffect(() => {
    if (selectedTalentId) void reloadItems(selectedTalentId)
  }, [selectedTalentId, reloadItems])

  const progress = useMemo(() => onboardingProgress(items), [items])
  const selectedTalent = talents.find((t) => t.id === selectedTalentId)

  const initChecklist = async () => {
    if (!selectedTalentId) return
    try {
      const seeded = await seedTalentOnboarding(selectedTalentId)
      setItems(seeded)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const toggle = async (item: OnboardingItem) => {
    try {
      const updated = await toggleOnboardingItem(item.id, !item.completed)
      setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>Ejecuta NeuraGest con la app de escritorio para gestionar onboarding de talentos.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Onboarding talento</h1>
          <p>Checklist de incorporación y % completado por talento.</p>
        </div>
        <button className="secondary" disabled={loading} onClick={() => void reloadTalents()}>
          <RefreshCw size={16} />{loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="onboarding-layout">
        <div className="card onboarding-talents">
          <b>Talentos</b>
          {talents.map((talent) => (
            <button
              key={talent.id}
              className={talent.id === selectedTalentId ? 'selected' : ''}
              onClick={() => setSelectedTalentId(talent.id)}
            >
              {talent.avatarUrl
                ? <img src={talent.avatarUrl} alt="" className="onboarding-avatar" />
                : <span className="avatar-placeholder">{talent.displayName.slice(0, 2).toUpperCase()}</span>}
              <span><b>{talent.displayName}</b><small>@{talent.login}</small></span>
            </button>
          ))}
          {talents.length === 0 && !loading && <p className="empty-state">Sin talentos registrados.</p>}
        </div>

        <div className="card onboarding-detail">
          {selectedTalent ? (
            <>
              <div className="onboarding-head">
                <div>
                  <h2>{selectedTalent.displayName}</h2>
                  <p>@{selectedTalent.login}</p>
                </div>
                <div className="onboarding-progress-ring" data-progress={progress}>
                  <strong>{progress}%</strong>
                  <span>completado</span>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="onboarding-empty">
                  <Sparkles size={28} />
                  <p>Sin checklist para este talento.</p>
                  <button className="primary" onClick={() => void initChecklist()}>Generar checklist estándar</button>
                </div>
              ) : (
                <ul className="onboarding-checklist">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button className={item.completed ? 'done' : ''} onClick={() => void toggle(item)}>
                        {item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                        <span>
                          <b>{item.title}</b>
                          {item.description && <small>{item.description}</small>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="empty-state">Selecciona un talento.</p>
          )}
        </div>
      </div>
    </>
  )
}

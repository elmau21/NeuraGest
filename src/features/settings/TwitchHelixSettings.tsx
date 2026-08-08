import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Trash2 } from 'lucide-react'
import {
  deleteHelixProfile,
  getActiveHelixProfile,
  listHelixProfiles,
  setActiveHelixProfile,
  type HelixProfile,
} from '@/services/helix-profiles'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'
import { useAppStore } from '@/stores/app-store'

const AGENCY_PROFILE_ID = 'env-default'

function profileLabel(profile: HelixProfile): string {
  if (profile.id === AGENCY_PROFILE_ID) return 'Cuenta de la agencia'
  return profile.name
}

export function TwitchHelixSettings() {
  const [profiles, setProfiles] = useState<HelixProfile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const refreshTalentData = useAppStore((s) => s.refreshTalentData)
  const readonly = !canMutate(roles, session?.login)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, active] = await Promise.all([
        listHelixProfiles(),
        getActiveHelixProfile(),
      ])
      setProfiles(rows)
      setActiveId(active?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const activate = async (id: string) => {
    if (readonly) return
    try {
      await setActiveHelixProfile(id)
      setActiveId(id)
      await refreshTalentData()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const remove = async (id: string) => {
    if (readonly) return
    try {
      await deleteHelixProfile(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // Solo hay una conexión de agencia: el estado ya está en «Monitoreo Twitch».
  if (!loading && !error && profiles.length <= 1) return null

  return (
    <div className="card">
      <h3><KeyRound size={16}/> Cuentas Twitch</h3>
      <p>Elige qué cuenta usa NeuraLive para métricas y clips.</p>

      {profiles.length > 0 ? (
        <ul className="helix-profile-list">
          {profiles.map((profile) => (
            <li key={profile.id} className={profile.id === activeId ? 'active' : ''}>
              <div>
                <b>{profileLabel(profile)}</b>
                <span>{profile.hasSecret ? 'Lista' : 'Sin clave'}{profile.id === activeId ? ' · En uso' : ''}</span>
              </div>
              <div className="helix-profile-actions">
                {profile.id !== activeId && (
                  <button className="secondary" disabled={readonly || loading} onClick={() => void activate(profile.id)}>
                    Usar
                  </button>
                )}
                {profile.id === activeId && <span className="helix-active-badge">Activa</span>}
                {profile.id !== AGENCY_PROFILE_ID && (
                  <button className="icon-btn" disabled={readonly} onClick={() => void remove(profile.id)} aria-label="Eliminar">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !loading && <p className="integration-note">Sin cuentas configuradas.</p>
      )}

      {error && <p className="integration-note">{error}</p>}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import {
  deleteHelixProfile,
  getActiveHelixProfile,
  listHelixProfiles,
  saveHelixProfile,
  setActiveHelixProfile,
  type HelixProfile,
} from '@/services/helix-profiles'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'
import { useAppStore } from '@/stores/app-store'

export function TwitchHelixSettings() {
  const [profiles, setProfiles] = useState<HelixProfile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ name: '', clientId: '', clientSecret: '' })
  const [saved, setSaved] = useState(false)
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

  const save = async () => {
    if (readonly || !draft.name.trim() || !draft.clientId.trim()) return
    try {
      const profile = await saveHelixProfile({
        name: draft.name,
        clientId: draft.clientId,
        clientSecret: draft.clientSecret || undefined,
      })
      setDraft({ name: '', clientId: '', clientSecret: '' })
      await setActiveHelixProfile(profile.id)
      await reload()
      await refreshTalentData()
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

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

  return (
    <div className="card">
      <h3><KeyRound size={16}/> Perfiles Twitch (multi-cuenta)</h3>
      <p>Selecciona qué credenciales de desarrollador usa NeuraGest para métricas y clips. Se guardan de forma segura en Windows.</p>

      {profiles.length > 0 && (
        <ul className="helix-profile-list">
          {profiles.map((profile) => (
            <li key={profile.id} className={profile.id === activeId ? 'active' : ''}>
              <div>
                <b>{profile.name}</b>
                <span>{profile.clientId.slice(0, 8)}… · {profile.hasSecret ? 'Clave OK' : 'Sin clave'}</span>
              </div>
              <div className="helix-profile-actions">
                {profile.id !== activeId && (
                  <button className="secondary" disabled={readonly || loading} onClick={() => void activate(profile.id)}>
                    Usar
                  </button>
                )}
                {profile.id === activeId && <span className="helix-active-badge">Activo</span>}
                {profile.id !== 'env-default' && (
                  <button className="icon-btn" disabled={readonly} onClick={() => void remove(profile.id)} aria-label="Eliminar">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!readonly && (
        <>
          <label>Nombre del perfil<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="NeuraLive principal" /></label>
          <label>Identificador de app<input value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })} placeholder="abc123…" /></label>
          <label>Clave secreta<input type="password" value={draft.clientSecret} onChange={(e) => setDraft({ ...draft, clientSecret: e.target.value })} placeholder="Solo al crear o rotar" /></label>
          <button className="secondary" disabled={loading} onClick={() => void save()}>
            <Plus size={14}/>{saved ? 'Guardado' : 'Agregar perfil'}
          </button>
        </>
      )}

      {error && <p className="integration-note">{error}</p>}
    </div>
  )
}

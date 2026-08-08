import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import {
  getGoogleCalendarSettings,
  saveGoogleCalendarSettings,
  type GoogleCalendarSettings,
} from '@/services/settings'
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  googleOAuthStatus,
  syncGoogleCalendar,
} from '@/services/google-calendar-oauth'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'
import { isTauri } from '@/services/twitch'
import { toastError, toastSuccess } from '@/stores/toast-store'

export function GoogleCalendarSettings() {
  const [settings, setSettings] = useState<GoogleCalendarSettings>({
    syncEnabled: false,
    calendarId: 'primary',
    oauthNote: '',
  })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)

  useEffect(() => {
    void (async () => {
      const [stored, oauth] = await Promise.all([
        getGoogleCalendarSettings(),
        googleOAuthStatus().catch(() => ({ connected: false })),
      ])
      setSettings({
        ...stored,
        connected: oauth.connected,
        connectedEmail: 'email' in oauth ? oauth.email : undefined,
      })
    })().finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (readonly) return
    const ok = await saveGoogleCalendarSettings(settings)
    setSaved(ok)
    if (ok) toastSuccess('Guardado')
    else toastError('No se pudo guardar')
    window.setTimeout(() => setSaved(false), 1500)
  }

  const connect = async () => {
    if (readonly || !isTauri) return
    setBusy(true)
    setStatusMessage(null)
    try {
      const oauth = await connectGoogleCalendar()
      setSettings((prev) => ({
        ...prev,
        syncEnabled: true,
        connected: oauth.connected,
        connectedEmail: oauth.email,
        oauthNote: oauth.email ? `Conectado como ${oauth.email}` : 'Google Calendar conectado.',
      }))
      await saveGoogleCalendarSettings({
        ...settings,
        syncEnabled: true,
        connected: oauth.connected,
        connectedEmail: oauth.email,
        oauthNote: oauth.email ? `Conectado como ${oauth.email}` : 'Google Calendar conectado.',
      })
      setStatusMessage('Cuenta Google conectada.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (readonly) return
    setBusy(true)
    try {
      await disconnectGoogleCalendar()
      setSettings((prev) => ({
        ...prev,
        connected: false,
        connectedEmail: undefined,
        oauthNote: 'Desconectado.',
      }))
      await saveGoogleCalendarSettings({
        ...settings,
        connected: false,
        connectedEmail: undefined,
        oauthNote: 'Desconectado.',
      })
      setStatusMessage('Google Calendar desconectado.')
    } finally {
      setBusy(false)
    }
  }

  const syncNow = async () => {
    if (readonly || !settings.connected) return
    setBusy(true)
    setStatusMessage(null)
    try {
      const result = await syncGoogleCalendar(settings.calendarId || 'primary')
      const next = {
        ...settings,
        lastSyncAt: result.lastSyncAt,
        oauthNote: `Última sync: ${result.pulled} importados, ${result.pushed} exportados.`,
      }
      setSettings(next)
      await saveGoogleCalendarSettings(next)
      setStatusMessage(`Listo · ${result.pulled} importados · ${result.pushed} exportados`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3><CalendarDays size={16}/> Google Calendar</h3>
      <p>Sincroniza el calendario de NeuraLive con Google.</p>
      {!isTauri && (
        <p className="integration-note">Disponible en la app de escritorio NeuraGest.</p>
      )}
      <div className={`connection ${settings.connected ? 'connected' : ''}`}>
        <div className={settings.connected ? 'online-dot' : 'offline-dot'} />
        <div>
          <b>{settings.connected ? 'Conectado' : 'Sin conectar'}</b>
          <span>{settings.connectedEmail ?? settings.oauthNote ?? 'Conecta tu cuenta Google para sincronizar.'}</span>
        </div>
      </div>
      <label className="toggle-row">
        Sync automático
        <input
          type="checkbox"
          checked={settings.syncEnabled}
          disabled={readonly || loading}
          onChange={(event) => setSettings({ ...settings, syncEnabled: event.target.checked })}
        />
      </label>
      <div className="settings-session-actions">
        {!settings.connected ? (
          <button className="twitch-button" disabled={readonly || loading || busy || !isTauri} onClick={() => void connect()}>
            {busy ? 'Conectando…' : 'Conectar Google'}
          </button>
        ) : (
          <>
            <button className="secondary" disabled={readonly || busy || !settings.syncEnabled} onClick={() => void syncNow()}>
              {busy ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
            <button className="secondary" disabled={readonly || busy} onClick={() => void disconnect()}>
              Desconectar
            </button>
          </>
        )}
        <button className="secondary" disabled={readonly || loading} onClick={() => void save()}>
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </div>
      {settings.lastSyncAt && (
        <p className="integration-note">Última sincronización: {new Date(settings.lastSyncAt).toLocaleString('es-MX')}</p>
      )}
      {statusMessage && <p className="integration-note">{statusMessage}</p>}
    </div>
  )
}

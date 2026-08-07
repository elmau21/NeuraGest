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
  GOOGLE_OAUTH_REDIRECT_TO,
} from '@/services/google-calendar-oauth'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'
import { isTauri } from '@/services/twitch'

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
        oauthNote: 'Desconectado. Puedes seguir usando exportación ICS.',
      }))
      await saveGoogleCalendarSettings({
        ...settings,
        connected: false,
        connectedEmail: undefined,
        oauthNote: 'Desconectado. Puedes seguir usando exportación ICS.',
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
      setStatusMessage(`Sincronización completada · ${result.pulled} importados · ${result.pushed} exportados`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3><CalendarDays size={16}/> Google Calendar</h3>
      <p>Conexión con Google Calendar y exportación ICS desde Calendario. Sincronización bidireccional gratuita.</p>
      {!isTauri && (
        <p className="integration-note">La conexión y sync requieren la app de escritorio NeuraGest.</p>
      )}
      <div className={`connection ${settings.connected ? 'connected' : ''}`}>
        <div className={settings.connected ? 'online-dot' : 'offline-dot'} />
        <div>
          <b>{settings.connected ? 'Google conectado' : 'Google sin conectar'}</b>
          <span>{settings.connectedEmail ?? settings.oauthNote ?? 'Usa ICS mientras configuras la conexión con Google.'}</span>
        </div>
      </div>
      <label className="toggle-row">
        Sync automático habilitado
        <input
          type="checkbox"
          checked={settings.syncEnabled}
          disabled={readonly || loading}
          onChange={(event) => setSettings({ ...settings, syncEnabled: event.target.checked })}
        />
      </label>
      <label>
        Calendar ID
        <input
          value={settings.calendarId}
          readOnly={readonly}
          onChange={(event) => setSettings({ ...settings, calendarId: event.target.value })}
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
          {saved ? 'Guardado' : 'Guardar preferencias'}
        </button>
      </div>
      {settings.lastSyncAt && (
        <p className="integration-note">Última sincronización: {new Date(settings.lastSyncAt).toLocaleString('es-MX')}</p>
      )}
      {statusMessage && <p className="integration-note">{statusMessage}</p>}
      <details className="gcal-oauth-doc">
        <summary>Guía de conexión con Google (administradores)</summary>
        <ol>
          <li>Crea un proyecto en Google Cloud Console y habilita Google Calendar.</li>
          <li>Pantalla de consentimiento (interno NeuraLive).</li>
          <li>Credenciales de aplicación de escritorio.</li>
          <li>URI de redirección autorizado: <code>{GOOGLE_OAUTH_REDIRECT_TO}</code></li>
          <li>Configura las credenciales de Google en el archivo <code>.env</code> de la app.</li>
          <li>La sync importa eventos de Google al calendario NeuraGest y exporta eventos locales.</li>
        </ol>
        <p className="integration-note">Alternativa sin conexión: «Exportar ICS» en la vista Calendario.</p>
      </details>
    </div>
  )
}

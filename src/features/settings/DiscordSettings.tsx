import { useEffect, useState } from 'react'
import { Discord, Radio, Send } from '@/components/icons'
import {
  getDiscordSettings,
  saveDiscordSettings,
  DEFAULT_DISCORD_EVENT_TEMPLATES,
  DEFAULT_DISCORD_PRESENCE,
  type DiscordSettings,
  type DiscordEventKind,
} from '@/services/settings'
import { postDiscordEvent, renderDiscordEventTemplate } from '@/services/discord'
import {
  applyDiscordPresence,
  subscribeDiscordPresenceStatus,
  type DiscordRpcStatus,
} from '@/services/discord-presence'
import { useAuthStore } from '@/stores/auth-store'
import { canEditPersonalSettings, canMutate } from '@/services/permissions'
import { isTauri } from '@/services/twitch'
import { toastError, toastSuccess } from '@/stores/toast-store'

const EVENT_LABELS: Record<DiscordEventKind, string> = {
  raid: 'Raid recibido',
  milestone: 'Milestone',
  campaignEnd: 'Fin de campaña',
}

const EVENT_VARS: Record<DiscordEventKind, Record<string, string>> = {
  raid: { talent: 'Arikyu', raider: 'CanalAliado', viewers: '420' },
  milestone: { talent: 'Arikyu', milestone: '10K followers' },
  campaignEnd: { talent: 'Arikyu', brand: 'MarcaX' },
}

type DiscordSettingsProps = {
  /** Solo estado en Discord (sin webhooks / plantillas de canal). */
  personalOnly?: boolean
}

export function DiscordSettings({ personalOnly = false }: DiscordSettingsProps) {
  const [settings, setSettings] = useState<DiscordSettings>({
    webhookUrl: '',
    enabled: false,
    postedLive: {},
    eventTemplates: DEFAULT_DISCORD_EVENT_TEMPLATES,
    ...DEFAULT_DISCORD_PRESENCE,
  })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [presenceNote, setPresenceNote] = useState<string | null>(null)
  const [presenceStatus, setPresenceStatus] = useState<DiscordRpcStatus | null>(null)
  const [testingPresence, setTestingPresence] = useState(false)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const canEditChannel = canMutate(roles, session?.login)
  const readonly = personalOnly
    ? !canEditPersonalSettings(roles, session?.login)
    : !canEditChannel
  const channelReadonly = !canEditChannel

  useEffect(() => {
    void getDiscordSettings().then(setSettings).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isTauri) return
    return subscribeDiscordPresenceStatus(setPresenceStatus)
  }, [])

  const save = async () => {
    if (readonly) return
    const ok = await saveDiscordSettings(settings)
    setSaved(ok)
    if (ok) toastSuccess('Guardado')
    else toastError('No se pudo guardar')
    if (ok && isTauri) {
      const status = await applyDiscordPresence(settings, window.location.pathname)
      setPresenceNote(status.message)
      window.setTimeout(() => setPresenceNote(null), 4500)
    }
    window.setTimeout(() => setSaved(false), 1500)
  }

  const testPresence = async () => {
    if (!isTauri) return
    setTestingPresence(true)
    setPresenceNote(null)
    try {
      const status = await applyDiscordPresence(
        { ...settings, presenceEnabled: true, presenceUseLargeImage: settings.presenceUseLargeImage !== false },
        window.location.pathname,
        { forceRefresh: true },
      )
      setPresenceNote(status.message)
      if (status.connected) toastSuccess(status.message || 'Presencia sincronizada')
      else toastError(status.message || 'No se pudo sincronizar presencia')
      if (status.connected && !settings.presenceEnabled) {
        setSettings((prev) => ({ ...prev, presenceEnabled: true }))
      }
    } finally {
      setTestingPresence(false)
      window.setTimeout(() => setPresenceNote(null), 6000)
    }
  }

  const updateTemplate = (kind: DiscordEventKind, value: string) => {
    setSettings({
      ...settings,
      eventTemplates: {
        ...DEFAULT_DISCORD_EVENT_TEMPLATES,
        ...settings.eventTemplates,
        [kind]: value,
      },
    })
  }

  const testTemplate = async (kind: DiscordEventKind) => {
    setTestResult(null)
    const ok = await postDiscordEvent(kind, EVENT_VARS[kind])
    if (ok) toastSuccess(`Prueba «${EVENT_LABELS[kind]}» enviada`)
    else toastError('No se pudo enviar. Revisa el enlace de avisos.')
    setTestResult(ok ? `Prueba «${EVENT_LABELS[kind]}» enviada.` : 'No se pudo enviar. Revisa el enlace de avisos.')
    window.setTimeout(() => setTestResult(null), 3000)
  }

  const templates = { ...DEFAULT_DISCORD_EVENT_TEMPLATES, ...settings.eventTemplates }
  const presenceOn = Boolean(settings.presenceEnabled)

  return (
    <div className="card discord-settings-card">
      <h3><Discord size={16}/> Discord</h3>
      <p>
        {personalOnly
          ? 'Estado en tu perfil de Discord mientras usas NeuraGest.'
          : 'Avisos al canal y estado en tu perfil mientras usas NeuraLive.'}
      </p>

      {!personalOnly && (
        <>
          <h4 className="discord-section-title">Avisos al canal</h4>
          <label className="toggle-row">
            Notificaciones activas
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={channelReadonly || loading}
              onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
            />
          </label>
          <label>
            Enlace de avisos
            <input
              type="url"
              value={settings.webhookUrl}
              readOnly={channelReadonly}
              onChange={(event) => setSettings({ ...settings, webhookUrl: event.target.value })}
            />
          </label>

          <div className="discord-event-templates">
            <h4>Mensajes por evento</h4>
            {(Object.keys(EVENT_LABELS) as DiscordEventKind[]).map((kind) => (
              <div className="discord-template-row" key={kind}>
                <label>
                  {EVENT_LABELS[kind]}
                  <textarea
                    rows={2}
                    value={templates[kind]}
                    readOnly={channelReadonly}
                    onChange={(e) => updateTemplate(kind, e.target.value)}
                  />
                </label>
                <div className="discord-template-meta">
                  <small>Vista previa: {renderDiscordEventTemplate(templates[kind], EVENT_VARS[kind])}</small>
                  {!channelReadonly && (
                    <button type="button" className="secondary" onClick={() => void testTemplate(kind)}>
                      <Send size={13} /> Probar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="discord-presence-block">
        <h4 className="discord-section-title"><Radio size={14} /> Estado en Discord</h4>
        {!isTauri && (
          <p className="integration-note">Disponible en la app de escritorio NeuraGest.</p>
        )}
        {isTauri && (
          <div
            className={`discord-presence-status ${presenceStatus?.connected ? 'is-connected' : 'is-idle'}`}
            role="status"
          >
            <span className="discord-presence-dot" aria-hidden />
            <span>
              {presenceStatus?.connected
                ? 'Conectado'
                : presenceOn
                  ? 'Discord no detectado'
                  : 'Desactivado'}
            </span>
            {presenceStatus?.message && (
              <small>{presenceStatus.message}</small>
            )}
          </div>
        )}
        <label className="toggle-row">
          Mostrar estado en Discord
          <input
            type="checkbox"
            checked={presenceOn}
            disabled={readonly || loading || !isTauri}
            onChange={(event) => setSettings({ ...settings, presenceEnabled: event.target.checked })}
          />
        </label>
        <label>
          Detalle
          <input
            type="text"
            maxLength={128}
            placeholder="Operaciones Twitch · NeuraLive"
            value={settings.presenceDetails ?? ''}
            readOnly={readonly || !presenceOn}
            disabled={!presenceOn}
            onChange={(event) => setSettings({ ...settings, presenceDetails: event.target.value })}
          />
        </label>
        <label>
          Estado
          <input
            type="text"
            maxLength={128}
            placeholder="Vacío = página actual"
            value={settings.presenceState ?? ''}
            readOnly={readonly || !presenceOn}
            disabled={!presenceOn}
            onChange={(event) => setSettings({ ...settings, presenceState: event.target.value })}
          />
        </label>
        <label className="toggle-row">
          Reflejar página actual
          <input
            type="checkbox"
            checked={settings.presenceShowPage !== false}
            disabled={readonly || loading || !presenceOn || Boolean(settings.presenceState?.trim())}
            onChange={(event) => setSettings({ ...settings, presenceShowPage: event.target.checked })}
          />
        </label>
        <label className="toggle-row">
          Logo NeuraLive
          <input
            type="checkbox"
            checked={settings.presenceUseLargeImage !== false}
            disabled={readonly || loading || !presenceOn}
            onChange={(event) => setSettings({ ...settings, presenceUseLargeImage: event.target.checked })}
          />
        </label>
      </div>

      {testResult && <p className="integration-note">{testResult}</p>}
      {presenceNote && <p className={`integration-note ${presenceStatus?.connected ? 'discord-presence-ok' : ''}`}>{presenceNote}</p>}
      <div className="discord-settings-actions">
        {isTauri && (
          <button
            type="button"
            className="secondary"
            disabled={readonly || loading || testingPresence}
            onClick={() => void testPresence()}
          >
            <Radio size={13} />
            {testingPresence ? 'Probando…' : 'Probar estado'}
          </button>
        )}
        <button className="secondary" disabled={readonly || loading} onClick={() => void save()}>
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

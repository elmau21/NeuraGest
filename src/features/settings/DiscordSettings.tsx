import { useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import {
  getDiscordSettings,
  saveDiscordSettings,
  DEFAULT_DISCORD_EVENT_TEMPLATES,
  type DiscordSettings,
  type DiscordEventKind,
} from '@/services/settings'
import { postDiscordEvent, renderDiscordEventTemplate } from '@/services/discord'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'

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

export function DiscordSettings() {
  const [settings, setSettings] = useState<DiscordSettings>({
    webhookUrl: '',
    enabled: false,
    postedLive: {},
    eventTemplates: DEFAULT_DISCORD_EVENT_TEMPLATES,
  })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)

  useEffect(() => {
    void getDiscordSettings().then(setSettings).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (readonly) return
    const ok = await saveDiscordSettings(settings)
    setSaved(ok)
    window.setTimeout(() => setSaved(false), 1500)
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
    setTestResult(ok ? `Prueba «${EVENT_LABELS[kind]}» enviada.` : 'No se pudo enviar — revisa el enlace de Discord.')
    window.setTimeout(() => setTestResult(null), 3000)
  }

  const templates = { ...DEFAULT_DISCORD_EVENT_TEMPLATES, ...settings.eventTemplates }

  return (
    <div className="card discord-settings-card">
      <h3><MessageCircle size={16}/> Discord</h3>
      <p>Enlace de notificaciones para streams en vivo y plantillas por evento (raid, milestone, fin campaña).</p>
      <label className="toggle-row">
        Notificaciones activas
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={readonly || loading}
          onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
        />
      </label>
      <label>
        Enlace de Discord
        <input
          type="url"
          placeholder="https://discord.com/channels/…"
          value={settings.webhookUrl}
          readOnly={readonly}
          onChange={(event) => setSettings({ ...settings, webhookUrl: event.target.value })}
        />
      </label>
      <p className="integration-note">Live: «Nombre en vivo · N viewers» · Placeholders evento: {'{talent}'}, {'{raider}'}, {'{viewers}'}, {'{milestone}'}, {'{brand}'}</p>

      <div className="discord-event-templates">
        <h4>Plantillas por evento</h4>
        {(Object.keys(EVENT_LABELS) as DiscordEventKind[]).map((kind) => (
          <div className="discord-template-row" key={kind}>
            <label>
              {EVENT_LABELS[kind]}
              <textarea
                rows={2}
                value={templates[kind]}
                readOnly={readonly}
                onChange={(e) => updateTemplate(kind, e.target.value)}
              />
            </label>
            <div className="discord-template-meta">
              <small>Vista previa: {renderDiscordEventTemplate(templates[kind], EVENT_VARS[kind])}</small>
              {!readonly && (
                <button type="button" className="secondary" onClick={() => void testTemplate(kind)}>
                  <Send size={13} /> Probar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {testResult && <p className="integration-note">{testResult}</p>}
      <button className="secondary" disabled={readonly || loading} onClick={() => void save()}>
        {saved ? 'Guardado' : 'Guardar Discord'}
      </button>
    </div>
  )
}

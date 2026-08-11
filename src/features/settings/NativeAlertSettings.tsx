import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import {
  getNativeAlertSettings,
  saveNativeAlertSettings,
  type NativeAlertSettings,
} from '@/services/settings'
import { testNativeNotification } from '@/services/native-alerts'
import { getLiveSoundSettings, playLiveOnBeep } from '@/services/live-sound'
import { useAuthStore } from '@/stores/auth-store'
import { canEditPersonalSettings } from '@/services/permissions'
import { isTauri } from '@/services/twitch'
import { toastError, toastSuccess } from '@/stores/toast-store'

export function NativeAlertSettings() {
  const [settings, setSettings] = useState<NativeAlertSettings>({
    enabled: false,
    notifyOnline: true,
    notifyOffline: true,
    notifyViewerThreshold: false,
    viewerThreshold: 100,
    postedAlerts: {},
  })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canEditPersonalSettings(roles, session?.login)

  useEffect(() => {
    void getNativeAlertSettings().then(setSettings).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (readonly) return
    const ok = await saveNativeAlertSettings(settings)
    setSaved(ok)
    if (ok) toastSuccess('Guardado')
    else toastError('No se pudo guardar')
    window.setTimeout(() => setSaved(false), 1500)
  }

  const runTest = async () => {
    const ok = await testNativeNotification()
    if (ok) {
      toastSuccess('Alerta de prueba enviada')
      const sound = getLiveSoundSettings()
      if (sound.soundOnLive || sound.soundOnOffline) {
        void playLiveOnBeep()
      }
      setTestResult('Notificación de prueba enviada.')
    } else {
      toastError('No se pudo enviar la notificación')
      setTestResult('No se pudo enviar la notificación.')
    }
    window.setTimeout(() => setTestResult(null), 2500)
  }

  return (
    <div className="card">
      <h3><Bell size={16}/> Alertas Windows</h3>
      <p>Avisos del sistema cuando cambie el estado de un stream.</p>
      {!isTauri && (
        <p className="integration-note">Disponible en la app de escritorio NeuraGest.</p>
      )}
      <label className="toggle-row">
        Alertas activas
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={readonly || loading || !isTauri}
          onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
        />
      </label>
      <label className="toggle-row">
        Stream en vivo
        <input
          type="checkbox"
          checked={settings.notifyOnline}
          disabled={readonly || loading || !settings.enabled}
          onChange={(event) => setSettings({ ...settings, notifyOnline: event.target.checked })}
        />
      </label>
      <label className="toggle-row">
        Stream offline
        <input
          type="checkbox"
          checked={settings.notifyOffline}
          disabled={readonly || loading || !settings.enabled}
          onChange={(event) => setSettings({ ...settings, notifyOffline: event.target.checked })}
        />
      </label>
      <label className="toggle-row">
        Umbral de viewers
        <input
          type="checkbox"
          checked={settings.notifyViewerThreshold}
          disabled={readonly || loading || !settings.enabled}
          onChange={(event) => setSettings({ ...settings, notifyViewerThreshold: event.target.checked })}
        />
      </label>
      {settings.notifyViewerThreshold && (
        <label>
          Viewers mínimos
          <input
            type="number"
            min={1}
            step={10}
            value={settings.viewerThreshold}
            readOnly={readonly}
            disabled={!settings.enabled}
            onChange={(event) => setSettings({
              ...settings,
              viewerThreshold: Math.max(1, Number(event.target.value) || 1),
            })}
          />
        </label>
      )}
      <div className="settings-session-actions">
        <button className="secondary" disabled={readonly || loading || !isTauri} onClick={() => void save()}>
          {saved ? 'Guardado' : 'Guardar'}
        </button>
        <button className="secondary" disabled={!settings.enabled || !isTauri} onClick={() => void runTest()}>
          Probar
        </button>
      </div>
      {testResult && <p className="integration-note">{testResult}</p>}
    </div>
  )
}

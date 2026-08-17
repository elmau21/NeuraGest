import { useEffect, useState } from 'react'
import { Volume2 } from '@/components/icons'
import {
  getLiveSoundSettings,
  playLiveOffBeep,
  playLiveOnBeep,
  saveLiveSoundSettings,
  type LiveSoundSettings,
  DEFAULT_LIVE_SOUND_SETTINGS,
} from '@/services/live-sound'
import { toastSuccess } from '@/stores/toast-store'

export function LiveSoundSettings() {
  const [settings, setSettings] = useState<LiveSoundSettings>(DEFAULT_LIVE_SOUND_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setSettings(getLiveSoundSettings())
    setLoaded(true)
  }, [])

  const persist = (next: LiveSoundSettings) => {
    setSettings(next)
    saveLiveSoundSettings(next)
    toastSuccess('Guardado')
  }

  return (
    <div className="card">
      <h3><Volume2 size={16} /> Sonido de stream</h3>
      <p>Aviso sonoro suave al detectar cambios de emisión. Desactivado por defecto.</p>
      <label className="toggle-row">
        Sonido al ir en vivo
        <input
          type="checkbox"
          checked={settings.soundOnLive}
          disabled={!loaded}
          onChange={(event) => persist({ ...settings, soundOnLive: event.target.checked })}
        />
      </label>
      <label className="toggle-row">
        Sonido al terminar
        <input
          type="checkbox"
          checked={settings.soundOnOffline}
          disabled={!loaded}
          onChange={(event) => persist({ ...settings, soundOnOffline: event.target.checked })}
        />
      </label>
      <div className="settings-session-actions">
        <button
          type="button"
          className="secondary"
          disabled={!loaded}
          onClick={() => {
            void playLiveOnBeep()
            toastSuccess('Sonido de prueba')
          }}
        >
          Probar en vivo
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!loaded}
          onClick={() => {
            void playLiveOffBeep()
            toastSuccess('Sonido de prueba')
          }}
        >
          Probar fin
        </button>
      </div>
    </div>
  )
}

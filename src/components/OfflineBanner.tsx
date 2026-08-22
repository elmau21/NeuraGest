import { WifiOff, X } from '@/components/icons'
import { useOfflineStore } from '@/stores/offline-store'

export function OfflineBanner() {
  const usingCache = useOfflineStore((s) => s.usingCache)
  const setUsingCache = useOfflineStore((s) => s.setUsingCache)

  if (!usingCache) return null

  return (
    <div className="offline-banner" role="status">
      <WifiOff size={15} aria-hidden />
      <span>Sin conexión — mostrando datos en caché</span>
      <button type="button" className="offline-banner-dismiss" aria-label="Ocultar aviso" onClick={() => setUsingCache(false)}>
        <X size={13} />
      </button>
    </div>
  )
}

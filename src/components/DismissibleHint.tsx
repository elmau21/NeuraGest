import { useState } from 'react'
import { Lightbulb, X } from '@/components/icons'

type DismissibleHintProps = {
  storageKey: string
  children: React.ReactNode
  className?: string
}

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function DismissibleHint({ storageKey, children, className = '' }: DismissibleHintProps) {
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey))

  if (dismissed) return null

  return (
    <div className={`dismissible-hint ${className}`.trim()} role="note">
      <Lightbulb size={14} aria-hidden />
      <span>{children}</span>
      <button
        type="button"
        className="dismissible-hint-close"
        aria-label="Cerrar consejo"
        onClick={() => {
          setDismissed(true)
          try { localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
        }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

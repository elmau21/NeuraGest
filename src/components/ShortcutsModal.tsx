import { useEffect } from 'react'
import { LayoutGrid } from '@/components/icons'

const SHORTCUTS = [
  { keys: 'Ctrl K', label: 'Búsqueda global' },
  { keys: '?', label: 'Atajos de teclado' },
  { keys: 'Esc', label: 'Cerrar modales y menús' },
  { keys: 'Enter', label: 'Abrir elemento seleccionado (listas)' },
  { keys: 'Tab', label: 'Navegar entre controles' },
] as const

type ShortcutsModalProps = {
  open: boolean
  onClose: () => void
}

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="shortcuts-modal vision-glass"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <header>
          <LayoutGrid size={18} aria-hidden />
          <h2 id="shortcuts-title">Atajos de teclado</h2>
          <kbd>Esc</kbd>
        </header>
        <ul className="shortcuts-list">
          {SHORTCUTS.map((item) => (
            <li key={item.keys}>
              <kbd>{item.keys}</kbd>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        <p className="shortcuts-note">En macOS, usa ⌘ en lugar de Ctrl.</p>
      </div>
    </div>
  )
}

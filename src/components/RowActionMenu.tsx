import { useEffect, useRef, useState } from 'react'
import { Ellipsis } from '@/components/icons'

export type RowAction = {
  id: string
  label: string
  onClick: () => void
  danger?: boolean
  hidden?: boolean
}

type RowActionMenuProps = {
  actions: RowAction[]
  className?: string
}

export function RowActionMenu({ actions, className = '' }: RowActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const visible = actions.filter((action) => !action.hidden)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openAt = (clientX: number, clientY: number) => {
    setPosition({ top: clientY, left: clientX })
    setOpen(true)
  }

  if (visible.length === 0) return null

  return (
    <div
      className={`row-action-menu ${className}`.trim()}
      ref={wrapRef}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        openAt(event.clientX, event.clientY)
      }}
    >
      <button
        type="button"
        className="icon-btn row-action-trigger"
        aria-label="Más acciones"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          const rect = event.currentTarget.getBoundingClientRect()
          openAt(rect.left, rect.bottom + 4)
        }}
      >
        <Ellipsis size={16} />
      </button>
      {open ? (
        <div
          className="row-action-dropdown"
          style={{ top: position.top, left: position.left }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          {visible.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className={action.danger ? 'danger' : undefined}
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
                action.onClick()
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

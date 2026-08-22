import type { ReactNode } from 'react'
import type { PlatformIcon } from '@/components/icons'

type EmptyStateProps = {
  icon?: PlatformIcon
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, children, className = '' }: EmptyStateProps) {
  return (
    <div className={`empty-state-block ${className}`.trim()}>
      {Icon ? <Icon size={32} strokeWidth={1.5} className="empty-state-icon" aria-hidden /> : null}
      <b>{title}</b>
      {description ? <span>{description}</span> : null}
      {children ? <div className="empty-state-actions">{children}</div> : null}
    </div>
  )
}

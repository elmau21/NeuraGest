import { Link } from 'react-router-dom'
import { ShieldAlert } from '@/components/icons'
import { EmptyState } from '@/components/EmptyState'
import type { PermissionDenial } from '@/services/permissions'

export type PermissionAlternative = {
  label: string
  to: string
}

type PermissionGateProps = {
  allowed: boolean
  denial: PermissionDenial
  children: React.ReactNode
}

export function PermissionGate({ allowed, denial, children }: PermissionGateProps) {
  if (allowed) return <>{children}</>

  return (
    <EmptyState
      icon={ShieldAlert}
      title={denial.title}
      description={denial.description}
      className="permission-gate"
    >
      {denial.alternatives?.map((alt) => (
        <Link key={alt.to} to={alt.to} className="secondary">
          {alt.label}
        </Link>
      ))}
    </EmptyState>
  )
}

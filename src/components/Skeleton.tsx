import type { CSSProperties } from 'react'

type BarProps = {
  className?: string
  style?: CSSProperties
}

export function SkeletonBar({ className = '', style }: BarProps) {
  return <span className={`sk-bar ${className}`.trim()} style={style} aria-hidden />
}

export function DashboardSkeleton() {
  return (
    <div className="sk-dashboard" aria-busy="true" aria-label="Cargando dashboard">
      <div className="sk-title-block">
        <SkeletonBar className="sk-w-24 sk-h-10" />
        <SkeletonBar className="sk-w-48 sk-h-22" />
        <SkeletonBar className="sk-w-64 sk-h-12" />
      </div>
      <div className="sk-kpi-row">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="sk-kpi" key={i}>
            <SkeletonBar className="sk-w-40 sk-h-10" />
            <SkeletonBar className="sk-w-32 sk-h-20" />
            <SkeletonBar className="sk-w-48 sk-h-10" />
          </div>
        ))}
      </div>
      <div className="sk-visual-row">
        <div className="sk-panel sk-panel-lg">
          <SkeletonBar className="sk-w-40 sk-h-12" />
          <SkeletonBar className="sk-chart" />
        </div>
        <div className="sk-panel">
          <SkeletonBar className="sk-w-36 sk-h-12" />
          {Array.from({ length: 3 }, (_, i) => (
            <div className="sk-live-row" key={i}>
              <SkeletonBar className="sk-avatar" />
              <div className="sk-live-meta">
                <SkeletonBar className="sk-w-48 sk-h-12" />
                <SkeletonBar className="sk-w-32 sk-h-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="sk-panel">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonBar className="sk-table-row" key={i} />
        ))}
      </div>
    </div>
  )
}

export function TalentsSkeleton() {
  return (
    <div className="sk-talents" aria-busy="true" aria-label="Cargando talentos">
      <div className="sk-title-block">
        <SkeletonBar className="sk-w-32 sk-h-22" />
        <SkeletonBar className="sk-w-56 sk-h-12" />
      </div>
      <div className="sk-panel">
        <SkeletonBar className="sk-w-48 sk-h-14 sk-mb" />
        {Array.from({ length: 8 }, (_, i) => (
          <div className="sk-talent-row" key={i}>
            <SkeletonBar className="sk-avatar" />
            <SkeletonBar className="sk-w-40 sk-h-12" />
            <SkeletonBar className="sk-w-24 sk-h-10" />
            <SkeletonBar className="sk-w-28 sk-h-10" />
            <SkeletonBar className="sk-w-20 sk-h-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function WarRoomSkeleton() {
  return (
    <div className="sk-war-room" aria-busy="true" aria-label="Cargando war room">
      <div className="sk-title-block">
        <SkeletonBar className="sk-w-40 sk-h-22" />
        <SkeletonBar className="sk-w-64 sk-h-12" />
      </div>
      <div className="sk-kpi-row sk-kpi-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="sk-kpi" key={i}>
            <SkeletonBar className="sk-w-32 sk-h-10" />
            <SkeletonBar className="sk-w-24 sk-h-20" />
          </div>
        ))}
      </div>
      <div className="sk-mosaic">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="sk-mosaic-tile" key={i}>
            <SkeletonBar className="sk-mosaic-frame" />
            <SkeletonBar className="sk-w-40 sk-h-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

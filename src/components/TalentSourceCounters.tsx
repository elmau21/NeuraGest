import type { TalentSourceCounts } from '@/hooks/useTalentDataSources'

type Props = {
  counts: TalentSourceCounts
  className?: string
  showMerged?: boolean
}

export function TalentSourceCounters({ counts, className, showMerged = true }: Props) {
  return (
    <div className={`talent-source-counters${className ? ` ${className}` : ''}`}>
      <span className="talent-source-badge helix">{counts.helix.toLocaleString('es-MX')} Twitch</span>
      <span className="talent-source-badge tt">{counts.tt.toLocaleString('es-MX')} TT</span>
      <span className="talent-source-badge vods">{counts.vods.toLocaleString('es-MX')} repeticiones</span>
      <span className="talent-source-badge sessions">{counts.sessions.toLocaleString('es-MX')} sesiones</span>
      <span className="talent-source-badge events">{counts.events.toLocaleString('es-MX')} tiempo real</span>
      {showMerged && (
        <span className="talent-source-badge merged">
          {counts.merged.toLocaleString('es-MX')} pts fusionados
          {counts.mergedAdded > 0 && ` (+${counts.mergedAdded.toLocaleString('es-MX')})`}
        </span>
      )}
    </div>
  )
}

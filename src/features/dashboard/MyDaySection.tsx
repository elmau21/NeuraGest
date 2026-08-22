import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  FileText,
  LayoutTemplate,
  ListTodo,
  Radio,
  Scan,
} from '@/components/icons'
import { localContracts } from '@/features/documents/contracts-data'
import { listDocumentDriveItems } from '@/services/document-drive'
import { listDesignBriefs } from '@/services/design-briefs'
import { listEventFichas } from '@/services/ops-event-fichas'
import {
  canAccessContratos,
  canAccessControlCenter,
  canMutateDesign,
} from '@/services/permissions'
import { fetchTasks } from '@/services/tasks'
import { taskSummaryCounts } from '@/services/task-utils'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'

type DayCard = {
  key: string
  label: string
  value: string
  meta: string
  to: string
  icon: typeof ListTodo
  tone?: string
}

export function MyDaySection() {
  const talents = useAppStore((state) => state.talents)
  const roles = useAuthStore((state) => state.roles)
  const login = useAuthStore((state) => state.session)?.login
  const showControl = canAccessControlCenter(roles, login)
  const showDesign = canMutateDesign(roles, login)
  const showContracts = canAccessContratos(roles, login)
  const tasksPath = showControl ? '/control/tareas' : '/tareas'

  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [openFichas, setOpenFichas] = useState<number | null>(null)
  const [draftBriefs, setDraftBriefs] = useState<number | null>(null)
  const [contractCount, setContractCount] = useState<number | null>(null)

  const liveCount = useMemo(() => talents.filter((talent) => talent.isLive).length, [talents])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const tasks = await fetchTasks()
        if (cancelled) return
        const counts = taskSummaryCounts(tasks)
        setPendingCount(counts.pending)
        setOverdueCount(counts.overdue)
      } catch {
        if (!cancelled) setPendingCount(0)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!showControl && !showDesign) return
    let cancelled = false
    void (async () => {
      try {
        if (showControl) {
          const fichas = await listEventFichas()
          if (!cancelled) {
            setOpenFichas(fichas.filter((f) => !['publicado', 'cerrado'].includes(f.estado)).length)
          }
        }
        if (showDesign) {
          const briefs = await listDesignBriefs()
          if (!cancelled) {
            setDraftBriefs(briefs.filter((b) => b.status === 'draft' || b.status === 'ready').length)
          }
        }
      } catch {
        if (!cancelled) {
          if (showControl) setOpenFichas(0)
          if (showDesign) setDraftBriefs(0)
        }
      }
    })()
    return () => { cancelled = true }
  }, [showControl, showDesign])

  useEffect(() => {
    if (!showContracts) return
    let cancelled = false
    void (async () => {
      try {
        const cloud = await listDocumentDriveItems('Contratos', null)
        if (!cancelled) setContractCount(cloud.filter((item) => item.kind === 'file').length + localContracts.length)
      } catch {
        if (!cancelled) setContractCount(localContracts.length)
      }
    })()
    return () => { cancelled = true }
  }, [showContracts])

  const cards: DayCard[] = [
    {
      key: 'tasks',
      label: 'Tareas pendientes',
      value: pendingCount == null ? '…' : String(pendingCount),
      meta: overdueCount > 0 ? `${overdueCount} atrasada${overdueCount === 1 ? '' : 's'}` : 'Al día con lo urgente',
      to: tasksPath,
      icon: ListTodo,
      tone: overdueCount > 0 ? 'warn' : 'purple',
    },
    {
      key: 'live',
      label: 'Canales en directo',
      value: String(liveCount),
      meta: liveCount > 0 ? 'Emitiendo ahora' : 'Sin emisiones activas',
      to: '/war-room',
      icon: Scan,
      tone: liveCount > 0 ? 'live' : 'neutral',
    },
  ]

  if (showControl && openFichas != null) {
    cards.push({
      key: 'fichas',
      label: 'Fichas abiertas',
      value: String(openFichas),
      meta: openFichas > 0 ? 'Eventos por cerrar' : 'Sin fichas pendientes',
      to: '/control/fichas',
      icon: LayoutTemplate,
      tone: openFichas > 0 ? 'amber' : 'blue',
    })
  }

  if (showDesign && draftBriefs != null) {
    cards.push({
      key: 'briefs',
      label: 'Briefs creativos',
      value: String(draftBriefs),
      meta: draftBriefs > 0 ? 'Por revisar o publicar' : 'Briefs al día',
      to: '/diseno/briefs',
      icon: LayoutTemplate,
      tone: draftBriefs > 0 ? 'amber' : 'cyan',
    })
  }

  if (showContracts && contractCount != null) {
    cards.push({
      key: 'contracts',
      label: 'Contratos',
      value: String(contractCount),
      meta: 'Archivos en carpeta Contratos',
      to: '/documentos?category=Contratos',
      icon: FileText,
      tone: 'blue',
    })
  }

  return (
    <section className="my-day-section" aria-labelledby="my-day-title">
      <div className="my-day-head">
        <div>
          <span className="bi-overline">RESUMEN PERSONAL</span>
          <h2 id="my-day-title">Tu día</h2>
          <p>Lo que necesitas atender hoy, con un clic.</p>
        </div>
        <Link to={tasksPath} className="cc-inline-link">
          Ver tareas <ArrowRight size={12} />
        </Link>
      </div>
      <div className="my-day-grid">
        {cards.map(({ key, label, value, meta, to, icon: Icon, tone }) => (
          <Link key={key} to={to} className={`vision-stat-card my-day-card ${tone ?? ''}`.trim()}>
            <div className="vision-stat-icon" aria-hidden>
              <Icon size={18} strokeWidth={1.6} />
            </div>
            <div className="vision-stat-content">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{meta}</small>
            </div>
            {key === 'live' && liveCount > 0 ? <Radio size={14} className="my-day-live-pulse" aria-hidden /> : null}
          </Link>
        ))}
      </div>
    </section>
  )
}

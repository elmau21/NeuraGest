import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, X } from '@/components/icons'
import { useNavigate } from 'react-router-dom'
import type { AppRole } from '@/services/app-users'
import { useAuthStore } from '@/stores/auth-store'

const ONBOARDING_KEY = 'neuragest-onboarding-v1'

type OnboardingStep = {
  title: string
  body: string
  route?: string
}

function stepsForRoles(roles: AppRole[]): OnboardingStep[] {
  if (roles.includes('assistant')) {
    return [
      {
        title: 'Organiza tus tareas',
        body: 'El panel de tareas concentra pendientes, atrasadas y lo que vence hoy. Empieza aquí cada mañana.',
        route: '/control/tareas',
      },
      {
        title: 'Fichas de evento',
        body: 'Registra ideas, producción y cierre de eventos en fichas para que el equipo tenga contexto.',
        route: '/control/fichas',
      },
      {
        title: 'Notas del día',
        body: 'En el centro de control dejas cobertura, handoff y notas operativas para quien sigue el turno.',
        route: '/control',
      },
    ]
  }

  if (roles.includes('league_manager')) {
    return [
      {
        title: 'Contratos de liga',
        body: 'Gestiona contratos y documentos de jugadores desde Documentos y NeuraLeague.',
        route: '/documentos',
      },
      {
        title: 'Calendario de liga',
        body: 'Partidos, entrenamientos y fechas clave viven en el calendario de NeuraLeague.',
        route: '/neuralleague/calendario',
      },
      {
        title: 'Operación de temporada',
        body: 'Revisa equipos, reclutamiento y operación diaria desde el hub de NeuraLeague.',
        route: '/neuralleague/operacion',
      },
    ]
  }

  if (roles.includes('owner') || roles.includes('admin')) {
    return [
      {
        title: 'War Room',
        body: 'Supervisa varios canales en directo, viewers y alertas desde un solo lugar.',
        route: '/war-room',
      },
      {
        title: 'Contratos y documentos',
        body: 'Centraliza contratos, directivas y archivos compartidos del equipo.',
        route: '/documentos',
      },
      {
        title: 'Permisos del equipo',
        body: 'Define quién puede ver y editar cada área desde Ajustes → Permisos.',
        route: '/ajustes?tab=permisos',
      },
    ]
  }

  return [
    {
      title: 'Tu resumen diario',
      body: 'El dashboard muestra tareas, canales en vivo y pendientes clave al inicio del día.',
      route: '/',
    },
    {
      title: 'War Room',
      body: 'Monitorea emisiones activas y métricas en tiempo real.',
      route: '/war-room',
    },
    {
      title: 'Centro de control',
      body: 'Alertas, cobertura y operación del día en un solo panel.',
      route: '/control',
    },
  ]
}

export function OnboardingModal() {
  const roles = useAuthStore((s) => s.roles)
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const navigate = useNavigate()
  const steps = useMemo(() => stepsForRoles(roles), [roles])

  useEffect(() => {
    if (roles.length === 0) return
    try {
      if (localStorage.getItem(ONBOARDING_KEY) === '1') return
    } catch { /* ignore */ }
    const timer = window.setTimeout(() => setOpen(true), 1000)
    return () => window.clearTimeout(timer)
  }, [roles])

  const finish = useCallback(() => {
    try { localStorage.setItem(ONBOARDING_KEY, '1') } catch { /* ignore */ }
    setOpen(false)
  }, [])

  const go = useCallback((index: number) => {
    const step = steps[index]
    if (step?.route) navigate(step.route)
    setStepIndex(index)
  }, [navigate, steps])

  if (!open || steps.length === 0) return null

  const step = steps[stepIndex]
  const isLast = stepIndex >= steps.length - 1

  return (
    <div className="onboarding-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-modal-title">
      <div className="onboarding-modal-card glass-card">
        <button type="button" className="onboarding-modal-close" onClick={finish} aria-label="Cerrar">
          <X size={16} />
        </button>
        <span className="onboarding-modal-step">Paso {stepIndex + 1} de {steps.length}</span>
        <h2 id="onboarding-modal-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="onboarding-modal-actions">
          {stepIndex > 0 ? (
            <button type="button" className="secondary" onClick={() => go(stepIndex - 1)}>Anterior</button>
          ) : null}
          {!isLast ? (
            <button type="button" className="primary" onClick={() => go(stepIndex + 1)}>
              Siguiente<ChevronRight size={14} />
            </button>
          ) : (
            <button type="button" className="primary" onClick={finish}>Listo</button>
          )}
          <button type="button" className="text-btn" onClick={finish}>Omitir</button>
        </div>
      </div>
    </div>
  )
}

export function resetOnboardingModal() {
  try { localStorage.removeItem(ONBOARDING_KEY) } catch { /* ignore */ }
}

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'

const TOUR_KEY = 'neuragest-manager-tour-done'

type TourStep = {
  id: string
  title: string
  body: string
  route?: string
  selector?: string
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenido, manager',
    body: 'Este recorrido te muestra las áreas clave de NeuraGest para operar la agencia.',
  },
  {
    id: 'war-room',
    title: 'War Room / NOC',
    body: 'Mira varios streams a la vez, gestiona el mosaico y vigila viewers en tiempo real.',
    route: '/war-room',
    selector: '[data-tour="nav-war-room"]',
  },
  {
    id: 'crm',
    title: 'CRM Patrocinios',
    body: 'Registra marcas, deals, entregables y detecta conflictos de exclusividad.',
    route: '/crm',
    selector: '[data-tour="nav-crm"]',
  },
  {
    id: 'inteligencia',
    title: 'Inteligencia Twitch',
    body: 'Radar de categorías, heatmap, clips de Twitch y checklist post-stream.',
    route: '/inteligencia',
    selector: '[data-tour="nav-inteligencia"]',
  },
  {
    id: 'ajustes',
    title: 'Ajustes e integraciones',
    body: 'Perfiles Twitch multi-cuenta, importar historial, Discord y actualizaciones.',
    route: '/ajustes',
    selector: '[data-tour="nav-ajustes"]',
  },
]

function isManagerRole(roles: string[]) {
  return roles.some((role) => ['owner', 'admin', 'manager'].includes(role))
}

export function ManagerTour() {
  const roles = useAuthStore((s) => s.roles)
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isManagerRole(roles)) return
    try {
      if (localStorage.getItem(TOUR_KEY) === '1') return
    } catch { /* ignore */ }
    const timer = window.setTimeout(() => setOpen(true), 800)
    return () => window.clearTimeout(timer)
  }, [roles])

  const finish = useCallback(() => {
    try { localStorage.setItem(TOUR_KEY, '1') } catch { /* ignore */ }
    setOpen(false)
  }, [])

  const go = useCallback((index: number) => {
    const step = STEPS[index]
    if (step?.route) navigate(step.route)
    setStepIndex(index)
  }, [navigate])

  if (!open) return null

  const step = STEPS[stepIndex]
  const isLast = stepIndex >= STEPS.length - 1

  return (
    <div className="manager-tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="manager-tour-title">
      <div className="manager-tour-card">
        <button type="button" className="manager-tour-close" onClick={finish} aria-label="Cerrar tour">
          <X size={16}/>
        </button>
        <span className="manager-tour-step">Paso {stepIndex + 1} de {STEPS.length}</span>
        <h2 id="manager-tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="manager-tour-actions">
          {stepIndex > 0 && (
            <button type="button" className="secondary" onClick={() => go(stepIndex - 1)}>Anterior</button>
          )}
          {!isLast ? (
            <button type="button" className="primary" onClick={() => go(stepIndex + 1)}>
              Siguiente<ChevronRight size={14}/>
            </button>
          ) : (
            <button type="button" className="primary" onClick={finish}>Empezar a operar</button>
          )}
          <button type="button" className="text-btn" onClick={finish}>Omitir</button>
        </div>
      </div>
    </div>
  )
}

export function resetManagerTour() {
  try { localStorage.removeItem(TOUR_KEY) } catch { /* ignore */ }
}

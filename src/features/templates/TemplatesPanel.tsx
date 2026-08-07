import { useState } from 'react'
import { Layers, Loader2 } from 'lucide-react'
import { applyTemplate, TEMPLATES, type TemplateKind } from '@/services/templates'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'
import { useTasksStore } from '@/stores/tasks-store'

export function TemplatesPanel() {
  const [busy, setBusy] = useState<TemplateKind | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)
  const reloadTasks = useTasksStore((s) => s.load)

  const run = async (kind: TemplateKind) => {
    if (readonly) return
    setBusy(kind)
    setMessage(null)
    const result = await applyTemplate(kind)
    if (result) {
      setMessage(`Plantilla aplicada: ${result.tasks} tareas y ${result.events} eventos creados.`)
      await reloadTasks()
    } else {
      setMessage('No se pudo aplicar la plantilla. Verifica tu sesión activa.')
    }
    setBusy(null)
  }

  return (
    <div className="templates-panel">
      <div className="templates-head">
        <Layers size={18}/>
        <div><h3>Plantillas operativas</h3><p>Genera tareas y eventos de calendario con un clic.</p></div>
      </div>
      <div className="templates-grid">
        {TEMPLATES.map((template) => (
          <div className="card template-card" key={template.id}>
            <b>{template.title}</b>
            <p>{template.description}</p>
            <small>{template.tasks.length} tareas · {template.events.length} eventos</small>
            <button className="primary" disabled={readonly || busy !== null} onClick={() => void run(template.id)}>
              {busy === template.id ? <Loader2 size={14} className="spinning"/> : null}
              Aplicar plantilla
            </button>
          </div>
        ))}
      </div>
      {readonly && <p className="integration-note">Staff: plantillas deshabilitadas.</p>}
      {message && <p className="integration-note">{message}</p>}
    </div>
  )
}

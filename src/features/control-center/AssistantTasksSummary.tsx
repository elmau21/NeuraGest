import { Link } from 'react-router-dom'
import { ArrowRight, Check, Clock, ListTodo } from '@/components/icons'
import type { TaskRecord } from '@/services/tasks'
import { overdueTasks, pendingTasks, taskSummaryCounts } from '@/services/task-utils'

export function AssistantTasksSummary({ tasks }: { tasks: TaskRecord[] }) {
  const counts = taskSummaryCounts(tasks)
  const overdue = overdueTasks(tasks)
  const pending = pendingTasks(tasks)

  return (
    <section className="card cc-section at-summary-widget">
      <div className="cc-section-head">
        <div className="cc-section-title">
          <ListTodo size={16} strokeWidth={1.6} />
          <div>
            <h3>Panel de tareas</h3>
            <p>Resumen rápido para asistentes — abre el hub completo.</p>
          </div>
        </div>
        <Link to="/control/tareas" className="cc-inline-link">
          Ver panel <ArrowRight size={12} />
        </Link>
      </div>
      <div className="cc-section-body">
        <div className="at-summary at-summary-compact">
          <div className="at-stat"><div className="at-stat-content"><span>Pendientes</span><strong>{counts.pending}</strong></div></div>
          <div className="at-stat warn"><div className="at-stat-content"><span>Atrasadas</span><strong>{counts.overdue}</strong></div></div>
          <div className="at-stat soon"><div className="at-stat-content"><span>Próximas</span><strong>{counts.dueSoon}</strong></div></div>
          <div className="at-stat ok"><div className="at-stat-content"><span>Hechas</span><strong>{counts.completedRecent}</strong></div></div>
        </div>
        {overdue.length > 0 ? (
          <ul className="at-summary-list">
            {overdue.slice(0, 3).map((t) => (
              <li key={t.id}>
                <Link to={`/control/tareas?task=${t.id}`}>
                  <Clock size={12} /> {t.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : pending.length > 0 ? (
          <ul className="at-summary-list">
            {pending.slice(0, 3).map((t) => (
              <li key={t.id}>
                <Link to={`/control/tareas?task=${t.id}`}>
                  <Check size={12} /> {t.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state cc-empty">Sin tareas urgentes. Abre el panel para crear una.</p>
        )}
      </div>
    </section>
  )
}

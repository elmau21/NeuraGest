import { useEffect, useState } from 'react'
import { MessageSquare, Paperclip, Trash2, X } from '@/components/icons'
import { useTasksStore } from '@/stores/tasks-store'
import {
  addComment,
  addSubtask,
  fetchAttachments,
  fetchComments,
  fetchSubtasks,
  fetchTasks,
  toggleSubtask,
  updateTask,
  uploadAttachment,
  type AttachmentRecord,
  type CommentRecord,
  type SubtaskRecord,
  type TaskRecord,
} from '@/services/tasks'

export function TaskDetailPanel({
  taskId,
  readonly,
  onClose,
}: {
  taskId: string
  readonly: boolean
  onClose: () => void
}) {
  const [task, setTask] = useState<TaskRecord | null>(null)
  const [subtasks, setSubtasks] = useState<SubtaskRecord[]>([])
  const [comments, setComments] = useState<CommentRecord[]>([])
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const remove = useTasksStore((s) => s.remove)

  const reload = async () => {
    const tasks = await fetchTasks()
    setTask(tasks.find((item) => item.id === taskId) ?? null)
    setSubtasks(await fetchSubtasks(taskId))
    setComments(await fetchComments(taskId))
    setAttachments(await fetchAttachments(taskId))
  }

  useEffect(() => { void reload() }, [taskId])

  const saveField = async (patch: Partial<TaskRecord>) => {
    if (readonly || !task) return
    setSaving(true)
    await updateTask(task.id, patch)
    setTask({ ...task, ...patch })
    setSaving(false)
  }

  const submitComment = async () => {
    if (readonly || !commentDraft.trim()) return
    const created = await addComment(taskId, commentDraft.trim())
    if (created) {
      setComments((current) => [...current, created])
      setCommentDraft('')
    }
  }

  const submitSubtask = async () => {
    if (readonly || !subtaskDraft.trim()) return
    const created = await addSubtask(taskId, subtaskDraft.trim())
    if (created) {
      setSubtasks((current) => [...current, created])
      setSubtaskDraft('')
    }
  }

  const onFile = async (file?: File) => {
    if (readonly || !file) return
    const uploaded = await uploadAttachment(taskId, file)
    if (uploaded) setAttachments((current) => [...current, uploaded])
    else setError('No se pudo subir el archivo')
  }

  const onDelete = async () => {
    if (readonly || !task || deleting) return
    if (!window.confirm(`¿Eliminar la tarea «${task.title}»? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    setError(null)
    const result = await remove(task.id)
    setDeleting(false)
    if (result.ok) onClose()
    else setError(result.error)
  }

  if (!task) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="task-detail-panel card" onClick={(event) => event.stopPropagation()}>
        <div className="task-detail-head">
          <div>
            <input
              className="task-detail-title"
              value={task.title}
              readOnly={readonly}
              onChange={(event) => setTask({ ...task, title: event.target.value })}
              onBlur={() => void saveField({ title: task.title })}
            />
            <span className={`priority ${task.priority}`}>{task.priority} · {task.status}</span>
          </div>
          <button className="secondary" onClick={onClose}><X size={16}/></button>
          {!readonly && (
            <button className="secondary danger" disabled={deleting} onClick={() => void onDelete()} title="Eliminar tarea">
              <Trash2 size={16}/>
            </button>
          )}
        </div>
        <textarea
          className="task-detail-description"
          value={task.description}
          readOnly={readonly}
          onChange={(event) => setTask({ ...task, description: event.target.value })}
          onBlur={() => void saveField({ description: task.description })}
        />
        <div className="task-detail-grid">
          <section>
            <h4>Subtareas</h4>
            {subtasks.map((item) => (
              <label key={item.id} className="subtask-row">
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={readonly}
                  onChange={() => void toggleSubtask(item.id, !item.completed).then(reload)}
                />
                <span className={item.completed ? 'done' : ''}>{item.title}</span>
              </label>
            ))}
            {!readonly && (
              <div className="inline-form">
                <input value={subtaskDraft} onChange={(event) => setSubtaskDraft(event.target.value)} placeholder="Nueva subtarea…" />
                <button className="secondary" onClick={() => void submitSubtask()}>Añadir</button>
              </div>
            )}
          </section>
          <section>
            <h4><MessageSquare size={14}/> Comentarios</h4>
            <div className="comments-list">
              {comments.map((comment) => (
                <div key={comment.id} className="comment-row">
                  <b>{comment.authorLabel}</b>
                  <span>{new Date(comment.createdAt).toLocaleString('es-MX')}</span>
                  <p>{comment.body}</p>
                </div>
              ))}
            </div>
            {!readonly && (
              <div className="inline-form">
                <input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Escribe un comentario…" />
                <button className="secondary" onClick={() => void submitComment()}>Enviar</button>
              </div>
            )}
          </section>
          <section>
            <h4><Paperclip size={14}/> Adjuntos</h4>
            <div className="attachments-list">
              {attachments.map((file) => (
                <a key={file.id} href={file.url} target="_blank" rel="noreferrer">{file.fileName}</a>
              ))}
            </div>
            {!readonly && (
              <label className="secondary file-upload">
                Subir archivo
                <input type="file" hidden onChange={(event) => void onFile(event.target.files?.[0])} />
              </label>
            )}
          </section>
        </div>
        {saving && <p className="integration-note">Guardando…</p>}
        {error && <p className="integration-note staff-readonly-banner">{error}</p>}
      </div>
    </div>
  )
}

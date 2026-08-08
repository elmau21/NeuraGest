import { supabase } from '@/services/supabase'
import {
  DEFAULT_ORG_ID,
  PRIORITY_BY_ID,
  STATUS_BY_ID,
  TASK_PRIORITY_IDS,
  TASK_STATUS_IDS,
} from '@/services/org'
import { logActivity } from '@/services/activity-log'
import type { Priority, TaskStatus } from '@/types'

export type TaskRecord = {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  assignee: string
  dueDate?: string
  tags: string[]
  estimate: number
  position: number
  startsAt?: string
}

export type SubtaskRecord = {
  id: string
  taskId: string
  title: string
  completed: boolean
  position: number
}

export type CommentRecord = {
  id: string
  taskId: string
  body: string
  authorLabel: string
  createdAt: string
}

export type AttachmentRecord = {
  id: string
  taskId: string
  fileName: string
  mimeType?: string
  sizeBytes?: number
  url?: string
  storagePath: string
}

const ATTACHMENTS_BUCKET = 'task-attachments'

function mapTask(row: Record<string, unknown>): TaskRecord {
  const statusId = String(row.status_id ?? '')
  const priorityId = String(row.priority_id ?? '')
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    status: (STATUS_BY_ID[statusId] ?? 'backlog') as TaskStatus,
    priority: (PRIORITY_BY_ID[priorityId] ?? 'medium') as Priority,
    assignee: 'Equipo',
    dueDate: row.due_at ? String(row.due_at).slice(0, 10) : undefined,
    tags: ['Operaciones'],
    estimate: Number(row.estimate_minutes ?? 0) / 60 || 1,
    position: Number(row.position ?? 0),
    startsAt: row.starts_at ? String(row.starts_at) : undefined,
  }
}

export async function fetchTasks(): Promise<TaskRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,description,status_id,priority_id,due_at,starts_at,estimate_minutes,position')
    .eq('organization_id', DEFAULT_ORG_ID)
    .is('deleted_at', null)
    .order('position', { ascending: true })
  if (error || !data) return []
  return data.map((row) => mapTask(row as Record<string, unknown>))
}

export async function createTask(input: Partial<TaskRecord>): Promise<TaskRecord | null> {
  if (!supabase) return null
  const status = input.status ?? 'backlog'
  const priority = input.priority ?? 'medium'
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      organization_id: DEFAULT_ORG_ID,
      title: input.title ?? 'Nueva tarea',
      description: input.description ?? '',
      status_id: TASK_STATUS_IDS[status],
      priority_id: TASK_PRIORITY_IDS[priority],
      due_at: input.dueDate ? new Date(input.dueDate).toISOString() : null,
      starts_at: input.startsAt ? new Date(input.startsAt).toISOString() : null,
      estimate_minutes: Math.round((input.estimate ?? 1) * 60),
      position: input.position ?? Date.now(),
      created_by: user?.id ?? null,
    })
    .select('id,title,description,status_id,priority_id,due_at,starts_at,estimate_minutes,position')
    .single()
  if (error || !data) return null
  const task = mapTask(data as Record<string, unknown>)
  await logActivity('task', 'created', { title: task.title }, task.id)
  return task
}

export async function updateTask(id: string, patch: Partial<TaskRecord>): Promise<boolean> {
  if (!supabase) return false
  const payload: {
    title?: string
    description?: string
    status_id?: string
    priority_id?: string
    due_at?: string | null
    starts_at?: string | null
    estimate_minutes?: number
    position?: number
  } = {}
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.status) payload.status_id = TASK_STATUS_IDS[patch.status]
  if (patch.priority) payload.priority_id = TASK_PRIORITY_IDS[patch.priority]
  if (patch.dueDate !== undefined) payload.due_at = patch.dueDate ? new Date(patch.dueDate).toISOString() : null
  if (patch.startsAt !== undefined) payload.starts_at = patch.startsAt ? new Date(patch.startsAt).toISOString() : null
  if (patch.estimate !== undefined) payload.estimate_minutes = Math.round(patch.estimate * 60)
  if (patch.position !== undefined) payload.position = patch.position
  const { error } = await supabase.from('tasks').update(payload).eq('id', id)
  if (!error) {
    const action = patch.status === 'done' ? 'completed' : 'updated'
    await logActivity(
      'task',
      action,
      {
        title: patch.title,
        status: patch.status,
        priority: patch.priority,
      },
      id,
    )
  }
  return !error
}

export async function moveTaskStatus(id: string, status: TaskStatus, position?: number): Promise<boolean> {
  return updateTask(id, { status, position: position ?? Date.now() })
}

export type TaskMutationResult = { ok: true } | { ok: false; error: string }

export async function deleteTask(id: string): Promise<TaskMutationResult> {
  if (!supabase) return { ok: false, error: 'La nube no está configurada' }
  const deletedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('tasks')
    .update({ deleted_at: deletedAt })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'No se pudo eliminar la tarea (permisos o tarea inexistente)' }
  await logActivity('task', 'deleted', { deleted_at: deletedAt }, id)
  return { ok: true }
}

export async function fetchSubtasks(taskId: string): Promise<SubtaskRecord[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('subtasks')
    .select('id,task_id,title,completed,position')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('position')
  return (data ?? []).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    completed: Boolean(row.completed),
    position: row.position ?? 0,
  }))
}

export async function addSubtask(taskId: string, title: string): Promise<SubtaskRecord | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('subtasks')
    .insert({ organization_id: DEFAULT_ORG_ID, task_id: taskId, title, position: Date.now() })
    .select('id,task_id,title,completed,position')
    .single()
  if (error || !data) return null
  return { id: data.id, taskId: data.task_id, title: data.title, completed: Boolean(data.completed), position: data.position ?? 0 }
}

export async function toggleSubtask(id: string, completed: boolean): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('subtasks').update({ completed }).eq('id', id)
  return !error
}

export async function fetchComments(taskId: string): Promise<CommentRecord[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('comments')
    .select('id,task_id,body,created_at,author_id')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at')
  return (data ?? []).map((row) => ({
    id: row.id,
    taskId: row.task_id ?? taskId,
    body: row.body,
    authorLabel: row.author_id ? 'Miembro' : 'Anónimo',
    createdAt: row.created_at ?? new Date().toISOString(),
  }))
}

export async function addComment(taskId: string, body: string): Promise<CommentRecord | null> {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('comments')
    .insert({
      organization_id: DEFAULT_ORG_ID,
      task_id: taskId,
      body,
      author_id: user?.id ?? null,
    })
    .select('id,task_id,body,created_at')
    .single()
  if (error || !data) return null
  await logActivity('task', 'commented', { preview: body.slice(0, 80) }, taskId)
  return {
    id: data.id,
    taskId: data.task_id ?? taskId,
    body: data.body,
    authorLabel: user?.email?.split('@')[0] ?? 'Tú',
    createdAt: data.created_at ?? new Date().toISOString(),
  }
}

export async function fetchAttachments(taskId: string): Promise<AttachmentRecord[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('attachments')
    .select('id,task_id,file_name,mime_type,size_bytes,storage_path')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at')
  const rows = data ?? []
  return Promise.all(rows.map(async (row) => {
    const signed = await supabase!.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(row.storage_path, 3600)
    return {
      id: row.id,
      taskId: row.task_id ?? taskId,
      fileName: row.file_name,
      mimeType: row.mime_type ?? undefined,
      sizeBytes: row.size_bytes ?? undefined,
      storagePath: row.storage_path,
      url: signed.data?.signedUrl,
    }
  }))
}

export async function uploadAttachment(taskId: string, file: File): Promise<AttachmentRecord | null> {
  if (!supabase) return null
  const path = `${DEFAULT_ORG_ID}/${taskId}/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { upsert: false })
  if (uploadError) return null
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('attachments')
    .insert({
      organization_id: DEFAULT_ORG_ID,
      task_id: taskId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      created_by: user?.id ?? null,
    })
    .select('id,task_id,file_name,mime_type,size_bytes,storage_path')
    .single()
  if (error || !data) return null
  const signed = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(path, 3600)
  return {
    id: data.id,
    taskId: data.task_id ?? taskId,
    fileName: data.file_name,
    mimeType: data.mime_type ?? undefined,
    sizeBytes: data.size_bytes ?? undefined,
    storagePath: data.storage_path,
    url: signed.data?.signedUrl,
  }
}

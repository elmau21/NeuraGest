export type Talent = {
  id: string
  login: string
  displayName: string
  avatar: string
  banner?: string
  description: string
  isLive: boolean
  viewers: number
  followers: number
  category: string
  title: string
  createdAt: string
  streamId?: string
  startedAt?: string
}

export type TaskStatus = 'backlog' | 'progress' | 'review' | 'done'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export type WorkTask = {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  assignee: string
  dueDate?: string
  tags: string[]
  estimate: number
}

export type CalendarItem = {
  id: string
  title: string
  type: 'stream' | 'meeting' | 'delivery' | 'campaign' | 'tournament'
  date: string
  time: string
}

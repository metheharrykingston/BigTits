import { apiFetch, readApiJson } from './api'

export type SessionKind = 'website' | 'agent' | 'mixed' | 'empty'
export type SessionStatus = 'idle' | 'working' | 'ready' | 'published' | 'error'
export type ActivityStatus = 'running' | 'done' | 'error' | 'info'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  at: string
}

export interface SessionActivity {
  id: string
  stage: string
  label: string
  detail?: string
  status: ActivityStatus
  at: string
}

export interface SessionSummary {
  session_id: string
  title: string
  kind: SessionKind
  status: SessionStatus
  message_count: number
  activity_count: number
  preview?: string
  module_slug?: string
  template_slug?: string
  project_path?: string
  created_at: string
  updated_at: string
}

export interface SessionSnapshot extends SessionSummary {
  messages: ChatMessage[]
  activities: SessionActivity[]
  restore?: Record<string, unknown> | null
}

function newLocalSessionId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  try {
    const res = await apiFetch('/api/sessions')
    if (res.status === 404) return []
    const data = await readApiJson<{ sessions?: SessionSummary[] }>(res)
    return Array.isArray(data.sessions) ? data.sessions : []
  } catch {
    return []
  }
}

export async function createSession(): Promise<string> {
  try {
    const res = await apiFetch('/api/sessions', { method: 'POST' })
    if (res.ok) {
      const data = await readApiJson<{ session_id?: string }>(res)
      if (data.session_id) return data.session_id
    }
  } catch {
    // API may be an older deploy without /api/sessions — first /api/create will ensureSession
  }
  return newLocalSessionId()
}

export async function fetchSession(sessionId: string): Promise<SessionSnapshot | null> {
  try {
    const res = await apiFetch(`/api/sessions/${sessionId}`)
    if (res.status === 404) return null
    const data = await readApiJson<{ session?: SessionSnapshot }>(res)
    return data.session ?? null
  } catch {
    return null
  }
}

export async function renameSession(sessionId: string, title: string): Promise<void> {
  await apiFetch(`/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function kindLabel(kind: SessionKind): string {
  if (kind === 'website') return 'Website'
  if (kind === 'agent') return 'Meta'
  if (kind === 'mixed') return 'Mixed'
  return 'Chat'
}
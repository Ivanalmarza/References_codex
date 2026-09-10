import { getApi } from './api'

export interface ActiveSession {
  sessionId?: string
  status?: string
  projectPath?: string
  progress?: number
  completed?: boolean
  success?: boolean
  updatedAt?: string
  [key: string]: unknown
}

/** Recoverable/active session for the current user (from _active-sessions). */
export async function getActiveSession(): Promise<ActiveSession | null> {
  const { data } = await getApi().get<ActiveSession | null>('/api/sessions/active')
  return data && typeof data === 'object' && (data.sessionId || data.status) ? data : null
}

import { getApi } from './api'
import { asArray } from './types'

export interface LogEntry {
  ts?: string
  level?: string
  phase?: string
  message: string
  [key: string]: unknown
}

export async function getLogs(sessionId?: string): Promise<LogEntry[]> {
  const { data } = await getApi().get('/api/logs', { params: sessionId ? { sessionId } : {} })
  return asArray<LogEntry>(data, 'logs', 'entries', 'items')
}

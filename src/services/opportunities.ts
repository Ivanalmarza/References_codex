import { getApi } from './api'
import { asArray } from './types'

export interface OpportunityDoc {
  id: string
  name: string
  size?: number
  modified?: string
  webUrl?: string
  [key: string]: unknown
}

export interface CheckResult {
  ok: boolean
  rows?: Array<Record<string, unknown>>
  summary?: Record<string, unknown>
  [key: string]: unknown
}

export async function listDocs(params?: Record<string, string>): Promise<OpportunityDoc[]> {
  const { data } = await getApi().get('/api/opportunities/docs', { params })
  return asArray<OpportunityDoc>(data, 'files', 'docs', 'items')
}

export async function uploadDocs(form: FormData): Promise<{ ok: boolean; [k: string]: unknown }> {
  const { data } = await getApi().post('/api/opportunities/docs', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function checkDocs(params?: Record<string, string>): Promise<CheckResult> {
  const { data } = await getApi().get('/api/opportunities/check', { params })
  return data ?? { ok: false }
}

export async function deleteDoc(id: string): Promise<{ ok: boolean; [k: string]: unknown }> {
  const { data } = await getApi().delete(`/api/opportunities/docs/${encodeURIComponent(id)}`)
  return data
}

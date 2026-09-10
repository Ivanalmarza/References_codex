import { getApi } from './api'
import { asArray } from './types'

export interface SpFolder {
  id?: string
  name: string
  [key: string]: unknown
}

export interface SpFile {
  id?: string
  name: string
  size?: number
  modified?: string
  webUrl?: string
  [key: string]: unknown
}

export async function getAreas(): Promise<SpFolder[]> {
  const { data } = await getApi().get('/api/admin/areas')
  return asArray<SpFolder>(data, 'folders', 'items', 'areas')
}

export async function getProjects(area: string): Promise<SpFolder[]> {
  const { data } = await getApi().get('/api/admin/projects', { params: { area } })
  return asArray<SpFolder>(data, 'folders', 'items', 'projects')
}

export async function getFiles(area: string, project: string): Promise<SpFile[]> {
  const { data } = await getApi().get('/api/admin/files', { params: { area, project } })
  return asArray<SpFile>(data, 'files', 'items')
}

export async function uploadFile(form: FormData): Promise<{ ok: boolean; [k: string]: unknown }> {
  const { data } = await getApi().post('/api/admin/files', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

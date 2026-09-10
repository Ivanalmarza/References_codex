import { getApi } from './api'
import { asArray, type Option } from './types'

export interface OktaUser {
  id: string
  login?: string
  firstName?: string
  lastName?: string
  email?: string
  status?: string
  roles?: string[]
  [key: string]: unknown
}

export async function searchUsers(q?: string): Promise<OktaUser[]> {
  const { data } = await getApi().get('/api/admin/users', { params: q ? { q } : {} })
  return asArray<OktaUser>(data, 'users', 'items')
}

export async function getUser(id: string): Promise<OktaUser> {
  const { data } = await getApi().get<OktaUser>(`/api/admin/users/${encodeURIComponent(id)}`)
  return data
}

export async function createUser(payload: Partial<OktaUser>): Promise<OktaUser> {
  const { data } = await getApi().post<OktaUser>('/api/admin/users', payload)
  return data
}

export async function updateUser(id: string, payload: Partial<OktaUser>): Promise<OktaUser> {
  const { data } = await getApi().put<OktaUser>(`/api/admin/users/${encodeURIComponent(id)}`, payload)
  return data
}

export async function deleteUser(id: string): Promise<{ ok: boolean; [k: string]: unknown }> {
  const { data } = await getApi().delete(`/api/admin/users/${encodeURIComponent(id)}`)
  return data
}

/** Roles available in the app (from the security context deptAppNode.roles). */
export async function getRoles(): Promise<Option[]> {
  const { data } = await getApi().get('/api/admin/roles')
  return asArray<Option>(data, 'roles', 'items')
}

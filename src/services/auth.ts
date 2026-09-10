import { getApi } from './api'

/**
 * Shape returned by the axet SPA node at `/_auth/user`.
 * Kept permissive because the exact payload depends on the auth provider (Okta),
 * but the common identity fields are typed for convenience.
 */
export interface CurrentUser {
  login?: string
  name?: string
  email?: string
  preferred_username?: string
  sub?: string
  roles?: string[]
  [key: string]: unknown
}

/** Endpoint exposed by the axet SPA node that returns the authenticated user. */
export const CURRENT_USER_ENDPOINT = '/_auth/user'

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await getApi().get<CurrentUser>(CURRENT_USER_ENDPOINT)
  return data
}

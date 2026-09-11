import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getBootstrap, getCurrentUser } from '../services/referenceApi'
import { getProblemMessage } from '../services/api'
import type { AppUser, BootstrapResponse, SessionSummary } from '../types/api'

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
}

export const useAppStore = defineStore('app', () => {
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const bootstrap = ref<BootstrapResponse | null>(null)
  const user = ref<AppUser | null>(null)

  const activeSession = computed<SessionSummary | null>(() => bootstrap.value?.active || null)
  const options = computed(() => bootstrap.value?.options || null)

  async function initialize(force = false): Promise<void> {
    if (initialized.value && !force) return
    loading.value = true
    error.value = null

    try {
      const data = await getBootstrap()
      if (!data || data.ok !== true || !data.options) throw new Error('BOOTSTRAP_INVALID_RESPONSE')
      bootstrap.value = data

      if (data.user?.login) {
        const login = data.user.login
        const displayName = data.user.displayName || login
        const email = data.user.email || (login.includes('@') ? login : '')
        user.value = {
          login,
          displayName,
          email,
          initials: initials(displayName || login),
          axetUserId: data.user.axetUserId,
          roles: data.user.roles || [],
        }
      } else {
        // Secondary platform fallback only. The FLOWS bootstrap is authoritative.
        try { user.value = await getCurrentUser() } catch { user.value = null }
      }
    } catch (reason) {
      error.value = getProblemMessage(reason, 'No se ha podido cargar la aplicación.')
      user.value = null
    }

    initialized.value = true
    loading.value = false
  }

  async function refreshBootstrap(): Promise<void> {
    bootstrap.value = await getBootstrap()
  }

  function setActiveSession(session: SessionSummary | null): void {
    if (bootstrap.value) bootstrap.value.active = session
  }

  return {
    initialized,
    loading,
    error,
    bootstrap,
    user,
    activeSession,
    options,
    initialize,
    refreshBootstrap,
    setActiveSession,
  }
})

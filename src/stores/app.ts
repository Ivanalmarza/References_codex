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

    const [bootstrapResult, userResult] = await Promise.allSettled([
      getBootstrap(),
      getCurrentUser(),
    ])

    if (bootstrapResult.status === 'fulfilled') {
      bootstrap.value = bootstrapResult.value
    }

    if (userResult.status === 'fulfilled') {
      user.value = userResult.value
    } else if (bootstrap.value?.user) {
      const login = bootstrap.value.user.login
      const displayName = bootstrap.value.user.displayName || login
      const email = bootstrap.value.user.email || (login.includes('@') ? login : '')
      user.value = {
        login,
        displayName,
        email,
        initials: initials(displayName || login),
        axetUserId: bootstrap.value.user.axetUserId,
        roles: bootstrap.value.user.roles,
      }
    }

    if (bootstrapResult.status === 'rejected') {
      error.value = getProblemMessage(bootstrapResult.reason, 'No se ha podido cargar la aplicación.')
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

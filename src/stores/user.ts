import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchCurrentUser, type CurrentUser } from '../services/auth'

export const useUserStore = defineStore('user', () => {
  const user = ref<CurrentUser | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value !== null)
  const displayName = computed(
    () => user.value?.name || user.value?.preferred_username || user.value?.login || user.value?.email || '',
  )

  async function loadUser(): Promise<CurrentUser | null> {
    loading.value = true
    error.value = null
    try {
      user.value = await fetchCurrentUser()
      return user.value
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to load current user'
      user.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  return { user, loading, error, isAuthenticated, displayName, loadUser }
})

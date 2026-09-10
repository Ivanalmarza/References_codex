import { onBeforeUnmount, ref } from 'vue'
import { getExecutionStatus } from '../services/referenceApi'
import { getProblemMessage } from '../services/api'
import type { ExecutionStatusResponse } from '../types/api'

export function useExecutionPolling(sessionId: string, intervalMs = 2500) {
  const data = ref<ExecutionStatusResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let timer: number | null = null
  let disposed = false

  async function refresh(): Promise<ExecutionStatusResponse | null> {
    if (loading.value || disposed) return data.value
    loading.value = true
    try {
      data.value = await getExecutionStatus(sessionId)
      error.value = null
      return data.value
    } catch (reason) {
      error.value = getProblemMessage(reason, 'No se ha podido consultar la ejecución.')
      return null
    } finally {
      loading.value = false
    }
  }

  function schedule(): void {
    if (disposed || timer !== null) return
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, intervalMs)
  }

  async function start(): Promise<void> {
    await refresh()
    schedule()
  }

  function stop(): void {
    disposed = true
    if (timer !== null) window.clearInterval(timer)
    timer = null
  }

  onBeforeUnmount(stop)

  return { data, loading, error, refresh, start, stop }
}

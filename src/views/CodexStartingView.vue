<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSessionState } from '../services/executions'

const route = useRoute()
const router = useRouter()
const sessionId = computed(() => String(route.query.sessionId || ''))
let timer: number | undefined

onMounted(() => {
  if (!sessionId.value) {
    router.replace({ name: 'start' })
    return
  }
  // Confirmamos que la sesión existe y saltamos al progreso.
  void getSessionState(sessionId.value).catch(() => undefined)
  timer = window.setTimeout(() => {
    router.replace({ name: 'progress', params: { sessionId: sessionId.value } })
  }, 1200)
})

onBeforeUnmount(() => {
  if (timer) window.clearTimeout(timer)
})
</script>

<template>
  <div class="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
    <span
      class="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500 dark:border-slate-700 dark:border-t-cyan-400"
    ></span>
    <div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">Iniciando Codex…</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Preparando el workspace y arrancando la ejecución.
      </p>
    </div>
  </div>
</template>

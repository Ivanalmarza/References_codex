<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import {
  getSessionState,
  progressEventsUrl,
  stopExecution,
  type SessionState,
} from '../services/executions'
import { notify } from '../services/notyf'

const route = useRoute()
const router = useRouter()
const sessionId = computed(() => String(route.params.sessionId || route.query.sessionId || ''))

const state = ref<SessionState>({})
const stopping = ref(false)
let timer: number | undefined
let es: EventSource | undefined

const progress = computed(() => Math.max(0, Math.min(100, Math.round(Number(state.value.runtime?.progress ?? 0)))))
const status = computed(() => state.value.runtime?.status || 'En curso…')
const tasks = computed(() => state.value.tasks || {})

const PHASE_LABELS: Record<string, string> = {
  docs: 'Documentación',
  config: 'Configuración',
  execute: 'Ejecución',
  changes: 'Cambios',
  report: 'Informe',
}
const phases = computed(() => {
  const ps = state.value.progressView?.phaseStatus || {}
  return Object.keys(PHASE_LABELS).map((key) => ({ key, label: PHASE_LABELS[key], status: String(ps[key] || 'pending') }))
})

const isCompleted = computed(
  () => Boolean(state.value.runtime?.completed || state.value.resultReady || state.value.readyToRedirect),
)
const isErrored = computed(
  () => Boolean(state.value.runtime?.error) || state.value.runtime?.status === 'Error',
)

function phaseClasses(s: string): string {
  if (s === 'done') return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30'
  if (s === 'error') return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
  if (s === 'pending') return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
  return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
}

function apply(next: SessionState) {
  if (!next || typeof next !== 'object') return
  state.value = next
  if (isErrored.value) {
    router.replace({ name: 'stopped', query: { sessionId: sessionId.value, reason: String(state.value.runtime?.error || '') } })
  } else if (isCompleted.value) {
    router.replace({ name: 'result', params: { sessionId: sessionId.value } })
  }
}

async function poll() {
  if (!sessionId.value) return
  try {
    apply(await getSessionState(sessionId.value))
  } catch {
    /* silencioso: reintenta en el siguiente tick */
  }
}

function startSse() {
  if (!sessionId.value || typeof EventSource === 'undefined') return
  try {
    es = new EventSource(progressEventsUrl(sessionId.value), { withCredentials: true })
    es.onmessage = (event) => {
      try {
        apply(JSON.parse(event.data))
      } catch {
        /* ignore malformed frame */
      }
    }
    es.onerror = () => {
      es?.close()
      es = undefined
    }
  } catch {
    es = undefined
  }
}

async function onStop() {
  if (!sessionId.value) return
  stopping.value = true
  try {
    await stopExecution(sessionId.value)
    notify.success('Ejecución detenida')
    router.replace({ name: 'stopped', query: { sessionId: sessionId.value } })
  } catch {
    notify.error('No se pudo detener la ejecución')
  } finally {
    stopping.value = false
  }
}

onMounted(() => {
  if (!sessionId.value) {
    router.replace({ name: 'entry' })
    return
  }
  void poll()
  startSse()
  timer = window.setInterval(poll, 2500)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
  es?.close()
})
</script>

<template>
  <div>
    <PageHeader eyebrow="Ejecución" title="Progreso de la ejecución">
      <template #actions>
        <button
          type="button"
          :disabled="stopping"
          class="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
          @click="onStop"
        >
          {{ stopping ? 'Deteniendo…' : 'Detener' }}
        </button>
      </template>
    </PageHeader>

    <p class="-mt-4 mb-6 font-mono text-xs text-slate-500 dark:text-slate-400">{{ sessionId }}</p>

    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-end justify-between">
        <div class="text-4xl font-extrabold text-slate-900 dark:text-white">{{ progress }}<span class="text-xl text-slate-400">%</span></div>
        <div class="text-right text-sm text-slate-500 dark:text-slate-400">{{ status }}</div>
      </div>
      <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div class="h-full rounded-full bg-gradient-to-r from-[#0b2f55] to-[#1e6fd1] transition-all" :style="{ width: `${progress}%` }"></div>
      </div>
      <p v-if="tasks.total" class="mt-3 text-sm text-slate-500 dark:text-slate-400">
        Tareas: {{ tasks.completed ?? 0 }}/{{ tasks.total }}
      </p>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div
        v-for="phase in phases"
        :key="phase.key"
        class="rounded-xl border p-4 text-center"
        :class="phaseClasses(phase.status)"
      >
        <div class="text-sm font-semibold">{{ phase.label }}</div>
        <div class="mt-1 text-xs capitalize">{{ phase.status }}</div>
      </div>
    </div>

    <div class="mt-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <span class="h-2 w-2 animate-pulse rounded-full bg-cyan-500"></span>
      Actualizando en vivo…
    </div>
  </div>
</template>

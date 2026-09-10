<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { getActiveSession, type ActiveSession } from '../services/sessions'

const router = useRouter()
const loading = ref(true)
const session = ref<ActiveSession | null>(null)

const isCompleted = computed(() => Boolean(session.value?.completed || session.value?.success))
const progress = computed(() => Math.round(Number(session.value?.progress ?? 0)))

onMounted(async () => {
  try {
    session.value = await getActiveSession()
  } finally {
    loading.value = false
  }
})

function resume() {
  const id = session.value?.sessionId
  if (!id) return
  router.push(isCompleted.value ? { name: 'result', params: { sessionId: id } } : { name: 'progress', params: { sessionId: id } })
}

function newExecution() {
  router.push({ name: 'start' })
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Sesión"
      title="Recuperar sesión"
      description="Tienes una ejecución previa. Puedes continuar donde lo dejaste o empezar una nueva."
    />

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">Cargando sesión…</div>

    <template v-else>
      <div
        v-if="session"
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-slate-900 dark:text-white">Última ejecución</p>
            <p class="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              {{ session.sessionId }}
            </p>
          </div>
          <span
            class="rounded-full px-3 py-1 text-xs font-bold"
            :class="isCompleted
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'"
          >
            {{ session.status || (isCompleted ? 'Completada' : 'En curso') }}
          </span>
        </div>

        <div class="mt-4">
          <div class="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Progreso</span>
            <span>{{ progress }}%</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div class="h-full rounded-full bg-cyan-500 transition-all" :style="{ width: `${progress}%` }"></div>
          </div>
        </div>

        <div class="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            class="rounded-xl bg-gradient-to-br from-[#0b2f55] to-[#1e6fd1] px-5 py-2.5 font-bold text-white transition hover:opacity-95"
            @click="resume"
          >
            ▶ Continuar sesión anterior
          </button>
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            @click="newExecution"
          >
            🆕 Nueva ejecución
          </button>
        </div>
      </div>

      <div
        v-else
        class="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <p class="text-slate-600 dark:text-slate-300">No hay ninguna sesión activa que recuperar.</p>
        <button
          type="button"
          class="mt-4 rounded-xl bg-cyan-500 px-5 py-2.5 font-semibold text-white transition hover:bg-cyan-400"
          @click="newExecution"
        >
          Iniciar nueva ejecución
        </button>
      </div>
    </template>
  </div>
</template>

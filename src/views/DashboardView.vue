<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'
import { useAppStore } from '../stores/app'
import { getProblemMessage } from '../services/api'
import { notify } from '../services/notyf'

const store = useAppStore()
const router = useRouter()
const active = computed(() => store.activeSession)

const greeting = computed(() => {
  const hour = new Date().getHours()
  return hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
})

async function refresh(): Promise<void> {
  try {
    await store.refreshBootstrap()
  } catch (error) {
    notify.error(getProblemMessage(error, 'No se ha podido actualizar la sesión activa.'))
  }
}

onMounted(() => void refresh())
</script>

<template>
  <div class="page-shell space-y-6">
    <section class="relative overflow-hidden rounded-3xl bg-[#0b2f55] px-6 py-8 text-white shadow-2xl shadow-blue-950/15 sm:px-8 sm:py-10">
      <div class="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[44px] border-cyan-300/10"></div>
      <div class="absolute bottom-0 right-20 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl"></div>
      <div class="relative max-w-3xl">
        <p class="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Reference Generator</p>
        <h1 class="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{{ greeting }}, {{ store.user?.displayName?.split(' ')[0] || 'usuario' }}</h1>
        <p class="mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">Genera referencias trazables combinando proyectos procesados, oportunidades MANA y archivos propios. El procesamiento sigue ejecutándose en FLOWS; Vue gestiona la experiencia de usuario y el seguimiento.</p>
        <div class="mt-6 flex flex-wrap gap-3">
          <RouterLink to="/new" class="btn bg-white text-[#0b2f55] no-underline hover:bg-blue-50">Crear nueva referencia</RouterLink>
          <RouterLink to="/logs" class="btn border border-white/25 bg-white/10 text-white no-underline hover:bg-white/15">Ver ejecuciones</RouterLink>
        </div>
      </div>
    </section>

    <section class="surface-card">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="eyebrow">Sesión actual</p>
          <h2 class="section-title mt-1">Continuidad de la ejecución</h2>
        </div>
        <button class="btn-secondary" @click="refresh">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6v5h-5M4 18v-5h5" /><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5l2-2.5" /></svg>
          Actualizar
        </button>
      </div>

      <div v-if="active" class="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <StatusBadge :status="active.status" :ready="active.ready" :failed="active.failed" :stopped="active.stopped" />
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">{{ active.sessionId }}</span>
          </div>
          <h3 class="mt-3 text-xl font-black text-slate-900 dark:text-white">{{ active.opportunityTitle || active.project || 'Ejecución de referencias' }}</h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ active.selectedSources.join(' + ') || active.sourceType }} · {{ active.template || 'Plantilla pendiente' }}</p>
          <div class="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div class="h-full rounded-full bg-gradient-to-r from-[#0b2f55] to-blue-500 transition-all" :style="{ width: `${active.progress}%` }"></div>
          </div>
          <div class="mt-2 flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400"><span>{{ active.tasks.completed }}/{{ active.tasks.total || '—' }} tareas</span><span>{{ active.progress }}%</span></div>
        </div>
        <button class="btn-primary min-w-40" @click="router.push(active.ready || active.terminal ? `/results/${active.sessionId}` : `/execution/${active.sessionId}`)">{{ active.ready ? 'Abrir resultados' : active.terminal ? 'Abrir detalle final' : 'Continuar seguimiento' }}</button>
      </div>

      <EmptyState v-else class="mt-5" title="No hay una ejecución activa" description="Inicia una nueva generación y podrás abandonarla y recuperarla desde esta pantalla.">
        <RouterLink to="/new" class="btn-primary no-underline">Nueva referencia</RouterLink>
      </EmptyState>
    </section>

    <section class="grid gap-4 md:grid-cols-3">
      <article class="surface-card-flat p-5">
        <span class="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v14H4zM8 9h8M8 13h5" /></svg></span>
        <h2 class="mt-4 font-extrabold text-slate-900 dark:text-white">Proyecto procesado</h2>
        <p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Reutiliza markdowns ya preparados por unidad y proyecto.</p>
      </article>
      <article class="surface-card-flat p-5">
        <span class="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6.5h7l2 2h9v10.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg></span>
        <h2 class="mt-4 font-extrabold text-slate-900 dark:text-white">Oportunidad MANA</h2>
        <p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Consulta oportunidades de forma filtrada sin cargar el índice completo en el navegador.</p>
      </article>
      <article class="surface-card-flat p-5">
        <span class="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4M7 9l5-5 5 5M5 14v5h14v-5" /></svg></span>
        <h2 class="mt-4 font-extrabold text-slate-900 dark:text-white">Archivos propios</h2>
        <p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Añade documentos específicos y aplica la prioridad uploads &gt; oportunidad &gt; procesado.</p>
      </article>
    </section>
  </div>
</template>

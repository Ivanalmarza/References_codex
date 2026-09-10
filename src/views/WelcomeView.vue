<script setup lang="ts">
import { RouterLink } from 'vue-router'

const phases = [
  {
    eyebrow: 'Fase 1',
    title: 'Planificación automática',
    text: 'El agente analiza la estructura del proyecto y genera un plan de tareas detallado adaptado al contexto del código.',
    items: [
      'Escaneo de la estructura de directorios',
      'Generación de índice de proyecto',
      'Plan de ejecución por tareas',
    ],
  },
  {
    eyebrow: 'Fase 2',
    title: 'Implementación por batches',
    text: 'Codex CLI ejecuta cada tarea de forma secuencial, con control de progreso en tiempo real y detección de errores.',
    chips: ['Codex CLI', 'Sandbox completo', 'Anti-bucle'],
  },
  {
    eyebrow: 'Resultado',
    title: 'Informe y descarga',
    text: 'Al finalizar, genera un informe estructurado con los cambios realizados y el análisis en formato Excel.',
    items: ['Registro de cambios por fichero', 'Exportación a respuestas.xlsx', 'Log completo de ejecución'],
  },
]
</script>

<template>
  <div>
    <section
      class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0b2f55] to-[#1e6fd1]"></div>
      <p class="text-xs font-extrabold uppercase tracking-[0.15em] text-cyan-600 dark:text-cyan-400">
        Bienvenido
      </p>
      <h1 class="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        Codex References Generator
      </h1>
      <p class="mx-auto mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
        Automatiza el análisis y la generación de referencias de proyectos existentes mediante IA.
        Define el proyecto, selecciona el modelo y deja que el agente planifique, implemente y
        documente los cambios de forma autónoma.
      </p>
      <div
        class="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-50 px-4 py-1.5 text-sm font-bold text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
        Listo para usar
      </div>
    </section>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="phase in phases"
        :key="phase.title"
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <p class="text-xs font-extrabold uppercase tracking-[0.1em] text-cyan-600 dark:text-cyan-400">
          {{ phase.eyebrow }}
        </p>
        <h3 class="mt-2 text-lg font-bold text-slate-900 dark:text-white">{{ phase.title }}</h3>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ phase.text }}</p>
        <ul
          v-if="phase.items"
          class="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-300"
        >
          <li v-for="item in phase.items" :key="item">{{ item }}</li>
        </ul>
        <div v-if="phase.chips" class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="chip in phase.chips"
            :key="chip"
            class="rounded-full border border-cyan-500/15 bg-cyan-50 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-cyan-500/10 dark:text-slate-200"
          >
            {{ chip }}
          </span>
        </div>
      </div>
    </div>

    <div
      class="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <h3 class="text-lg font-bold text-slate-900 dark:text-white">Iniciar una nueva ejecución</h3>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Selecciona la unidad, proyecto, modelo de IA y nivel de razonamiento para comenzar.
        </p>
      </div>
      <RouterLink
        to="/start"
        class="rounded-xl bg-gradient-to-br from-[#0b2f55] to-[#1e6fd1] px-6 py-3 font-extrabold text-white transition hover:opacity-95"
      >
        Comenzar
      </RouterLink>
    </div>
  </div>
</template>

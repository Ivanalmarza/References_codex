<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const sessionId = computed(() => String(route.query.sessionId || ''))
const reason = computed(() => String(route.query.reason || ''))
</script>

<template>
  <div class="flex min-h-[50vh] items-center justify-center">
    <div class="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-2xl text-red-500">
        ⏹
      </div>
      <h1 class="mt-4 text-xl font-bold text-slate-900 dark:text-white">Ejecución detenida</h1>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {{ reason || 'La ejecución se ha detenido. Puedes iniciar una nueva o revisar el progreso.' }}
      </p>
      <div class="mt-6 flex flex-wrap justify-center gap-3">
        <button
          v-if="sessionId"
          type="button"
          class="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="router.push({ name: 'progress', params: { sessionId } })"
        >
          Ver progreso
        </button>
        <button
          type="button"
          class="rounded-xl bg-gradient-to-br from-[#0b2f55] to-[#1e6fd1] px-5 py-2.5 font-extrabold text-white transition hover:opacity-95"
          @click="router.push({ name: 'start' })"
        >
          Nueva ejecución
        </button>
      </div>
    </div>
  </div>
</template>

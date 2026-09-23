<script setup lang="ts">
import { ref } from 'vue'
import BrandMark from '../components/BrandMark.vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const selectedProjectId = ref(store.axetProjects[0]?.id || '')

async function continueWithProject(): Promise<void> {
  if (!selectedProjectId.value) return
  await store.selectProject(selectedProjectId.value)
}
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
    <div class="absolute inset-x-0 top-0 h-72 bg-[#0b2f55]"></div>
    <div class="absolute -right-28 top-10 h-80 w-80 rounded-full border-[54px] border-cyan-300/10"></div>
    <div class="absolute left-10 top-36 h-48 w-48 rounded-full bg-blue-400/10 blur-3xl"></div>

    <div class="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col">
      <div class="mb-8 flex items-center justify-between rounded-2xl bg-white/95 px-5 py-4 shadow-xl shadow-blue-950/10 backdrop-blur dark:bg-slate-900/95">
        <BrandMark />
        <div class="hidden text-right sm:block">
          <p class="text-xs font-extrabold text-slate-900 dark:text-white">{{ store.user?.displayName || 'Usuario' }}</p>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">{{ store.user?.email || store.user?.login || '' }}</p>
        </div>
      </div>

      <main class="my-auto rounded-3xl bg-white p-6 shadow-2xl shadow-blue-950/15 dark:bg-slate-900 sm:p-8">
        <div class="mx-auto max-w-xl text-center">
          <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[#0b2f55] dark:bg-blue-950/50 dark:text-blue-200">
            <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M3 6.5h7l2 2h9v10.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            </svg>
          </span>
          <p class="eyebrow mt-5">Acceso a References Codex</p>
          <h1 class="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">Selecciona un proyecto</h1>
          <p class="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            El proyecto elegido quedará asociado a tu sesión de aXet antes de cargar la aplicación.
          </p>
        </div>

        <div class="mx-auto mt-7 max-w-xl space-y-3">
          <label
            v-for="project in store.axetProjects"
            :key="project.id"
            class="flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition"
            :class="selectedProjectId === project.id
              ? 'border-blue-500 bg-blue-50/80 shadow-sm dark:border-blue-400 dark:bg-blue-950/30'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800'"
          >
            <input v-model="selectedProjectId" type="radio" name="axet-project" :value="project.id" class="h-4 w-4 accent-blue-700" />
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#0b2f55] shadow-sm dark:bg-slate-800 dark:text-blue-200">
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6.5h7l2 2h9v10.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-extrabold text-slate-900 dark:text-white">{{ project.displayName }}</span>
              <span class="mt-0.5 block truncate text-xs text-slate-400">{{ project.id }}</span>
            </span>
            <svg v-if="selectedProjectId === project.id" viewBox="0 0 24 24" class="h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 4 4L19 6" /></svg>
          </label>
        </div>

        <div v-if="store.projectError" class="error-banner mx-auto mt-5 max-w-xl">{{ store.projectError }}</div>

        <div class="mx-auto mt-6 max-w-xl">
          <button class="btn-primary w-full justify-center" :disabled="!selectedProjectId || store.selectingProject" @click="continueWithProject">
            <svg v-if="store.selectingProject" viewBox="0 0 24 24" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.56" /></svg>
            {{ store.selectingProject ? 'Seleccionando proyecto...' : 'Continuar' }}
          </button>
        </div>
      </main>

      <p class="mt-6 text-center text-xs text-blue-100/80">NTT DATA · References Codex</p>
    </div>
  </div>
</template>

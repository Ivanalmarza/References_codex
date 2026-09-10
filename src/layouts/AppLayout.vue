<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from '../components/AppSidebar.vue'
import { useUserStore } from '../stores/user'
import { useThemeStore } from '../stores/theme'

const route = useRoute()
const userStore = useUserStore()
const themeStore = useThemeStore()

const title = computed(() => String(route.meta.title || 'Codex References Generator'))

onMounted(() => {
  if (!userStore.user && !userStore.loading) void userStore.loadUser()
})
</script>

<template>
  <div class="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <AppSidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex items-center gap-4 border-b border-slate-200 bg-white/90 px-6 py-3.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90"
      >
        <h2 class="truncate text-base font-semibold text-slate-900 dark:text-white">{{ title }}</h2>
        <div class="ml-auto flex items-center gap-3">
          <span class="text-sm text-slate-500 dark:text-slate-400">
            {{ userStore.displayName || (userStore.loading ? 'Cargando…' : 'Sin sesión') }}
          </span>
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            :aria-label="themeStore.isDark ? 'Modo claro' : 'Modo oscuro'"
            @click="themeStore.toggleMode"
          >
            {{ themeStore.isDark ? '☀' : '🌙' }}
          </button>
        </div>
      </header>
      <main class="min-w-0 flex-1 overflow-y-auto">
        <div class="mx-auto max-w-6xl px-6 py-8">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import BrandMark from './BrandMark.vue'

import { useAppStore } from '../stores/app'
import { useThemeStore } from '../stores/theme'

const appStore = useAppStore()
const themeStore = useThemeStore()
const route = useRoute()
const mobileOpen = ref(false)

const items = computed(() => [
  { name: 'dashboard', label: 'Inicio', path: '/', icon: 'home' },
  { name: 'new-execution', label: 'Nueva referencia', path: '/new', icon: 'plus' },
  { name: 'logs', label: 'Ejecuciones y logs', path: '/logs', icon: 'logs' },
  { name: 'mana', label: 'Oportunidades MANA', path: '/mana', icon: 'folder' },
  { name: 'admin', label: 'Administración', path: '/admin', icon: 'admin' },
])

const active = computed(() => appStore.activeSession)
const user = computed(() => appStore.user)

function isCurrent(item: { name: string }): boolean {
  if (item.name === 'new-execution' && route.name === 'execution') return true
  if (item.name === 'dashboard' && route.name === 'results') return true
  return route.name === item.name
}
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/88 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/88">
      <div class="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <button class="btn-ghost !h-10 !w-10 !p-0 lg:hidden" aria-label="Abrir menú" @click="mobileOpen = !mobileOpen">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <RouterLink to="/" class="no-underline"><BrandMark /></RouterLink>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <RouterLink
            v-if="active"
            :to="active.ready ? `/results/${active.sessionId}` : `/execution/${active.sessionId}`"
            class="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs no-underline dark:border-slate-700 dark:bg-slate-900 sm:flex"
          >
            <span class="h-2 w-2 rounded-full bg-emerald-500" :class="{ 'animate-pulse': !active.terminal }"></span>
            <span class="font-bold text-slate-600 dark:text-slate-300">Activa</span>
          </RouterLink>

          <button class="btn-ghost !h-10 !w-10 !p-0" :aria-label="themeStore.isDark ? 'Activar modo claro' : 'Activar modo oscuro'" @click="themeStore.toggleMode">
            <svg v-if="themeStore.isDark" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
            </svg>
            <svg v-else viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z" />
            </svg>
          </button>

          <div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            <span class="grid h-8 w-8 place-items-center rounded-lg bg-[#0b2f55] text-xs font-black text-white">{{ user?.initials || 'U' }}</span>
            <div class="hidden min-w-0 sm:block">
              <p class="max-w-48 truncate text-xs font-extrabold text-slate-900 dark:text-white">{{ user?.displayName || 'Usuario' }}</p>
              <p class="max-w-48 truncate text-[11px] text-slate-500 dark:text-slate-400">{{ user?.email || user?.login || '' }}</p>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div class="mx-auto flex max-w-[1600px]">
      <aside
        class="fixed inset-y-16 left-0 z-30 w-72 -translate-x-full border-r border-slate-200 bg-white p-4 transition-transform dark:border-slate-800 dark:bg-slate-950 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-64 lg:translate-x-0"
        :class="{ '!translate-x-0': mobileOpen }"
      >
        <nav class="space-y-1" aria-label="Navegación principal">
          <RouterLink
            v-for="item in items"
            :key="item.name"
            :to="item.path"
            class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold no-underline transition"
            :class="isCurrent(item)
              ? 'bg-blue-50 text-[#0b2f55] dark:bg-blue-950/40 dark:text-blue-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'"
            @click="mobileOpen = false"
          >
            <span class="grid h-8 w-8 place-items-center rounded-lg" :class="isCurrent(item) ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300' : 'bg-slate-100 text-slate-500 group-hover:bg-white dark:bg-slate-900 dark:text-slate-400'">
              <svg v-if="item.icon === 'home'" viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="1.9"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>
              <svg v-else-if="item.icon === 'plus'" viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 5v14M5 12h14" /></svg>
              <svg v-else-if="item.icon === 'logs'" viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 5h16M4 12h16M4 19h10" /></svg>
              <svg v-else-if="item.icon === 'folder'" viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 6.5h7l2 2h9v10.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>
              <svg v-else viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7Z" /><path d="M9 12l2 2 4-4" /></svg>
            </span>
            {{ item.label }}
          </RouterLink>
        </nav>
      </aside>

      <button v-if="mobileOpen" class="fixed inset-0 top-16 z-20 bg-slate-950/30 lg:hidden" aria-label="Cerrar menú" @click="mobileOpen = false"></button>

      <main class="min-w-0 flex-1">
        <slot />
      </main>
    </div>
  </div>
</template>

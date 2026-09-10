<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { MENU, isGroup } from '../config/menu'

const route = useRoute()

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

const linkBase =
  'block rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/70'
const linkActive =
  'bg-cyan-50 font-semibold text-cyan-700 hover:bg-cyan-50 dark:bg-cyan-500/10 dark:text-cyan-300'
const linkIdle = 'text-slate-700 dark:text-slate-300'
</script>

<template>
  <aside
    class="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
  >
    <RouterLink to="/" class="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
      <div class="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-[#0b2f55] to-[#1e6fd1]"></div>
      <div class="min-w-0">
        <div class="truncate text-sm font-extrabold tracking-wide text-slate-900 dark:text-white">
          NTT DATA
        </div>
        <div class="truncate text-xs text-slate-500 dark:text-slate-400">
          Codex References Generator
        </div>
      </div>
    </RouterLink>

    <nav class="flex-1 space-y-1 overflow-y-auto p-3 text-sm">
      <template v-for="entry in MENU" :key="entry.label">
        <RouterLink
          v-if="!isGroup(entry)"
          :to="entry.to"
          :class="[linkBase, isActive(entry.to) ? linkActive : linkIdle]"
        >
          {{ entry.label }}
        </RouterLink>
        <div v-else class="pt-4">
          <div class="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {{ entry.label }}
          </div>
          <RouterLink
            v-for="child in entry.children"
            :key="child.to"
            :to="child.to"
            :class="[linkBase, isActive(child.to) ? linkActive : linkIdle]"
          >
            {{ child.label }}
          </RouterLink>
        </div>
      </template>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from './components/AppShell.vue'
import LoadingPanel from './components/LoadingPanel.vue'
import { useAppStore } from './stores/app'

const appStore = useAppStore()

onMounted(() => {
  void appStore.initialize()
})
</script>

<template>
  <AppShell>
    <LoadingPanel v-if="!appStore.initialized || appStore.loading" message="Preparando References Codex..." />
    <div v-else-if="appStore.error" class="page-shell">
      <div class="surface-card max-w-2xl">
        <p class="eyebrow">Error de inicialización</p>
        <h1 class="page-title mt-2">No se ha podido cargar la aplicación</h1>
        <p class="error-banner mt-5">{{ appStore.error }}</p>
        <button class="btn-primary mt-5" @click="appStore.initialize(true)">Reintentar</button>
      </div>
    </div>
    <RouterView v-else />
  </AppShell>
</template>

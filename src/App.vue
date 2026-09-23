<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from './components/AppShell.vue'
import LoadingPanel from './components/LoadingPanel.vue'
import ProjectSelectionView from './views/ProjectSelectionView.vue'
import { useAppStore } from './stores/app'

const appStore = useAppStore()

onMounted(() => {
  void appStore.initialize()
})
</script>

<template>
  <LoadingPanel
    v-if="!appStore.sessionReady || (appStore.loading && !appStore.needsProjectSelection)"
    message="Preparando References Codex..."
  />

  <div v-else-if="appStore.error" class="page-shell min-h-screen py-10">
    <div class="surface-card mx-auto max-w-2xl">
      <p class="eyebrow">Error de inicialización</p>
      <h1 class="page-title mt-2">No se ha podido cargar la aplicación</h1>
      <p class="error-banner mt-5">{{ appStore.error }}</p>
      <button class="btn-primary mt-5" @click="appStore.initialize(true)">Reintentar</button>
    </div>
  </div>

  <ProjectSelectionView v-else-if="appStore.needsProjectSelection" />

  <AppShell v-else-if="appStore.initialized">
    <RouterView />
  </AppShell>

  <LoadingPanel v-else message="Preparando References Codex..." />
</template>

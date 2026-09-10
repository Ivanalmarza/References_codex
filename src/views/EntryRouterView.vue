<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getActiveSession } from '../services/sessions'

const router = useRouter()
const checking = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const active = await getActiveSession()
    if (active?.sessionId) {
      // Hay una sesión recuperable: dejar elegir (continuar / nueva).
      await router.replace({ name: 'session' })
      return
    }
    // Sin sesión activa: ir directo al generador.
    await router.replace({ name: 'start' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo comprobar la sesión'
  } finally {
    checking.value = false
  }
})
</script>

<template>
  <div class="flex min-h-[50vh] items-center justify-center">
    <div v-if="checking" class="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
      <span
        class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500 dark:border-slate-700 dark:border-t-cyan-400"
      ></span>
      <p class="text-sm">Comprobando sesión activa…</p>
    </div>

    <div
      v-else-if="error"
      class="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <p class="text-sm text-red-500">{{ error }}</p>
      <div class="mt-4 flex justify-center gap-3">
        <button
          type="button"
          class="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-white transition hover:bg-cyan-400"
          @click="router.replace({ name: 'start' })"
        >
          Ir al generador
        </button>
      </div>
    </div>
  </div>
</template>

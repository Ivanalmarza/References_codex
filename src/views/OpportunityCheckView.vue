<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { checkDocs, type CheckResult } from '../services/opportunities'

const route = useRoute()
const router = useRouter()
const unidad = computed(() => String(route.query.unidad || ''))
const oportunidad = computed(() => String(route.query.oportunidad || ''))

const loading = ref(true)
const result = ref<CheckResult | null>(null)

const columns = computed(() => {
  const rows = result.value?.rows || []
  const keys = new Set<string>()
  for (const row of rows) for (const key of Object.keys(row)) keys.add(key)
  return Array.from(keys)
})

onMounted(async () => {
  try {
    result.value = await checkDocs({ unidad: unidad.value, oportunidad: oportunidad.value })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <PageHeader eyebrow="SharePoint · Mana" title="Resultado comprobación PDF/CSV">
      <template #actions>
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="router.push({ name: 'opportunities' })"
        >
          Volver a subir/comprobar
        </button>
      </template>
    </PageHeader>

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">Comprobando documentos…</div>

    <template v-else-if="result">
      <div
        v-if="result.summary"
        class="mb-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <pre class="overflow-x-auto whitespace-pre-wrap text-slate-700 dark:text-slate-300">{{ JSON.stringify(result.summary, null, 2) }}</pre>
      </div>

      <div
        v-if="result.rows && result.rows.length"
        class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <table class="w-full text-left text-sm">
          <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
            <tr>
              <th v-for="col in columns" :key="col" class="px-4 py-2">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in result.rows" :key="i" class="border-b border-slate-100 dark:border-slate-800">
              <td v-for="col in columns" :key="col" class="px-4 py-2 text-slate-700 dark:text-slate-300">{{ row[col] }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="text-sm text-slate-500 dark:text-slate-400">Sin resultados de comprobación.</p>
    </template>
  </div>
</template>

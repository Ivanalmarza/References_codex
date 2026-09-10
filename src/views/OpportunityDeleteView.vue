<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { listDocs, deleteDoc, type OpportunityDoc } from '../services/opportunities'
import { notify } from '../services/notyf'

const route = useRoute()
const router = useRouter()
const unidad = computed(() => String(route.query.unidad || ''))
const oportunidad = computed(() => String(route.query.oportunidad || ''))

const docs = ref<OpportunityDoc[]>([])
const loading = ref(true)
const removingId = ref('')

async function load() {
  loading.value = true
  try {
    docs.value = await listDocs({ unidad: unidad.value, oportunidad: oportunidad.value })
  } finally {
    loading.value = false
  }
}

async function remove(doc: OpportunityDoc) {
  removingId.value = doc.id
  try {
    await deleteDoc(doc.id)
    notify.success('Documento eliminado')
    await load()
  } catch {
    notify.error('No se pudo eliminar el documento')
  } finally {
    removingId.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div>
    <PageHeader eyebrow="SharePoint · Mana" title="Seleccionar documento a eliminar">
      <template #actions>
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="router.push({ name: 'opportunities' })"
        >
          Volver
        </button>
      </template>
    </PageHeader>

    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">Cargando documentos…</p>
      <p v-else-if="!docs.length" class="text-sm text-slate-500 dark:text-slate-400">No hay documentos para eliminar.</p>
      <ul v-else class="divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="doc in docs" :key="doc.id" class="flex items-center justify-between py-3">
          <div>
            <p class="text-sm font-medium text-slate-800 dark:text-slate-200">{{ doc.name }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ doc.modified || '' }}</p>
          </div>
          <button
            type="button"
            :disabled="removingId === doc.id"
            class="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
            @click="remove(doc)"
          >
            {{ removingId === doc.id ? 'Eliminando…' : 'Eliminar' }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

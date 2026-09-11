<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import FileUploader from '../components/FileUploader.vue'
import OpportunityPicker from '../components/OpportunityPicker.vue'
import EmptyState from '../components/EmptyState.vue'
import { runManaAction } from '../services/referenceApi'
import { getProblemMessage } from '../services/api'
import { notify } from '../services/notyf'
import { useAppStore } from '../stores/app'
import type { ManaActionResponse, OpportunityItem, UploadToken } from '../types/api'

const store = useAppStore()
const selectedOpportunity = ref<OpportunityItem | null>(null)
const uploads = ref<UploadToken[]>([])
const busyAction = ref<string | null>(null)
const result = ref<ManaActionResponse | null>(null)
const selectedDeleteFile = ref('')
const selection = reactive({ mode: 'filters' as 'filters' | 'businessId', sector: '', unit: '', customer: '', businessId: '' })

const sectors = computed(() => store.options?.opportunitySectors || [])
const canAct = computed(() => Boolean(selectedOpportunity.value?.opportunityId) && !busyAction.value)

function updateSelection(value: typeof selection): void {
  Object.assign(selection, value)
}

function basePayload(): Record<string, unknown> {
  return {
    opportunityId: selectedOpportunity.value?.opportunityId || '',
    sector: selection.sector || selectedOpportunity.value?.sector || '',
    unidadOportunidad: selection.unit || selectedOpportunity.value?.unit || '',
    cliente: selection.customer || selectedOpportunity.value?.customer || '',
  }
}

async function execute(action: 'upload' | 'checkRequired' | 'deleteDoc' | 'deleteDocConfirm'): Promise<void> {
  if (!selectedOpportunity.value) {
    notify.warning('Selecciona una oportunidad.')
    return
  }
  if (action === 'upload' && !uploads.value.length) {
    notify.warning('Añade al menos un documento.')
    return
  }
  if (action === 'deleteDocConfirm' && !selectedDeleteFile.value) {
    notify.warning('Selecciona el documento que quieres eliminar.')
    return
  }
  if (action === 'deleteDocConfirm') {
    const confirmed = window.confirm(`¿Eliminar "${selectedDeleteFile.value}" de SharePoint?`)
    if (!confirmed) return
  }

  busyAction.value = action
  try {
    result.value = await runManaAction({
      ...basePayload(),
      action,
      uploadIds: uploads.value.map((item) => item.uploadId),
      deleteFileName: selectedDeleteFile.value,
    })
    if (action === 'upload' && result.value.ok) uploads.value = []
    if (action === 'deleteDoc' && result.value.delete.choices.length) {
      selectedDeleteFile.value = result.value.delete.choices[0]?.value || ''
    }
    if (action === 'deleteDocConfirm' && result.value.ok) selectedDeleteFile.value = ''
    result.value.ok ? notify.success(result.value.status) : notify.warning(result.value.status)
    await store.refreshBootstrap().catch(() => undefined)
  } catch (reason) {
    notify.error(getProblemMessage(reason, 'La acción MANA no se ha podido completar.'))
  } finally {
    busyAction.value = null
  }
}
</script>

<template>
  <div class="page-shell space-y-6">
    <header>
      <p class="eyebrow">Administración MANA</p>
      <h1 class="page-title mt-2">Documentos de oportunidad</h1>
      <p class="page-description">Sube documentos, comprueba la presencia de PDF/CSV o elimina un fichero asociado a la oportunidad.</p>
    </header>

    <section class="surface-card">
      <p class="eyebrow">1 · Oportunidad</p>
      <h2 class="section-title mt-1">Localiza la carpeta de SharePoint</h2>
      <div class="mt-5">
        <OpportunityPicker v-model="selectedOpportunity" :sectors="sectors" :disabled="Boolean(busyAction)" @update:selection="updateSelection" />
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-3">
      <article class="surface-card-flat flex flex-col p-5">
        <span class="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4M7 9l5-5 5 5M5 14v5h14v-5" /></svg></span>
        <h2 class="mt-4 font-extrabold text-slate-900 dark:text-white">Subir documentos</h2>
        <p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Añade uno o varios archivos a la carpeta asociada y actualiza el índice local.</p>
        <div class="mt-4 flex-1"><FileUploader v-model="uploads" scope="mana" :max-files="10" /></div>
        <button class="btn-primary mt-4 w-full" :disabled="!canAct || !uploads.length" @click="execute('upload')">{{ busyAction === 'upload' ? 'Subiendo...' : 'Subir a SharePoint' }}</button>
      </article>

      <article class="surface-card-flat flex flex-col p-5">
        <span class="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4M8 11h6M11 8v6" /></svg></span>
        <h2 class="mt-4 font-extrabold text-slate-900 dark:text-white">Comprobar PDF/CSV</h2>
        <p class="mt-2 flex-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Consulta los documentos existentes y confirma si hay PDF, CSV y <code>opportunity_info.csv</code>.</p>
        <button class="btn-secondary mt-5 w-full" :disabled="!canAct" @click="execute('checkRequired')">{{ busyAction === 'checkRequired' ? 'Comprobando...' : 'Comprobar documentos' }}</button>
      </article>

      <article class="surface-card-flat flex flex-col p-5">
        <span class="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg></span>
        <h2 class="mt-4 font-extrabold text-slate-900 dark:text-white">Eliminar documento</h2>
        <p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Primero recupera la lista actual de archivos; después confirma el documento exacto.</p>
        <button class="btn-secondary mt-4 w-full" :disabled="!canAct" @click="execute('deleteDoc')">{{ busyAction === 'deleteDoc' ? 'Consultando...' : 'Listar documentos' }}</button>
        <div class="mt-3">
          <select v-model="selectedDeleteFile" class="form-control" :disabled="!result?.delete.choices.length || Boolean(busyAction)">
            <option value="">Selecciona documento</option>
            <option v-for="item in result?.delete.choices || []" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>
        <button class="btn-danger mt-3 w-full" :disabled="!canAct || !selectedDeleteFile" @click="execute('deleteDocConfirm')">{{ busyAction === 'deleteDocConfirm' ? 'Eliminando...' : 'Eliminar seleccionado' }}</button>
      </article>
    </section>

    <section class="surface-card">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><p class="eyebrow">Resultado</p><h2 class="section-title mt-1">Última operación MANA</h2></div>
        <span v-if="result" class="rounded-full px-3 py-1.5 text-xs font-bold" :class="result.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'">{{ result.ok ? 'Completada' : 'Con error' }}</span>
      </div>

      <template v-if="result">
        <p class="mt-4 rounded-xl border px-4 py-3 text-sm font-bold" :class="result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'">{{ result.status }}</p>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 class="text-sm font-extrabold text-slate-900 dark:text-white">Oportunidad</h3>
            <pre class="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-600 dark:text-slate-300">{{ result.opportunity.information || 'Sin detalle.' }}</pre>
          </div>
          <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 class="text-sm font-extrabold text-slate-900 dark:text-white">SharePoint</h3>
            <pre class="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-600 dark:text-slate-300">{{ result.sharePoint.text || 'Sin detalle.' }}</pre>
          </div>
        </div>

        <div v-if="result.sharePoint.hasPdf !== undefined || result.sharePoint.hasCsv !== undefined" class="mt-4 flex flex-wrap gap-2">
          <span class="rounded-full px-3 py-1.5 text-xs font-bold" :class="result.sharePoint.hasPdf ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'">PDF: {{ result.sharePoint.hasPdf ? 'Sí' : 'No' }}</span>
          <span class="rounded-full px-3 py-1.5 text-xs font-bold" :class="result.sharePoint.hasCsv ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'">CSV: {{ result.sharePoint.hasCsv ? 'Sí' : 'No' }}</span>
          <span class="rounded-full px-3 py-1.5 text-xs font-bold" :class="result.sharePoint.hasOpportunityInfo ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'">opportunity_info.csv: {{ result.sharePoint.hasOpportunityInfo ? 'Sí' : 'No' }}</span>
        </div>

        <div v-if="result.index.summary" class="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-950"><h3 class="text-sm font-extrabold text-slate-900 dark:text-white">Índice local</h3><pre class="mt-2 whitespace-pre-wrap font-mono text-xs leading-5 text-slate-600 dark:text-slate-300">{{ result.index.summary }}</pre></div>
      </template>

      <EmptyState v-else class="mt-5" title="Todavía no hay resultados" description="Selecciona una oportunidad y ejecuta una de las acciones superiores." />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import FileUploader from '../components/FileUploader.vue'
import OpportunityPicker from '../components/OpportunityPicker.vue'
import { useAppStore } from '../stores/app'
import { removeUpload, startExecution } from '../services/referenceApi'
import { getProblemMessage } from '../services/api'
import { sourceLabel } from '../utils/format'
import { notify } from '../services/notyf'
import type { ExecutionRequest, OpportunityItem, UploadToken } from '../types/api'

const store = useAppStore()
const router = useRouter()
const submitting = ref(false)
const cancellingMixedSources = ref(false)
const showMixedSourcesWarning = ref(false)
const pageError = ref<string | null>(null)
const selectedOpportunity = ref<OpportunityItem | null>(null)
const uploads = ref<UploadToken[]>([])
const opportunitySelection = reactive({
  mode: 'filters' as 'filters' | 'businessId',
  sector: '',
  unit: '',
  customer: '',
  businessId: '',
})

const form = reactive({
  includeOpportunity: false,
  includeUploads: false,
  idioma: 'Español (ES)',
  plantilla: '',
  sector_outputformat: 'general' as 'general' | 'sector_publico' | 'sector_privado',
  instruccionEspecifica: '',
})

const options = computed(() => store.options)
const selectedSources = computed(() => [
  form.includeOpportunity ? 'opportunity' : '',
  form.includeUploads ? 'uploads' : '',
].filter(Boolean))

watch(options, (value) => {
  if (!form.plantilla && value?.templates?.length) form.plantilla = value.templates[0]?.value || ''
}, { immediate: true })

function setOpportunitySelection(value: typeof opportunitySelection): void {
  Object.assign(opportunitySelection, value)
}

function validate(): string | null {
  if (!selectedSources.value.length) return 'Selecciona Oportunidad MANA, Archivos propios o ambas fuentes.'
  if (form.includeOpportunity && !selectedOpportunity.value?.opportunityId) {
    return 'Selecciona una oportunidad MANA.'
  }
  if (form.includeUploads && uploads.value.length === 0) {
    return 'Añade al menos un archivo propio.'
  }
  if (!form.plantilla) return 'Selecciona una plantilla de salida.'
  return null
}

function buildExecutionRequest(): ExecutionRequest {
  return {
    // Se mantienen estos campos por compatibilidad con el contrato actual de Flows.
    // El frontend ya no ofrece "Proyecto procesado" como fuente seleccionable.
    includeProcessed: false,
    includeOpportunity: form.includeOpportunity,
    includeUploads: form.includeUploads,
    unidadProcesado: '',
    proyectoProcesado: '',
    opportunitySelectionMode: opportunitySelection.mode,
    businessOpportunityIdSearch: opportunitySelection.businessId,
    sector: opportunitySelection.sector || selectedOpportunity.value?.sector || '',
    unidadOportunidad: opportunitySelection.unit || selectedOpportunity.value?.unit || '',
    cliente: opportunitySelection.customer || selectedOpportunity.value?.customer || '',
    opportunityId: selectedOpportunity.value?.opportunityId || '',
    uploadIds: uploads.value.map((item) => item.uploadId),
    idioma: form.idioma,
    plantilla: form.plantilla,
    sector_outputformat: form.sector_outputformat,
    instruccionEspecifica: form.instruccionEspecifica.trim(),
  }
}

async function startConfirmedExecution(): Promise<void> {
  if (submitting.value) return

  submitting.value = true
  pageError.value = null

  try {
    const accepted = await startExecution(buildExecutionRequest())
    notify.success('Ejecución iniciada correctamente.')
    await store.refreshBootstrap().catch(() => undefined)
    await router.push(`/execution/${accepted.sessionId}`)
  } catch (error) {
    pageError.value = getProblemMessage(error, 'No se ha podido iniciar la ejecución.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } finally {
    submitting.value = false
  }
}

async function submit(): Promise<void> {
  pageError.value = validate()
  if (pageError.value) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  // La advertencia solo se muestra cuando la referencia combina MANA y archivos propios.
  // Mientras el usuario no acepte, NO se crea sessionId y NO se llama a /references-api/executions.
  if (form.includeOpportunity && form.includeUploads) {
    showMixedSourcesWarning.value = true
    return
  }

  await startConfirmedExecution()
}

async function confirmMixedSources(): Promise<void> {
  if (submitting.value || cancellingMixedSources.value) return
  showMixedSourcesWarning.value = false
  await startConfirmedExecution()
}

async function cancelMixedSources(): Promise<void> {
  if (submitting.value || cancellingMixedSources.value) return

  cancellingMixedSources.value = true

  try {
    // Los archivos ya se han subido al staging temporal antes de pulsar "Iniciar proceso".
    // Al cancelar los eliminamos para no dejar uploads huérfanos.
    const results = await Promise.allSettled(
      uploads.value.map((item) => removeUpload(item.uploadId)),
    )

    const failedDeletes = results.filter((result) => result.status === 'rejected').length
    uploads.value = []
    showMixedSourcesWarning.value = false

    if (failedDeletes > 0) {
      notify.warning(
        `La ejecución se ha cancelado, pero no se han podido limpiar ${failedDeletes} archivo(s) temporal(es).`,
      )
    } else {
      notify.warning('Ejecución cancelada antes de iniciarse.')
    }

    await router.push('/')
  } finally {
    cancellingMixedSources.value = false
  }
}
</script>

<template>
  <div class="page-shell space-y-6">
    <header>
      <p class="eyebrow">Nueva generación</p>
      <h1 class="page-title mt-2">Configura la referencia</h1>
      <p class="page-description">Selecciona una oportunidad MANA, sube archivos propios o combina ambas fuentes, y configura el idioma, la plantilla y el formato de salida.</p>
    </header>

    <div v-if="store.activeSession && !store.activeSession.terminal" class="warning-banner">
      Hay una ejecución activa: <strong>{{ store.activeSession.status }}</strong>. Al iniciar una nueva, se solicitará la parada de la ejecución actual antes de crear la nueva sesión.
    </div>
    <div v-if="pageError" class="error-banner"><strong>Revisa la configuración:</strong> {{ pageError }}</div>

    <form class="space-y-6" @submit.prevent="submit">
      <section class="surface-card">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="eyebrow">1 · Fuentes</p>
            <h2 class="section-title mt-1">Selecciona la información de entrada</h2>
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Puedes activar una o ambas fuentes. Si un mismo dato aparece en ambas, tendrán prioridad los archivos propios sobre la oportunidad.</p>
          </div>
          <span class="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{{ selectedSources.length }} activa(s)</span>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <label class="relative rounded-2xl border p-4 transition" :class="form.includeOpportunity ? 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'">
            <input v-model="form.includeOpportunity" type="checkbox" class="absolute right-4 top-4 h-5 w-5 rounded border-slate-300 text-cyan-600" />
            <span class="grid h-10 w-10 place-items-center rounded-xl bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6.5h7l2 2h9v10.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg></span>
            <h3 class="mt-4 font-extrabold text-slate-900 dark:text-white">Oportunidad MANA</h3>
            <p class="mt-1.5 pr-6 text-sm leading-5 text-slate-500 dark:text-slate-400">Documentos asociados a una oportunidad de SharePoint.</p>
          </label>

          <label class="relative rounded-2xl border p-4 transition" :class="form.includeUploads ? 'border-violet-500 bg-violet-50/70 dark:bg-violet-950/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'">
            <input v-model="form.includeUploads" type="checkbox" class="absolute right-4 top-4 h-5 w-5 rounded border-slate-300 text-violet-600" />
            <span class="grid h-10 w-10 place-items-center rounded-xl bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4M7 9l5-5 5 5M5 14v5h14v-5" /></svg></span>
            <h3 class="mt-4 font-extrabold text-slate-900 dark:text-white">Archivos propios</h3>
            <p class="mt-1.5 pr-6 text-sm leading-5 text-slate-500 dark:text-slate-400">Documentos específicos subidos para esta ejecución.</p>
          </label>
        </div>
      </section>

      <section v-if="form.includeOpportunity" class="surface-card">
        <p class="eyebrow">Oportunidad MANA</p>
        <h2 class="section-title mt-1">Selecciona la oportunidad</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">La búsqueda se realiza de forma filtrada y paginada para mostrar únicamente las oportunidades relevantes.</p>
        <div class="mt-5">
          <OpportunityPicker v-model="selectedOpportunity" :sectors="options?.opportunitySectors || []" :disabled="submitting" @update:selection="setOpportunitySelection" />
        </div>
      </section>

      <section v-if="form.includeUploads" class="surface-card">
        <p class="eyebrow">Archivos propios</p>
        <h2 class="section-title mt-1">Añade documentación</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Los archivos se adjuntan a esta ejecución y se utilizarán como fuente de información para generar la referencia.</p>
        <div class="mt-5"><FileUploader v-model="uploads" scope="execution" /></div>
      </section>

      <section class="surface-card">
        <p class="eyebrow">2 · Salida</p>
        <h2 class="section-title mt-1">Idioma, plantilla y formato</h2>
        <div class="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <label class="field-label" for="language">Idioma de salida</label>
            <select id="language" v-model="form.idioma" class="form-control">
              <option v-for="item in options?.languages || []" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
          <div>
            <label class="field-label" for="template">Plantilla</label>
            <select id="template" v-model="form.plantilla" class="form-control">
              <option value="">Selecciona plantilla</option>
              <option v-for="item in options?.templates || []" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
          <div>
            <label class="field-label" for="sector-format">Sector / formato de salida</label>
            <select id="sector-format" v-model="form.sector_outputformat" class="form-control">
              <option v-for="item in options?.sectorOutputFormats || []" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
        </div>

        <div class="mt-5">
          <label class="field-label" for="instructions">Instrucciones adicionales</label>
          <textarea id="instructions" v-model="form.instruccionEspecifica" rows="5" class="form-control resize-y" maxlength="8000" placeholder="Añade criterios específicos para la generación de la referencia..."></textarea>
          <p class="field-help text-right">{{ form.instruccionEspecifica.length }}/8000</p>
        </div>
      </section>

      <div class="surface-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="font-extrabold text-slate-900 dark:text-white">{{ selectedSources.length ? `Fuentes: ${selectedSources.map(sourceLabel).join(' + ')}` : 'Selecciona Oportunidad MANA, Archivos propios o ambas fuentes' }}</p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Podrás seguir el progreso de la generación desde la pantalla de ejecución.</p>
        </div>
        <button type="submit" class="btn-primary min-w-52" :disabled="submitting">
          <span v-if="submitting" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
          <svg v-else viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6" /></svg>
          {{ submitting ? 'Iniciando...' : 'Iniciar proceso' }}
        </button>
      </div>
    </form>

    <Teleport to="body">
      <div
        v-if="showMixedSourcesWarning"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm"
        role="presentation"
      >
        <section
          class="w-full max-w-xl overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-2xl shadow-slate-950/30 dark:border-amber-900/70 dark:bg-slate-900"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mixed-sources-warning-title"
          aria-describedby="mixed-sources-warning-description"
        >
          <div class="border-b border-amber-100 bg-amber-50 px-6 py-5 dark:border-amber-900/50 dark:bg-amber-950/30 sm:px-7">
            <div class="flex items-start gap-4">
              <span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.3 3.8 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
                </svg>
              </span>
              <div>
                <p class="text-xs font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Aviso antes de ejecutar</p>
                <h2 id="mixed-sources-warning-title" class="mt-1 text-xl font-black text-slate-950 dark:text-white">Comprueba la coherencia de las fuentes</h2>
              </div>
            </div>
          </div>

          <div class="px-6 py-6 sm:px-7">
            <div id="mixed-sources-warning-description" class="space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <p>
                Has seleccionado información procedente de <strong class="text-slate-900 dark:text-white">una oportunidad MANA</strong> y también <strong class="text-slate-900 dark:text-white">documentos propios</strong>.
              </p>
              <p>
                Si la información de ambas fuentes no es coherente, contiene datos contradictorios o pertenece a contextos diferentes, la referencia generada podría no ser la deseada.
              </p>
              <div class="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200">
                Verifica que los documentos propios y la oportunidad MANA hacen referencia al mismo contexto antes de continuar.
              </div>
            </div>

            <div class="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                class="btn-secondary sm:min-w-48"
                :disabled="submitting || cancellingMixedSources"
                @click="cancelMixedSources"
              >
                <span v-if="cancellingMixedSources" class="h-4 w-4 animate-spin rounded-full border-2 border-slate-400/40 border-t-slate-600 dark:border-slate-500/40 dark:border-t-slate-200"></span>
                {{ cancellingMixedSources ? 'Cancelando...' : 'Cancelar y volver al inicio' }}
              </button>
              <button
                type="button"
                class="btn-primary sm:min-w-44"
                :disabled="submitting || cancellingMixedSources"
                @click="confirmMixedSources"
              >
                <span v-if="submitting" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                <svg v-else viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m5 12 4 4L19 6" />
                </svg>
                {{ submitting ? 'Iniciando...' : 'Aceptar y continuar' }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

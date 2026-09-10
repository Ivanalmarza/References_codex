<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import FileUploader from '../components/FileUploader.vue'
import OpportunityPicker from '../components/OpportunityPicker.vue'
import { useAppStore } from '../stores/app'
import { startExecution } from '../services/referenceApi'
import { getProblemMessage } from '../services/api'
import { notify } from '../services/notyf'
import type { ExecutionRequest, OpportunityItem, UploadToken } from '../types/api'

const store = useAppStore()
const router = useRouter()
const submitting = ref(false)
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
  includeProcessed: false,
  includeOpportunity: false,
  includeUploads: false,
  unidadProcesado: '',
  proyectoProcesado: '',
  idioma: 'Español (ES)',
  plantilla: '',
  sector_outputformat: 'general' as 'general' | 'sector_publico' | 'sector_privado',
  instruccionEspecifica: '',
})

const options = computed(() => store.options)
const processedProjects = computed(() =>
  options.value?.processedProjectsByUnit?.[form.unidadProcesado] || [],
)
const selectedSources = computed(() => [
  form.includeProcessed ? 'processed' : '',
  form.includeOpportunity ? 'opportunity' : '',
  form.includeUploads ? 'uploads' : '',
].filter(Boolean))

watch(options, (value) => {
  if (!form.plantilla && value?.templates?.length) form.plantilla = value.templates[0]?.value || ''
}, { immediate: true })

watch(() => form.unidadProcesado, () => {
  form.proyectoProcesado = ''
})

function setOpportunitySelection(value: typeof opportunitySelection): void {
  Object.assign(opportunitySelection, value)
}

function validate(): string | null {
  if (!selectedSources.value.length) return 'Activa al menos una fuente de información.'
  if (form.includeProcessed && (!form.unidadProcesado || !form.proyectoProcesado)) {
    return 'Selecciona la unidad y el proyecto procesado.'
  }
  if (form.includeOpportunity && !selectedOpportunity.value?.opportunityId) {
    return 'Selecciona una oportunidad MANA.'
  }
  if (form.includeUploads && uploads.value.length === 0) {
    return 'Añade al menos un archivo propio.'
  }
  if (!form.plantilla) return 'Selecciona una plantilla de salida.'
  return null
}

async function submit(): Promise<void> {
  pageError.value = validate()
  if (pageError.value) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  submitting.value = true
  try {
    const request: ExecutionRequest = {
      includeProcessed: form.includeProcessed,
      includeOpportunity: form.includeOpportunity,
      includeUploads: form.includeUploads,
      unidadProcesado: form.unidadProcesado,
      proyectoProcesado: form.proyectoProcesado,
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

    const accepted = await startExecution(request)
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
</script>

<template>
  <div class="page-shell space-y-6">
    <header>
      <p class="eyebrow">Nueva generación</p>
      <h1 class="page-title mt-2">Configura la referencia</h1>
      <p class="page-description">Combina una o varias fuentes. Los valores se envían al mismo contrato que utilizaba Form.io y el procesamiento continúa en los Functions actuales de FLOWS.</p>
    </header>

    <div v-if="store.activeSession && !store.activeSession.terminal" class="warning-banner">
      Hay una ejecución activa: <strong>{{ store.activeSession.status }}</strong>. Al iniciar una nueva, FLOWS solicitará la parada de la anterior antes de crear la nueva sesión.
    </div>
    <div v-if="pageError" class="error-banner"><strong>Revisa la configuración:</strong> {{ pageError }}</div>

    <form class="space-y-6" @submit.prevent="submit">
      <section class="surface-card">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="eyebrow">1 · Fuentes</p>
            <h2 class="section-title mt-1">Selecciona la información de entrada</h2>
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Puedes activar varias fuentes. En conflictos de nombre prevalece: uploads, oportunidad y proyecto procesado.</p>
          </div>
          <span class="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{{ selectedSources.length }} activa(s)</span>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-3">
          <label class="relative rounded-2xl border p-4 transition" :class="form.includeProcessed ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'">
            <input v-model="form.includeProcessed" type="checkbox" class="absolute right-4 top-4 h-5 w-5 rounded border-slate-300 text-blue-600" />
            <span class="grid h-10 w-10 place-items-center rounded-xl bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v14H4zM8 9h8M8 13h5" /></svg></span>
            <h3 class="mt-4 font-extrabold text-slate-900 dark:text-white">Proyecto procesado</h3>
            <p class="mt-1.5 pr-6 text-sm leading-5 text-slate-500 dark:text-slate-400">Markdowns ya generados por unidad y proyecto.</p>
          </label>

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

      <section v-if="form.includeProcessed" class="surface-card">
        <p class="eyebrow">Proyecto procesado</p>
        <h2 class="section-title mt-1">Origen preprocesado</h2>
        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label class="field-label" for="processed-unit">Unidad</label>
            <select id="processed-unit" v-model="form.unidadProcesado" class="form-control">
              <option value="">Selecciona unidad</option>
              <option v-for="item in options?.processedUnits || []" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
          <div>
            <label class="field-label" for="processed-project">Proyecto</label>
            <select id="processed-project" v-model="form.proyectoProcesado" class="form-control" :disabled="!form.unidadProcesado">
              <option value="">Selecciona proyecto</option>
              <option v-for="item in processedProjects" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
        </div>
      </section>

      <section v-if="form.includeOpportunity" class="surface-card">
        <p class="eyebrow">Oportunidad MANA</p>
        <h2 class="section-title mt-1">Selecciona la oportunidad</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">La búsqueda se realiza en FLOWS de forma filtrada y paginada. El navegador no recibe el índice completo.</p>
        <div class="mt-5">
          <OpportunityPicker v-model="selectedOpportunity" :sectors="options?.opportunitySectors || []" :disabled="submitting" @update:selection="setOpportunitySelection" />
        </div>
      </section>

      <section v-if="form.includeUploads" class="surface-card">
        <p class="eyebrow">Archivos propios</p>
        <h2 class="section-title mt-1">Añade documentación</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Los archivos se guardan temporalmente y FLOWS los materializa en el workspace de la sesión al comenzar.</p>
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
          <p class="font-extrabold text-slate-900 dark:text-white">{{ selectedSources.length ? `Fuentes: ${selectedSources.join(' + ')}` : 'Selecciona al menos una fuente' }}</p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">La petición devolverá una sesión inmediatamente y el proceso continuará de forma desacoplada.</p>
        </div>
        <button type="submit" class="btn-primary min-w-52" :disabled="submitting">
          <span v-if="submitting" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
          <svg v-else viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6" /></svg>
          {{ submitting ? 'Iniciando...' : 'Iniciar proceso' }}
        </button>
      </div>
    </form>
  </div>
</template>

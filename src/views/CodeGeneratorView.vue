<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { getSelectors, type Selectors } from '../services/selectors'
import { startExecution } from '../services/executions'
import { notify } from '../services/notyf'

const router = useRouter()

const loading = ref(true)
const submitting = ref(false)
const selectors = ref<Selectors | null>(null)
const files = ref<File[]>([])

const form = reactive({
  includeProcessed: false,
  includeOpportunity: false,
  includeUploads: false,
  unidadProcesado: '',
  proyectoProcesado: '',
  unidadOportunidad: '',
  oportunidad: '',
  plantilla: '',
  sector_outputformat: '',
  idioma: '',
  model: '',
  reasoning: '',
  instruccionEspecifica: '',
})

const selectedSources = computed(() => {
  const s: string[] = []
  if (form.includeProcessed) s.push('processed')
  if (form.includeOpportunity) s.push('opportunity')
  if (form.includeUploads) s.push('uploads')
  return s
})

const canSubmit = computed(() => {
  if (!selectors.value || submitting.value) return false
  if (selectedSources.value.length === 0) return false
  if (!form.plantilla || !form.sector_outputformat) return false
  if (form.includeProcessed && (!form.unidadProcesado || !form.proyectoProcesado)) return false
  if (form.includeOpportunity && (!form.unidadOportunidad || !form.oportunidad)) return false
  if (form.includeUploads && files.value.length === 0) return false
  return true
})

onMounted(async () => {
  try {
    selectors.value = await getSelectors()
  } catch {
    notify.error('No se pudieron cargar los selectores')
  } finally {
    loading.value = false
  }
})

watch(
  () => form.unidadProcesado,
  async (unidad) => {
    form.proyectoProcesado = ''
    if (!unidad || !selectors.value) return
    const next = await getSelectors({ unidad })
    selectors.value = { ...selectors.value, proyectosProcesado: next.proyectosProcesado }
  },
)

watch(
  () => form.unidadOportunidad,
  async (unidad) => {
    form.oportunidad = ''
    if (!unidad || !selectors.value) return
    const next = await getSelectors({ unidadOportunidad: unidad })
    selectors.value = { ...selectors.value, oportunidades: next.oportunidades }
  },
)

function onFilesChange(event: Event) {
  const input = event.target as HTMLInputElement
  files.value = input.files ? Array.from(input.files) : []
}

async function onSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const payload = {
      ...form,
      selectedSources: selectedSources.value,
      outputLanguage: form.idioma,
    }
    const result = await startExecution(payload, form.includeUploads ? files.value : undefined)
    notify.success('Ejecución iniciada')
    router.push({ name: 'starting', query: { sessionId: result.sessionId } })
  } catch {
    notify.error('No se pudo iniciar la ejecución')
  } finally {
    submitting.value = false
  }
}

const label = 'block text-sm font-medium text-slate-700 dark:text-slate-200'
const control =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const card =
  'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900'
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Nueva ejecución"
      title="Iniciar generador"
      description="Selecciona las fuentes, la unidad, el proyecto y la configuración de salida para lanzar la generación de referencias."
    />

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">Cargando configuración…</div>

    <form v-else class="space-y-6" @submit.prevent="onSubmit">
      <section :class="card">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Fuentes</h3>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Activa al menos una fuente.</p>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <label
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-cyan-400 dark:border-slate-700"
            :class="form.includeProcessed ? 'border-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/10' : ''"
          >
            <input v-model="form.includeProcessed" type="checkbox" class="mt-0.5 h-4 w-4 accent-cyan-500" />
            <span>
              <span class="block text-sm font-semibold text-slate-900 dark:text-white">Incluir proyecto</span>
              <span class="block text-xs text-slate-500 dark:text-slate-400">Usa documentos ya procesados de un proyecto.</span>
            </span>
          </label>
          <label
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-cyan-400 dark:border-slate-700"
            :class="form.includeOpportunity ? 'border-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/10' : ''"
          >
            <input v-model="form.includeOpportunity" type="checkbox" class="mt-0.5 h-4 w-4 accent-cyan-500" />
            <span>
              <span class="block text-sm font-semibold text-slate-900 dark:text-white">Incluir oportunidad</span>
              <span class="block text-xs text-slate-500 dark:text-slate-400">Incluye los datos obtenidos de Mana.</span>
            </span>
          </label>
          <label
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-cyan-400 dark:border-slate-700"
            :class="form.includeUploads ? 'border-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/10' : ''"
          >
            <input v-model="form.includeUploads" type="checkbox" class="mt-0.5 h-4 w-4 accent-cyan-500" />
            <span>
              <span class="block text-sm font-semibold text-slate-900 dark:text-white">Incluir uploads</span>
              <span class="block text-xs text-slate-500 dark:text-slate-400">Sube tus propios documentos.</span>
            </span>
          </label>
        </div>
      </section>

      <section v-if="form.includeProcessed" :class="card">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Proyecto procesado</h3>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label :class="label">Unidad</label>
            <select v-model="form.unidadProcesado" :class="control">
              <option value="" disabled>Seleccionar unidad</option>
              <option v-for="o in selectors?.unidadesProcesado" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div>
            <label :class="label">Proyecto</label>
            <select v-model="form.proyectoProcesado" :class="control" :disabled="!form.unidadProcesado">
              <option value="" disabled>Seleccionar proyecto</option>
              <option v-for="o in selectors?.proyectosProcesado" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
        </div>
      </section>

      <section v-if="form.includeOpportunity" :class="card">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Oportunidad (Mana)</h3>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label :class="label">Unidad</label>
            <select v-model="form.unidadOportunidad" :class="control">
              <option value="" disabled>Seleccionar unidad</option>
              <option v-for="o in selectors?.unidadesOportunidad" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div>
            <label :class="label">Oportunidad</label>
            <select v-model="form.oportunidad" :class="control" :disabled="!form.unidadOportunidad">
              <option value="" disabled>Buscar oportunidad</option>
              <option v-for="o in selectors?.oportunidades" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
        </div>
      </section>

      <section v-if="form.includeUploads" :class="card">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Documentos a subir</h3>
        <input type="file" multiple class="mt-4 block w-full text-sm text-slate-600 dark:text-slate-300" @change="onFilesChange" />
        <p v-if="files.length" class="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {{ files.length }} fichero(s) seleccionado(s)
        </p>
      </section>

      <section :class="card">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Configuración de salida</h3>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label :class="label">Plantilla <span class="text-red-500">*</span></label>
            <select v-model="form.plantilla" :class="control">
              <option value="" disabled>Seleccionar plantilla</option>
              <option v-for="o in selectors?.plantillas" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div>
            <label :class="label">Sector / formato de salida <span class="text-red-500">*</span></label>
            <select v-model="form.sector_outputformat" :class="control">
              <option value="" disabled>Seleccionar sector / formato</option>
              <option v-for="o in selectors?.sectorOutputFormats" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div>
            <label :class="label">Idioma de salida</label>
            <select v-model="form.idioma" :class="control">
              <option value="" disabled>Seleccionar idioma</option>
              <option v-for="o in selectors?.idiomas" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div v-if="selectors?.models?.length">
            <label :class="label">Modelo</label>
            <select v-model="form.model" :class="control">
              <option value="">Por defecto</option>
              <option v-for="o in selectors?.models" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div v-if="selectors?.reasoningLevels?.length">
            <label :class="label">Nivel de razonamiento</label>
            <select v-model="form.reasoning" :class="control">
              <option value="">Por defecto</option>
              <option v-for="o in selectors?.reasoningLevels" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
        </div>
      </section>

      <section :class="card">
        <label :class="label">Instrucciones adicionales para la generación de la referencia</label>
        <textarea
          v-model="form.instruccionEspecifica"
          rows="4"
          :class="control"
          placeholder="Opcional: indica requisitos, formato, tono, etc."
        ></textarea>
      </section>

      <div class="flex items-center gap-4">
        <button
          type="submit"
          :disabled="!canSubmit"
          class="rounded-xl bg-gradient-to-br from-[#0b2f55] to-[#1e6fd1] px-6 py-3 font-extrabold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ submitting ? 'Iniciando…' : '🔎 Iniciar proceso' }}
        </button>
        <p v-if="selectedSources.length === 0" class="text-sm text-amber-600 dark:text-amber-400">
          Activa al menos una fuente (procesado, oportunidad o uploads).
        </p>
      </div>
    </form>
  </div>
</template>

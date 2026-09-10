<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { searchOpportunities } from '../services/referenceApi'
import { getProblemMessage } from '../services/api'
import type { Choice, OpportunityItem } from '../types/api'

const props = withDefaults(defineProps<{
  modelValue: OpportunityItem | null
  sectors?: Choice[]
  disabled?: boolean
}>(), {
  sectors: () => [],
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: OpportunityItem | null]
  'update:selection': [value: { mode: 'filters' | 'businessId'; sector: string; unit: string; customer: string; businessId: string }]
}>()

const mode = ref<'filters' | 'businessId'>('filters')
const sector = ref('')
const unit = ref('')
const customer = ref('')
const businessId = ref('')
const textSearch = ref('')
const units = ref<Choice[]>([])
const customers = ref<Choice[]>([])
const opportunities = ref<OpportunityItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const hint = ref('Selecciona sector, unidad y cliente.')

const selectedId = computed({
  get: () => props.modelValue?.opportunityId || '',
  set: (value: string) => {
    const selected = opportunities.value.find((item) => item.opportunityId === value) || null
    emit('update:modelValue', selected)
  },
})

function publishSelection(): void {
  emit('update:selection', {
    mode: mode.value,
    sector: sector.value,
    unit: unit.value,
    customer: customer.value,
    businessId: businessId.value,
  })
}

async function query(params: Record<string, string>): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const response = await searchOpportunities({ ...params, size: 100 })
    units.value = response.facets?.units || units.value
    customers.value = response.facets?.customers || customers.value
    opportunities.value = response.items || []
    hint.value = response.message || `${response.pagination?.total || 0} oportunidad(es) encontrada(s).`
  } catch (reason) {
    error.value = getProblemMessage(reason, 'No se han podido cargar las oportunidades.')
    opportunities.value = []
  } finally {
    loading.value = false
  }
}

async function changeSector(): Promise<void> {
  unit.value = ''
  customer.value = ''
  units.value = []
  customers.value = []
  opportunities.value = []
  emit('update:modelValue', null)
  publishSelection()
  if (sector.value) await query({ sector: sector.value })
}

async function changeUnit(): Promise<void> {
  customer.value = ''
  customers.value = []
  opportunities.value = []
  emit('update:modelValue', null)
  publishSelection()
  if (sector.value && unit.value) await query({ sector: sector.value, unit: unit.value })
}

async function changeCustomer(): Promise<void> {
  opportunities.value = []
  emit('update:modelValue', null)
  publishSelection()
  if (sector.value && unit.value && customer.value) {
    await query({ sector: sector.value, unit: unit.value, customer: customer.value })
  }
}

async function searchByBusinessId(): Promise<void> {
  const id = businessId.value.trim()
  const q = textSearch.value.trim()
  if (!id && q.length < 3) {
    error.value = 'Introduce un Business Opportunity ID o al menos 3 caracteres de búsqueda.'
    return
  }
  emit('update:modelValue', null)
  publishSelection()
  await query(id ? { businessId: id } : { q })
}

function changeMode(next: 'filters' | 'businessId'): void {
  mode.value = next
  opportunities.value = []
  error.value = null
  emit('update:modelValue', null)
  publishSelection()
}

watch(() => props.modelValue, (value) => {
  if (!value) return
  if (!opportunities.value.some((item) => item.opportunityId === value.opportunityId)) {
    opportunities.value = [value, ...opportunities.value]
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-950">
      <button type="button" class="rounded-lg px-3.5 py-2 text-sm font-bold transition" :class="mode === 'filters' ? 'bg-white text-[#0b2f55] shadow-sm dark:bg-slate-800 dark:text-blue-200' : 'text-slate-500 dark:text-slate-400'" :disabled="disabled" @click="changeMode('filters')">Por filtros</button>
      <button type="button" class="rounded-lg px-3.5 py-2 text-sm font-bold transition" :class="mode === 'businessId' ? 'bg-white text-[#0b2f55] shadow-sm dark:bg-slate-800 dark:text-blue-200' : 'text-slate-500 dark:text-slate-400'" :disabled="disabled" @click="changeMode('businessId')">Por Business Opportunity ID</button>
    </div>

    <div v-if="mode === 'filters'" class="grid gap-4 md:grid-cols-3">
      <div>
        <label class="field-label" for="op-sector">Sector</label>
        <select id="op-sector" v-model="sector" class="form-control" :disabled="disabled || loading" @change="changeSector">
          <option value="">Selecciona sector</option>
          <option v-for="item in sectors" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </div>
      <div>
        <label class="field-label" for="op-unit">Unidad</label>
        <select id="op-unit" v-model="unit" class="form-control" :disabled="disabled || loading || !sector" @change="changeUnit">
          <option value="">Selecciona unidad</option>
          <option v-for="item in units" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </div>
      <div>
        <label class="field-label" for="op-customer">Cliente</label>
        <select id="op-customer" v-model="customer" class="form-control" :disabled="disabled || loading || !unit" @change="changeCustomer">
          <option value="">Selecciona cliente</option>
          <option v-for="item in customers" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </div>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <div>
        <label class="field-label" for="business-id">Business Opportunity ID</label>
        <input id="business-id" v-model="businessId" class="form-control" placeholder="Ej. OPP-123456" :disabled="disabled || loading" @keyup.enter="searchByBusinessId" />
      </div>
      <div>
        <label class="field-label" for="op-query">O buscar por texto</label>
        <input id="op-query" v-model="textSearch" class="form-control" placeholder="Título, cliente u Opportunity ID" :disabled="disabled || loading" @keyup.enter="searchByBusinessId" />
      </div>
      <button type="button" class="btn-secondary" :disabled="disabled || loading" @click="searchByBusinessId">
        <svg viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        Buscar
      </button>
    </div>

    <div>
      <label class="field-label" for="opportunity-result">Oportunidad seleccionada</label>
      <select id="opportunity-result" v-model="selectedId" class="form-control" :disabled="disabled || loading || opportunities.length === 0">
        <option value="">{{ loading ? 'Buscando...' : opportunities.length ? 'Selecciona una oportunidad' : 'Sin resultados cargados' }}</option>
        <option v-for="item in opportunities" :key="item.opportunityId" :value="item.opportunityId">{{ item.label }}</option>
      </select>
      <p class="field-help">{{ hint }}</p>
      <p v-if="error" class="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-if="modelValue" class="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="font-extrabold text-slate-900 dark:text-white">{{ modelValue.title }}</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ modelValue.opportunityId }}<span v-if="modelValue.businessOpportunityId"> · {{ modelValue.businessOpportunityId }}</span></p>
        </div>
        <span class="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300">{{ modelValue.customer || 'Sin cliente' }}</span>
      </div>
    </div>
  </div>
</template>

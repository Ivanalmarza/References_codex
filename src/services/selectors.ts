import { getApi } from './api'
import type { Option } from './types'

/**
 * Options for the main generator form. Populated server-side (mirrors the
 * form.io `onInitPopulateFormStructure` fed by "Update main form selectors").
 */
export interface Selectors {
  unidadesProcesado: Option[]
  proyectosProcesado: Option[]
  plantillas: Option[]
  sectorOutputFormats: Option[]
  idiomas: Option[]
  unidadesOportunidad: Option[]
  oportunidades: Option[]
  models: Option[]
  reasoningLevels: Option[]
}

const EMPTY: Selectors = {
  unidadesProcesado: [],
  proyectosProcesado: [],
  plantillas: [],
  sectorOutputFormats: [],
  idiomas: [],
  unidadesOportunidad: [],
  oportunidades: [],
  models: [],
  reasoningLevels: [],
}

export interface SelectorsQuery {
  unidad?: string
  unidadOportunidad?: string
}

export async function getSelectors(params?: SelectorsQuery): Promise<Selectors> {
  const { data } = await getApi().get<Partial<Selectors>>('/api/selectors', { params })
  return { ...EMPTY, ...data }
}

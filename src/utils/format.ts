export function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes || 0)
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  const amount = value / 1024 ** index
  return `${amount.toFixed(index === 0 ? 0 : amount >= 10 ? 1 : 2)} ${units[index]}`
}

export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)
}

export function formatDurationSeconds(value: unknown): string {
  const total = Number(value)
  if (!Number.isFinite(total) || total < 0) return '—'
  if (total < 60) return `${Math.round(total)} s`
  const minutes = Math.floor(total / 60)
  const seconds = Math.round(total % 60)
  if (minutes < 60) return `${minutes} min ${seconds} s`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}

export function sourceLabel(value: string): string {
  const labels: Record<string, string> = {
    processed: 'Proyecto procesado',
    opportunity: 'Oportunidad MANA',
    uploads: 'Archivos propios',
    mixed: 'Fuentes combinadas',
  }
  return labels[value] || value || 'Sin fuente'
}

export function outputFormatLabel(value: string): string {
  const labels: Record<string, string> = {
    general: 'General',
    sector_publico: 'Sector público',
    sector_privado: 'Sector privado',
  }
  return labels[value] || value || 'General'
}

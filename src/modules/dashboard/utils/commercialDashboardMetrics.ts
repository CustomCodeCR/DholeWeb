/** Filtros comerciales expresados en fechas locales del navegador (sin cortes UTC). */
export function isInDashboardDateRange(
  value: string | number | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!from && !to) return true
  if (value == null || value === '') return false
  let day: string
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    day = value
  } else {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return false
    day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  }
  return (!from || day >= from) && (!to || day <= to)
}

/** Un vencimiento resta progreso; el resultado puede ser negativo. */
export function commercialPerformancePercent(quoted: number, open: number, accepted: number, expired: number): number {
  return quoted > 0 ? ((open + accepted - expired) * 100) / quoted : 0
}

/**
 * Presentation labels only. Backend owns case, department and origin transitions.
 * Do not treat DRAFT as an operative stage or publish origin statuses to clients.
 */
const originLabels: Record<string, string> = {
  ORIGIN_COORDINATION: 'Coordinación en Origen',
  CARGO_PICKUP: 'Recolecta de carga',
  ORIGIN_WAREHOUSE: 'Carga en WHS de origen',
  BOOKING_READY: 'Booking listo',
  PORT_OF_LOADING: 'Carga en puerto de salida',
  PREPARING_DISPATCH: 'Preparando envío',
  DEPARTURE_AIRPORT: 'Carga en aeropuerto de salida',
  IN_TRANSIT: 'En tránsito',
}
const stageLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  READY: 'Listo para iniciar',
  IN_PROGRESS: 'En proceso',
  ON_HOLD: 'En espera',
  COMPLETED: 'Completado',
  SKIPPED: 'No aplica',
}
const apertureLabels: Record<string, string> = {
  DRAFT: 'Apertura por completar',
  PENDING_VALIDATION: 'Pendiente de validación',
  APERTURA_REQUIERE_CAMBIOS: 'Requiere correcciones',
  APERTURA_VALIDADA: 'Apertura validada',
}
export function operationsLabel(value: string | null | undefined): string {
  if (!value) return 'Pendiente'
  return originLabels[value] ?? stageLabels[value] ??
    apertureLabels[value] ?? value.replaceAll('_', ' ')
}
export function departmentStatusLabel(
  departmentCode: string | null | undefined,
  departmentStatus: string | null | undefined,
  caseStatus: string | null | undefined,
  originStatusCode?: string | null,
): string {
  if (departmentCode === 'COORDINACION_ORIGEN' && originStatusCode)
    return operationsLabel(originStatusCode)
  if (departmentCode === 'APERTURAS' && caseStatus && apertureLabels[caseStatus])
    return apertureLabels[caseStatus]
  return operationsLabel(departmentStatus || caseStatus)
}

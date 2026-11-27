import type { OperationsAudit } from '../services/operationsApi'

type Snapshot = Record<string, unknown>
export type AuditChange = { field: string; before: unknown; after: unknown }
export type Translate = (key: string, params?: Record<string, string | number>) => string

const actionKeys: Record<string, string> = {
  'operations.team.catalog.created': 'teamCreated',
  'operations.team.created': 'teamCreated',
  'operations.assignment-rule.catalog.created': 'ruleCreated',
  'operations.assignment-rule.created': 'ruleCreated',
  'operations.team.member.added': 'memberAdded',
  'operations.team.member.updated': 'memberUpdated',
  'operations.team.member.removed': 'memberRemoved',
  'operations.team.active.changed': 'teamActive',
  'operations.aperture.validation.assigned': 'reviewersAssigned',
  'operations.aperture.validation.reviewed': 'reviewerDecision',
}

const departmentKeys = new Set([
  'APERTURAS', 'COORDINACION_ORIGEN', 'DOCUMENTACION', 'TRANSITO',
  'PANAMA', 'COSTA_RICA', 'FINANZAS',
])

const teamNameKeys: Record<string, string> = {
  Aperturas: 'aperture',
  'Origen · Estados Unidos': 'usa',
  'Origen · FCL internacional': 'fcl',
  'Origen · LCL y Aéreo internacional': 'lclAir',
  'Origen · Transporte terrestre': 'land',
  Documentación: 'documents',
  Tránsito: 'transit',
  'Operaciones Panamá': 'panama',
  'Operaciones Costa Rica': 'costaRica',
  Finanzas: 'finance',
}

const technicalKeys = new Set([
  'id', 'companyid', 'teamid', 'userid', 'caseid', 'stageid',
  'validationid', 'eventid', 'actoruserid', 'quoteid', 'acceptedoptionid', 'sourceeventid', 'sourcequoteid', 'sourcequoteoptionid',
])

const fieldKeys: Record<string, string> = {
  name: 'name', departmentcode: 'department', department: 'department',
  priority: 'priority', capacitypoints: 'capacity', isavailable: 'availability',
  issupervisor: 'supervisor', rolecode: 'supervisor', isactive: 'active', origincountrycode: 'origin',
  destinationcountrycode: 'destination', modalitycode: 'modality',
  modalities: 'modalities', slot: 'reviewer', slots: 'reviewers',
  status: 'status', decision: 'decision', bothapproved: 'bothApproved',
}

function parseSnapshot(json: string | null | undefined): Snapshot {
  if (!json) return {}
  try {
    const parsed: unknown = JSON.parse(json)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
      return parsed as Snapshot
  } catch {
    // Old or malformed audit payloads must not break the screen.
  }
  return {}
}

export function auditActionKey(code: string): string {
  return actionKeys[code] ?? 'generic'
}

export function auditCategoryKey(code: string): string {
  if (code.includes('assignment-rule')) return 'rules'
  if (code.includes('team')) return 'teams'
  if (code.includes('aperture') || code.includes('validation')) return 'openings'
  return 'cases'
}

export function auditSnapshot(event: OperationsAudit): { before: Snapshot; after: Snapshot } {
  return { before: parseSnapshot(event.beforeJson), after: parseSnapshot(event.afterJson) }
}

function normalized(snapshot: Snapshot): Map<string, { field: string; value: unknown }> {
  const fields = new Map<string, { field: string; value: unknown }>()
  for (const [field, value] of Object.entries(snapshot)) {
    const key = field.toLowerCase()
    if (!technicalKeys.has(key) && !/(?:id|ids|uuid|uuids)$/.test(key)) fields.set(key, { field, value })
  }
  return fields
}

export function auditChanges(event: OperationsAudit): AuditChange[] {
  const snapshots = auditSnapshot(event)
  const before = normalized(snapshots.before)
  const after = normalized(snapshots.after)
  const keys = new Set([...before.keys(), ...after.keys()])
  return [...keys].filter(key => JSON.stringify(before.get(key)?.value) !== JSON.stringify(after.get(key)?.value))
    .map(key => ({
      field: after.get(key)?.field ?? before.get(key)?.field ?? key,
      before: before.get(key)?.value ?? null,
      after: after.get(key)?.value ?? null,
    }))
}

export function auditFieldLabel(field: string, translate: Translate): string {
  const key = fieldKeys[field.toLowerCase()]
  if (key) return translate('operations.auditTimeline.fields.' + key)
  const readableLabels: Record<string,string> = { idtra: 'IDTRA', costs: 'Rubros cotizados', projectedcosts: 'Rubros registrados', costspendingreconciliation: 'Rubros por conciliar', services: 'Servicios', equipment: 'Equipos', commercialrevision: 'Revisión comercial', assignmentsource: 'Origen de la asignación' }
  if (readableLabels[field.toLowerCase()]) return readableLabels[field.toLowerCase()]!
  return field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
}

function get(snapshot: Snapshot, field: string): unknown {
  return Object.entries(snapshot).find(([key]) => key.toLowerCase() === field.toLowerCase())?.[1]
}

function namedTeam(value: string, translate: Translate): string {
  const key = teamNameKeys[value]
  return key ? translate('operations.catalog.' + key) : value
}

export function auditValue(value: unknown, field: string, translate: Translate): string {
  if (value === null || value === undefined || value === '') return '—'
  const key = field.toLowerCase()
  if (typeof value === 'boolean') {
    if (key === 'isavailable') return translate(value ? 'operations.available' : 'operations.unavailable')
    if (key === 'issupervisor') return translate(value ? 'operations.supervisor' : 'operations.operator')
    if (key === 'isactive') return translate(value ? 'operations.active' : 'operations.inactive')
    return translate(value ? 'operations.auditTimeline.yes' : 'operations.auditTimeline.no')
  }
  if (Array.isArray(value)) {
    if (value.every(item => typeof item === 'string' || typeof item === 'number'))
      return value.map(item => auditValue(item, key === 'modalities' ? 'modalityCode' : field, translate)).join(', ')
    return translate('operations.auditTimeline.peopleCount', { count: value.length })
  }
  if (typeof value === 'object') return translate('operations.auditTimeline.structuredValue')
  const text = String(value)
  if (key === 'rolecode') return translate('operations.teamRoles.' + text)
  if (key === 'assignmentsource' && text === 'AutomaticPool') return 'Pool automático'
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) || /^[A-Z][A-Z0-9]+-\d{4}-\d+$/i.test(text)) return 'Referencia interna'
  if (key === 'name') return namedTeam(text, translate)
  if (key === 'departmentcode' || key === 'department') {
    if (departmentKeys.has(text)) return translate('operations.departments.' + text)
  }
  if (key === 'origincountrycode' || key === 'destinationcountrycode') {
    if (['US', 'CR', 'PA'].includes(text))
      return translate('operations.auditTimeline.countries.' + text)
  }
  if (key === 'modalitycode' || key === 'modalities') {
    const modalities: Record<string, string> = { FCL: 'FCL', LCL: 'LCL', AIR: 'air', FTL: 'FTL', LTL: 'LTL' }
    if (modalities[text] === 'air') return translate('operations.auditTimeline.air')
    if (modalities[text]) return modalities[text]
  }
  if (key === 'decision' || key === 'status') {
    if (['APPROVED', 'REJECTED', 'PENDING'].includes(text))
      return translate('operations.auditTimeline.decisions.' + text)
  }
  return text.length > 120 ? text.slice(0, 117) + '…' : text
}

export function auditPreview(
  event: OperationsAudit,
  translate: Translate,
  userName?: (userId: string) => string | undefined,
): string {
  const { before, after } = auditSnapshot(event)
  const action = auditActionKey(event.actionCode)
  const name = get(after, 'name') ?? get(before, 'name')
  if (action === 'teamCreated' && typeof name === 'string')
    return translate('operations.auditTimeline.previews.teamCreated', { name: namedTeam(name, translate) })

  if (action === 'memberAdded' || action === 'memberUpdated' || action === 'memberRemoved') {
    const id = get(after, 'userId') ?? get(before, 'userId')
    const employee = typeof id === 'string' ? userName?.(id) : undefined
    if (employee) return translate('operations.auditTimeline.previews.' + action, { name: employee })
  }

  if (action === 'teamActive') {
    const value = get(after, 'isActive')
    if (typeof value === 'boolean')
      return translate('operations.auditTimeline.previews.' + (value ? 'activated' : 'deactivated'))
  }

  if (action === 'reviewersAssigned') {
    const slots = get(after, 'slots')
    if (Array.isArray(slots))
      return translate('operations.auditTimeline.previews.reviewersAssigned', { count: slots.length })
  }
  if (action === 'reviewerDecision') {
    const decision = get(after, 'decision')
    if (decision === 'APPROVED') return translate('operations.auditTimeline.previews.approved')
    if (decision === 'REJECTED') return translate('operations.auditTimeline.previews.rejected')
  }
  return translate('operations.auditTimeline.previews.' + action)
}

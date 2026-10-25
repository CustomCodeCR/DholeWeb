import { toUtc } from '../services/crmApi'

export type CrmSection =
  | 'dashboard' | 'accounts' | 'leads' | 'opportunities' | 'activities'
  | 'followups' | 'analyses' | 'finance' | 'settings'

export type CrmFieldType = 'text' | 'email' | 'number' | 'datetime-local' | 'select' | 'textarea' | 'checkbox'
export interface CrmField {
  key: string
  label: string
  type: CrmFieldType
  required?: boolean
  options?: { value: string; label: string }[]
}
export interface CrmModule {
  section: CrmSection
  resource: string
  title: string
  readScope: string
  createScope?: string
  updateScope?: string
  fields: CrmField[]
  primary: string
  secondary: string
}
const field = (key: string, label: string, type: CrmFieldType = 'text',
  required = false, options?: CrmField['options']): CrmField =>
  ({ key, label, type, required, options })
const select = (key: string, label: string, values: string[]) =>
  field(key, label, 'select', true, values.map(value => ({ value, label: value })))

export const CRM_MODULES: Record<string, CrmModule> = {
  accounts: {
    section: 'accounts', resource: 'accounts', title: 'Cuentas y clientes',
    readScope: 'crm.account.read', createScope: 'crm.account.create',
    updateScope: 'crm.account.update', primary: 'displayName', secondary: 'legalName',
    fields: [
      field('displayName', 'Nombre comercial', 'text', true),
      field('legalName', 'Razón social', 'text', true),
      field('countryId', 'ID del país (Config)'),
      field('taxIdTypeCode', 'Tipo de identificación'),
      field('taxId', 'Identificación fiscal (texto)'),
      select('customerTypeCode', 'Tipo de cliente', ['cash', 'credit']),
      select('categoryType', 'Categoría de cuenta', ['CUSTOMER', 'NVOCC']),
      field('categoryCode', 'Código categoría', 'text', true),
      field('sourceCode', 'Origen'),
      field('relationshipTypeCode', 'Relación comercial'),
    ],
  },
  leads: {
    section: 'leads', resource: 'leads', title: 'Prospectos',
    readScope: 'crm.lead.read', createScope: 'crm.lead.create',
    updateScope: 'crm.lead.update', primary: 'name', secondary: 'companyName',
    fields: [
      field('name', 'Prospecto', 'text', true), field('companyName', 'Empresa'),
      field('countryId', 'ID del país (Config)'), field('taxId', 'Identificación fiscal (texto)'),
      field('contactEmail', 'Correo', 'email'), field('phone', 'Teléfono'),
      field('sourceCode', 'Origen'), field('relationshipTypeCode', 'Relación comercial'),
    ],
  },
  opportunities: {
    section: 'opportunities', resource: 'opportunities', title: 'Oportunidades y pipeline',
    readScope: 'crm.opportunity.read', createScope: 'crm.opportunity.create',
    updateScope: 'crm.opportunity.update', primary: 'title', secondary: 'status',
    fields: [
      field('title', 'Oportunidad', 'text', true),
      field('accountId', 'ID de cuenta'),
      field('leadId', 'ID de prospecto'),
      field('description', 'Descripción', 'textarea'),
      field('amountEstimated', 'Monto estimado', 'number', true),
      field('currencyCode', 'Código moneda (Config)', 'text', true),
      field('expectedCloseAt', 'Cierre estimado', 'datetime-local'),
    ],
  },
  activities: {
    section: 'activities', resource: 'activities', title: 'Actividades y visitas',
    readScope: 'crm.activity.read', createScope: 'crm.activity.create',
    updateScope: 'crm.activity.update', primary: 'subject', secondary: 'type',
    fields: [
      field('subject', 'Actividad', 'text', true),
      select('type', 'Tipo', ['VISIT', 'CALL', 'EMAIL', 'MEETING', 'OTHER']),
      field('accountId', 'ID cuenta'), field('leadId', 'ID prospecto'),
      field('opportunityId', 'ID oportunidad'), field('contactId', 'ID contacto'),
      field('scheduledStartAt', 'Inicio', 'datetime-local'),
      field('scheduledEndAt', 'Fin', 'datetime-local'),
      field('locationText', 'Ubicación'),
    ],
  },
  followups: {
    section: 'followups', resource: 'followups', title: 'Agenda y seguimientos',
    readScope: 'crm.task.manage', createScope: 'crm.followup.manage',
    updateScope: 'crm.task.manage', primary: 'channel', secondary: 'status',
    fields: [
      field('accountId', 'ID de cuenta'), field('leadId', 'ID de prospecto'),
      field('opportunityId', 'ID de oportunidad'),
      select('channel', 'Canal', ['EMAIL', 'SYSTEM']),
      field('dueAt', 'Próximo seguimiento', 'datetime-local', true),
    ],
  },
  analyses: {
    section: 'analyses', resource: 'analyses', title: 'Análisis comercial',
    readScope: 'crm.analysis.read', createScope: 'crm.analysis.manage',
    updateScope: 'crm.analysis.manage', primary: 'marketCode', secondary: 'observations',
    fields: [
      field('accountId', 'ID de cuenta'), field('leadId', 'ID de prospecto'),
      field('opportunityId', 'ID de oportunidad'),
      field('marketCode', 'Código de mercado (Config)', 'text', true),
      field('customsNationalizationRequired', 'Requiere nacionalización', 'checkbox'),
      field('observations', 'Observaciones', 'textarea'),
      field('estimatedMonthlyVolume', 'Volumen mensual', 'number'),
      select('volumeUnit', 'Unidad', ['CBM', 'CFT', 'KG', 'LB', 'TEU']),
    ],
  },
  settings: {
    section: 'settings', resource: 'pipelines', title: 'Administración de pipeline',
    readScope: 'crm.settings.manage', createScope: 'crm.settings.manage',
    updateScope: 'crm.settings.manage', primary: 'name', secondary: 'sortOrder',
    fields: [field('name', 'Nombre', 'text', true), field('sortOrder', 'Orden', 'number', true),
      field('isDefault', 'Pipeline predeterminado', 'checkbox')],
  },
}
export const crmSectionScope: Record<CrmSection, string[]> = {
  dashboard: ['crm.account.read', 'crm.lead.read', 'crm.opportunity.read', 'crm.activity.read'],
  accounts: ['crm.account.read', 'crm.account.read-all'],
  leads: ['crm.lead.read', 'crm.lead.read-all'],
  opportunities: ['crm.opportunity.read', 'crm.opportunity.read-all'],
  activities: ['crm.activity.read', 'crm.activity.read-all'],
  followups: ['crm.task.manage', 'crm.followup.manage'],
  analyses: ['crm.analysis.read', 'crm.analysis.manage'],
  finance: ['crm.credit.read', 'crm.contract.read'],
  settings: ['crm.settings.manage'],
}
export function crmDefaults(section: string): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const f of CRM_MODULES[section]?.fields ?? []) {
    defaults[f.key] = f.type === 'checkbox' ? false : f.type === 'number' ? 0 : ''
  }
  if (section === 'accounts') Object.assign(defaults, { customerTypeCode: 'cash', categoryType: 'CUSTOMER', categoryCode: 'A' })
  if (section === 'opportunities') Object.assign(defaults, { currencyCode: 'USD' })
  if (section === 'analyses') Object.assign(defaults, { marketCode: 'OTHER', volumeUnit: 'CBM' })
  if (section === 'activities') Object.assign(defaults, { type: 'CALL' })
  if (section === 'followups') Object.assign(defaults, { channel: 'SYSTEM' })
  return defaults
}
export function crmPayload(section: string, values: Record<string, unknown>,
  current?: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  const keys = CRM_MODULES[section]?.fields ?? []
  for (const f of keys) {
    // Omit immutable identities on PATCH; the endpoint contracts do not accept those fields.
    if (current && ['accountId', 'leadId', 'opportunityId', 'countryId', 'taxId', 'taxIdTypeCode',
      'categoryType', 'categoryCode', 'type'].includes(f.key)) continue
    const v = values[f.key]
    result[f.key] = f.type === 'datetime-local' ? toUtc(String(v ?? '')) :
      f.type === 'number' ? Number(v ?? 0) :
      f.type === 'checkbox' ? Boolean(v) : typeof v === 'string' ? v.trim() || null : v
  }
  if (current) {
    result.expectedVersion = Number(current.rowVersion)
    if (section === 'leads') result.qualificationStatus = current.qualificationStatus || 'New'
    if (section === 'analyses') result.reviewedAt = current.reviewedAt ?? null
    if (section === 'settings') result.isActive = current.isActive ?? true
  } else {
    // Every CRM API validates actual subject ownership and the authenticated actor.
    if (section === 'opportunities') { result.pipelineId = null; result.stageId = null; result.executiveUserId = null }
    if (section === 'analyses') result.ownerUserId = null
    if (section === 'activities') { result.ownerUserId = null; result.occurredAt = null }
    if (section === 'accounts' || section === 'leads') result.executiveUserId = null
    if (section === 'followups') result.assignedUserId = values.assignedUserId || null
  }
  return result
}

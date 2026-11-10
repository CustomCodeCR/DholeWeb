export interface CrmAgendaIdentityLabels {
  accounts: Record<string, string>
  leads: Record<string, string>
  owners: Record<string, string>
}
export interface CrmAgendaIdentityRecord {
  accountId?: unknown
  leadId?: unknown
  assignedUserId?: unknown
  ownerUserId?: unknown
  _crmResource?: unknown
}
const id = (value: unknown) => typeof value === 'string' ? value.trim() : ''
export function crmAgendaOwnerId(row: CrmAgendaIdentityRecord) {
  return id(row._crmResource === 'followups' ? row.assignedUserId : row.ownerUserId)
}
export function crmAgendaIdentityIds(rows: readonly CrmAgendaIdentityRecord[]) {
  return {
    accounts: [...new Set(rows.map(row => id(row.accountId)).filter(Boolean))],
    leads: [...new Set(rows.map(row => id(row.leadId)).filter(Boolean))],
    owners: [...new Set(rows.map(crmAgendaOwnerId).filter(Boolean))],
  }
}
export function crmAgendaClientName(row: CrmAgendaIdentityRecord, labels: CrmAgendaIdentityLabels) {
  const accountId = id(row.accountId)
  if (accountId) return labels.accounts[accountId] || 'Cliente no disponible'
  const leadId = id(row.leadId)
  if (leadId) return labels.leads[leadId] || 'Prospecto no disponible'
  return 'Sin cliente vinculado'
}
export function crmAgendaExecutiveName(row: CrmAgendaIdentityRecord, labels: CrmAgendaIdentityLabels, me = '') {
  const ownerId = crmAgendaOwnerId(row)
  if (!ownerId) return 'Sin asignar'
  return labels.owners[ownerId] || (ownerId === me ? 'Mi usuario' : 'Ejecutivo no disponible')
}

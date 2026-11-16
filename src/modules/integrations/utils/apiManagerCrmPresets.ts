/**
 * Pure mapping of permission-filtered CRM data into the fixed fields of a
 * third-party Pricing rate-request contract. Castro Fallas is an institutional
 * display identity, NOT an invented Auth user or bypass for Pricing permissions.
 */
export type CrmAccount = {
  id: string
  displayName: string
  executiveUserId?: string | null
  isCastroFallasExecutive?: boolean
}
export type CrmLead = {
  id: string
  name: string
  companyName?: string | null
  executiveUserId?: string | null
  isCastroFallasExecutive?: boolean
  convertedAt?: string | null
}
export type AssignedCrmExecutive = {
  displayName?: string | null
  institutional?: boolean
}
export type CommercialPreset = {
  clientName: string
  sellerUserId: string
  executiveName: string
}

const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const unassigned = new Set(['Sin asignar', 'Vendedor no disponible'])

function accountableSellerId(value?: string | null): string {
  if (!value || !validUuid.test(value) || value.toLowerCase() === '00000000-0000-0000-0000-000000000000') {
    throw new Error('La ficha de CRM no tiene un usuario responsable válido para Pricing.')
  }
  return value
}

function verifiedExecutive(name: string | null | undefined, isHouse: boolean): string {
  const displayName = name?.trim() ?? ''
  if (isHouse) {
    if (displayName !== 'Castro Fallas') {
      throw new Error('CRM no confirmó la asignación del ejecutivo institucional Castro Fallas.')
    }
    return 'Castro Fallas'
  }
  if (!displayName || unassigned.has(displayName)) {
    throw new Error('CRM no tiene un ejecutivo de ventas activo para este registro.')
  }
  return displayName
}

export function accountCommercialPreset(account: CrmAccount, assigned: AssignedCrmExecutive): CommercialPreset {
  const clientName = account.displayName?.trim()
  if (!clientName) throw new Error('La cuenta seleccionada no tiene nombre comercial.')
  const house = account.isCastroFallasExecutive === true
  if (house !== (assigned.institutional === true)) {
    throw new Error('La asignación institucional cambió en CRM; actualizá la búsqueda.')
  }
  return {
    clientName,
    sellerUserId: accountableSellerId(account.executiveUserId),
    executiveName: verifiedExecutive(assigned.displayName, house),
  }
}

export function leadCommercialPreset(lead: CrmLead, assignedName: string | null | undefined): CommercialPreset {
  if (lead.convertedAt) throw new Error('Este prospecto ya fue convertido a cuenta. Seleccioná la cuenta de CRM.')
  const clientName = lead.companyName?.trim() || lead.name?.trim()
  if (!clientName) throw new Error('El prospecto no tiene nombre o razón social.')
  return {
    clientName,
    sellerUserId: accountableSellerId(lead.executiveUserId),
    executiveName: verifiedExecutive(assignedName, lead.isCastroFallasExecutive === true),
  }
}

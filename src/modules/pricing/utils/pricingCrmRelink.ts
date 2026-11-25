/** Recover a missing persisted CRM link only from a complete, unique, exact result. */
interface CrmRelinkOption {
  id: string
  kind: 'account' | 'lead'
  displayName: string
  legalName?: string | null
  executiveName: string
  executiveUserId: string
  isCastroFallasExecutive: boolean
}
const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
export function uniquePersistedCrmMatch<T extends CrmRelinkOption>(
  result: { items: T[]; total: number }, clientName: unknown, executiveName: unknown,
): T | undefined {
  const name = normalize(clientName)
  const owner = normalize(executiveName)
  if (!name || !owner || !Array.isArray(result.items) || result.total !== result.items.length) return
  const exact = result.items.filter(item => normalize(item.displayName) === name || normalize(item.legalName) === name)
  if (exact.length !== 1) return
  const match = exact[0]
  if (!match || !match.id || (match.kind !== 'account' && match.kind !== 'lead')) return
  const currentOwner = match.isCastroFallasExecutive ? 'castro fallas' : normalize(match.executiveName)
  if (currentOwner !== owner || currentOwner === 'vendedor no disponible') return
  if (!match.isCastroFallasExecutive && (!match.executiveUserId || match.executiveUserId === '00000000-0000-0000-0000-000000000000')) return
  return match
}

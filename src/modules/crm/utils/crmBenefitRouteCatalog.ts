import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'

// Same CY / SD / APT metadata and legacy-code fallback as Pricing's
// pricingWizardRouteTerminalTypes transform. POL and POE default to CY;
// POD defaults to SD for legacy Config records.
export type BenefitMode = 'FCL' | 'LCL' | 'FTL' | 'LTL' | 'AIR'
export type RouteRole = 'pol' | 'poe' | 'pod'
export type TerminalType = 'CY' | 'SD' | 'APT'

export function terminalForBenefitMode(mode: BenefitMode): TerminalType {
  return mode === 'AIR' ? 'APT' : mode === 'FTL' || mode === 'LTL' ? 'SD' : 'CY'
}
export function benefitUsesPod(mode: BenefitMode): boolean {
  return mode === 'FCL' || mode === 'LCL'
}
export function routeTerminalType(item: Pick<CatalogItemSelectDto, 'code' | 'metadataJson'>,
  fallback: TerminalType): TerminalType {
  if (item.metadataJson) {
    try {
      const meta = JSON.parse(item.metadataJson) as Record<string, unknown>
      const configured = String(meta.terminalType ?? '').trim().toUpperCase()
      if (configured === 'CY' || configured === 'SD' || configured === 'APT')
        return configured
    } catch { /* Older Config entries without structured metadata use code fallback. */ }
  }
  const code = String(item.code ?? '').trim().toUpperCase()
  for (const type of ['CY', 'SD', 'APT'] as const) {
    if (code.startsWith(type + '_') || code.endsWith('_' + type) || code.includes('_' + type + '_'))
      return type
  }
  return fallback
}
export function isCompatibleBenefitLocation(item: Pick<CatalogItemSelectDto, 'code' | 'metadataJson'>,
  mode: BenefitMode, role: RouteRole): boolean {
  if (role === 'pod' && !benefitUsesPod(mode)) return false
  const expected = role === 'pod' ? 'SD' : terminalForBenefitMode(mode)
  const legacyDefault: TerminalType = role === 'pod' ? 'SD' : 'CY'
  return routeTerminalType(item, legacyDefault) === expected
}

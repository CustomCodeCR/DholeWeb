import type { RateOperationType } from '@/core/interfaces/pricing'

const ICC_INCOTERM_CODES = new Set([
  'EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP',
])

/** Resolve an ICC term from Config codes or labels without treating opaque IDs
 * (e.g. INC-2026-005) as Incoterms and without matching partial words. */
export function normalizeIncotermCode(code?: string | null, displayName?: string | null): string {
  for (const candidate of [code, displayName]) {
    const value = String(candidate ?? '').trim().toUpperCase()
    if (ICC_INCOTERM_CODES.has(value)) return value
    const match = value.match(/(?:^|[^A-Z])(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)(?=$|[^A-Z])/)
    if (match) return match[1]!
  }
  return String(code || displayName || '').trim().toUpperCase()
}

export type InlandBillingParty = 'Exporter' | 'Importer' | 'Both' | 'ByAgreement'

/**
 * ICC Incoterms retain their meaning in all trade directions:
 * EXW = buyer normally arranges collection; DDP = seller delivers duty paid.
 * A change in the party for whom Dhole prepares the quotation changes the
 * client's cost exposure, NOT the underlying contractual Incoterm.
 */
export function inlandBillingParty(
  operation: RateOperationType,
  incoterm: string,
): InlandBillingParty {
  if (operation === 'TransitDomestic') return 'Both' // Hybrid; each stop can override.
  const code = incoterm.trim().toUpperCase()
  if (code === 'EXW') return 'Importer'
  if (code === 'DDP') return 'Exporter'
  return 'ByAgreement' // Never infer responsibility from a partial transport leg.
}

export function incotermOperationExplanation(
  operation: RateOperationType,
  incoterm: string,
): string {
  const code = incoterm.trim().toUpperCase()
  if (operation === 'TransitDomestic') {
    return 'Tránsito / doméstico: operación híbrida. Asigne el responsable de cada tramo y punto; el Incoterm no cambia de significado.'
  }
  if (operation === 'Import' && code === 'EXW')
    return 'Importación EXW: el importador/comprador normalmente contrata transporte y recolección desde origen.'
  if (operation === 'Export' && code === 'DDP')
    return 'Exportación DDP: el exportador/vendedor normalmente asume entrega y despacho hasta el destino pactado.'
  if (code === 'EXW')
    return 'EXW: el comprador normalmente contrata la recolección. Cotizar como exportación no cambia esa obligación.'
  if (code === 'DDP')
    return 'DDP: el vendedor normalmente asume la entrega. Cotizar como importación no cambia esa obligación.'
  return 'La operación define la perspectiva comercial; distribuya los cargos según el Incoterm pactado y el tramo contratado.'
}

export type IncotermCostSection =
  | 'pickup_origin' | 'origin_charges' | 'international_freight'
  | 'destination_charges' | 'delivery_destination'
const SECTIONS: IncotermCostSection[] = [
  'pickup_origin', 'origin_charges', 'international_freight',
  'destination_charges', 'delivery_destination',
]
const BUYER_SECTIONS: Record<string, IncotermCostSection[]> = {
  EXW: SECTIONS,
  FCA: ['international_freight', 'destination_charges', 'delivery_destination'],
  FAS: ['international_freight', 'destination_charges', 'delivery_destination'],
  FOB: ['international_freight', 'destination_charges', 'delivery_destination'],
  CFR: ['destination_charges', 'delivery_destination'],
  CIF: ['destination_charges', 'delivery_destination'],
  CPT: ['destination_charges', 'delivery_destination'],
  CIP: ['destination_charges', 'delivery_destination'],
  DAP: ['destination_charges'], // Import clearance/duties remain buyer obligations.
  DPU: ['destination_charges'],
  DDP: [],
}

/** Cost sections for the party being quoted, not a renamed or inverted Incoterm. */
export function incotermClientSections(
  operation: RateOperationType,
  code: string,
  fallback: IncotermCostSection[] = ['international_freight'],
): IncotermCostSection[] {
  if (operation === 'TransitDomestic') return [...SECTIONS] // Hybrid, manually split costs.
  const buyerSections = BUYER_SECTIONS[normalizeIncotermCode(code)] ?? fallback
  if (operation === 'Import') return [...buyerSections]
  return SECTIONS.filter(section => !buyerSections.includes(section))
}

export function incotermClientPaysMainTransport(
  operation: RateOperationType,
  code: string,
): boolean {
  return incotermClientSections(operation, code).includes('international_freight')
}

/**
 * Visual indicator only. The Incoterm describes the usual contractual party
 * paying a block, not which services Dhole may contract or bill separately.
 * NEVER use this value to hide/delete stored RateDetails or alter their amounts.
 */
export type IncotermSectionApplicability = 'client' | 'other-party' | 'mixed' | 'unknown'
type VisualSection = IncotermCostSection | 'agent' | 'insurance'
const VISUAL_SECTIONS: readonly IncotermCostSection[] = [
  'pickup_origin', 'origin_charges', 'international_freight',
  'destination_charges', 'delivery_destination',
]
// Per section in VISUAL_SECTIONS: B=buyer, S=seller, M=mixed by exact place/charge.
const CONTRACTUAL_PARTY: Record<string, string> = {
  EXW: 'BBBBB',
  FCA: 'MMBBB',
  FAS: 'SMBBB',
  FOB: 'SSBBB',
  CFR: 'SSSMB',
  CIF: 'SSSMB',
  CPT: 'SSSMM',
  CIP: 'SSSMM',
  DAP: 'SSSMS',
  DPU: 'SSSMS',
  DDP: 'SSSSS',
}

export function incotermSectionApplicability(
  operation: RateOperationType,
  incoterm: string,
  section: VisualSection,
): IncotermSectionApplicability {
  if (operation !== 'Import' && operation !== 'Export') return 'unknown'
  const term = normalizeIncotermCode(incoterm)
  const mapping = CONTRACTUAL_PARTY[term]
  if (!mapping || section === 'agent') return 'unknown'
  // Insurance stays optional in other terms; under CIF/CIP the seller must
  // document coverage, but the importer must not be billed a second premium.
  if (section === 'insurance') {
    if (term !== 'CIF' && term !== 'CIP') return 'mixed'
    return operation === 'Export' ? 'client' : 'other-party'
  }
  const index = VISUAL_SECTIONS.indexOf(section)
  if (index < 0) return 'unknown'
  const party = mapping[index]
  if (party === 'M') return 'mixed'
  return party === (operation === 'Import' ? 'B' : 'S') ? 'client' : 'other-party'
}


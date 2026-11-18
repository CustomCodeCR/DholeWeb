import type { RateOperationType } from '@/core/interfaces/pricing'

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

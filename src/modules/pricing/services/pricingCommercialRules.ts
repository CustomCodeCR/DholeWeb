import { callEndpoint } from '@/core/api/callEndpoint'
import type { CostDetailType, CostType, ShipmentMode } from '@/core/interfaces/pricing'

export type PricingModality = 'Maritime' | 'Air' | 'Land' | 'Multimodal'
export type PricingRateSection =
  | 'pickup_origin'
  | 'origin_charges'
  | 'international_freight'
  | 'destination_charges'
  | 'delivery_destination'

export interface CommercialTermItem {
  id: string
  text: string
}

export interface CommercialTerms {
  includes: CommercialTermItem[]
  subjectTo: CommercialTermItem[]
  excludes: CommercialTermItem[]
}

export interface OperationalLineTemplate {
  name: string
  section: PricingRateSection
  costDetailType: CostDetailType
  costType: CostType
  costAmount: number
  saleAmount: number
  included: boolean
  optional: boolean
}

const ALL_SECTIONS: PricingRateSection[] = [
  'pickup_origin',
  'origin_charges',
  'international_freight',
  'destination_charges',
  'delivery_destination',
]

const INCOTERM_SECTIONS: Record<string, PricingRateSection[]> = {
  EXW: ALL_SECTIONS,
  FCA: ['origin_charges', 'international_freight', 'destination_charges', 'delivery_destination'],
  FAS: ['international_freight', 'destination_charges', 'delivery_destination'],
  FOB: ['international_freight', 'destination_charges', 'delivery_destination'],
  CFR: ['destination_charges', 'delivery_destination'],
  CIF: ['destination_charges', 'delivery_destination'],
  CPT: ['destination_charges', 'delivery_destination'],
  CIP: ['destination_charges', 'delivery_destination'],
  DAP: ['destination_charges'],
  DPU: ['destination_charges'],
  DDP: ['destination_charges'],
}

export function incotermRateSections(
  code?: string | null,
  fallback: PricingRateSection[] = ['international_freight'],
): PricingRateSection[] {
  const normalized = String(code ?? '').trim().toUpperCase()
  return INCOTERM_SECTIONS[normalized] ?? fallback
}

export function incotermBuyerPaysMainTransport(code?: string | null) {
  return incotermRateSections(code).includes('international_freight')
}

export function calculateCargoInsurance(fobValue: number, freightAmount: number) {
  const fob = Math.max(0, Number(fobValue) || 0)
  const freight = Math.max(0, Number(freightAmount) || 0)
  const insuredValue = (fob + freight) * 1.1
  const cost = Math.max(35, roundMoney(insuredValue * 0.002))
  const sale = Math.max(125, roundMoney(insuredValue * 0.0085))
  return { insuredValue: roundMoney(insuredValue), cost, sale }
}

export function cargoInsuranceNote(fobValue: number, freightAmount: number) {
  const calculated = calculateCargoInsurance(fobValue, freightAmount)
  return `Seguro de carga · valor FOB USD ${roundMoney(fobValue)} · flete USD ${roundMoney(freightAmount)} · valor asegurado 110% USD ${calculated.insuredValue} · tasa 0.85% · mínimo USD 125`
}

export async function resolveCommercialTerms(query: {
  transportModality: PricingModality
  shipmentMode: ShipmentMode
  direction: string
  incotermId: string
  serviceCodes: string[]
}): Promise<CommercialTerms> {
  const params = new URLSearchParams()
  params.set('transportModality', query.transportModality)
  params.set('shipmentMode', query.shipmentMode)
  params.set('direction', query.direction)
  params.set('incotermId', query.incotermId)
  if (query.serviceCodes.length) params.set('serviceCodes', query.serviceCodes.join(','))

  return callEndpoint<CommercialTerms>({
    method: 'GET',
    path: `/api/pricing/commercial-terms/resolve?${params.toString()}`,
    headers: { Accept: 'application/json' },
  })
}

export function buildOperationalLines(context: {
  modality: PricingModality
  shipmentMode: ShipmentMode
  direction: string
  incotermCode: string
  destinationText?: string | null
}): OperationalLineTemplate[] {
  const result: OperationalLineTemplate[] = []
  const seen = new Set<string>()
  const add = (
    name: string,
    section: PricingRateSection,
    costDetailType: CostDetailType,
    saleAmount = 0,
    costType: CostType = 'Variable',
    optional = false,
  ) => {
    const key = normalize(name)
    if (seen.has(key)) return
    seen.add(key)
    result.push({
      name,
      section,
      costDetailType,
      costType,
      costAmount: 0,
      saleAmount,
      included: !optional,
      optional,
    })
  }

  const incoterm = context.incotermCode.toUpperCase()
  const isImport = normalize(context.direction).includes('importacion')
  const isExport = normalize(context.direction).includes('exportacion')

  if (incoterm === 'EXW') {
    add('Recolección', 'pickup_origin', 'InlandTransport')
    add('Trámite de exportación', 'origin_charges', 'CustomsCharge')
    add('Cargos en origen', 'origin_charges', 'OriginCharge')

    if (isExport && context.modality === 'Maritime')
      add('Impuestos de exportación', 'origin_charges', 'OriginCharge', 3)
    if (isExport && context.modality === 'Land')
      add('Impuestos de exportación', 'origin_charges', 'OriginCharge', 28)
  }

  if (context.modality === 'Air' && incoterm === 'FCA')
    add('Cargos en origen de la línea aérea', 'origin_charges', 'OriginCharge')

  if (context.modality === 'Maritime') {
    if (context.shipmentMode === 'Lcl') {
      add('Manejos', 'international_freight', 'AgentCharge', 45)
      add('HBL', 'international_freight', 'Documentation', 40)
      if (isImport)
        add('Cargos en destino de la línea naviera', 'destination_charges', 'DestinationCharge')
    }

    if (context.shipmentMode === 'Fcl') {
      add('Manejos', 'international_freight', 'AgentCharge', 55)
      add('HBL', 'international_freight', 'Documentation', 40)
      if (isImport) {
        add('Cargos en destino de la línea naviera', 'destination_charges', 'DestinationCharge')
        add('THC / Destino', 'destination_charges', 'PortCharge')
        const destination = normalize(context.destinationText ?? '')
        if (destination.includes('caldera'))
          add('Interno Pto. Caldera → SJO', 'delivery_destination', 'InlandTransport')
        if (destination.includes('moin'))
          add('Interno Pto. Moín → SJO', 'delivery_destination', 'InlandTransport')
      }
    }
  }

  if (context.modality === 'Air' && context.shipmentMode === 'Lcl') {
    add('Manejos', 'international_freight', 'AgentCharge', 45)
    add('HAWB', 'international_freight', 'Documentation', 40)
    if (isImport)
      add('Cargos en destino de la línea aérea', 'destination_charges', 'DestinationCharge')
  }

  if (context.modality === 'Land') {
    const handling = context.shipmentMode === 'Ftl' ? 55 : 45
    add('Manejos', 'international_freight', 'AgentCharge', handling)
    add('Carta porte', 'international_freight', 'Documentation', 40)
    add('Manifiesto de carga', 'international_freight', 'Documentation', 40)
    add('DUCA-T', 'international_freight', 'Documentation', 40)
  }

  if (context.modality === 'Multimodal' && isImport) {
    add('Manejos', 'international_freight', 'AgentCharge')
    add('Cargos en destino en Panamá', 'destination_charges', 'DestinationCharge')
    add('HUB de transbordo en Panamá', 'destination_charges', 'PortCharge')
    add('Inland Panamá → Costa Rica', 'delivery_destination', 'InlandTransport')
    add('Documentación', 'destination_charges', 'Documentation')
    add('Ingreso a Almacén A257 Castro Fallas en San José', 'delivery_destination', 'InlandTransport')
  }

  return result
}

export function canonicalServiceLine(code: string, fallbackName: string) {
  switch (code.toUpperCase()) {
    case 'CARGO_INSURANCE':
      return { name: 'Seguro de carga', section: 'destination_charges' as PricingRateSection, type: 'Insurance' as CostDetailType }
    case 'PICKUP':
      return { name: 'Recolección', section: 'pickup_origin' as PricingRateSection, type: 'InlandTransport' as CostDetailType }
    case 'CUSTOMS_FOREIGN':
      return { name: 'Trámite de exportación', section: 'origin_charges' as PricingRateSection, type: 'CustomsCharge' as CostDetailType }
    case 'CUSTOMS_CR':
      return { name: 'Trámites de aduanas', section: 'destination_charges' as PricingRateSection, type: 'CustomsCharge' as CostDetailType }
    case 'STORAGE':
      return { name: 'Bodegaje', section: 'destination_charges' as PricingRateSection, type: 'DestinationCharge' as CostDetailType }
    case 'PACKING':
      return { name: 'Embalaje', section: 'origin_charges' as PricingRateSection, type: 'OriginCharge' as CostDetailType }
    default:
      return { name: fallbackName, section: null, type: null }
  }
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

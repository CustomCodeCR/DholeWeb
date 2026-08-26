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
  incotermCode?: string
  serviceCodes: string[]
  routeText?: string
}): Promise<CommercialTerms> {
  const fallback = buildFallbackCommercialTerms(query)
  const params = new URLSearchParams()
  params.set('transportModality', query.transportModality)
  params.set('shipmentMode', query.shipmentMode)
  params.set('direction', query.direction)
  params.set('incotermId', query.incotermId)
  if (query.serviceCodes.length) params.set('serviceCodes', query.serviceCodes.join(','))
  if (query.routeText?.trim()) params.set('routeText', query.routeText.trim())

  try {
    const configured = await callEndpoint<CommercialTerms>({
      method: 'GET',
      path: `/api/pricing/commercial-terms/resolve?${params.toString()}`,
      headers: { Accept: 'application/json' },
    })
    return mergeCommercialTerms(fallback, configured)
  } catch {
    // Las condiciones comerciales no pueden quedar vacías por una caída del resolver.
    // El fallback reproduce las reglas operativas del manual de Pricing; los bloques
    // configurados en Pricing se agregan cuando el endpoint está disponible.
    return fallback
  }
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

function buildFallbackCommercialTerms(query: {
  transportModality: PricingModality
  shipmentMode: ShipmentMode
  direction: string
  incotermId: string
  incotermCode?: string
  serviceCodes: string[]
  routeText?: string
}): CommercialTerms {
  const includes: string[] = []
  const subjectTo: string[] = [
    'Inspecciones, revisiones y escáner',
    'Cambios sin previo aviso',
    'Mensajería USD 8 a 15 IVI',
  ]
  const excludes: string[] = ['Impuestos', 'Trámites de aduanas', 'Bodegaje', 'Permisos', 'Seguro de carga']
  const modality = query.transportModality
  const mode = query.shipmentMode
  const direction = normalize(query.direction)
  const incoterm = String(query.incotermCode ?? '').trim().toUpperCase()
  const route = normalize(query.routeText ?? '')
  const isImport = direction.includes('importacion')
  const isExport = direction.includes('exportacion')

  const add = (target: string[], ...values: string[]) => {
    values.forEach((value) => {
      if (value && !target.some((current) => normalize(current) === normalize(value))) target.push(value)
    })
  }

  if (incoterm === 'EXW') {
    add(includes, 'Recolección', 'Trámite de exportación', 'Cargos en origen')
  } else if (incoterm === 'FCA' && modality === 'Air') {
    add(includes, 'Cargos en origen de la línea aérea')
    add(excludes, 'Recolección', 'Embalaje')
  } else if (incoterm === 'FOB') {
    add(excludes, 'Cargos en origen')
    if (isExport) add(excludes, 'Recolección')
  }

  if (modality === 'Maritime' && mode === 'Lcl') {
    add(includes, 'Flete internacional marítimo', 'Manejos', 'HBL')
    if (isImport) {
      add(includes, 'Cargos en destino de la línea naviera')
      add(subjectTo, 'IVA de los cargos en destino', 'Marchamo electrónico USD 35 + IVA (si aplica)')
      if (route.includes('caldera')) add(subjectTo, 'Transitorio y bodegaje transitorio si la carga ingresa por Puerto Caldera')
    }
    if (isExport) add(excludes, 'Cargos en destino')
  }

  if (modality === 'Maritime' && mode === 'Fcl') {
    add(includes, 'Flete internacional marítimo', 'Manejos', 'HBL')
    if (isImport) {
      add(includes, 'Cargos en destino de la línea naviera', 'THC / Destino')
      if (route.includes('caldera')) add(includes, 'Interno Puerto Caldera → SJO')
      if (route.includes('moin')) add(includes, 'Interno Puerto Moín → SJO')
      add(
        subjectTo,
        'Muellaje',
        route.includes('moin') ? 'Anticipado USD 125 + IVA o Redestino USD 65 + IVA' : 'Anticipado USD 150 + IVA o Redestino USD 65 + IVA',
        'Marchamo USD 100 + IVA',
        'Retiro vacío USD 150 + IVA',
        'Sobrepeso USD 200 + IVA / Patio USD 100 + IVA',
        'Demoras de chasis USD 100 + IVA',
        'Demoras de contenedor USD 130 + IVA',
        'Carta de transbordo USD 55 + IVA',
        '7 días libres de contenedor',
        'IVA de los cargos en destino',
      )
      if (route.includes('caldera')) add(subjectTo, 'Carrusel USD 265 + IVA')
      add(excludes, 'Traslado a almacén en puerto para inspecciones o revisión de aforo amarillo o rojo')
    }
    if (isExport) {
      add(subjectTo, '5 días libres de contenedor')
      add(
        excludes,
        'Cargos en destino',
        'Traslado a almacén en puerto para inspecciones o revisión de aforo amarillo o rojo',
        'Muellaje',
        'Marchamo USD 100 + IVA',
        'Retiro vacío USD 150 + IVA',
        'Sobrepeso USD 200 + IVA / Patio USD 100 + IVA',
        'Demoras de chasis USD 100 + IVA',
        'Demoras de contenedor USD 130 + IVA',
      )
      if (route.includes('caldera')) add(excludes, 'Carrusel USD 230 + IVA')
    }
  }

  if (modality === 'Land') {
    add(includes, 'Flete internacional terrestre', 'Manejos', 'Carta porte', 'Manifiesto de carga', 'DUCA-T')
    add(subjectTo, 'DUCA-F USD 40 (si aplica)')
    if (mode === 'Ftl' && isExport) add(includes, 'Trámite de exportación', 'Impuesto de exportación USD 28')
    if (mode === 'Ltl' && incoterm === 'EXW') add(includes, 'Impuesto de exportación USD 28')
    add(excludes, 'Cargos en destino')
    if (isExport) add(excludes, 'Trámites de aduanas destino')
  }

  if (modality === 'Air' && mode === 'Lcl') {
    add(includes, 'Flete internacional aéreo', 'Manejos', 'HAWB')
    if (isImport) {
      add(includes, 'Cargos en destino de la línea aérea')
      add(subjectTo, 'IVA de los cargos en destino', 'Retiro de guía aérea en destino USD 65 + IVA')
    }
    if (isExport) add(excludes, 'Cargos en destino de la línea aérea')
  }

  if (modality === 'Multimodal' && isImport) {
    includes.splice(0, includes.length)
    add(
      includes,
      'Flete internacional',
      'Manejos',
      'Cargos en destino en Panamá',
      'HUB de transbordo en Panamá',
      'Inland Panamá → Costa Rica',
      'Documentación',
      'Ingreso a Almacén A257 Castro Fallas en San José',
    )
    if (incoterm === 'EXW') add(includes, 'Recolección', 'Trámite de exportación', 'Cargos en origen')
    add(subjectTo, 'Certificado de reexportación USD 125', 'No sobrepeso')
    add(excludes, 'Traslado a almacén en puerto para inspecciones o revisión de aforo amarillo o rojo')
  }

  const serviceCodes = new Set(query.serviceCodes.map((code) => code.toUpperCase()))
  if (serviceCodes.has('CARGO_INSURANCE')) {
    removeNormalized(excludes, 'Seguro de carga')
    add(includes, 'Seguro de carga')
  }
  if (serviceCodes.has('CUSTOMS_CR')) {
    removeNormalized(excludes, 'Trámites de aduanas')
    removeNormalized(excludes, 'Trámites de aduanas destino')
    add(includes, 'Trámites de aduanas')
  }
  if (serviceCodes.has('STORAGE')) {
    removeNormalized(excludes, 'Bodegaje')
    add(includes, 'Bodegaje')
  }
  if (serviceCodes.has('PICKUP')) {
    removeNormalized(excludes, 'Recolección')
    add(includes, 'Recolección')
  }
  if (serviceCodes.has('PACKING')) {
    removeNormalized(excludes, 'Embalaje')
    add(includes, 'Embalaje')
  }

  return {
    includes: includes.map(fallbackTerm),
    subjectTo: subjectTo.map(fallbackTerm),
    excludes: excludes.map(fallbackTerm),
  }
}

function mergeCommercialTerms(primary: CommercialTerms, secondary: CommercialTerms): CommercialTerms {
  const result: CommercialTerms = {
    includes: [...primary.includes],
    subjectTo: [...primary.subjectTo],
    excludes: [...primary.excludes],
  }
  const seen = new Set(
    [...result.includes, ...result.subjectTo, ...result.excludes].map((item) => normalize(item.text)),
  )

  const append = (target: CommercialTermItem[], items: CommercialTermItem[]) => {
    items.forEach((item) => {
      const key = normalize(item.text)
      if (!key || seen.has(key)) return
      seen.add(key)
      target.push(item)
    })
  }

  append(result.includes, secondary.includes ?? [])
  append(result.subjectTo, secondary.subjectTo ?? [])
  append(result.excludes, secondary.excludes ?? [])
  return result
}

function fallbackTerm(text: string): CommercialTermItem {
  return { id: `manual:${normalize(text).replaceAll(' ', '-')}`, text }
}

function removeNormalized(values: string[], target: string) {
  const normalizedTarget = normalize(target)
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (normalize(values[index] ?? '') === normalizedTarget) values.splice(index, 1)
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

from pathlib import Path
import re

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text()


def sub(pattern: str, replacement: str, label: str, flags=0):
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')


def replace(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)


sub(
    r'(import type \{\n  BrowseImportRatesQuery,\n)(  CostDetailType,\n)',
    r'\1  ChargeBasis,\n\2  CostPortRole,\n',
    'type imports',
)

sub(
    r'(  costDetailType: CostDetailType\n  costType: CostType\n)(  costId\?: string \| null\n)',
    r'\1  chargeBasis: ChargeBasis\n\2  contextLabel?: string | null\n',
    'RateLine fields',
)

functions = '''function sectionFromPortRole(
  role: CostPortRole | null | undefined,
  detailType: CostDetailType,
): RateSection | null {
  if (!role || role === 'Any') return null
  if (role === 'Pol') {
    return detailType === 'InlandTransport' ? 'pickup_origin' : 'origin_charges'
  }
  return detailType === 'InlandTransport' ? 'delivery_destination' : 'destination_charges'
}

function sectionForDetail(type: CostDetailType, name = ''): RateSection {
  const normalized = normalizeCatalogValue(name)
  const mentionsOrigin = /(^| )(origen|origin)( |$)/.test(normalized)
  const mentionsDestination = /(^| )(destino|destination)( |$)/.test(normalized)
  const mentionsPickup = /recole|pickup/.test(normalized)
  const mentionsDelivery = /entrega|delivery/.test(normalized)

  if (type === 'Freight') return 'international_freight'
  if (type === 'OriginCharge') return 'origin_charges'
  if (type === 'DestinationCharge' || type === 'Insurance') return 'destination_charges'
  if (type === 'PortCharge') return mentionsOrigin ? 'origin_charges' : 'destination_charges'
  if (type === 'InlandTransport') {
    return mentionsPickup || mentionsOrigin ? 'pickup_origin' : 'delivery_destination'
  }
  if (type === 'CustomsCharge') {
    return mentionsOrigin || /exterior|export/.test(normalized)
      ? 'origin_charges'
      : 'destination_charges'
  }
  if (type === 'AgentCharge' || type === 'Documentation') {
    if (mentionsOrigin) return 'origin_charges'
    if (mentionsDestination) return 'destination_charges'
    return 'international_freight'
  }
  if (mentionsPickup) return 'pickup_origin'
  if (mentionsDelivery) return 'delivery_destination'
  if (mentionsOrigin) return 'origin_charges'
  return 'destination_charges'
}

function sectionForCost(cost: CostSelectDto): RateSection {
  const byPortRole = sectionFromPortRole(cost.portRole, cost.costDetailType)
  if (byPortRole) return byPortRole

  if (cost.polId && !cost.poeId && !cost.podId) {
    return cost.costDetailType === 'InlandTransport' ? 'pickup_origin' : 'origin_charges'
  }
  if ((cost.poeId || cost.podId) && !cost.polId) {
    return cost.costDetailType === 'InlandTransport'
      ? 'delivery_destination'
      : 'destination_charges'
  }

  return sectionForDetail(cost.costDetailType, cost.name)
}

function sectionForManual(section: RateSection): CostDetailType {
  if (section === 'international_freight') return 'Freight'
  if (section === 'origin_charges') return 'OriginCharge'
  if (section === 'destination_charges') return 'DestinationCharge'
  if (section === 'pickup_origin' || section === 'delivery_destination') return 'InlandTransport'
  return 'Other'
}

function defaultChargeBasis(type: CostDetailType): ChargeBasis {
  if (type === 'Documentation') return 'PerDocument'
  if (type === 'Freight' || type === 'InlandTransport') {
    if (shipmentModeForApi.value === 'Fcl') return 'PerContainer'
    if (shipmentModeForApi.value === 'Ftl') return 'PerTruck'
    if (shipmentModeForApi.value === 'Lcl' || shipmentModeForApi.value === 'Ltl') {
      return 'PerChargeableCbm'
    }
  }
  return 'PerShipment'
}

function quantityForChargeBasis(basis: ChargeBasis) {
  if (basis === 'PerContainer' || basis === 'PerTruck') {
    return Math.max(1, form.equipmentQuantity)
  }
  return 1
}

function detailTypeLabel(type: CostDetailType, section?: RateSection) {
  return ({
    Freight: 'Flete',
    OriginCharge: 'Cargo en origen',
    DestinationCharge: 'Cargo en destino',
    PortCharge: 'Cargo portuario',
    CustomsCharge: 'Aduanas',
    InlandTransport: section === 'pickup_origin' ? 'Recolecta' : 'Transporte terrestre',
    AgentCharge: 'Agente',
    Documentation: 'Documentación',
    Insurance: 'Seguro',
    Other: 'Otro',
  } as Record<CostDetailType, string>)[type]
}

function chargeBasisLabel(basis: ChargeBasis) {
  return ({
    PerShipment: 'Por embarque',
    PerContainer: 'Por contenedor',
    PerTruck: 'Por camión',
    PerCbm: 'Por CBM',
    PerChargeableCbm: 'Por CBM cobrable',
    PerKg: 'Por kg',
    Per100Kg: 'Por 100 kg',
    PerTon: 'Por tonelada',
    PerPallet: 'Por pallet',
    PerPackage: 'Por bulto',
    PerDocument: 'Por documento',
  } as Record<ChargeBasis, string>)[basis]
}

function costContextLabel(cost: CostSelectDto) {
  const parts: string[] = []
  if (cost.agentName) parts.push(`Agente: ${cost.agentName}`)
  if (cost.carrierName) parts.push(`Naviera: ${cost.carrierName}`)
  if (cost.polName) parts.push(`POL: ${cost.polName}`)
  if (cost.poeName) parts.push(`POE: ${cost.poeName}`)
  if (cost.podName) parts.push(`POD: ${cost.podName}`)
  if (cost.portName && !parts.some((part) => part.includes(cost.portName!))) {
    const role = cost.portRole && cost.portRole !== 'Any' ? cost.portRole.toUpperCase() : 'Puerto'
    parts.push(`${role}: ${cost.portName}`)
  }
  return parts.join(' · ') || null
}

function applicableCost(cost: CostSelectDto) {
  if (cost.shipmentMode && cost.shipmentMode !== shipmentModeForApi.value) return false
  if (cost.incoterms?.length && !cost.incoterms.some((incoterm) => incoterm.id === form.incotermId)) return false
  if (cost.carrierId && cost.carrierId !== form.carrierId) return false
  if (cost.agentId && cost.agentId !== form.agentId) return false
  if (cost.polId && cost.polId !== form.originId) return false
  if (cost.poeId && cost.poeId !== form.destinationId) return false
  if (cost.podId && cost.podId !== form.podId) return false

  if (cost.portId) {
    const matchesLegacyPort = cost.portRole === 'Pol'
      ? cost.portId === form.originId
      : cost.portRole === 'Poe'
        ? cost.portId === form.destinationId
        : cost.portRole === 'Pod'
          ? cost.portId === form.podId
          : [form.originId, form.destinationId, form.podId].includes(cost.portId)
    if (!matchesLegacyPort) return false
  }

  return true
}

function serviceAmounts'''

sub(
    r"function sectionForDetail\(type: CostDetailType, name = ''\): RateSection \{.*?\n\}\n\nfunction serviceAmounts",
    functions,
    'cost classification functions',
    re.S,
)

replace(
    "      costDetailType: 'Freight',\n      costType: 'Variable',\n",
    "      costDetailType: 'Freight',\n      costType: 'Variable',\n      chargeBasis: defaultChargeBasis('Freight'),\n",
    'freight charge basis',
)
replace(
    "      costDetailType: template.costDetailType,\n      costType: template.costType,\n",
    "      costDetailType: template.costDetailType,\n      costType: template.costType,\n      chargeBasis: defaultChargeBasis(template.costDetailType),\n",
    'operational charge basis',
)
replace(
    "        costDetailType: detailType,\n        costType: optional ? 'Optional' : 'Variable',\n",
    "        costDetailType: detailType,\n        costType: optional ? 'Optional' : 'Variable',\n        chargeBasis: defaultChargeBasis(detailType),\n",
    'service charge basis',
)
replace(
    "      costDetailType: 'Insurance',\n      costType: 'Optional',\n",
    "      costDetailType: 'Insurance',\n      costType: 'Optional',\n      chargeBasis: 'PerShipment',\n",
    'insurance charge basis',
)
replace(
    "  costs.value.filter(applicableCost).forEach((cost) => {\n    const section = sectionForDetail(cost.costDetailType, cost.name)\n",
    "  costs.value.filter(applicableCost).forEach((cost) => {\n    const section = sectionForCost(cost)\n",
    'configured cost section',
)
replace(
    "      costDetailType: cost.costDetailType,\n      costType: cost.costType,\n      costId: cost.id,\n",
    "      costDetailType: cost.costDetailType,\n      costType: cost.costType,\n      chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),\n      costId: cost.id,\n      contextLabel: costContextLabel(cost),\n",
    'configured cost metadata',
)

manual = '''function addManualCharge() {
  const name = form.manualName.trim()
  const currency = selectedCurrency.value
  if (!name || !currency) return
  const detailType = sectionForManual(form.manualSection)
  rateLines.value.push({
    key: `manual:${crypto.randomUUID()}`,
    section: form.manualSection,
    name,
    costDetailType: detailType,
    costType: 'Variable',
    chargeBasis: defaultChargeBasis(detailType),
    currencyId: currency.id,
    currencyName: displayValue(currency),
    currencyCode: currency.code,
    costAmount: 0,
    saleAmount: 0,
    included: true,
    optional: false,
    manual: true,
  })
  form.manualName = ''
}

function selectDefaultService'''
sub(
    r'function addManualCharge\(\) \{.*?\n\}\n\nfunction selectDefaultService',
    manual,
    'manual charge',
    re.S,
)

replace(
    "    chargeBasis: line.costDetailType === 'Freight' || shipmentModeForApi.value === 'Fcl' ? 'PerContainer' : 'PerShipment',\n",
    "    chargeBasis: line.chargeBasis,\n",
    'payload charge basis',
)
replace(
    "    quantity: line.costDetailType === 'Freight' ? form.equipmentQuantity : 1,\n",
    "    quantity: quantityForChargeBasis(line.chargeBasis),\n",
    'payload quantity',
)

visible_anchor = '''  effectiveServices.value.forEach((service) => {
    if (
      service.code?.toUpperCase() === 'INT_TRANSPORT' &&
      !incotermBuyerPaysMainTransport(selectedIncoterm.value?.code)
    ) return
    metadata(service)?.rateSections?.forEach((section) => sections.add(section))
  })

  if (form.cargoValue > 0) sections.add('destination_charges')'''
visible_replacement = '''  effectiveServices.value.forEach((service) => {
    if (
      service.code?.toUpperCase() === 'INT_TRANSPORT' &&
      !incotermBuyerPaysMainTransport(selectedIncoterm.value?.code)
    ) return
    metadata(service)?.rateSections?.forEach((section) => sections.add(section))
  })

  costs.value.filter(applicableCost).forEach((cost) => sections.add(sectionForCost(cost)))

  if (form.cargoValue > 0) sections.add('destination_charges')'''
replace(visible_anchor, visible_replacement, 'visible configured-cost sections')

ui_old = '''                  <p class="font-bold">{{ line.name }}</p>
                  <DhBadge v-if="line.optional" variant="neutral">Opcional</DhBadge>
                  <DhBadge v-if="line.costType === 'Variable'" variant="warning">Variable</DhBadge>
                </div>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Moneda: {{ line.currencyName }}</p>
              </div>
              <DhInput v-model.number="line.costAmount" type="number" step="0.01" min="0" label="Costo" :disabled="!line.included || (!line.manual && line.costType !== 'Optional' && line.costType !== 'Variable')" />
              <DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" label="Venta" :disabled="!line.included" />'''
ui_new = '''                  <p class="font-bold">{{ line.name }}</p>
                  <DhBadge variant="neutral">{{ detailTypeLabel(line.costDetailType, line.section) }}</DhBadge>
                  <DhBadge variant="neutral">{{ chargeBasisLabel(line.chargeBasis) }}</DhBadge>
                  <DhBadge v-if="line.optional" variant="neutral">Opcional</DhBadge>
                  <DhBadge v-if="line.costType === 'Fixed'" variant="neutral">Fijo</DhBadge>
                  <DhBadge v-if="line.costType === 'Variable'" variant="warning">Variable</DhBadge>
                </div>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Moneda: {{ line.currencyName }}</p>
                <p v-if="line.contextLabel" class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ line.contextLabel }}</p>
              </div>
              <DhInput v-model.number="line.costAmount" type="number" step="0.01" min="0" :label="`Costo · ${chargeBasisLabel(line.chargeBasis)}`" :disabled="!line.included || (!line.manual && line.costType !== 'Optional' && line.costType !== 'Variable')" />
              <DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" :label="`Venta · ${chargeBasisLabel(line.chargeBasis)}`" :disabled="!line.included" />'''
replace(ui_old, ui_new, 'line UI')

path.write_text(text)

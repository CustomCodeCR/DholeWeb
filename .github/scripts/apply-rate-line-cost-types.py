from pathlib import Path
import re

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text()


def replace(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)


def sub(pattern: str, replacement: str, label: str, flags=0):
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')


replace(
    "  landEquipment: [] as CatalogItemSelectDto[],\n",
    "",
    "remove land equipment catalog state",
)

sub(
    r"const equipmentSource = computed\(\(\) => \{.*?\n\}\)\n\nconst equipmentHasSizes",
    """const equipmentSource = computed(() => {
  const modality = String(form.modality)
  if (!modality || modality === 'Land') return []

  return catalogs.containers.filter((item) => {
    const meta = metadata(item)
    if (meta?.modalities?.length) return meta.modalities.includes(modality)
    if (modality === 'Air') {
      const value = displayValue(item).toUpperCase()
      return ['LOOSE', 'PALLET', 'ULD'].some((kind) => value.includes(kind))
    }
    return modality !== 'Air'
  })
})

const equipmentHasSizes""",
    "remove land equipment source",
    re.S,
)

replace(
    "const selectedEquipment = computed(() => findById(equipmentSource.value, form.equipmentId))",
    """const selectedEquipment = computed(() => {
  if (form.modality === 'Land') {
    const shipmentMode = form.shipmentMode.toUpperCase()
    return catalogs.shipmentModes.find((item) =>
      item.code?.toUpperCase() === shipmentMode || displayValue(item).toUpperCase() === shipmentMode,
    ) ?? null
  }
  return findById(equipmentSource.value, form.equipmentId)
})""",
    "use shipment mode as land technical snapshot",
)

replace(
    "      form.equipmentId &&\n",
    "      selectedEquipment.value &&\n",
    "land does not require equipment selection",
)

old_detail = """function detailTypeLabel(type: CostDetailType, section?: RateSection) {
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
}"""
new_detail = """function detailTypeLabel(type: CostDetailType) {
  return ({
    Freight: 'Flete internacional',
    AgentCharge: 'Costo de agente',
    OriginCharge: 'Cargo en origen',
    DestinationCharge: 'Cargo en destino',
    PortCharge: 'Cargo portuario',
    CustomsCharge: 'Aduana',
    InlandTransport: 'Transporte interno',
    Documentation: 'Documentación',
    Insurance: 'Seguro',
    Other: 'Otro',
  } as Record<CostDetailType, string>)[type]
}"""
replace(old_detail, new_detail, "canonical rubro labels")

anchor = """function applicableCost(cost: CostSelectDto) {
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
"""
replacement = anchor + """
function costSpecificity(cost: CostSelectDto) {
  let score = 0
  if (cost.shipmentMode) score += 2
  if (cost.incoterms?.length) score += 2
  if (cost.carrierId) score += 3
  if (cost.agentId) score += 3
  if (cost.polId) score += 4
  if (cost.poeId) score += 4
  if (cost.podId) score += 4
  if (cost.portId) score += 4
  if (cost.portRole && cost.portRole !== 'Any') score += 1
  return score
}

function applicableConfiguredCosts() {
  return costs.value
    .filter(applicableCost)
    .sort((left, right) => costSpecificity(right) - costSpecificity(left))
}
"""
replace(anchor, replacement, "configured cost specificity")

new_rebuild = r'''function rebuildRateLines() {
  const currency = selectedCurrency.value ?? catalogs.currencies[0]
  if (!currency) return

  const visible = new Set(visibleSections.value)
  const lines: RateLine[] = []
  const hasEquivalent = (name: string, detailType: CostDetailType) =>
    lines.some((line) =>
      line.costDetailType === detailType &&
      normalizeCatalogValue(line.name) === normalizeCatalogValue(name),
    )

  // El flete capturado/seleccionado en el flujo es la fuente principal del flete internacional.
  if (visible.has('international_freight')) {
    lines.push({
      key: 'freight',
      section: 'international_freight',
      name: 'Flete Internacional',
      costDetailType: 'Freight',
      costType: 'Variable',
      chargeBasis: defaultChargeBasis('Freight'),
      currencyId: currency.id,
      currencyName: displayValue(currency),
      currencyCode: currency.code,
      costAmount: number(form.freightCost),
      saleAmount: number(form.freightSale),
      included: true,
      optional: false,
      manual: false,
    })
  }

  // Los Cost configurados en Pricing tienen prioridad sobre las líneas de respaldo del manual.
  // Si existen versiones genéricas y específicas del mismo rubro/nombre, gana la más específica.
  applicableConfiguredCosts().forEach((cost) => {
    const section = sectionForCost(cost)
    if (!visible.has(section)) return
    if (cost.costDetailType === 'Freight' && lines.some((line) => line.costDetailType === 'Freight')) return
    if (hasEquivalent(cost.name, cost.costDetailType)) return
    lines.push({
      key: `cost:${cost.id}`,
      section,
      name: cost.name,
      costDetailType: cost.costDetailType,
      costType: cost.costType,
      chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),
      costId: cost.id,
      contextLabel: costContextLabel(cost),
      currencyId: cost.currencyId,
      currencyName: cost.currencyName,
      currencyCode: cost.currencyCode,
      costAmount: number(cost.costAmount),
      saleAmount: number(cost.saleAmount),
      included: cost.costType !== 'Optional',
      optional: cost.costType === 'Optional',
      manual: false,
    })
  })

  // El manual queda como respaldo únicamente cuando Pricing no tiene ese costo configurado.
  buildOperationalLines({
    modality: form.modality as Modality,
    shipmentMode: shipmentModeForApi.value,
    direction: direction.value,
    incotermCode: selectedIncoterm.value?.code ?? '',
    destinationText: displayValue(selectedDestination.value),
  }).forEach((template) => {
    if (!visible.has(template.section)) return
    if (hasEquivalent(template.name, template.costDetailType)) return
    lines.push({
      key: `operational:${normalizeCatalogValue(template.name)}`,
      section: template.section,
      name: template.name,
      costDetailType: template.costDetailType,
      costType: template.costType,
      chargeBasis: defaultChargeBasis(template.costDetailType),
      currencyId: currency.id,
      currencyName: displayValue(currency),
      currencyCode: currency.code,
      costAmount: template.costAmount,
      saleAmount: template.saleAmount,
      included: template.included,
      optional: template.optional,
      manual: false,
    })
  })

  effectiveServices.value
    .filter((service) => !normalizeCatalogValue(displayValue(service)).includes('transporte internacional'))
    .forEach((service) => {
      const meta = metadata(service)
      const name = displayValue(service)
      const canonical = canonicalServiceLine(service.code, name)
      const lineName = canonical.name
      const detailType = canonical.type ?? detailTypeForService(service)
      const section = canonical.section ?? meta?.rateSections?.[0] ?? sectionForDetail(detailType, lineName)
      if (!visible.has(section)) return
      if (hasEquivalent(lineName, detailType)) return
      const amounts = serviceAmounts(service)
      const optional = detailType === 'Insurance' || Boolean(meta?.optional)
      lines.push({
        key: `service:${service.id}`,
        section,
        name: lineName,
        costDetailType: detailType,
        costType: optional ? 'Optional' : 'Variable',
        chargeBasis: defaultChargeBasis(detailType),
        currencyId: currency.id,
        currencyName: displayValue(currency),
        currencyCode: currency.code,
        costAmount: amounts.cost,
        saleAmount: amounts.sale,
        included: !optional,
        optional,
        manual: false,
      })
    })

  if (form.cargoValue > 0 && !cargoInsuranceService.value && !lines.some((line) => line.costDetailType === 'Insurance')) {
    const insurance = calculateCargoInsurance(form.cargoValue, form.freightCost)
    lines.push({
      key: 'cargo-insurance:auto',
      section: 'destination_charges',
      name: 'Seguro de carga',
      costDetailType: 'Insurance',
      costType: 'Optional',
      chargeBasis: 'PerShipment',
      currencyId: currency.id,
      currencyName: displayValue(currency),
      currencyCode: currency.code,
      costAmount: insurance.cost,
      saleAmount: insurance.sale,
      included: false,
      optional: true,
      manual: false,
    })
  }

  rateLines.value = lines
}'''
sub(
    r"function rebuildRateLines\(\) \{.*?\n\}\n\nfunction addManualCharge",
    new_rebuild + "\n\nfunction addManualCharge",
    "configured costs before manual fallback",
    re.S,
)

# Land is identified by FTL/LTL itself; there is no separate terrestrial equipment catalog.
replace("      landEquipment,\n", "", "remove land equipment destructuring")
replace("      select('land-equipment-types'),\n", "", "stop loading land equipment catalog")
replace("      landEquipment,\n", "", "remove land equipment assignment")

replace(
    "              v-model=\"form.equipmentType\"\n              :label=\"form.modality === 'Land' ? 'Tipo de unidad / furgón' : equipmentHasSizes ? 'Tipo' : 'Tipo de equipo'\"\n              :placeholder=\"form.modality === 'Land' ? 'Seleccione unidad terrestre' : equipmentHasSizes ? 'Seleccione tipo' : 'Seleccione equipo'\"",
    "              v-if=\"form.modality !== 'Land'\"\n              v-model=\"form.equipmentType\"\n              :label=\"equipmentHasSizes ? 'Tipo' : 'Tipo de equipo'\"\n              :placeholder=\"equipmentHasSizes ? 'Seleccione tipo' : 'Seleccione equipo'\"",
    "hide terrestrial equipment selector",
)

replace(
    "            <h2 class=\"crystal-title\">Ruta, equipo, Incoterm y servicios</h2>",
    "            <h2 class=\"crystal-title\">{{ form.modality === 'Land' ? 'Ruta, Incoterm y servicios' : 'Ruta, equipo, Incoterm y servicios' }}</h2>",
    "land step title",
)

replace(
    "            <div v-if=\"selectedEquipment\">\n              <span class=\"block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]\">Equipo</span>",
    "            <div v-if=\"selectedEquipment && form.modality !== 'Land'\">\n              <span class=\"block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]\">Equipo</span>",
    "hide land equipment summary",
)

replace(
    "      incotermId: form.incotermId,\n      serviceCodes,",
    "      incotermId: form.incotermId,\n      incotermCode: selectedIncoterm.value?.code ?? '',\n      serviceCodes,",
    "pass incoterm code to commercial fallback",
)

old_ui = '''                  <p class="font-bold">{{ line.name }}</p>
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
new_ui = '''                  <p class="font-bold">{{ line.name }}</p>
                  <DhBadge v-if="line.optional" variant="neutral">Opcional</DhBadge>
                  <DhBadge v-if="line.costType === 'Variable'" variant="warning">Variable</DhBadge>
                </div>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                  Rubro: {{ detailTypeLabel(line.costDetailType) }} · Moneda: {{ line.currencyName }} · {{ chargeBasisLabel(line.chargeBasis) }}
                </p>
                <p v-if="line.contextLabel" class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ line.contextLabel }}</p>
              </div>
              <DhInput v-model.number="line.costAmount" type="number" step="0.01" min="0" label="Costo" :disabled="!line.included || (!line.manual && line.costType !== 'Optional' && line.costType !== 'Variable')" />
              <DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" label="Venta" :disabled="!line.included" />'''
replace(old_ui, new_ui, "clean rate line UI")

path.write_text(text)

import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error('[pricingWizardMixedFclFreightFix] Expected one ' + label + ', found ' + count + '.')
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceRequired(
    code,
    '  detailId?: string | null\n}',
    '  detailId?: string | null\n  quantityOverride?: number | null\n}',
    'RateLine quantity override',
  )

  const quantityUsage = 'quantityForChargeBasis(line.chargeBasis)'
  const quantityUsageCount = code.split(quantityUsage).length - 1
  if (quantityUsageCount < 4) {
    throw new Error(
      '[pricingWizardMixedFclFreightFix] Expected line quantity usages, found ' + quantityUsageCount + '.',
    )
  }
  code = code.split(quantityUsage).join('quantityForRateLine(line)')

  code = replaceRequired(
    code,
    'function detailTypeLabel(type: CostDetailType) {',
    [
      'function quantityForRateLine(line: RateLine) {',
      '  const explicitQuantity = number(line.quantityOverride)',
      '  if (explicitQuantity > 0) return explicitQuantity',
      '  return quantityForChargeBasis(line.chargeBasis)',
      '}',
      '',
      'function persistedFclFreightForContainer(',
      '  rate: RateDto,',
      '  container: { containerTypeName?: string | null; containerTypeCode?: string | null },',
      '  fallbackIndex: number,',
      ') {',
      "  const freight = (rate.rateDetails ?? []).filter((detail) => detail.costDetailType === 'Freight')",
      '  const candidates = [container.containerTypeName, container.containerTypeCode]',
      "    .map((value) => normalizeCatalogValue(String(value ?? '')))",
      '    .filter(Boolean)',
      '  const matched = freight.find((detail) => {',
      "    const source = normalizeCatalogValue(String(detail.name ?? '') + ' ' + String(detail.notes ?? ''))",
      '    return candidates.some((candidate) => source.includes(candidate))',
      '  })',
      '  return matched ?? freight[fallbackIndex] ?? null',
      '}',
      '',
      'function restorePersistedFclDistribution(rate: RateDto) {',
      "  if (String(rate.shipmentMode).toLocaleLowerCase() !== 'fcl') return false",
      '  const allocations = (rate.containers ?? []).filter((container) => number(container.quantity) > 0)',
      '  if (allocations.length <= 1) {',
      '    fclExtraContainers.value = []',
      '    return false',
      '  }',
      '',
      '  const primary = allocations.find((container) => container.containerTypeId === rate.containerTypeId) ?? allocations[0]',
      '  form.equipmentId = primary.containerTypeId',
      '  form.equipmentQuantity = Math.max(1, Math.trunc(number(primary.quantity)))',
      '',
      '  const primaryIndex = allocations.findIndex((container) => container.containerTypeId === primary.containerTypeId)',
      '  const primaryFreight = persistedFclFreightForContainer(rate, primary, Math.max(0, primaryIndex))',
      '  form.freightCost = number(primaryFreight?.costAmount)',
      '  form.freightSale = number(primaryFreight?.saleAmount)',
      '',
      '  fclExtraContainers.value = allocations',
      '    .filter((container) => container.containerTypeId !== primary.containerTypeId)',
      '    .map((container) => {',
      '      const allocationIndex = allocations.findIndex((candidate) => candidate.containerTypeId === container.containerTypeId)',
      '      const freight = persistedFclFreightForContainer(rate, container, Math.max(0, allocationIndex))',
      '      return {',
      '        key: crypto.randomUUID(),',
      '        containerTypeId: container.containerTypeId,',
      '        quantity: Math.max(1, Math.trunc(number(container.quantity))),',
      '        freightCostAmount: number(freight?.costAmount),',
      '        freightSaleAmount: number(freight?.saleAmount),',
      '        freightTouched: true,',
      '      }',
      '    })',
      '  return true',
      '}',
      '',
      'function rateEquipmentSummary(rate: RateDto) {',
      "  if (String(rate.shipmentMode).toLocaleLowerCase() === 'lcl') {",
      "    return 'LCL · ' + Number(rate.chargeableQuantity || 0).toFixed(3) + ' CBM cobrable'",
      '  }',
      '  const allocations = (rate.containers ?? []).filter((container) => number(container.quantity) > 0)',
      '  if (allocations.length) {',
      '    return allocations',
      "      .map((container) => String(container.quantity) + ' × ' + (container.containerTypeName || container.containerTypeCode))",
      "      .join(' + ')",
      '  }',
      "  return String(rate.containerQuantity) + ' × ' + rate.containerTypeName",
      '}',
      '',
      'function detailTypeLabel(type: CostDetailType) {',
    ].join('\n'),
    'mixed FCL quantity helpers',
  )

  const providerAnchor = [
    'const providerCost = computed(() => number(form.freightCost) + providerAgentCost.value)',
    'const providerSale = computed(() => number(form.freightSale) + providerAgentSale.value)',
  ].join('\n')
  const providerReplacement = [
    'const providerFreightCost = computed(() =>',
    "  shipmentModeForApi.value === 'Fcl' && fclContainerAllocations.value.length",
    '    ? fclContainerAllocations.value.reduce(',
    '        (sum, allocation) => sum + number(allocation.freightCostAmount) * Math.max(1, number(allocation.quantity)),',
    '        0,',
    '      )',
    '    : number(form.freightCost),',
    ')',
    'const providerFreightSale = computed(() =>',
    "  shipmentModeForApi.value === 'Fcl' && fclContainerAllocations.value.length",
    '    ? fclContainerAllocations.value.reduce(',
    '        (sum, allocation) => sum + number(allocation.freightSaleAmount) * Math.max(1, number(allocation.quantity)),',
    '        0,',
    '      )',
    '    : number(form.freightSale),',
    ')',
    'const providerCost = computed(() => providerFreightCost.value + providerAgentCost.value)',
    'const providerSale = computed(() => providerFreightSale.value + providerAgentSale.value)',
  ].join('\n')
  code = replaceRequired(code, providerAnchor, providerReplacement, 'provider mixed FCL totals')

  const rebuildFinalizeAnchor = [
    '  lines.forEach((line) => {',
    '    line.amountCurrencyCode = canonicalCurrencyCode(line)',
    '    enforceLineCurrency(line)',
    '  })',
  ].join('\n')
  const rebuildFinalizeReplacement = [
    "  if (shipmentModeForApi.value === 'Fcl' && fclContainerAllocations.value.length > 1) {",
    "    const freightIndex = lines.findIndex((line) => line.costDetailType === 'Freight')",
    '    if (freightIndex >= 0) {',
    '      const baseFreight = lines[freightIndex]',
    '      const mixedFreightLines = fclContainerAllocations.value.map((allocation) => ({',
    '        ...baseFreight,',
    "        key: 'freight:' + allocation.containerTypeId,",
    "        name: 'Flete Internacional · ' + allocation.containerTypeName,",
    "        chargeBasis: 'PerContainer' as ChargeBasis,",
    '        costId: null,',
    '        costAmount: number(allocation.freightCostAmount),',
    '        saleAmount: number(allocation.freightSaleAmount),',
    '        quantityOverride: Math.max(1, Math.trunc(number(allocation.quantity))),',
    '        notes: [',
    "          'Flete específico para ' + Math.max(1, Math.trunc(number(allocation.quantity))) + ' × ' + allocation.containerTypeName,",
    '          fclSelectedImportRateIds.value[allocation.containerTypeId]',
    "            ? 'Tarifa importada: ' + fclSelectedImportRateIds.value[allocation.containerTypeId]",
    '            : null,',
    "        ].filter(Boolean).join(' · '),",
    '      }))',
    '      lines.splice(freightIndex, 1, ...mixedFreightLines)',
    '    }',
    '  }',
    '',
    '  lines.forEach((line) => {',
    '    line.amountCurrencyCode = canonicalCurrencyCode(line)',
    '    enforceLineCurrency(line)',
    '  })',
  ].join('\n')
  code = replaceRequired(code, rebuildFinalizeAnchor, rebuildFinalizeReplacement, 'mixed FCL rate lines')

  code = replaceRequired(
    code,
    '        detailId: detail.id,\n        section: sectionForDetail(detail.costDetailType, detail.name),',
    '        detailId: detail.id,\n        quantityOverride: number(detail.quantity) > 0 ? number(detail.quantity) : null,\n        section: sectionForDetail(detail.costDetailType, detail.name),',
    'persisted detail quantity hydration',
  )

  code = replaceRequired(
    code,
    [
      "    const freight = rate.rateDetails.find((detail) => detail.costDetailType === 'Freight')",
      '    form.freightCost = Number(freight?.costAmount || 0)',
      '    form.freightSale = Number(freight?.saleAmount || 0)',
    ].join('\n'),
    [
      '    const restoredMixedFclFreight = restorePersistedFclDistribution(rate)',
      '    if (!restoredMixedFclFreight) {',
      "      const freight = rate.rateDetails.find((detail) => detail.costDetailType === 'Freight')",
      '      form.freightCost = Number(freight?.costAmount || 0)',
      '      form.freightSale = Number(freight?.saleAmount || 0)',
      '    }',
    ].join('\n'),
    'persisted mixed FCL freight hydration',
  )

  code = replaceRequired(
    code,
    '      sourceImportFclRateId: form.selectedImportRateId || null,',
    [
      "      sourceImportFclRateId: shipmentModeForApi.value === 'Fcl' && fclContainerAllocations.value.length > 1",
      '        ? null',
      '        : form.selectedImportRateId || null,',
    ].join('\n'),
    'mixed FCL source import persistence',
  )

  code = replaceRequired(
    code,
    "  if (shipmentModeForApi.value === 'Fcl' && fclContainerAllocations.value.length > 1) {\n    const freightIndex = details.findIndex((detail) => detail.costDetailType === 'Freight')",
    "  if (shipmentModeForApi.value === 'Fcl' && fclContainerAllocations.value.length > 1 && details.filter((detail) => detail.costDetailType === 'Freight').length === 1) {\n    const freightIndex = details.findIndex((detail) => detail.costDetailType === 'Freight')",
    'legacy mixed FCL detail expansion guard',
  )

  code = replaceRequired(
    code,
    'label="Flete internacional · costo"',
    ':label="shipmentModeForApi === \'Fcl\' ? \'Flete \' + fclContainerName(form.equipmentId) + \' · costo\' : \'Flete internacional · costo\'"',
    'primary freight cost label',
  )
  code = replaceRequired(
    code,
    'label="Flete internacional · venta"',
    ':label="shipmentModeForApi === \'Fcl\' ? \'Flete \' + fclContainerName(form.equipmentId) + \' · venta\' : \'Flete internacional · venta\'"',
    'primary freight sale label',
  )

  const providerHelpAnchor =
    '<p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">El contenedor principal usa los valores superiores. Los adicionales se inicializan con ese flete y pueden modificarse individualmente.</p>'
  const providerHelpReplacement =
    '<p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]"><strong>Principal: {{ form.equipmentQuantity }} × {{ fclContainerName(form.equipmentId) }}.</strong> Ese flete usa los campos superiores; cada contenedor adicional conserva su propio costo y venta.</p>'
  code = replaceRequired(code, providerHelpAnchor, providerHelpReplacement, 'provider freight container help')

  const screen09EquipmentExpression =
    "{{ editingRate.shipmentMode === 'Lcl' ? `LCL · ${Number(editingRate.chargeableQuantity || 0).toFixed(3)} CBM cobrable` : `${editingRate.containerQuantity} × ${editingRate.containerTypeName}` }}"
  code = replaceRequired(
    code,
    screen09EquipmentExpression,
    '{{ rateEquipmentSummary(editingRate) }}',
    'screen 09 equipment summary',
  )

  return code
}

export function pricingWizardMixedFclFreightFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-mixed-fcl-freight-fix',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

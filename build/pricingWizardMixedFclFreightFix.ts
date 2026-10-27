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

  if (!code.includes('quantityOverride?: number | null')) {
    code = replaceRequired(
      code,
      '  detailId?: string | null\n}',
      '  detailId?: string | null\n  quantityOverride?: number | null\n}',
      'RateLine quantity override',
    )
  }

  const quantityUsage = 'quantityForChargeBasis(line.chargeBasis)'
  const quantityUsageCount = code.split(quantityUsage).length - 1
  if (quantityUsageCount < 4) {
    throw new Error(
      '[pricingWizardMixedFclFreightFix] Expected line quantity usages, found ' + quantityUsageCount + '.',
    )
  }
  code = code.split(quantityUsage).join('quantityForRateLine(line)')

  const quantityHelper = code.includes('function quantityForRateLine(line: RateLine)')
    ? []
    : [
        'function quantityForRateLine(line: RateLine) {',
        '  const explicitQuantity = number(line.quantityOverride)',
        "  const mixedFclFreightQuantity = shipmentModeForApi.value === 'Fcl'",
        "    && line.costDetailType === 'Freight'",
        "    && String(line.key ?? '').startsWith('freight:')",
        '    && explicitQuantity > 0',
        '  if (mixedFclFreightQuantity) return explicitQuantity',
        '  return quantityForChargeBasis(line.chargeBasis)',
        '}',
        '',
      ]

  code = replaceRequired(
    code,
    'function detailTypeLabel(type: CostDetailType) {',
    [
      ...quantityHelper,
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

  // Reconcile persisted and edited FCL freight by equipment identity, not by total header quantity.
  code = replaceRequired(
    code,
    'function detailTypeLabel(type: CostDetailType) {',
    "function fclFreightLineMatchesAllocation(\n  line: RateLine,\n  allocation: { containerTypeId: string; containerTypeName: string; containerTypeCode: string },\n) {\n  if (line.key === 'freight:' + allocation.containerTypeId) return true\n  const type = normalizeCatalogValue(allocation.containerTypeName)\n  const code = normalizeCatalogValue(allocation.containerTypeCode)\n  const title = normalizeCatalogValue(String(line.name ?? ''))\n  const note = normalizeCatalogValue(String(line.notes ?? ''))\n  return (type.length >= 3 && (title.includes(type) || note.includes(type)))\n    || (code.length >= 4 && (title.includes(code) || note.includes(code)))\n}\n\nfunction reconcileFclFreightLines() {\n  if (shipmentModeForApi.value !== 'Fcl') return\n  const allocations = fclContainerAllocations.value\n  if (!allocations.length) return\n  const currentLines = rateLines.value\n  const previousFreight = currentLines.filter((line) => line.costDetailType === 'Freight')\n  if (!previousFreight.length && !visibleSections.value.includes('international_freight')) return\n\n  const originalAllocations = editingRate.value?.containers ?? []\n  const originalFreight = previousFreight.filter((line) => Boolean(line.detailId))\n  const claimed = new Set<RateLine>()\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]\n\n  const replacement: RateLine[] = allocations.map((allocation) => {\n    let matching = previousFreight.find((line) =>\n      !claimed.has(line) && fclFreightLineMatchesAllocation(line, allocation),\n    )\n    if (!matching) {\n      // Legacy rows may lack an equipment suffix; an index is safe only when\n      // this exact equipment type existed in the original persisted allocation.\n      const originalIndex = originalAllocations.findIndex(\n        (row) => row.containerTypeId === allocation.containerTypeId,\n      )\n      if (originalIndex >= 0 && originalFreight.length === originalAllocations.length) {\n        const candidate = originalFreight[originalIndex]\n        if (candidate && !claimed.has(candidate)) matching = candidate\n      } else if (originalIndex >= 0 && originalAllocations.length === 1 && originalFreight.length === 1) {\n        const candidate = originalFreight[0]\n        if (candidate && !claimed.has(candidate)) matching = candidate\n      }\n    }\n    if (matching) claimed.add(matching)\n    const base = matching ?? previousFreight[0]\n    const noteParts = String(matching?.notes ?? '')\n      .split(/\\s+·\\s+/)\n      .map((part) => part.trim())\n      .filter((part) => part && !/^Flete específico para\\b/i.test(part) && !/^Tarifa importada:/i.test(part))\n    noteParts.push('Flete específico para ' + allocation.quantity + ' × ' + allocation.containerTypeName)\n    const importId = fclSelectedImportRateIds.value[allocation.containerTypeId]\n    if (importId) noteParts.push('Tarifa importada: ' + importId)\n    return {\n      ...(base ?? {}),\n      key: 'freight:' + allocation.containerTypeId,\n      detailId: matching?.detailId ?? null,\n      section: 'international_freight' as RateSection,\n      name: 'Flete Internacional · ' + allocation.containerTypeName,\n      costDetailType: 'Freight' as CostDetailType,\n      costType: matching?.costType ?? 'Variable',\n      chargeBasis: 'PerContainer' as ChargeBasis,\n      costId: matching?.costId ?? null,\n      currencyId: matching?.currencyId ?? currency?.id ?? form.currencyId,\n      currencyName: matching?.currencyName ?? (currency ? displayValue(currency) : ''),\n      currencyCode: matching?.currencyCode ?? currency?.code ?? '',\n      costAmount: number(allocation.freightCostAmount),\n      saleAmount: number(allocation.freightSaleAmount),\n      quantityOverride: allocation.quantity,\n      notes: noteParts.join(' · '),\n      included: true,\n      optional: false,\n      manual: matching?.manual ?? true,\n    }\n  })\n  const freightIndex = currentLines.findIndex((line) => line.costDetailType === 'Freight')\n  rateLines.value = freightIndex < 0\n    ? [...currentLines, ...replacement]\n    : [\n        ...currentLines.slice(0, freightIndex),\n        ...replacement,\n        ...currentLines.slice(freightIndex + 1).filter((line) => line.costDetailType !== 'Freight'),\n      ]\n}\n\nfunction detailTypeLabel(type: CostDetailType) {",
    'FCL equipment freight reconciliation',
  )
  code = replaceRequired(code, "  const mixedFclFreightQuantity =\n    shipmentModeForApi.value === 'Fcl'\n    && line.costDetailType === 'Freight'\n    && String(line.key ?? '').startsWith('freight:')\n    && explicitQuantity > 0\n\n  if (mixedFclFreightQuantity) return explicitQuantity", "  if (shipmentModeForApi.value === 'Fcl' && line.costDetailType === 'Freight') {\n    const allocation = fclContainerAllocations.value.find((row) => fclFreightLineMatchesAllocation(line, row))\n    if (allocation) return allocation.quantity\n    // A persisted detail can have an older key (\"existing:<id>\"); preserve its\n    // stored freight-specific quantity instead of multiplying by all containers.\n    if (explicitQuantity > 0) return explicitQuantity\n  }", 'persisted FCL freight quantities')
  // Other wizard features may inject service reconciliation between the
  // persisted-cost merge and the step assignment. Insert the FCL freight
  // reconciliation right after the merge instead of depending on adjacency.
  const persistedCostsMerge = '    mergeConfiguredOptionalCostsIntoRateLines()\\n'
  code = replaceRequired(
    code,
    persistedCostsMerge,
    persistedCostsMerge + '    if (!props.viewOnly) reconcileFclFreightLines()\\n',
    'FCL freight hydrate reconciliation',
  )
  code = replaceRequired(
    code,
    '  if (editingRate.value && !props.viewOnly) {',
    "  if (shipmentModeForApi.value === 'Fcl') reconcileFclFreightLines()\n\n  if (editingRate.value && !props.viewOnly) {",
    'FCL freight before update snapshot',
  )
  code = replaceRequired(
    code,
    '\n</script>\n',
    "\nwatch(\n  () => [step.value, fclContainerAllocations.value.map((row) =>\n    [row.containerTypeId, row.quantity, row.freightCostAmount, row.freightSaleAmount].join(':'),\n  ).join('|')] as const,\n  () => {\n    if (hydratingExistingRate.value || props.viewOnly || step.value < 6) return\n    if (editingRate.value || rateLines.value.length) reconcileFclFreightLines()\n  },\n  { flush: 'sync' },\n)\n\nconst lastValidFclPrimaryType = ref(form.equipmentId)\n\nwatch(\n  () => form.equipmentId,\n  (nextType, previousType) => {\n    if (hydratingExistingRate.value) {\n      if (nextType) lastValidFclPrimaryType.value = nextType\n      return\n    }\n    if (shipmentModeForApi.value !== 'Fcl') {\n      lastValidFclPrimaryType.value = ''\n      return\n    }\n    // Size/type selectors may clear equipmentId momentarily before resolving\n    // the replacement, so compare against the last valid container ID.\n    if (!nextType) {\n      if (previousType) lastValidFclPrimaryType.value = previousType\n      return\n    }\n    const oldType = previousType || lastValidFclPrimaryType.value\n    lastValidFclPrimaryType.value = nextType\n    if (!oldType || nextType === oldType) return\n    const existing = fclExtraContainers.value.find((row) => row.containerTypeId === nextType)\n    if (existing) {\n      // Replacing the primary with a type already present consolidates both\n      // quantities and keeps the new type's own price, never the old type's.\n      form.equipmentQuantity = Math.max(1, Math.trunc(number(form.equipmentQuantity)))\n        + Math.max(1, Math.trunc(number(existing.quantity)))\n      form.freightCost = number(existing.freightCostAmount)\n      form.freightSale = number(existing.freightSaleAmount)\n      fclExtraContainers.value = fclExtraContainers.value.filter((row) => row.key !== existing.key)\n    } else {\n      form.freightCost = 0\n      form.freightSale = 0\n    }\n    form.selectedImportRateId = ''\n    form.manualRate = true\n  },\n  { flush: 'sync' },\n)\n\nwatch(\n  () => fclExtraContainers.value.map((row) => [row.key, row.containerTypeId] as const),\n  (current, previous) => {\n    if (hydratingExistingRate.value || shipmentModeForApi.value !== 'Fcl') return\n    const priorTypes = new Map((previous ?? []).map(([key, type]) => [key, type]))\n    for (const [key, type] of current) {\n      const previousType = priorTypes.get(key)\n      if (!previousType || previousType === type) continue\n      const row = fclExtraContainers.value.find((candidate) => candidate.key === key)\n      if (!row) continue\n      // An equipment replacement must not reuse the replaced container's cost/sale.\n      row.freightCostAmount = 0\n      row.freightSaleAmount = 0\n      row.freightTouched = true\n      form.selectedImportRateId = ''\n      form.manualRate = true\n    }\n  },\n  { flush: 'sync' },\n)\n\n</script>\n",
    'FCL edit and equipment replacement watches',
  )

  // Earlier Vite plugins may rewrite this watcher. It is an optional
  // compatibility improvement, not a reason to prevent production deployment.
  const existingFclEditWatcher = "watch(\n  () => [form.cargoValue, form.freightCost, form.serviceIds.join('|'), form.cargoWeightKg, form.cargoPallets, form.cargoPackages, form.storageDays, form.equipmentId] as const,\n  () => {\n    if (hydratingExistingRate.value || step.value < 7) return\n    rebuildRateLines()\n  },\n)"
  if (code.includes(existingFclEditWatcher)) {
    code = code.replace(
      existingFclEditWatcher,
      "watch(\n  () => [form.cargoValue, form.freightCost, form.serviceIds.join('|'), form.cargoWeightKg, form.cargoPallets, form.cargoPackages, form.storageDays, form.equipmentId] as const,\n  (current, previous) => {\n    if (hydratingExistingRate.value || step.value < 7) return\n    if (editingRate.value && shipmentModeForApi.value === 'Fcl' && previous) {\n      const onlyFreightOrEquipmentChanged = current.every((value, index) =>\n        index === 1 || index === 7 || value === previous[index],\n      )\n      if (onlyFreightOrEquipmentChanged) {\n        reconcileFclFreightLines()\n        return\n      }\n    }\n    rebuildRateLines()\n  },\n)",
    )
  }

  // Pantalla 7 edits RateLine.saleAmount, while the mixed-FCL preview and
  // persistence reconcile freight from fclContainerAllocations. Keep the
  // per-equipment source values in sync BEFORE the step 7 -> 8 watcher runs.
  // Otherwise the preview silently rolls user-entered sales back to tariff values.
  const screen7SaleSyncWatcher = `watch(
  () => rateLines.value
    .filter((line) => line.costDetailType === 'Freight' && line.included)
    .map((line) => [line.key, line.saleAmount].join(':')).join('|'),
  () => {
    if (hydratingExistingRate.value || props.viewOnly
      || shipmentModeForApi.value !== 'Fcl' || step.value !== 7) return
    const allocations = fclContainerAllocations.value
    for (const line of rateLines.value) {
      if (!line.included || line.costDetailType !== 'Freight') continue
      const allocation = allocations.find((row) => fclFreightLineMatchesAllocation(line, row))
      if (!allocation) continue
      const sale = Math.max(0, number(line.saleAmount))
      if (allocation.containerTypeId === form.equipmentId) {
        if (number(form.freightSale) !== sale) form.freightSale = sale
      } else {
        const extra = fclExtraContainers.value.find((row) => row.containerTypeId === allocation.containerTypeId)
        if (extra && number(extra.freightSaleAmount) !== sale) {
          extra.freightSaleAmount = sale
          extra.freightTouched = true
        }
      }
    }
  },
  { flush: 'sync' },
)

`;
  code = replaceRequired(
    code,
    "watch(\n  () => [step.value, fclContainerAllocations.value.map((row) =>",
    screen7SaleSyncWatcher + "watch(\n  () => [step.value, fclContainerAllocations.value.map((row) =>",
    'Screen 7 mixed-FCL unit sale synchronization',
  )

  return code
}

export function pricingWizardMixedFclFreightFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-mixed-fcl-freight-fix',
    // LTL provider parity also rewrites the freight fields. Run this first so
    // the mixed-FCL labels are established before the LTL-specific wrapper.
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

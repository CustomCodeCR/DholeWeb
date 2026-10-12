import type { Plugin } from 'vite'

// Pantalla 7: el precio cotizado de CUALQUIER cargo opcional es editable
// independientemente de la modalidad, sin modificar los maestros de costos.
// Los cargos no opcionales conservan sus restricciones anteriores.
const SUFFIXES = [
  '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
  '/src/modules/pricing/existing/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
  '/src/modules/pricing/components/PricingRateExistingWizardStable.vue',
]
const MARKER = '// dhole-ltl-optional-editable-20261008'

function replaceRequired(source: string, before: string, after: string, description: string) {
  if (!source.includes(before)) {
    throw new Error('[pricingLtlOptionalEditable] No se encontró: ' + description)
  }
  return source.replaceAll(before, after)
}

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  let code = source
  const editableOptional = "line.optional && !props.viewOnly"

  const standardCostDisabled = `:disabled="line.costDetailType === 'AgentCharge' || line.costType !== 'Variable'"`
  const exwCostDisabled = `:disabled="!isEditableExwPickup(line) && (line.costDetailType === 'AgentCharge' || line.costType !== 'Variable')"`
  const standardSaleDisabled = `:disabled="line.costDetailType === 'AgentCharge'"`
  const exwSaleDisabled = `:disabled="line.costDetailType === 'AgentCharge' && !isEditableExwPickup(line)"`
  const addOptionalOverride = (disabled: string) => {
    const expression = disabled.slice(':disabled="'.length, -1)
    return ':disabled="props.viewOnly || (!(' + editableOptional + ') && (' + expression + '))"'
  }

  // EXW puede reescribir la restricción original. Procesar todas las variantes
  // (también las líneas inferiores) y envolver los OR originales correctamente:
  // de lo contrario AgentCharge seguiría bloqueando opcionales.
  let updatedInputGuards = 0
  for (const disabled of [
    exwCostDisabled,
    standardCostDisabled,
    exwSaleDisabled,
    standardSaleDisabled,
  ]) {
    if (!code.includes(disabled)) continue
    code = code.replaceAll(disabled, addOptionalOverride(disabled))
    updatedInputGuards++
  }
  if (updatedInputGuards === 0) {
    throw new Error('[pricingLtlOptionalEditable] No se encontraron los campos de costo y venta.')
  }

  // Una reconstrucción de Pantalla 7 no debe reemplazar un importe modificado
  // con el valor de la matriz del costo. Solo conservar la misma línea opcional
  // de la misma fuente, sin transportar importes a otros costId.
  const rebuildStart = code.indexOf('function rebuildRateLines() {')
  const rebuildEnd = code.indexOf('\nfunction mergeConfiguredOptionalCostsIntoRateLines(', rebuildStart)
  if (rebuildStart >= 0 && rebuildEnd > rebuildStart) {
    const source = code.slice(rebuildStart, rebuildEnd)
    const anchor = [
      '  lines.forEach((line) => {',
      '    line.amountCurrencyCode = canonicalCurrencyCode(line)',
      '    enforceLineCurrency(line)',
      '  })',
    ].join('\n')
    const preservation = [
      '  const previousOptionalAmounts = new Map(',
      '    rateLines.value.filter((line) => line.optional)',
      "      .map((line) => [`${line.key}|${line.costId ?? ''}`, line] as const),",
      '  )',
      '  for (const line of lines) {',
      '    if (!line.optional) continue',
      "    const previous = previousOptionalAmounts.get(`${line.key}|${line.costId ?? ''}`)",
      '    if (!previous) continue',
      '    line.costAmount = previous.costAmount',
      '    line.saleAmount = previous.saleAmount',
      '    line.billToClient = previous.billToClient',
      '  }',
      anchor,
    ].join('\n')
    if (!source.includes(anchor)) {
      throw new Error('[pricingLtlOptionalEditable] No se encontró el sincronizador de líneas de Pantalla 7.')
    }
    code = code.slice(0, rebuildStart) + source.replace(anchor, preservation) + code.slice(rebuildEnd)
  }

  // Al actualizar una cotización existente, el sincronizador del catálogo
  // no debe pisar importes cotizados manualmente en un cargo opcional.
  const persistedSyncStart = code.indexOf('function syncPersistedLinesWithChangedConfiguredCosts() {')
  const persistedSyncEnd = code.indexOf('\nasync function loadApplicableCosts()', persistedSyncStart)
  if (persistedSyncStart >= 0 && persistedSyncEnd > persistedSyncStart) {
    const source = code.slice(persistedSyncStart, persistedSyncEnd)
    const syncGuard = "    if (!line.costId || line.costDetailType === 'Freight') return"
    if (!source.includes(syncGuard)) {
      throw new Error('[pricingLtlOptionalEditable] No se encontró el guard de sincronización de costos.')
    }
    code = code.slice(0, persistedSyncStart)
      + source.replace(syncGuard, "    if (line.optional || line.costType === 'Optional' || !line.costId || line.costDetailType === 'Freight') return")
      + code.slice(persistedSyncEnd)
  }
  // El wizard principal regenera las líneas desde la matriz del tarifario LTL.
  // Distinguir el tarifario de origen evita llevar valores de otra tarifa.
  if (code.includes('function syncResolvedLandLtlTariffLines() {')) {
    code = replaceRequired(
      code,
      '      optional: !isFlat,\n      manual: false,',
      "      optional: !isFlat,\n      ltlSourceTariffId: String(tariff?.id ?? ''),\n      manual: false,",
      'identidad de la fuente del opcional LTL',
    )

    code = replaceRequired(
      code,
      '    if (existing) {\n      Object.assign(existing, values)\n      return\n    }',
      [
        '    if (existing) {',
        '      const previousOptional = !isFlat && existing.key === values.key',
        '        && (existing as RateLine & { ltlSourceTariffId?: string }).ltlSourceTariffId === values.ltlSourceTariffId',
        '        ? {',
        '            costAmount: existing.costAmount,',
        '            saleAmount: existing.saleAmount,',
        '            included: existing.included,',
        '            currencyId: existing.currencyId,',
        '            currencyName: existing.currencyName,',
        '            currencyCode: existing.currencyCode,',
        '            amountCurrencyCode: existing.amountCurrencyCode,',
        '            billToClient: existing.billToClient,',
        '          }',
        '        : null',
        '      Object.assign(existing, values)',
        '      if (previousOptional) Object.assign(existing, previousOptional)',
        '      return',
        '    }',
      ].join('\n'),
      'conservar importes del opcional al sincronizar el mismo tarifario',
    )

    code = replaceRequired(
      code,
      [
        '  rateLines.value = lines',
        "  if (shipmentModeForApi.value === 'Ltl' && resolvedFtlTariff.value) {",
        '    syncResolvedLandLtlTariffLines()',
        '  }',
        '  // syncResolvedLandLtlTariffLines() after every rebuild',
      ].join('\n'),
      [
        '  const previousLtlOptionals = shipmentModeForApi.value === \'Ltl\'',
        '    ? rateLines.value.filter((line) => line.optional',
        "        && String(line.key ?? '').startsWith('ltl-tariff:')",
        "        && (line as RateLine & { ltlSourceTariffId?: string }).ltlSourceTariffId === String(resolvedFtlTariff.value?.id ?? ''))",
        '      .map((line) => ({ ...line }))',
        '    : []',
        '  rateLines.value = lines',
        "  if (shipmentModeForApi.value === 'Ltl' && resolvedFtlTariff.value) {",
        '    syncResolvedLandLtlTariffLines()',
        '    for (const previous of previousLtlOptionals) {',
        '      const current = rateLines.value.find((line) => line.key === previous.key && line.optional)',
        '      if (!current) continue',
        '      current.costAmount = previous.costAmount',
        '      current.saleAmount = previous.saleAmount',
        '      current.included = previous.included',
        '      current.currencyId = previous.currencyId',
        '      current.currencyName = previous.currencyName',
        '      current.currencyCode = previous.currencyCode',
        '      current.amountCurrencyCode = previous.amountCurrencyCode',
        '      current.billToClient = previous.billToClient',
        '    }',
        '  }',
        '  // syncResolvedLandLtlTariffLines() after every rebuild',
      ].join('\n'),
      'preservar cambios al reconstruir Pantalla 7',
    )
  }

  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd < 0) throw new Error('[pricingLtlOptionalEditable] No se encontró </script>.')
  return code.slice(0, scriptEnd) + '\n' + MARKER + '\n' + code.slice(scriptEnd)
}

export function pricingLtlOptionalEditable(): Plugin {
  return {
    name: 'dhole-pricing-ltl-optional-editable',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (!SUFFIXES.some((suffix) => normalizedId.endsWith(suffix))) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

import type { Plugin } from 'vite'

// Pantalla 7: los opcionales LTL son importes de la cotización, no costos
// maestros inmutables. Mantener el resto de modalidades sin cambios.
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
  const editableOptionalLtl = "(shipmentModeForApi === 'Ltl' && line.optional)"

  code = replaceRequired(
    code,
    ':disabled="line.costDetailType === \'AgentCharge\' || line.costType !== \'Variable\'"',
    ':disabled="(line.costDetailType === \'AgentCharge\' || line.costType !== \'Variable\') && !' + editableOptionalLtl + '"',
    'desbloquear costo de un opcional LTL',
  )
  code = replaceRequired(
    code,
    ':disabled="line.costDetailType === \'AgentCharge\'"',
    ':disabled="line.costDetailType === \'AgentCharge\' && !' + editableOptionalLtl + '"',
    'desbloquear costo y venta de opcionales LTL clasificados como cargo de agente',
  )

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
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!SUFFIXES.some((suffix) => normalizedId.endsWith(suffix))) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

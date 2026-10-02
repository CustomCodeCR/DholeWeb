import type { Plugin } from 'vite'

const WIZARD_SUFFIXES = [
  '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
  '/src/modules/pricing/existing/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
]
const MARKER = '// dhole-ltl-provider-parity-20260928'

function patchStepSixTemplate(source: string) {
  const startTag = '<div v-else-if="step === 6" class="space-y-6">'
  const endTag = '<div v-else-if="step === 4" class="space-y-6">'
  const start = source.indexOf(startTag)
  const end = source.indexOf(endTag, start + startTag.length)
  if (start < 0 || end < 0) return source

  let block = source.slice(start, end)

  block = block.replace(
    `<p class="crystal-description">{{ form.modality === 'Land' ? 'Para terrestre no se requiere agente ni naviera. La moneda muestra el Value configurado en Config.' : 'Los selects muestran el Value configurado en Config.' }}</p>`,
    `<p class="crystal-description">{{ shipmentModeForApi === 'Ltl' ? (form.manualRate && landLtlCommercialProfile === 'FinalClient' ? 'Tarifa LTL Cliente manual: ingrese moneda, costo y venta. LTL no utiliza agente, naviera ni días libres.' : 'La tarifa LTL seleccionada en Pantalla 5 se carga automáticamente. LTL no utiliza agente, naviera ni días libres.') : form.modality === 'Land' ? 'Para terrestre no se requiere agente ni naviera. La moneda muestra el Value configurado en Config.' : 'Los selects muestran el Value configurado en Config.' }}</p>`,
  )

  const gridAnchor = '          <div class="crystal-soft grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 md:p-5">'
  if (block.includes(gridAnchor)) {
    block = block.replace(
      gridAnchor,
      `          <div
            v-if="shipmentModeForApi === 'Ltl' && resolvedFtlTariff"
            class="rounded-[22px] border border-[rgb(var(--dh-primary-rgb)/0.22)] bg-[rgb(var(--dh-primary-rgb)/0.05)] p-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">Tarifa LTL seleccionada</p>
                <p class="mt-1 font-black">{{ landLtlCommercialProfile === 'Nvocc' ? 'NVOCC' : 'Cliente' }}</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ resolvedFtlTariff.originName }} → {{ resolvedFtlTariff.destinationName }}
                </p>
              </div>
              <DhBadge variant="success">{{ landLtlBillableCbm(resolvedFtlTariff).toFixed(3) }} CBM cobrable</DhBadge>
            </div>
          </div>

${gridAnchor}`,
    )
  }

  block = block.replace(
    '<DhSelect v-model="form.currencyId" label="Moneda" :options="currencyOptions" />',
    '<DhSelect v-model="form.currencyId" label="Moneda" :options="currencyOptions" :disabled="shipmentModeForApi === \'Ltl\' && Boolean(resolvedFtlTariff)" />',
  )

  block = block.replace(
    '<DhInput v-model.number="form.freightCost" type="number" min="0" step="0.01" label="Flete internacional · costo" />',
    '<DhInput v-model.number="form.freightCost" type="number" min="0" step="0.01" :label="shipmentModeForApi === \'Ltl\' ? \'Flete LTL · costo calculado\' : \'Flete internacional · costo\'" :disabled="shipmentModeForApi === \'Ltl\' && Boolean(resolvedFtlTariff)" />',
  )

  block = block.replace(
    '<DhInput v-model.number="form.freightSale" type="number" min="0" step="0.01" label="Flete internacional · venta" />',
    '<DhInput v-model.number="form.freightSale" type="number" min="0" step="0.01" :label="shipmentModeForApi === \'Ltl\' ? \'Flete LTL · venta calculada\' : \'Flete internacional · venta\'" :disabled="shipmentModeForApi === \'Ltl\' && Boolean(resolvedFtlTariff)" />',
  )

  block = block.replace(
    '<DhInput v-if="shipmentModeForApi !== \'Lcl\'" v-model.number="form.freeDays" type="number" min="0" label="Días libres" :disabled="number(selectedImportRate?.freeDays) > 0" />',
    '<DhInput v-if="shipmentModeForApi !== \'Lcl\' && shipmentModeForApi !== \'Ltl\'" v-model.number="form.freeDays" type="number" min="0" label="Días libres" :disabled="number(selectedImportRate?.freeDays) > 0" />',
  )

  block = block.replace(
    '<div v-else class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-sm font-bold text-[var(--dh-text-muted)]"><span class="block text-[10px] font-black uppercase tracking-[0.12em]">Días libres</span><span class="mt-1 block text-[var(--dh-text)]">No aplica para LCL</span></div>',
    '<div v-else-if="shipmentModeForApi === \'Lcl\'" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-sm font-bold text-[var(--dh-text-muted)]"><span class="block text-[10px] font-black uppercase tracking-[0.12em]">Días libres</span><span class="mt-1 block text-[var(--dh-text)]">No aplica para LCL</span></div>',
  )

  block = block.replace(
    '<DhInput v-model.number="form.transitDays" type="number" min="0" label="Días de tránsito" />',
    '<DhInput v-model.number="form.transitDays" type="number" min="0" label="Días de tránsito" :disabled="shipmentModeForApi === \'Ltl\' && Boolean(resolvedFtlTariff)" />',
  )

  return source.slice(0, start) + block + source.slice(end)
}

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  let code = source

  // Final-runtime guard: this plugin runs after every pricing wizard transform.
  // Recreate LTL helpers here if a previous transform removed their declarations.
  const helperDefinitions: string[] = []

  if (
    code.includes('isPanamaLandLtlTariff(')
    && !code.includes('function isPanamaLandLtlTariff(')
  ) {
    helperDefinitions.push([
      'function isPanamaLandLtlTariff(tariff: any) {',
      "  const route = normalizeCatalogValue(String(tariff?.originName ?? '') + ' ' + String(tariff?.originCode ?? ''))",
      "  return route.includes('panama') || route.includes('cfz') || route.includes('colon free zone') || route.includes('zona libre de colon')",
      '}',
    ].join('\n'))
  }

  if (
    code.includes('landLtlBillableCbm(')
    && !code.includes('function landLtlBillableCbm(')
  ) {
    helperDefinitions.push([
      'function landLtlBillableCbm(tariff: any) {',
      '  const factor = Math.max(1, number(tariff?.weightKgPerCbm) || 330)',
      '  const weightCbm = Math.max(0, number(form.cargoWeightKg)) / factor',
      '  const calculated = Math.max(number(lclDimensionalCbm.value), weightCbm)',
      '  return calculated > 0 ? Math.max(1, calculated) : 0',
      '}',
    ].join('\n'))
  }

  if (
    code.includes('applyResolvedLandLtlFreight(')
    && !code.includes('function applyResolvedLandLtlFreight(')
  ) {
    helperDefinitions.push([
      'function applyResolvedLandLtlFreight() {',
      "  if (shipmentModeForApi.value !== 'Ltl' || !resolvedFtlTariff.value) return",
      '  const tariff = resolvedFtlTariff.value',
      '  const cbm = landLtlBillableCbm(tariff)',
      '  const panamaSurcharge = isPanamaLandLtlTariff(tariff) ? number(tariff.panamaCostSurchargePerCbm ?? 9) : 0',
      '  const effectiveCostPerCbm = number(tariff.costPerCbm) + panamaSurcharge',
      '  form.freightCost = effectiveCostPerCbm * cbm',
      '  form.freightSale = Math.max(number(tariff.priceAmount) * cbm, number(tariff.minimumAmount))',
      '}',
    ].join('\n'))
  }

  if (
    code.includes('resolvedFtlTariff')
    && !code.includes('function syncResolvedLandLtlTariffLines(')
  ) {
    helperDefinitions.push([
      'function syncResolvedLandLtlTariffLines() {',
      "  if (shipmentModeForApi.value !== 'Ltl' || !resolvedFtlTariff.value) return",
      '  const tariff = resolvedFtlTariff.value',
      '  const currency = selectedCurrency.value ?? catalogs.currencies[0]',
      '  if (!currency) return',
      '  const cbm = landLtlBillableCbm(tariff)',
      '  if (cbm <= 0) return',
      '',
      '  const fallbackCharges = [',
      "    { key: 'dua', name: 'DUA', costDetailType: 'CustomsCharge', chargeBasis: 'PerDocument', section: 'origin_charges', costAmount: number(tariff.duaCost ?? 50), saleAmount: 60, isFlat: true },",
      "    { key: 'duca-t', name: 'DUCA-T', costDetailType: 'Documentation', chargeBasis: 'PerDocument', section: 'international_freight', costAmount: number(tariff.ducaTCost ?? 30), saleAmount: landLtlCommercialProfile.value === 'Nvocc' ? 30 : 35, isFlat: true },",
      "    { key: 'stuffing', name: 'Stuffing', costDetailType: 'OriginCharge', chargeBasis: 'PerChargeableCbm', section: 'origin_charges', costAmount: number(tariff.stuffingCostPerCbm ?? (550 / 60)), saleAmount: number(tariff.stuffingSalePerCbm ?? 10), isFlat: true },",
      "    { key: 'carta-porte', name: 'Carta Porte', costDetailType: 'Documentation', chargeBasis: 'PerDocument', section: 'international_freight', costAmount: 0, saleAmount: landLtlCommercialProfile.value === 'Nvocc' ? 35 : 45, isFlat: true },",
      "    { key: 'manejos', name: 'Manejos', costDetailType: 'AgentCharge', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: 0, saleAmount: landLtlCommercialProfile.value === 'Nvocc' ? 25 : 45, isFlat: true },",
      "    { key: 'seguro', name: 'Seguro', costDetailType: 'Insurance', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: null, saleAmount: null, isFlat: false },",
      "    { key: 'recolecta', name: 'Recolecta', costDetailType: 'OriginCharge', chargeBasis: 'PerShipment', section: 'pickup_origin', costAmount: null, saleAmount: null, isFlat: false },",
      "    { key: 'reembarque', name: 'Reembarque', costDetailType: 'Other', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: null, saleAmount: null, isFlat: false },",
      "    { key: 'inspeccion', name: 'Inspección', costDetailType: 'CustomsCharge', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: null, saleAmount: null, isFlat: false },",
      "    { key: 'tramite-aduanas-destino', name: 'Trámite Aduanas Destino', costDetailType: 'CustomsCharge', chargeBasis: 'PerShipment', section: 'destination_charges', costAmount: null, saleAmount: null, isFlat: false },",
      "    { key: 'entrega-destino', name: 'Entrega en Destino', costDetailType: 'InlandTransport', chargeBasis: 'PerShipment', section: 'delivery_destination', costAmount: null, saleAmount: null, isFlat: false },",
      "    { key: 'otros', name: 'Otros', costDetailType: 'Other', chargeBasis: 'PerShipment', section: 'destination_charges', costAmount: null, saleAmount: null, isFlat: false },",
      "    { key: 'duca-f', name: 'DUCA-F', costDetailType: 'Documentation', chargeBasis: 'PerDocument', section: 'international_freight', costAmount: null, saleAmount: null, isFlat: false },",
      "    { key: 'impuesto-exportacion', name: 'Impuesto Exportación', costDetailType: 'CustomsCharge', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: null, saleAmount: null, isFlat: false },",
      "    { key: 'recepcion-destino', name: 'Recepción en Destino', costDetailType: 'DestinationCharge', chargeBasis: 'PerShipment', section: 'destination_charges', costAmount: null, saleAmount: null, isFlat: false },",
      '  ]',
      '  const chargeItems = Array.isArray(tariff.ltlChargeItems) && tariff.ltlChargeItems.length',
      '    ? tariff.ltlChargeItems',
      '    : fallbackCharges',
      '',
      '  chargeItems.forEach((charge: any) => {',
      "    const key = String(charge?.key ?? '').trim()",
      "    const name = String(charge?.name ?? '').trim()",
      '    if (!key || !name) return',
      "    const section = String(charge?.section ?? 'origin_charges') as RateSection",
      "    const detailType = String(charge?.costDetailType ?? 'Other') as CostDetailType",
      "    const sourceBasis = String(charge?.chargeBasis ?? 'PerShipment')",
      "    const perCbm = sourceBasis === 'PerCbm' || sourceBasis === 'PerChargeableCbm'",
      "    const chargeBasis = (perCbm ? 'PerShipment' : sourceBasis) as ChargeBasis",
      '    const unitCost = charge?.costAmount == null ? 0 : number(charge.costAmount)',
      '    const unitSale = charge?.saleAmount == null ? 0 : number(charge.saleAmount)',
      '    const costAmount = perCbm ? unitCost * cbm : unitCost',
      '    const saleAmount = perCbm ? unitSale * cbm : unitSale',
      '    const isFlat = Boolean(charge?.isFlat)',
      '    const configuredVariable = !isFlat && (costAmount > 0 || saleAmount > 0)',
      '    const normalizedName = normalizeCatalogValue(name)',
      '    const existing = rateLines.value.find((line) =>',
      "      line.key === 'ltl-tariff:' + key",
      "      || normalizeCatalogValue(line.name) === normalizedName",
      "      || (key === 'seguro' && line.costDetailType === 'Insurance'),",
      '    )',
      "    const formulaNote = perCbm ? ' · ' + cbm.toFixed(3) + ' CBM cobrable.' : ''",
      '    const values = {',
      "      key: 'ltl-tariff:' + key,",
      '      section,',
      '      name,',
      '      costDetailType: detailType,',
      "      costType: 'Variable' as CostType,",
      '      chargeBasis,',
      '      costId: null,',
      "      contextLabel: `Tarifario LTL · ${landLtlCommercialProfile.value === 'Nvocc' ? 'NVOCC' : 'Cliente'}`,",
      "      notes: isFlat ? 'Cargo Flat del tarifario LTL' + formulaNote : 'Cargo variable LTL sin costo ni venta fija; completar cuando corresponda.',",
      '      currencyId: currency.id,',
      '      currencyName: displayValue(currency),',
      '      currencyCode: currency.code,',
      '      amountCurrencyCode: currency.code,',
      '      costAmount: Math.max(0, costAmount),',
      '      saleAmount: Math.max(0, saleAmount),',
      '      included: isFlat || configuredVariable,',
      '      optional: !isFlat,',
      '      manual: false,',
      '      applyDestinationTax: false,',
      '      destinationTaxRate: 0,',
      '    }',
      '    if (existing) {',
      '      Object.assign(existing, values)',
      '      return',
      '    }',
      '    rateLines.value.push(values as RateLine)',
      '  })',
      '}',
    ].join('\n'))
  }

  if (helperDefinitions.length) {
    const runtimeAnchor = 'const canNext = computed(() => {'
    if (!code.includes(runtimeAnchor)) {
      throw new Error('[pricingWizardLtlProviderParity] canNext runtime anchor not found.')
    }
    code = code.replace(runtimeAnchor, helperDefinitions.join('\n\n') + '\n\n' + runtimeAnchor)
  }

  // LTL has its own selection model: commercial profile + resolved master tariff.
  code = code.replace(
    'const canNext = computed(() => {',
    `const canNext = computed(() => {
  if (step.value === 5 && shipmentModeForApi.value === 'Ltl') {
    const manualClient = landLtlCommercialProfile.value === 'FinalClient' && form.manualRate
    return Boolean(landLtlCommercialProfile.value && (resolvedFtlTariff.value || manualClient))
  }
  if (step.value === 6 && shipmentModeForApi.value === 'Ltl') {
    const manualClient = landLtlCommercialProfile.value === 'FinalClient' && form.manualRate
    return Boolean(
      (resolvedFtlTariff.value || manualClient)
      && form.currencyId
      && number(form.freightCost) >= 0
      && number(form.freightSale) >= 0
    )
  }`,
  )

  // Dedicated LTL continuation avoids the imported-rate validation used by FCL/FTL.
  if (
    code.includes('applyResolvedLandLtlFreight')
    && code.includes('function previous() {')
    && !code.includes('function continueWithResolvedLandLtlTariff()')
  ) {
    code = code.replace(
      'function previous() {',
      `function continueWithManualLandLtlTariff() {
  if (
    shipmentModeForApi.value !== 'Ltl'
    || landLtlCommercialProfile.value !== 'FinalClient'
  ) return

  resolvedFtlTariff.value = null
  form.selectedImportRateId = ''
  form.manualRate = true
  form.freeDays = 0
  form.agentId = ''
  form.carrierId = ''
  form.freightCost = 0
  form.freightSale = 0
  form.transitDays = 0
  rateLines.value = rateLines.value.filter((line) => !String(line.key ?? '').startsWith('ltl-tariff:'))
  step.value = 6
}

function continueWithResolvedLandLtlTariff() {
  if (
    shipmentModeForApi.value !== 'Ltl'
    || !resolvedFtlTariff.value
    || !landLtlCommercialProfile.value
  ) return

  applyResolvedLandLtlFreight()
  form.freeDays = 0
  form.agentId = ''
  form.carrierId = ''
  form.transitDays = resolvedFtlTariff.value.transitDays ?? 0
  if (resolvedFtlTariff.value.currencyId) {
    form.currencyId = resolvedFtlTariff.value.currencyId
  }
  step.value = 6
}

watch(step, (currentStep) => {
  if (
    currentStep !== 6
    || shipmentModeForApi.value !== 'Ltl'
    || !resolvedFtlTariff.value
  ) return

  applyResolvedLandLtlFreight()
  form.freeDays = 0
  form.agentId = ''
  form.carrierId = ''
  form.transitDays = resolvedFtlTariff.value.transitDays ?? 0
  if (resolvedFtlTariff.value.currencyId) {
    form.currencyId = resolvedFtlTariff.value.currencyId
  }
})

function previous() {`,
    )
  }

  // Keep next() safe for keyboard/navigation paths too.
  if (
    code.includes('applyResolvedLandLtlFreight')
    && code.includes('async function next() {')
  ) {
    code = code.replace(
      'async function next() {',
      `async function next() {
  if (step.value === 5 && shipmentModeForApi.value === 'Ltl' && resolvedFtlTariff.value) {
    applyResolvedLandLtlFreight()
    form.freeDays = 0
    form.agentId = ''
    form.carrierId = ''
    form.transitDays = resolvedFtlTariff.value.transitDays ?? 0
    if (resolvedFtlTariff.value.currencyId) {
      form.currencyId = resolvedFtlTariff.value.currencyId
    }
  }`,
    )
  }

  const nextStart = code.indexOf('async function next() {')
  const nextEnd = nextStart >= 0 ? code.indexOf('\n}\n\nfunction ', nextStart) : -1
  if (nextStart >= 0 && nextEnd >= 0) {
    let nextBlock = code.slice(nextStart, nextEnd + 2)
    const advanceAnchor = '  if (step.value < 8) step.value += 1'
    if (
      nextBlock.includes(advanceAnchor)
      && !nextBlock.includes('syncResolvedLandLtlTariffLines()')
    ) {
      nextBlock = nextBlock.replace(
        advanceAnchor,
        `  if (step.value === 6 && shipmentModeForApi.value === 'Ltl') {
    syncResolvedLandLtlTariffLines()
  }
${advanceAnchor}`,
      )
      code = code.slice(0, nextStart) + nextBlock + code.slice(nextEnd + 2)
    }
  }

  // The tariff card button advances through the LTL-specific transition.
  code = code.replace(
    '@click="next">Usar tarifa {{ shipmentModeForApi.toUpperCase() }}</DhButton>',
    '@click="shipmentModeForApi === \'Ltl\' ? continueWithResolvedLandLtlTariff() : next()">Usar tarifa {{ shipmentModeForApi.toUpperCase() }}</DhButton>',
  )

  // LTL, like LCL, never persists free days.
  code = code.replaceAll(
    "freeDays: shipmentModeForApi.value === 'Lcl' ? 0 : number(form.freeDays),",
    "freeDays: (shipmentModeForApi.value === 'Lcl' || shipmentModeForApi.value === 'Ltl') ? 0 : number(form.freeDays),",
  )

  code = patchStepSixTemplate(code)

  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd >= 0) {
    code = code.slice(0, scriptEnd) + '\n' + MARKER + '\n' + code.slice(scriptEnd)
  }

  return code
}

export function pricingWizardLtlProviderParity(): Plugin {
  return {
    name: 'dhole-pricing-wizard-ltl-provider-parity',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!WIZARD_SUFFIXES.some((suffix) => normalizedId.endsWith(suffix))) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

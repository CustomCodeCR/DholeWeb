import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingWizardPanamaContinuation] ${label} anchor not found.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source
  if (code.includes('// dhole-panama-continuation-state')) return code

  code = replaceRequired(
    code,
    `import { PricingService } from '@/core/services/pricingService'`,
    `import { PricingService } from '@/core/services/pricingService'\nimport { PanamaContinuationService, type PanamaLandContinuationDto } from '@/core/services/panamaContinuationService'`,
    'Panama continuation service import',
  )

  code = replaceRequired(
    code,
    `const allInPresentation = ref(false)`,
    `const allInPresentation = ref(false)\n// dhole-panama-continuation-state\ntype PanamaContinuationMode = 'DoubleMaritime' | 'MaritimeLand'\nconst panamaContinuationMode = ref<PanamaContinuationMode | ''>('')\nconst panamaContinuationOceanRates = ref<ImportRateSelectDto[]>([])\nconst selectedPanamaContinuationRateId = ref('')\nconst panamaContinuationLandTariff = ref<PanamaLandContinuationDto | null>(null)\nconst panamaContinuationManualLand = ref(false)\nconst loadingPanamaContinuation = ref(false)\nconst panamaPrimaryTransitDays = ref(0)`,
    'Panama continuation state',
  )

  const canNextAnchor = `const canNext = computed(() => {`
  const helpers = `const panamaContinuationActive = computed(() =>\n  ['Maritime', 'Multimodal'].includes(String(form.modality))\n  && shipmentModeForApi.value === 'Fcl'\n  && isMultimodalViaPanama(selectedDestination.value),\n)\n\nwatch(\n  panamaContinuationActive,\n  (active) => {\n    if (active) {\n      // Producción: la continuación vía Panamá es automática y siempre marítimo-terrestre.\n      panamaContinuationMode.value = 'MaritimeLand'\n      return\n    }\n    if (panamaContinuationMode.value) clearPanamaContinuationResolution(true)\n  },\n  { immediate: true },\n)\n\nconst selectedPanamaOceanContinuationRate = computed(() =>\n  panamaContinuationOceanRates.value.find((rate) => rate.id === selectedPanamaContinuationRateId.value) ?? null,\n)\n\nfunction clearPanamaContinuationResolution(clearMode = false) {\n  panamaContinuationOceanRates.value = []\n  selectedPanamaContinuationRateId.value = ''\n  panamaContinuationLandTariff.value = null\n  panamaContinuationManualLand.value = false\n  panamaPrimaryTransitDays.value = 0\n  if (clearMode) panamaContinuationMode.value = ''\n}\n\nfunction selectPanamaContinuationMode(mode: PanamaContinuationMode) {\n  panamaContinuationMode.value = mode\n  clearPanamaContinuationResolution(false)\n}\n\nfunction panamaContinuationFinalDestination() {\n  const selected = selectedPod.value ? displayValue(selectedPod.value) : ''\n  return selected || String(editingRate.value?.podName ?? '').trim()\n}\n\nfunction panamaContinuationFinalDestinationCode() {\n  return String(selectedPod.value?.code ?? editingRate.value?.podCode ?? '').trim() || null\n}\n\nfunction isPanamaCostaRicaGamContinuation(finalDestination: string) {\n  const normalized = normalizeCatalogValue(finalDestination)\n  return normalized.includes('san jose') || normalized === 'costa rica'\n}\n\nfunction panamaContinuationLandOrigin(finalDestination: string, firstLegPoe = 'Panamá') {\n  if (isPanamaCostaRicaGamContinuation(finalDestination)) {\n    return 'CFZ / Zona Libre Colón, Panamá'\n  }\n  return firstLegPoe || 'Panamá'\n}\n\nfunction panamaCostaRicaGamFallback(finalDestination: string): PanamaLandContinuationDto | null {\n  if (!isPanamaCostaRicaGamContinuation(finalDestination)) return null\n\n  const usd = catalogs.currencies.find((currency) => {\n    const value = normalizeCatalogValue([currency.code, displayValue(currency), currency.label].filter(Boolean).join(' '))\n    return value === 'usd' || value.includes(' usd') || value.includes('dolar') || value.includes('dollar')\n  }) ?? null\n  if (!usd) return null\n\n  return {\n    id: 'gcf-cfz-san-jose-2140',\n    originId: null,\n    originName: 'CFZ / Zona Libre Colón, Panamá',\n    originCode: null,\n    destinationId: selectedPod.value?.id ?? editingRate.value?.podId ?? null,\n    destinationName: finalDestination || 'San José, Costa Rica',\n    destinationCode: panamaContinuationFinalDestinationCode(),\n    equipmentClass: '48_53',\n    equipmentLabel: 'FTL · Contenedor marítimo vía Panamá',\n    currencyId: usd.id,\n    currencyName: displayValue(usd) || usd.label || 'USD',\n    currencyCode: String(usd.code || 'USD'),\n    priceAmount: 2140,\n    transitDays: null,\n    source: 'GCF · Multimodal vía Panamá',\n    notes: 'Regla GCF: CFZ / Zona Libre Colón, Panamá → San José, Costa Rica · USD 2,140 por unidad.',\n    isActive: true,\n  }\n}\n\nfunction panamaContinuationActualPol(rate: ImportRateSelectDto) {\n  return String(rate.poe || rate.pod || '').trim()\n}\n\nfunction panamaContinuationRouteLabel() {\n  const destination = panamaContinuationFinalDestination() || 'POD'\n  const firstLegPoe = selectedImportRate.value ? panamaContinuationActualPol(selectedImportRate.value) : 'Panamá'\n  const origin = panamaContinuationMode.value === 'MaritimeLand'\n    ? panamaContinuationLandOrigin(destination, firstLegPoe)\n    : firstLegPoe || 'Panamá'\n  return origin + ' → ' + destination\n}\n\nfunction focusPanamaContinuationPanel() {\n  requestAnimationFrame(() => {\n    document.querySelector('[data-panama-continuation-panel]')?.scrollIntoView({\n      behavior: 'smooth',\n      block: 'center',\n    })\n  })\n}\n\nasync function loadPanamaContinuation(primaryRate: ImportRateSelectDto) {\n  if (!panamaContinuationActive.value || !panamaContinuationMode.value) {\n    step.value = 6\n    return\n  }\n\n  const finalDestination = panamaContinuationFinalDestination()\n  const panamaPol = panamaContinuationActualPol(primaryRate)\n  if (!finalDestination) {\n    toastStore.warning('POD requerido', 'Seleccione el destino final antes de resolver la continuación desde Panamá.')\n    return\n  }\n  if (!panamaPol) {\n    toastStore.warning('POE real de Panamá no disponible', 'La tarifa del primer tramo debe identificar el puerto real de Panamá antes de continuar.')\n    return\n  }\n\n  clearPanamaContinuationResolution(false)\n  panamaPrimaryTransitDays.value = Math.max(0, number(primaryRate.transitDays))\n\n  try {\n    loadingPanamaContinuation.value = true\n\n    if (panamaContinuationMode.value === 'DoubleMaritime') {\n      const rates = await PanamaContinuationService.ocean({\n        panamaPol,\n        panamaPolCode: primaryRate.poeCode || null,\n        finalDestination,\n        finalDestinationCode: panamaContinuationFinalDestinationCode(),\n        containerType: primaryRate.containerType || displayValue(selectedEquipment.value),\n        quoteDate: form.loadDate,\n      })\n      panamaContinuationOceanRates.value = rates\n        .filter((rate) => rate.id !== primaryRate.id)\n        .sort((left, right) => {\n          const statusRank = Number(left.status === 'Approved') - Number(right.status === 'Approved')\n          if (statusRank !== 0) return -statusRank\n          return number(left.freight) - number(right.freight)\n        })\n\n      if (!panamaContinuationOceanRates.value.length) {\n        toastStore.warning(\n          'Segundo tramo marítimo no disponible',\n          'No hay un flete marítimo vigente desde el POE real de Panamá hasta el POD seleccionado.',\n        )\n      }\n      return\n    }\n\n    const landOrigin = panamaContinuationLandOrigin(finalDestination, panamaPol)\n    let land = await PanamaContinuationService.land({\n      panamaPol: landOrigin,\n      panamaPolCode: landOrigin === panamaPol ? primaryRate.poeCode || null : null,\n      finalDestination,\n      finalDestinationCode: panamaContinuationFinalDestinationCode(),\n      containerType: primaryRate.containerType || displayValue(selectedEquipment.value),\n      quoteDate: form.loadDate,\n    })\n\n    // Regla comercial GCF: para multimodal marítimo-terrestre hacia GAM/San José,\n    // el tramo terrestre sale de CFZ / Zona Libre Colón y cuesta USD 2,140 por unidad.\n    // Mantener este fallback en Web evita que el flujo se rompa si Pricing todavía\n    // está desplegando/sembrando la matriz terrestre.\n    land ??= panamaCostaRicaGamFallback(finalDestination)\n\n    panamaContinuationLandTariff.value = land\n    panamaContinuationManualLand.value = !land\n\n    if (!land) {\n      toastStore.warning(\n        'Flete terrestre no configurado',\n        'No existe una tarifa terrestre internacional para ' + landOrigin + ' → ' + finalDestination + '. Revise el tarifario FTL/LTL o continúe manualmente.',\n      )\n    }\n  } catch (error) {\n    if (panamaContinuationMode.value === 'MaritimeLand') {\n      const fallback = panamaCostaRicaGamFallback(finalDestination)\n      if (fallback) {\n        panamaContinuationLandTariff.value = fallback\n        panamaContinuationManualLand.value = false\n        toastStore.warning('Tarifa terrestre GCF aplicada', 'Se aplicó CFZ / Zona Libre Colón, Panamá → San José, Costa Rica por USD 2,140 por unidad.')\n        return\n      }\n      panamaContinuationManualLand.value = true\n    }\n    toastStore.backendError(error, 'No se pudo resolver la continuación de la ruta desde Panamá.')\n  } finally {\n    loadingPanamaContinuation.value = false\n  }\n}\n\nfunction choosePanamaOceanContinuation(rate: ImportRateSelectDto) {\n  selectedPanamaContinuationRateId.value = rate.id\n  panamaContinuationLandTariff.value = null\n  panamaContinuationManualLand.value = false\n  form.transitDays = panamaPrimaryTransitDays.value + Math.max(0, number(rate.transitDays))\n  step.value = 6\n}\n\nfunction confirmPanamaLandContinuation() {\n  const land = panamaContinuationLandTariff.value\n  if (!land && !panamaContinuationManualLand.value) return\n  form.transitDays = panamaPrimaryTransitDays.value + Math.max(0, number(land?.transitDays))\n  step.value = 6\n}\n\nfunction appendPanamaContinuationLines(lines: RateLine[]) {\n  if (!panamaContinuationActive.value || !panamaContinuationMode.value) return\n\n  const primary = selectedImportRate.value\n  const panamaPol = primary ? panamaContinuationActualPol(primary) : ''\n  const finalDestination = panamaContinuationFinalDestination()\n  const landOrigin = panamaContinuationLandOrigin(finalDestination, panamaPol)\n\n  if (panamaContinuationMode.value === 'DoubleMaritime') {\n    const rate = selectedPanamaOceanContinuationRate.value\n    if (!rate) return\n    const currencyCode = String(rate.currencyCode || rate.currency || 'USD')\n    lines.push({\n      key: 'panama-continuation:ocean:' + rate.id,\n      section: 'international_freight',\n      name: 'Flete marítimo Panamá → POD',\n      costDetailType: 'Freight',\n      costType: 'Variable',\n      chargeBasis: 'PerContainer',\n      contextLabel: panamaPol + ' → ' + finalDestination + ' · ' + (rate.carrier || 'Naviera'),\n      notes: '[PANAMA_CONTINUATION:DOUBLE_MARITIME:' + rate.id + '] El POE real de Panamá del primer tramo se utiliza como POL del segundo tramo marítimo. Naviera: ' + (rate.carrier || 'N/D') + '.',\n      currencyId: rate.currencyId || form.currencyId,\n      currencyName: String(rate.currency || rate.currencyCode || 'USD'),\n      currencyCode,\n      amountCurrencyCode: currencyCode,\n      costAmount: number(rate.freight),\n      saleAmount: number(rate.totalSale ?? rate.freight),\n      included: true,\n      optional: false,\n      manual: false,\n    })\n    return\n  }\n\n  const land = panamaContinuationLandTariff.value\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]\n  if (!land && !currency) return\n  const currencyCode = String(land?.currencyCode || currency?.code || 'USD')\n  lines.push({\n    key: 'panama-continuation:land:' + (land?.id || 'manual'),\n    section: 'international_freight',\n    name: 'Flete terrestre internacional ' + landOrigin + ' → ' + finalDestination,\n    costDetailType: 'InlandTransport',\n    costType: 'Variable',\n    chargeBasis: 'PerContainer',\n    contextLabel: landOrigin + ' → ' + finalDestination + ' · Marítimo-terrestre',\n    notes: '[PANAMA_CONTINUATION:MARITIME_LAND:' + (land?.id || 'manual') + '] Continuación terrestre internacional ' + landOrigin + ' → ' + finalDestination + '.' + (land?.source ? ' Fuente: ' + land.source + '.' : ''),\n    currencyId: land?.currencyId || currency!.id,\n    currencyName: String(land?.currencyName || displayValue(currency) || currency?.code || 'USD'),\n    currencyCode,\n    amountCurrencyCode: currencyCode,\n    costAmount: number(land?.priceAmount),\n    saleAmount: number(land?.priceAmount),\n    included: true,\n    optional: false,\n    manual: !land,\n  })\n}\n\n${canNextAnchor}`
  code = replaceRequired(code, canNextAnchor, helpers, 'Panama continuation helpers')

  // Pantalla 3: para el POE sintético de Panamá se exige POD y tipo de continuación.
  const canNextIndex = code.indexOf(canNextAnchor)
  const stepThreeIndex = code.indexOf(`  if (step.value === 3) {`, canNextIndex)
  const stepThreeReturnIndex = code.indexOf(`\n    return Boolean(`, stepThreeIndex)
  if (stepThreeIndex < 0 || stepThreeReturnIndex < 0) {
    throw new Error('[pricingWizardPanamaContinuation] Screen 3 validation anchor not found.')
  }
  code = code.slice(0, stepThreeReturnIndex)
    + `\n    if (panamaContinuationActive.value && (!form.podId || !panamaContinuationMode.value)) return false`
    + code.slice(stepThreeReturnIndex)

  const stepFiveIndex = code.indexOf(`  if (step.value === 5)`, canNextIndex)
  if (stepFiveIndex < 0) {
    throw new Error('[pricingWizardPanamaContinuation] Screen 5 validation anchor not found.')
  }
  code = code.slice(0, stepFiveIndex)
    + `  if (step.value === 5 && panamaContinuationActive.value) {\n    if (panamaContinuationMode.value === 'DoubleMaritime') return Boolean(selectedPanamaContinuationRateId.value)\n    if (panamaContinuationMode.value === 'MaritimeLand') return Boolean(panamaContinuationLandTariff.value || panamaContinuationManualLand.value)\n    return false\n  }\n`
    + code.slice(stepFiveIndex)

  // Mantener el POD final del usuario; la tarifa primaria solo aporta el POE real de Panamá.
  const chooseRateStart = code.indexOf(`function chooseRate(rate: ImportRateSelectDto) {`)
  const chooseRateEnd = code.indexOf(`function continueManual() {`, chooseRateStart)
  if (chooseRateStart < 0 || chooseRateEnd < 0) {
    throw new Error('[pricingWizardPanamaContinuation] Imported rate selection anchors not found.')
  }
  let chooseRateBlock = code.slice(chooseRateStart, chooseRateEnd)
  chooseRateBlock = chooseRateBlock.replace(
    `  if (ratePod) form.podId = ratePod.id`,
    `  if (ratePod && !panamaContinuationActive.value) form.podId = ratePod.id`,
  )
  const chooseRateLastStep = chooseRateBlock.lastIndexOf(`  step.value = 6`)
  if (chooseRateLastStep < 0) {
    throw new Error('[pricingWizardPanamaContinuation] Imported rate final navigation not found.')
  }
  chooseRateBlock = chooseRateBlock.slice(0, chooseRateLastStep)
    + `  if (panamaContinuationActive.value && panamaContinuationMode.value) {\n    focusPanamaContinuationPanel()\n    void loadPanamaContinuation(rate)\n    return\n  }\n  step.value = 6`
    + chooseRateBlock.slice(chooseRateLastStep + `  step.value = 6`.length)
  code = code.slice(0, chooseRateStart) + chooseRateBlock + code.slice(chooseRateEnd)

  // En multimodal Panamá no se permite perder el POE real continuando una tarifa primaria totalmente manual.
  code = code.replace(
    `function continueManual() {`,
    `function continueManual() {\n  if (panamaContinuationActive.value) {\n    toastStore.warning('Tarifa marítima requerida', 'Para Multimodal Via Panamá seleccione una tarifa del primer tramo que identifique el POE real de Panamá.')\n    return\n  }`,
  )

  // Las tarifas manuales guardadas con el POE sintético no contienen el puerto real de Panamá.
  if (code.includes(`async function searchSavedManualRates() {`)) {
    code = code.replace(
      `async function searchSavedManualRates() {`,
      `async function searchSavedManualRates() {\n  if (panamaContinuationActive.value) {\n    availableSavedManualRates.value = []\n    selectedSavedManualRateId.value = ''\n    return\n  }`,
    )
  }

  // Pantalla 7: agregar la segunda etapa al desglose económico.
  const rateLinesAssignment = `  rateLines.value = lines`
  const rateLinesIndex = code.indexOf(rateLinesAssignment, code.indexOf(`function rebuildRateLines() {`))
  if (rateLinesIndex < 0) {
    throw new Error('[pricingWizardPanamaContinuation] Rate line rebuild anchor not found.')
  }
  code = code.slice(0, rateLinesIndex)
    + `  appendPanamaContinuationLines(lines)\n`
    + code.slice(rateLinesIndex)

  // Limpiar la resolución si cambia POD/ruta y conservar el modo mientras siga siendo Multimodal Panamá.
  const watcherAnchor = `watch(\n  () => selectedIncotermCode.value,`
  if (!code.includes(watcherAnchor)) {
    throw new Error('[pricingWizardPanamaContinuation] Route watcher anchor not found.')
  }
  code = code.replace(
    watcherAnchor,
    `watch(\n  () => [panamaContinuationActive.value, form.podId] as const,\n  ([active], previous) => {\n    if (!active) {\n      clearPanamaContinuationResolution(true)\n      return\n    }\n    if (!previous || previous[1] !== form.podId) clearPanamaContinuationResolution(false)\n  },\n)\n\n${watcherAnchor}`,
  )

  code = code.replace(
    `function resetWizard() {`,
    `function resetWizard() {\n  clearPanamaContinuationResolution(true)`,
  )

  // Pantalla 3: elección explícita de doble marítimo vs marítimo-terrestre.
  const equipmentRowAnchor = `            <!-- Fila 3: tamaño, tipo y cantidad del equipo. -->`
  const continuationSelector = equipmentRowAnchor\n  code = replaceRequired(code, equipmentRowAnchor, continuationSelector, 'Screen 3 automatic Panama continuation')

  // Pantalla 5: después de escoger el primer flete se resuelve la etapa Panamá → POD.
  const screenFive = code.indexOf(`<div v-else-if="step === 5"`)
  if (screenFive < 0) throw new Error('[pricingWizardPanamaContinuation] Screen 5 not found.')
  const loadingIf = code.indexOf(`<div v-if="loadingRates`, screenFive)
  const loadingElseIf = code.indexOf(`<div v-else-if="loadingRates`, screenFive)
  const loadingIndex = [loadingIf, loadingElseIf].filter((value) => value >= 0).sort((a, b) => a - b)[0] ?? -1
  if (loadingIndex < 0) throw new Error('[pricingWizardPanamaContinuation] Screen 5 loading block not found.')
  const lclSelectorIndex = code.lastIndexOf(`<PricingLclRateSourceSelector`, loadingIndex)
  const continuationInsertIndex = lclSelectorIndex >= screenFive ? lclSelectorIndex : loadingIndex

  const continuationPanel = `          <div v-if="panamaContinuationActive && form.selectedImportRateId" data-panama-continuation-panel class="crystal-soft space-y-4 p-4 md:p-5">\n            <div class="flex flex-wrap items-start justify-between gap-3">\n              <div>\n                <p class="text-sm font-black">Etapa 2 · {{ panamaContinuationRouteLabel() }}</p>\n                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">\n                  {{ panamaContinuationMode === 'DoubleMaritime'\n                    ? 'Seleccione el segundo flete marítimo. El POE real del primer tramo se usa como POL.'\n                    : 'Confirme el flete terrestre internacional desde CFZ / Zona Libre Colón hasta el POD final.' }}\n                </p>\n                <p class="mt-1 text-xs font-black text-[var(--dh-text)]">POD final: {{ panamaContinuationFinalDestination() || 'No definido' }}</p>\n              </div>\n              <DhBadge variant="primary">{{ panamaContinuationMode === 'DoubleMaritime' ? 'Doble marítimo' : 'Marítimo - terrestre' }}</DhBadge>\n            </div>\n\n            <div v-if="loadingPanamaContinuation" class="py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Buscando continuación {{ panamaContinuationRouteLabel() }}…</div>\n\n            <template v-else-if="panamaContinuationMode === 'DoubleMaritime'">\n              <div v-if="panamaContinuationOceanRates.length" class="grid gap-3 xl:grid-cols-2">\n                <button\n                  v-for="rate in panamaContinuationOceanRates"\n                  :key="'panama-ocean:' + rate.id"\n                  type="button"\n                  class="crystal-rate-card text-left"\n                  :class="selectedPanamaContinuationRateId === rate.id ? 'crystal-rate-card--active' : ''"\n                  @click="choosePanamaOceanContinuation(rate)"\n                >\n                  <div class="flex items-start justify-between gap-3">\n                    <div>\n                      <p class="font-black">{{ rate.carrier || 'Naviera' }}</p>\n                      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ rate.pol }} → {{ rate.poe || rate.pod }} · {{ rate.containerType }}</p>\n                    </div>\n                    <DhBadge :variant="rate.status === 'PreAuthorized' ? 'warning' : 'success'">{{ rate.status === 'PreAuthorized' ? 'Preautorizada' : 'Preaprobada' }}</DhBadge>\n                  </div>\n                  <p class="mt-4 text-xl font-black">{{ formatMoney(rate.freight, displayValue(findById(catalogs.currencies, rate.currencyId)) || rate.currency || 'USD') }}</p>\n                  <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">Vigencia {{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}<template v-if="rate.transitDays"> · {{ rate.transitDays }} días</template></p>\n                </button>\n              </div>\n              <div v-else class="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-xs font-semibold text-[var(--dh-text-soft)]">\n                No hay un segundo flete marítimo vigente desde el POE real de Panamá hasta el POD seleccionado. Cambie el POD, el tipo de continuación o cargue la tarifa correspondiente.\n              </div>\n            </template>\n\n            <template v-else-if="panamaContinuationMode === 'MaritimeLand'">\n              <div v-if="panamaContinuationLandTariff" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">\n                <div class="flex flex-wrap items-start justify-between gap-3">\n                  <div>\n                    <p class="font-black">Flete terrestre internacional</p>\n                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ panamaContinuationLandTariff.originName }} → {{ panamaContinuationLandTariff.destinationName }} · {{ panamaContinuationLandTariff.equipmentLabel }}</p>\n                  </div>\n                  <DhBadge variant="success">Matriz terrestre</DhBadge>\n                </div>\n                <p class="mt-4 text-xl font-black">{{ formatMoney(panamaContinuationLandTariff.priceAmount, panamaContinuationLandTariff.currencyCode || panamaContinuationLandTariff.currencyName || 'USD') }}</p>\n                <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]"><template v-if="panamaContinuationLandTariff.transitDays != null">{{ panamaContinuationLandTariff.transitDays }} días · </template>{{ panamaContinuationLandTariff.source || 'Pricing FTL' }}</p>\n                <div class="mt-4 flex justify-end"><DhButton @click="confirmPanamaLandContinuation">Usar flete terrestre</DhButton></div>\n              </div>\n              <div v-else-if="panamaContinuationManualLand" class="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">\n                <p class="text-sm font-black">Flete terrestre pendiente de completar</p>\n                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">No existe una tarifa automática para {{ panamaContinuationRouteLabel() }}. Revise el tarifario FTL/LTL o continúe de manera manual.</p>\n                <div class="mt-4 flex flex-wrap justify-end gap-2">
                  <DhButton variant="secondary" @click="router.push('/pricing/ftl-tariffs')">Administrar tarifas FTL / LTL</DhButton>
                  <DhButton variant="secondary" :disabled="loadingPanamaContinuation" @click="selectedImportRate && loadPanamaContinuation(selectedImportRate)">Reintentar búsqueda</DhButton>
                  <DhButton @click="confirmPanamaLandContinuation">Continuar con flete terrestre manual</DhButton>
                </div>\n              </div>\n            </template>\n          </div>\n\n`

  code = code.slice(0, continuationInsertIndex) + continuationPanel + code.slice(continuationInsertIndex)

  return code
}

export function pricingWizardPanamaContinuation(): Plugin {
  return {
    name: 'dhole-pricing-wizard-panama-continuation',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

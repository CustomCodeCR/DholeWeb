import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceExactlyOnce(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) throw new Error('[pricingWizardCompleteDraftNavigation] ' + label + ': expected 1 anchor, got ' + count)
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  // Keep a context fingerprint so changes in route/provider may refresh automatic
  // costs while returning to Pantalla 7 never erases user-entered sale amounts.
  const helpers = [
    "let pricingDraftLastLineContext = ''",
    "",
    "function pricingDraftLineContextKey() {",
    "  return [form.modality, form.shipmentMode, form.originId, form.destinationId,",
    "    form.podId, form.incotermId, form.agentId, form.carrierId, form.equipmentId,",
    "    [...form.serviceIds].sort().join(',')].join('|')",
    "}",
    "",
    "function pricingDraftLineIdentity(line: RateLine) {",
    "  if (line.costId) return 'cost:' + line.costId",
    "  if (line.key) return 'key:' + line.key",
    "  return 'name:' + normalizeCatalogValue(line.name) + '|' + line.section + '|' + line.costDetailType",
    "}",
    "",
  ].join('\n')
  code = replaceExactlyOnce(code, 'function rebuildRateLines() {', helpers + '\nfunction rebuildRateLines() {\n  if (pricingDraftRestoring.value) return', 'rebuild helper')

  const rebuildWrapper = [
    'function rebuildRateLines() {',
    '  if (pricingDraftRestoring.value) return',
    '  const previous = rateLines.value.map((line) => ({ ...line }))',
    '  const context = pricingDraftLineContextKey()',
    '  const sameContext = pricingDraftLastLineContext === context',
    '    || (!pricingDraftLastLineContext && previous.length > 0)',
    '  rebuildRateLinesInternal()',
    '  const generated = rateLines.value',
    '  if (sameContext) {',
    '    const byIdentity = new Map(previous.map((line) => [pricingDraftLineIdentity(line), line] as const))',
    '    for (const line of generated) {',
    '      const original = byIdentity.get(pricingDraftLineIdentity(line))',
    "      if (!original || line.costDetailType === 'Freight') continue",
    '      line.costAmount = original.costAmount',
    '      line.saleAmount = original.saleAmount',
    '      line.included = original.included',
    '      line.billToClient = original.billToClient',
    '      line.notes = original.notes',
    '      line.chargeBasis = original.chargeBasis',
    '      line.currencyId = original.currencyId',
    '      line.currencyName = original.currencyName',
    '      line.currencyCode = original.currencyCode',
    '      line.amountCurrencyCode = original.amountCurrencyCode',
    '      line.applyDestinationTax = original.applyDestinationTax',
    '      line.destinationTaxRate = original.destinationTaxRate',
    '    }',
    '  }',
    '  const generatedIdentities = new Set(generated.map(pricingDraftLineIdentity))',
    '  const preservedManual = previous.filter((line) =>',
    '    line.manual && !generatedIdentities.has(pricingDraftLineIdentity(line)))',
    '  if (preservedManual.length) rateLines.value = [...generated, ...preservedManual]',
    '  pricingDraftLastLineContext = context',
    '}',
    '',
    'function rebuildRateLinesInternal() {',
  ].join('\n')
  code = replaceExactlyOnce(
    code,
    'function rebuildRateLines() {\n  if (pricingDraftRestoring.value) return',
    rebuildWrapper,
    'rebuild wrapper',
  )
  const existingRestore = '    if (Array.isArray(draft.rateLines)) rateLines.value = draft.rateLines'
  const completeRestore = [
    "    if (Array.isArray(draft.rateLines)) {",
    "      rateLines.value = draft.rateLines.filter((line: unknown): line is RateLine =>",
    "        Boolean(line) && typeof line === 'object' && !Array.isArray(line)",
    "        && typeof (line as RateLine).name === 'string')",
    "      pricingDraftLastLineContext = pricingDraftLineContextKey()",
    "    }",
  ].join('\n')
  code = replaceExactlyOnce(code, existingRestore, completeRestore, 'restore lines and context')

  // A resumed draft at provider selection needs live choices; restoring steps
  // 6-8 must NOT reselect a rate or rehydrate/reprice existing RateLines.
  const restoredStep = [
    "    if (step.value === 5 && !props.rateRequestId && !props.sellerRequestMode) {",
    "      void searchApprovedRates().catch((error) =>",
    "        toastStore.backendError(error, 'No se pudieron consultar las tarifas disponibles.'))",
    "    }",
    "",
    "    await Promise.resolve()",
  ].join('\n')
  code = replaceExactlyOnce(
    code,
    '    pricingDraftLastSnapshot = raw',
    restoredStep + '\n    pricingDraftLastSnapshot = raw',
    'reload provider choices only on screen 5',
  )

  const goStart = code.indexOf('function goToStep(target: number) {')
  const goEnd = code.indexOf('function commercialStatusLabel(', goStart)
  if (goStart < 0 || goEnd < 0) {
    throw new Error('[pricingWizardCompleteDraftNavigation] navigation anchors not found')
  }
  const freeNavigation = [
    "function goToStep(target: number) {",
    "  if (target < 1 || target > maxStep.value || saving.value) return",
    "  // All seven/eight screens are revisitable; selection steps never reset",
    "  // the entered RateLines or redirect the restored draft to Pantalla 5.",
    "  step.value = target",
    "  if (target === 5 && !props.rateId && !loadingRates.value",
    "      && form.originId && form.destinationId && !availableRates.value.length) {",
    "    void searchApprovedRates().catch((error) =>",
    "      toastStore.backendError(error, 'No se pudieron consultar las tarifas disponibles.'))",
    "  }",
    "  if (target >= 7 && rateLines.value.length === 0 && !props.viewOnly",
    "      && form.agentId && form.currencyId) {",
    "    void loadApplicableCosts().then(() => {",
    "      if (rateLines.value.length === 0) rebuildRateLines()",
    "    })",
    "  }",
    "  savePricingDraftNow()",
    "}",
    "",
  ].join('\n')
  code = code.slice(0, goStart) + freeNavigation + code.slice(goEnd)

  // A recoverable LCL missing-lines error should be reviewed in Lines, not
  // send the user backwards to rate selection while discarding their work.
  const lclBadLines = [
    "  if (shipmentModeForApi.value === 'Lcl' && includedLines.value.length === 0) {",
    "    step.value = 5",
  ].join('\n')
  const lclGoodLines = [
    "  if (shipmentModeForApi.value === 'Lcl' && includedLines.value.length === 0) {",
    "    step.value = 7",
  ].join('\n')
  if (code.includes(lclBadLines)) {
    code = code.replace(lclBadLines, lclGoodLines)
  }

  return code
}

export function pricingWizardCompleteDraftNavigation(): Plugin {
  return {
    name: 'dhole-pricing-wizard-complete-draft-navigation',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

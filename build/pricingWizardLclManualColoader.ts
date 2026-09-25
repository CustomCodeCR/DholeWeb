import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingWizardLclManualColoader] Missing ${label} anchor.`)
  }
  return source.replace(anchor, replacement)
}

function replaceOneOf(
  source: string,
  candidates: Array<{ anchor: string; replacement: string }>,
  label: string,
) {
  for (const candidate of candidates) {
    if (source.includes(candidate.anchor)) {
      return source.replace(candidate.anchor, candidate.replacement)
    }
  }
  throw new Error(`[pricingWizardLclManualColoader] Missing ${label} anchor.`)
}

function patchApplyLclSource(source: string) {
  const startAnchor = 'function applyLclRateSource(selection: LclRateSourceSelection) {'
  const start = source.indexOf(startAnchor)
  if (start < 0) {
    throw new Error('[pricingWizardLclManualColoader] Missing applyLclRateSource function.')
  }

  const endAnchor = '\n}\n\nasync function initializeDraftCommercialTerms()'
  const end = source.indexOf(endAnchor, start)
  if (end < 0) {
    throw new Error('[pricingWizardLclManualColoader] Missing applyLclRateSource end.')
  }

  let block = source.slice(start, end + 2)
  block = replaceRequired(
    block,
    '  form.manualRate = false',
    '  form.manualRate = Boolean(selection.manual)',
    'manual LCL source state',
  )

  const resetAnchor = '  draftCommercialTermsInitialized.value = false'
  block = replaceRequired(
    block,
    resetAnchor,
    `  if (selection.manual) {
    // Manual LCL is only available from the Coloader tab. Clear any provider
    // inherited from the route so the user must choose the real coloader.
    form.agentId = ''
    form.carrierId = ''
    form.freeDays = 0
    form.transitDays = 0
    form.freightCost = 0
    form.freightSale = 0
    rateLines.value = []
  }

${resetAnchor}`,
    'manual LCL reset',
  )

  return source.slice(0, start) + block + source.slice(end + 2)
}

function patchWizard(source: string) {
  let code = source
  if (code.includes('// dhole-lcl-manual-coloader-final')) return code

  code = patchApplyLclSource(code)

  code = replaceRequired(
    code,
    `:disabled="shipmentModeForApi === 'Lcl' && lclSelectedSource?.kind === 'Coloader'"`,
    `:disabled="shipmentModeForApi === 'Lcl' && lclSelectedSource?.kind === 'Coloader' && !lclSelectedSource?.manual"`,
    'manual LCL freight editing',
  )

  code = replaceOneOf(
    code,
    [
      {
        anchor: `    if (shipmentModeForApi.value === 'Lcl') {
      return Boolean(lclSelectedSource.value && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)
    }`,
        replacement: `    if (shipmentModeForApi.value === 'Lcl') {
      const manualColoaderProviderReady = !lclSelectedSource.value?.manual || Boolean(form.agentId)
      return Boolean(
        lclSelectedSource.value
        && manualColoaderProviderReady
        && form.currencyId
        && form.freightCost >= 0
        && form.freightSale >= 0,
      )
    }`,
      },
      {
        anchor: `    const providerReady = shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value ? true : Boolean(form.agentId)
    return Boolean(providerReady && form.carrierId && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)`,
        replacement: `    if (shipmentModeForApi.value === 'Lcl') {
      const providerReady = !lclSelectedSource.value?.manual || Boolean(form.agentId)
      return Boolean(lclSelectedSource.value && providerReady && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)
    }
    return Boolean(form.agentId && form.carrierId && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)`,
      },
    ],
    'manual LCL step 6 validation',
  )

  code = replaceOneOf(
    code,
    [
      {
        anchor: `  if (form.modality !== 'Land' && !agent && !(shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value)) missing.push('agente')`,
        replacement: `  if (form.modality !== 'Land' && !agent && !(shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value && !lclSelectedSource.value.manual)) missing.push('agente')`,
      },
      {
        anchor: `  if (!agent && !(shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value)) missing.push('agente')`,
        replacement: `  if (!agent && !(shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value && !lclSelectedSource.value.manual)) missing.push('agente')`,
      },
    ],
    'manual LCL agent validation',
  )

  const markerAnchor = 'async function initializeDraftCommercialTerms()'
  code = replaceRequired(
    code,
    markerAnchor,
    `// dhole-lcl-manual-coloader-final
${markerAnchor}`,
    'manual LCL marker',
  )

  return code
}

export function pricingWizardLclManualColoader(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-manual-coloader',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

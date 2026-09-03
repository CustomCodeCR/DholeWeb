import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardLclSelectionHydrationFix] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  // pricingWizardLclFclParityFix keeps the original automatic Pantalla 5 -> 6
  // navigation on update:modelValue. PricingLclRateSourceSelector now emits the full
  // source selection BEFORE update:modelValue, so when that navigation fires the
  // wizard is already completely hydrated. Do not replace that proven navigation
  // mechanism with another handler here.

  code = replaceOne(
    code,
    `    if (shipmentModeForApi.value === 'Lcl') return Boolean(lclSelectedSource.value || lclSelectedSourceKey.value)`,
    `    if (shipmentModeForApi.value === 'Lcl') return Boolean(lclSelectedSource.value)`,
    'LCL source validation after hydration',
  )

  // Never retain an agent from the route (for example RS) after selecting an LCL
  // source. Resolve the source provider itself; own consolidations use GCF when that
  // catalog entry exists, otherwise the source metadata remains the authoritative label.
  code = replaceOne(
    code,
    `  form.agentId = selection.providerId ?? ''`,
    `  const sourceProviderText = normalizeCatalogValue([selection.providerCode, selection.providerName].filter(Boolean).join(' '))\n  const sourceAgent = selection.providerId\n    ? catalogs.agents.find((item) => item.id === selection.providerId)\n    : catalogs.agents.find((item) => {\n        const candidate = normalizeCatalogValue([item.code, displayValue(item)].filter(Boolean).join(' '))\n        if (selection.kind === 'Own') {\n          return candidate.includes('gcf') || candidate.includes('grupo castro fallas')\n        }\n        return Boolean(sourceProviderText && (candidate.includes(sourceProviderText) || sourceProviderText.includes(candidate)))\n      })\n  form.agentId = sourceAgent?.id ?? ''`,
    'LCL source agent resolution',
  )

  const carrierAnchor = `  const sourceCarrier = selection.carrierId\n    ? catalogs.carriers.find((item) => item.id === selection.carrierId)\n    : catalogs.carriers.find((item) => {\n        const sourceCode = normalizeCatalogValue(selection.carrierCode ?? '')\n        const sourceName = normalizeCatalogValue(selection.carrierName ?? '')\n        return (sourceCode && normalizeCatalogValue(item.code ?? '') === sourceCode)\n          || (sourceName && normalizeCatalogValue(displayValue(item)) === sourceName)\n      })\n  if (sourceCarrier) form.carrierId = sourceCarrier.id`
  const carrierReplacement = `  const sourceCarrierCode = normalizeCatalogValue(selection.carrierCode ?? '')\n  const sourceCarrierName = normalizeCatalogValue(selection.carrierName ?? '')\n  const sourceCarrier = selection.carrierId\n    ? catalogs.carriers.find((item) => item.id === selection.carrierId)\n      ?? catalogs.carriers.find((item) => {\n        const candidateCode = normalizeCatalogValue(item.code ?? '')\n        const candidateName = normalizeCatalogValue(displayValue(item))\n        return (sourceCarrierCode && (candidateCode === sourceCarrierCode || candidateCode.includes(sourceCarrierCode) || sourceCarrierCode.includes(candidateCode)))\n          || (sourceCarrierName && (candidateName === sourceCarrierName || candidateName.includes(sourceCarrierName) || sourceCarrierName.includes(candidateName)))\n      })\n    : catalogs.carriers.find((item) => {\n        const candidateCode = normalizeCatalogValue(item.code ?? '')\n        const candidateName = normalizeCatalogValue(displayValue(item))\n        return (sourceCarrierCode && (candidateCode === sourceCarrierCode || candidateCode.includes(sourceCarrierCode) || sourceCarrierCode.includes(candidateCode)))\n          || (sourceCarrierName && (candidateName === sourceCarrierName || candidateName.includes(sourceCarrierName) || sourceCarrierName.includes(candidateName)))\n      })\n  form.carrierId = sourceCarrier?.id ?? ''`
  code = replaceOne(code, carrierAnchor, carrierReplacement, 'LCL source carrier resolution')

  const descriptionAnchor = `<p class="crystal-description">Los selects muestran el Value configurado en Config.</p>`
  const descriptionReplacement = `${descriptionAnchor}\n            <div v-if="shipmentModeForApi === 'Lcl' && lclSelectedSource" class="mt-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3 text-sm">\n              <span class="text-[var(--dh-text-muted)]">Fuente seleccionada:</span>\n              <strong class="ml-1">{{ lclSelectedSource.kind === 'Own' ? 'Propio' : 'Coloader' }} · {{ lclSelectedSource.sourceTitle || lclSelectedSource.label }}</strong>\n              <span v-if="lclSelectedSource.carrierName || lclSelectedSource.carrierCode" class="ml-2 text-[var(--dh-text-muted)]">· {{ lclSelectedSource.carrierName || lclSelectedSource.carrierCode }}</span>\n            </div>`
  code = replaceOne(code, descriptionAnchor, descriptionReplacement, 'LCL source summary on provider step')

  return code
}

export function pricingWizardLclSelectionHydrationFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-selection-hydration-fix',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

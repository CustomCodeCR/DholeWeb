import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

const lclAwareDescription = `<p class="crystal-description">{{ shipmentModeForApi === 'Lcl' ? 'Compare consolidados propios y tarifarios de coloader. Al seleccionar una fuente, sus líneas reales pasan a Pantalla 7.' : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.' }}</p>`
const baseDescription = `<p class="crystal-description">La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.</p>`
const fclAwareDescription = `<p class="crystal-description">{{ shipmentModeForApi === 'Fcl' ? 'La búsqueda valida todos los tipos de contenedor seleccionados y solo ofrece combinaciones que cubren la composición FCL completa.' : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.' }}</p>`
const finalDescription = `<p class="crystal-description">{{ shipmentModeForApi === 'Lcl' ? 'Compare consolidados propios y tarifarios de coloader. Al seleccionar una fuente, sus líneas reales pasan a Pantalla 7.' : shipmentModeForApi === 'Fcl' ? 'La búsqueda valida todos los tipos de contenedor seleccionados y solo ofrece combinaciones que cubren la composición FCL completa.' : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.' }}</p>`

const panamaSearchReset = `async function searchApprovedRates() {
  availableRates.value = []
  rateCarrierFilter.value = ''
  continuationRates.value = []
  form.selectedImportRateId = ''
  form.selectedContinuationImportRateId = ''
  panamaLandFreightAmount.value = 0
  form.manualRate = false`

const fclCompatibleSearchReset = `async function searchApprovedRates() {
  availableRates.value = []
  rateCarrierFilter.value = ''
  form.selectedImportRateId = ''
  form.manualRate = false`

function scopedPlugin(name: string, transformSource: (source: string) => string): Plugin {
  return {
    name,
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: transformSource(source), map: null }
    },
  }
}

export function pricingWizardFclRateBundlesPreCompat(): Plugin {
  return scopedPlugin('dhole-pricing-wizard-fcl-rate-bundles-pre-compat', (source) => {
    let code = source.includes(lclAwareDescription)
      ? source.replace(lclAwareDescription, baseDescription)
      : source

    // The Panama prebuild patch adds its own reset fields inside searchApprovedRates.
    // Temporarily restore the exact anchor expected by pricingWizardFclRateBundles;
    // PostCompat adds the Panama resets back after the FCL transform runs.
    if (code.includes(panamaSearchReset)) {
      code = code.replace(panamaSearchReset, fclCompatibleSearchReset)
    }

    return code
  })
}

export function pricingWizardFclRateBundlesPostCompat(): Plugin {
  return scopedPlugin('dhole-pricing-wizard-fcl-rate-bundles-post-compat', (source) => {
    let code = source.includes(fclAwareDescription)
      ? source.replace(fclAwareDescription, finalDescription)
      : source

    // Restore the Panama continuation state reset without disturbing the FCL bundle
    // state inserted by pricingWizardFclRateBundles.
    if (code.includes(fclCompatibleSearchReset) && !code.includes(panamaSearchReset)) {
      code = code.replace(fclCompatibleSearchReset, panamaSearchReset)
    }

    return code
  })
}

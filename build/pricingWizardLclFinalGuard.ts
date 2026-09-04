import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const LCL_ONLY_HIDDEN_FLAGS = ['overweight', 'merchantHaulage', 'carrierHaulage'] as const

function guardFlagForLcl(code: string, field: (typeof LCL_ONLY_HIDDEN_FLAGS)[number]) {
  const pattern = new RegExp(
    `<button[^>]*:class="form\\.${field} \\? 'crystal-flag--active' : ''"[^>]*>`,
    'g',
  )

  return code.replace(pattern, (tag) => {
    if (tag.includes(`v-if="shipmentModeForApi !== 'Lcl'"`)) return tag
    return tag.replace('<button', `<button v-if="shipmentModeForApi !== 'Lcl'"`)
  })
}

function patchWizard(source: string) {
  let code = source

  // Peso es opcional en LCL: las dimensiones/tarimas bastan para calcular CBM cobrable.
  code = code.replace(
    `      form.cargoPallets > 0 &&\n      form.cargoWeightKg > 0 &&\n      form.cargoLengthCm > 0 &&`,
    `      form.cargoPallets > 0 &&\n      form.cargoLengthCm > 0 &&`,
  )

  code = code.replace('label="Peso total (kg)"', 'label="Peso total (kg) · opcional"')
  code = code.replace(
    `v-if="form.cargoWeightKg <= 0 || form.cargoPallets <= 0 || form.cargoLengthCm <= 0 || form.cargoWidthCm <= 0 || form.cargoHeightCm <= 0"`,
    `v-if="form.cargoPallets <= 0 || form.cargoLengthCm <= 0 || form.cargoWidthCm <= 0 || form.cargoHeightCm <= 0"`,
  )
  code = code.replace(
    'Complete peso, tarimas, largo, ancho y alto para continuar.',
    'Complete tarimas, largo, ancho y alto. El peso es opcional.',
  )

  for (const field of LCL_ONLY_HIDDEN_FLAGS) {
    code = guardFlagForLcl(code, field)
  }

  const guardStateMarker = 'const clearUnsupportedLclFlags = () => {'
  if (!code.includes(guardStateMarker)) {
    const lclCbmAnchor = 'const lclDimensionalCbm = computed(() => {'
    const guardState = `const clearUnsupportedLclFlags = () => {\n  if (shipmentModeForApi.value !== 'Lcl') return\n  form.overweight = false\n  form.merchantHaulage = false\n  form.carrierHaulage = false\n}\nwatch(shipmentModeForApi, clearUnsupportedLclFlags, { immediate: true })\n\n`
    if (!code.includes(lclCbmAnchor)) {
      throw new Error('[pricingWizardLclFinalGuard] LCL CBM anchor was not found.')
    }
    code = code.replace(lclCbmAnchor, guardState + lclCbmAnchor)
  }

  if (code.includes(`form.cargoPallets > 0 &&\n      form.cargoWeightKg > 0 &&`)) {
    throw new Error('[pricingWizardLclFinalGuard] LCL continue still requires weight.')
  }

  for (const field of LCL_ONLY_HIDDEN_FLAGS) {
    const pattern = new RegExp(
      `<button[^>]*:class="form\\.${field} \\? 'crystal-flag--active' : ''"[^>]*>`,
      'g',
    )
    const tags = code.match(pattern) ?? []
    if (tags.length !== 1 || !tags[0].includes(`v-if="shipmentModeForApi !== 'Lcl'"`)) {
      throw new Error(`[pricingWizardLclFinalGuard] ${field} is not guarded for LCL.`)
    }
  }

  return code
}

export function pricingWizardLclFinalGuard(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-final-guard',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

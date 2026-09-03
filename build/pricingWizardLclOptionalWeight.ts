import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardLclOptionalWeight] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    'label="Peso total (kg)"',
    'label="Peso total (kg) · opcional"',
    'LCL weight label',
  )

  code = replaceOne(
    code,
    'v-if="form.cargoWeightKg <= 0 || form.cargoPallets <= 0 || form.cargoLengthCm <= 0 || form.cargoWidthCm <= 0 || form.cargoHeightCm <= 0"',
    'v-if="form.cargoPallets <= 0 || form.cargoLengthCm <= 0 || form.cargoWidthCm <= 0 || form.cargoHeightCm <= 0"',
    'LCL cargo warning condition',
  )

  code = replaceOne(
    code,
    'Complete peso, tarimas, largo, ancho y alto para continuar.',
    'Complete tarimas, largo, ancho y alto. El peso es opcional.',
    'LCL cargo warning copy',
  )

  return code
}

export function pricingWizardLclOptionalWeight(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-optional-weight',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

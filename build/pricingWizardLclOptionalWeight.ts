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

  code = replaceOne(
    code,
    "  if (value.toUpperCase() === 'FCL') form.nonStackable = false\n  step.value = 3",
    "  if (value.toUpperCase() === 'FCL') form.nonStackable = false\n  if (value.toUpperCase() === 'LCL') {\n    form.overweight = false\n    form.merchantHaulage = false\n    form.carrierHaulage = false\n    loadingRates.value = false\n  }\n  step.value = 3",
    'LCL shipment reset',
  )

  code = replaceOne(
    code,
    "  if (shipmentModeForApi.value !== 'Fcl' || !selectedOrigin.value || !selectedDestination.value || !selectedEquipment.value) {\n    form.manualRate = true\n    return\n  }",
    "  if (shipmentModeForApi.value !== 'Fcl' || !selectedOrigin.value || !selectedDestination.value || !selectedEquipment.value) {\n    loadingRates.value = false\n    form.manualRate = true\n    return\n  }",
    'non-FCL rate lookup early return',
  )

  code = replaceOne(
    code,
    '<button type="button" class="crystal-flag" :class="form.overweight ? \'crystal-flag--active\' : \'\'" @click="form.overweight = !form.overweight">',
    '<button v-if="shipmentModeForApi !== \'Lcl\'" type="button" class="crystal-flag" :class="form.overweight ? \'crystal-flag--active\' : \'\'" @click="form.overweight = !form.overweight">',
    'LCL overweight visibility',
  )

  code = replaceOne(
    code,
    '<button type="button" class="crystal-flag" :class="form.merchantHaulage ? \'crystal-flag--active\' : \'\'" @click="toggleMerchantHaulage">',
    '<button v-if="shipmentModeForApi !== \'Lcl\'" type="button" class="crystal-flag" :class="form.merchantHaulage ? \'crystal-flag--active\' : \'\'" @click="toggleMerchantHaulage">',
    'LCL merchant visibility',
  )

  code = replaceOne(
    code,
    '<button type="button" class="crystal-flag" :class="form.carrierHaulage ? \'crystal-flag--active\' : \'\'" @click="toggleCarrierHaulage">',
    '<button v-if="shipmentModeForApi !== \'Lcl\'" type="button" class="crystal-flag" :class="form.carrierHaulage ? \'crystal-flag--active\' : \'\'" @click="toggleCarrierHaulage">',
    'LCL carrier visibility',
  )

  code = replaceOne(
    code,
    ':disabled="!canNext || loadingRates" @click="next">Continuar',
    ':disabled="!canNext || (loadingRates && shipmentModeForApi === \'Fcl\')" @click="next">Continuar',
    'LCL continue loading guard',
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

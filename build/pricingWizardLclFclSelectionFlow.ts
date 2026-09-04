import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardLclFclSelectionFlow] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  // Restore the exact interaction that was stable in 5e187615:
  // 1) @select hydrates the complete LCL source.
  // 2) update:modelValue only persists the selected key and advances 5 -> 6.
  // Keeping those responsibilities separate prevents the visual selected state from
  // becoming detached from the wizard navigation on mobile Safari.
  code = replaceOne(
    code,
    `            v-model="lclSelectedSourceKey"`,
    `            :model-value="lclSelectedSourceKey"\n            @update:model-value="(value) => { lclSelectedSourceKey = String(value || ''); if (value) step = 6 }"`,
    'LCL model-value navigation binding',
  )

  code = replaceOne(
    code,
    `            :resolve-selection="applyLclRateSource"`,
    `            @select="applyLclRateSource"`,
    'LCL source hydration binding',
  )

  // pricingWizardLclStableFlow previously made applyLclRateSource navigate too.
  // Remove that duplicate transition so only update:modelValue owns navigation.
  code = replaceOne(
    code,
    `  rateLines.value = selection.lines.map((line) => ({ ...line })) as RateLine[]\n  draftCommercialTermsInitialized.value = false\n  step.value = 6\n}`,
    `  rateLines.value = selection.lines.map((line) => ({ ...line })) as RateLine[]\n  draftCommercialTermsInitialized.value = false\n}`,
    'duplicate LCL navigation inside hydration',
  )

  if (!code.includes(`@select="applyLclRateSource"`)) {
    throw new Error('[pricingWizardLclFclSelectionFlow] LCL hydration handler was not restored.')
  }
  if (!code.includes(`@update:model-value="(value) => { lclSelectedSourceKey = String(value || ''); if (value) step = 6 }"`)) {
    throw new Error('[pricingWizardLclFclSelectionFlow] LCL 5 -> 6 navigation handler was not restored.')
  }

  return code
}

function patchSelector(source: string) {
  let code = source

  // The full source must reach the parent BEFORE the selected key advances the
  // wizard. The base selector emitted these in the opposite order, and later
  // plugins tried to solve it with direct callbacks / object modelValue payloads.
  // Keep modelValue as the original string contract and make event ordering explicit.
  code = replaceOne(
    code,
    `    props.resolveSelection?.(selection)\n    emit('update:modelValue', \`Own:\${row.id}\`)\n    emit('select', selection)`,
    `    emit('select', selection)\n    emit('update:modelValue', \`Own:\${row.id}\`)`,
    'own LCL event order',
  )

  code = replaceOne(
    code,
    `  props.resolveSelection?.(selection)\n  emit('update:modelValue', \`Coloader:\${rate.id}\`)\n  emit('select', selection)`,
    `  emit('select', selection)\n  emit('update:modelValue', \`Coloader:\${rate.id}\`)`,
    'coloader LCL event order',
  )

  if (!code.includes(`'update:modelValue': [value: string]`)) {
    throw new Error('[pricingWizardLclFclSelectionFlow] LCL modelValue must remain a string key.')
  }

  return code
}

export function pricingWizardLclFclSelectionFlow(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-fcl-selection-flow',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      if (normalizedId.endsWith(SELECTOR_PATH)) return { code: patchSelector(source), map: null }
      return null
    },
  }
}

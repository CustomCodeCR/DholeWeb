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

  // Match the FCL interaction model: the click delivers the complete selected rate
  // to one parent handler, that handler hydrates the form, and only then advances.
  // We intentionally use update:modelValue because this exact channel is already
  // proven to update the selected card correctly on mobile Safari.
  code = replaceOne(
    code,
    `            v-model="lclSelectedSourceKey"`,
    `            :model-value="lclSelectedSourceKey"`,
    'LCL model binding',
  )

  code = replaceOne(
    code,
    `            :resolve-selection="applyLclRateSource"`,
    `            @update:model-value="chooseLclRateSource"`,
    'LCL FCL-style selection handler',
  )

  const saveAnchor = 'async function saveRate() {'
  const handler = `function chooseLclRateSource(selection: LclRateSourceSelection) {\n  if (!selection?.id || !selection.kind) return\n\n  lclSelectedSourceKey.value = \`${'${selection.kind}:${selection.id}'}\`\n  applyLclRateSource(selection)\n  step.value = 6\n}\n\n`
  code = replaceOne(code, saveAnchor, handler + saveAnchor, 'saveRate handler anchor')

  return code
}

function patchSelector(source: string) {
  let code = source

  // update:modelValue now carries the full resolved source, just like chooseRate(rate)
  // receives the full FCL rate object. The parent keeps modelValue itself as the
  // string key used only to paint the selected state.
  code = replaceOne(
    code,
    `  'update:modelValue': [value: string]`,
    `  'update:modelValue': [selection: LclRateSourceSelection]`,
    'LCL model emit payload type',
  )

  code = replaceOne(
    code,
    `    props.resolveSelection?.(selection)\n    emit('update:modelValue', \`Own:\${row.id}\`)\n    emit('select', selection)`,
    `    emit('update:modelValue', selection)\n    emit('select', selection)`,
    'own LCL FCL-style emit',
  )

  code = replaceOne(
    code,
    `  props.resolveSelection?.(selection)\n  emit('update:modelValue', \`Coloader:\${rate.id}\`)\n  emit('select', selection)`,
    `  emit('update:modelValue', selection)\n  emit('select', selection)`,
    'coloader LCL FCL-style emit',
  )

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

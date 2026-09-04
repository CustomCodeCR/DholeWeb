import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardLclResolvedCallback] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchSelector(source: string) {
  let code = source

  code = replaceOne(
    code,
    `  cargoLines?: OwnLclCargoLineRequest[]\n}>(), {`,
    `  cargoLines?: OwnLclCargoLineRequest[]\n  onResolvedSelection?: (selection: LclRateSourceSelection) => void\n}>(), {`,
    'selector callback prop',
  )

  code = replaceOne(
    code,
    `    emit('select', selection)\n    emit('update:modelValue', \`Own:\${row.id}\`)`,
    `    props.onResolvedSelection?.(selection)\n    emit('select', selection)\n    emit('update:modelValue', \`Own:\${row.id}\`)`,
    'own source callback',
  )

  code = replaceOne(
    code,
    `  emit('select', selection)\n  emit('update:modelValue', \`Coloader:\${rate.id}\`)`,
    `  props.onResolvedSelection?.(selection)\n  emit('select', selection)\n  emit('update:modelValue', \`Coloader:\${rate.id}\`)`,
    'coloader source callback',
  )

  return code
}

function patchWizard(source: string) {
  let code = source

  const saveAnchor = `async function saveRate() {`
  const handler = `function handleResolvedLclSelection(selection: LclRateSourceSelection) {\n  applyLclRateSource(selection)\n  step.value = 6\n}\n\n`
  code = replaceOne(
    code,
    saveAnchor,
    handler + saveAnchor,
    'stable save handler anchor',
  )

  // Previous fixes used the custom select event. Replace it with a direct function
  // prop so hydration cannot be lost when Pantalla 5 is unmounted.
  const atomicHandler = `            @select="(selection) => { applyLclRateSource(selection); step = 6 }"`
  const legacyHandler = `            @select="applyLclRateSource"`
  const callbackBinding = `            :on-resolved-selection="handleResolvedLclSelection"`

  if (code.includes(atomicHandler)) {
    code = replaceOne(code, atomicHandler, callbackBinding, 'atomic select listener')
  } else if (code.includes(legacyHandler)) {
    code = replaceOne(code, legacyHandler, callbackBinding, 'legacy select listener')
  } else if (!code.includes(callbackBinding)) {
    throw new Error('[pricingWizardLclResolvedCallback] No LCL source listener anchor was found.')
  }

  if (!code.includes(':on-resolved-selection="handleResolvedLclSelection"')) {
    throw new Error('[pricingWizardLclResolvedCallback] Callback binding was not applied.')
  }

  return code
}

export function pricingWizardLclResolvedCallback(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-resolved-callback',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(SELECTOR_PATH)) return { code: patchSelector(source), map: null }
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      return null
    },
  }
}

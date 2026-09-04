import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'
const EVENT_NAME = 'dhole:lcl-source-selected'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardLclNavigationBridge] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `import { computed, onMounted, reactive, ref, watch } from 'vue'`,
    `import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'`,
    'Vue lifecycle import',
  )

  const saveAnchor = 'async function saveRate() {'
  const navigationBridge = `const LCL_SOURCE_SELECTED_EVENT = '${EVENT_NAME}'\n\nfunction handleLclSourceSelectedEvent(event: Event) {\n  if (step.value !== 5 || shipmentModeForApi.value !== 'Lcl') return\n  const selection = (event as CustomEvent<LclRateSourceSelection>).detail\n  if (!selection?.id || !selection.kind) return\n\n  applyLclRateSource(selection)\n  step.value = 6\n}\n\nonMounted(() => {\n  window.addEventListener(LCL_SOURCE_SELECTED_EVENT, handleLclSourceSelectedEvent as EventListener)\n})\n\nonBeforeUnmount(() => {\n  window.removeEventListener(LCL_SOURCE_SELECTED_EVENT, handleLclSourceSelectedEvent as EventListener)\n})\n\n`

  code = replaceOne(
    code,
    saveAnchor,
    navigationBridge + saveAnchor,
    'LCL navigation listener',
  )

  return code
}

function patchSelector(source: string) {
  let code = source

  const ownAnchor = `    props.resolveSelection?.(selection)\n    emit('update:modelValue', \`Own:\${row.id}\`)\n    emit('select', selection)`
  const ownReplacement = `    emit('update:modelValue', \`Own:\${row.id}\`)\n    emit('select', selection)\n    window.dispatchEvent(new CustomEvent('${EVENT_NAME}', { detail: selection }))`
  code = replaceOne(code, ownAnchor, ownReplacement, 'own LCL selection bridge')

  const coloaderAnchor = `  props.resolveSelection?.(selection)\n  emit('update:modelValue', \`Coloader:\${rate.id}\`)\n  emit('select', selection)`
  const coloaderReplacement = `  emit('update:modelValue', \`Coloader:\${rate.id}\`)\n  emit('select', selection)\n  window.dispatchEvent(new CustomEvent('${EVENT_NAME}', { detail: selection }))`
  code = replaceOne(code, coloaderAnchor, coloaderReplacement, 'coloader LCL selection bridge')

  return code
}

export function pricingWizardLclNavigationBridge(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-navigation-bridge',
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

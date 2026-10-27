import type { Plugin } from 'vite'

const WIZARD_SUFFIX = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const STEP_FOUR = /(^[ \t]*)<div v-else-if="step === 4" class="space-y-6">/gm
const STEP_SEVEN = /(^[ \t]*)<div v-else-if="step === 7" class="crystal-lines-stage space-y-6">/gm

// Previous independent Pricing transforms sometimes leave the root element
// for step 4 open. Repair ONLY that verified missing closing tag, without
// touching any step contents, reactive state, service calls or markup elsewhere.
export function closeUnfinishedStepFour(source: string): string {
  const starts = [...source.matchAll(STEP_FOUR)]
  const ends = [...source.matchAll(STEP_SEVEN)]
  if (starts.length !== 1 || ends.length !== 1) {
    throw new Error('[pricingWizardGeneratedTemplateIntegrity] Missing or duplicate step boundaries')
  }
  const start = starts[0]!.index! + starts[0]![1]!.length
  const end = ends[0]!.index!
  if (end <= start) {
    throw new Error('[pricingWizardGeneratedTemplateIntegrity] Invalid wizard step order')
  }

  const stack: number[] = []
  let unmatchedClosing = 0
  const tags = /<(\/?)div(?=[\s>])/gi
  const block = source.slice(start, end)
  for (const match of block.matchAll(tags)) {
    if (match[1] === '/') {
      if (stack.length === 0) unmatchedClosing++
      else stack.pop()
    } else {
      stack.push(match.index!)
    }
  }
  if (stack.length === 0 && unmatchedClosing === 0) return source
  // The ONLY supported repair is a still-open root <div> from step 4.
  if (stack.length !== 1 || stack[0] !== 0 || unmatchedClosing !== 0) {
    throw new Error(
      '[pricingWizardGeneratedTemplateIntegrity] Unexpected unbalanced step 4 markup: ' +
      stack.length + ' open, ' + unmatchedClosing + ' extra closing tags',
    )
  }
  const indentation = starts[0]![1]!
  const repaired = source.slice(0, end) + indentation + '</div>\n\n' + source.slice(end)
  // Idempotent: if the template is already balanced, never add an extra tag.
  if (repaired === source) throw new Error('[pricingWizardGeneratedTemplateIntegrity] No repair')
  return repaired
}

export function pricingWizardGeneratedTemplateIntegrity(): Plugin {
  return {
    name: 'dhole-pricing-wizard-generated-template-integrity',
    // Runs after other pricing transforms, immediately before Vue parsing.
    transform(source, id) {
      const normalized = id.replaceAll('\\', '/').split('?')[0]
      if (!normalized.endsWith(WIZARD_SUFFIX) || id.includes('?')) return null
      const repaired = closeUnfinishedStepFour(source)
      return repaired === source ? null : { code: repaired, map: null }
    },
  }
}

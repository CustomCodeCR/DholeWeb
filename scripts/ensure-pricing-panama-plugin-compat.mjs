import { readFile, writeFile } from 'node:fs/promises'

const wizardPath = new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url)

let source = await readFile(wizardPath, 'utf8')

const enhancedReset = `  availableRates.value = []
  continuationRates.value = []
  panamaLandFreightAmount.value = 0
  rateLines.value = []
  supportEntityId.value`
const compatibleReset = `  availableRates.value = []
  rateLines.value = []
  supportEntityId.value`

// pricingWizardEnhancements runs inside Vite and still owns this reset anchor.
// The Panama state is already cleared by its route/mode watchers and every
// tariff search, so keep the original anchor intact for the Vite transform.
if (source.includes(enhancedReset)) {
  source = source.replace(enhancedReset, compatibleReset)
  await writeFile(wizardPath, source)
  console.log('[pricing-panama-compat] Reset anchor restored for Vite transforms')
} else {
  console.log('[pricing-panama-compat] Reset anchor already compatible')
}

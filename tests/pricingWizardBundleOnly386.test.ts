import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { patchPricingWizardBundleOnlyFinal } from '../build/pricingWizardBundleOnlyFinal.ts'
import { removeDuplicateFclFreight } from '../src/modules/pricing/utils/pricingFclFreightDeduplication.ts'

const ftl = readFileSync(new URL('../build/pricingFtlLandCostsFix.ts', import.meta.url), 'utf8')
const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const fcl = readFileSync(new URL('../build/pricingWizardMixedFclFreightFix.ts', import.meta.url), 'utf8')
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')

test('DH-386: only wizard-bundle may resolve wizard catalog costs', () => {
  const source = [
    '<script setup lang="ts">',
    'PricingService.selectWizardCosts({ isActive: true })',
    'PricingService.selectCosts({ isActive: true })',
    'PricingService.selectCosts({ costType: "Optional" })',
    '</script>',
  ].join('\n')
  const patched = patchPricingWizardBundleOnlyFinal(source)
  assert.doesNotMatch(patched, /PricingService\.selectCosts\(/)
  assert.equal(patched.split('pricingWizardBundleSelectCosts({').length - 1, 2)
  assert.match(patched, /return bundle\.applicable\.filter/)
  assert.match(patched, /if \(props\.rateId && !allowCatalogRefreshForSavedQuote\.value\) return \[\]/)
  assert.match(vite, /pricingWizardBundleOnlyFinal\(\),\s*vue\(\)/)
})

test('DH-386: globally available catalog never auto-appends costs not in applicable', () => {
  assert.match(ftl, /contextualCosts\.filter\(\(cost\) => cost\.isActive !== false\)/)
  assert.doesNotMatch(ftl, /fullCatalog\s*\.filter\(maritimeFclCostMatchesCurrentContext\)/)
  assert.match(ftl, /const bundle = await PricingService\.selectWizardCosts\(contextualQuery\)/)
  assert.match(wizard, /if \(cost\.costDetailType === 'Freight'\) return 'international_freight'/)
})

test('DH-386: separate terrestrial FCL cost keeps CostId and freight block', () => {
  const sea = { key: 'freight:40hc', name: 'Flete Internacional · 40HC', costDetailType: 'Freight', included: true }
  const land = {
    key: 'cost:ae17c229-3d18-48a2-a22d-61f23264780d',
    name: 'Flete Internacional Terrestre', costDetailType: 'Freight', included: true,
  }
  assert.deepEqual(removeDuplicateFclFreight([sea, land], 'Fcl'), [sea, land])
  assert.match(fcl, /independentTerrestrialFreight/)
  assert.match(fcl, /independentTerrestrialFreight\.includes\(line\)/)
  assert.match(fcl, /!independentTerrestrialFreight\.includes\(line\)/)
})

test('DH-390: generic zero-valued variable templates do not leak into unrelated quotes', () => {
  const fixture = [
    '<script setup lang="ts">',
    'PricingService.selectWizardCosts({ isActive: true })',
    'function applicableCost(cost: CostSelectDto) { return true }',
    '</script>',
  ].join('\n')
  const patched = patchPricingWizardBundleOnlyFinal(fixture)
  assert.match(patched, /cost\.costType === 'Variable'/)
  assert.match(patched, /!cost\.pricingRulesJson/)
  assert.match(patched, /explicitlySelectedService/)
  assert.match(patched, /explicitlyMatchedIncoterm/)
  assert.match(patched, /selectedIncotermCode\.value === 'EXW'/)
  assert.match(patched, /if \(!explicitlySelectedService && !explicitlyMatchedIncoterm && !exwPickup\) return false/)
})

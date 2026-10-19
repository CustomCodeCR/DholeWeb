import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  patchLclSelectorRouteLabels,
  patchLclWizardColoaderRouteLabels,
} from '../build/pricingWizardLclFclParityFix.ts'

const wizardPoeAware = [
  '            :poe-id="selectedDestination?.id ?? null"',
  '            :poe-code="selectedDestination?.code ?? null"',
  '            :poe-name="displayValue(selectedDestination)"',
  '            :pod-id="selectedPod?.id ?? null"',
].join('\n')

const wizardLegacy = [
  '            :poe-id="selectedDestination?.id ?? null"',
  '            :pod-id="selectedPod?.id ?? null"',
].join('\n')

test('wizard preserves Balboa POE matching and provides coloader POE/POD labels', () => {
  const transformed = patchLclWizardColoaderRouteLabels(wizardPoeAware)
  assert.match(transformed, /:poe-code="selectedDestination\?\.code \?\? null"/)
  assert.match(transformed, /:poe-name="displayValue\(selectedDestination\)"/)
  assert.match(transformed, /:poe-label="displayValue\(selectedDestination\)"/)
  assert.match(transformed, /:pod-label="selectedPod \? displayValue\(selectedPod\) : null"/)
  assert.equal(transformed.match(/:poe-label=/g)?.length, 1)
  assert.equal(transformed.match(/:pod-label=/g)?.length, 1)
})

test('wizard still supports the legacy selector layout', () => {
  const transformed = patchLclWizardColoaderRouteLabels(wizardLegacy)
  assert.match(transformed, /:poe-label="displayValue\(selectedDestination\)"/)
  assert.match(transformed, /:pod-label="selectedPod \? displayValue\(selectedPod\) : null"/)
})

test('selector preserves Balboa-only props and adds distinct coloader labels', () => {
  const selector = readFileSync(
    new URL('../src/modules/pricing/components/PricingLclRateSourceSelector.vue', import.meta.url),
    'utf8',
  )
  const transformed = patchLclSelectorRouteLabels(selector)
  assert.match(transformed, /poeCode\?: string \| null/)
  assert.match(transformed, /poeName\?: string \| null/)
  assert.match(transformed, /poeLabel\?: string \| null/)
  assert.match(transformed, /podLabel\?: string \| null/)
  assert.match(transformed, /poeCode: null/)
  assert.match(transformed, /poeName: null/)
  assert.match(transformed, /poeLabel: null/)
  assert.match(transformed, /podLabel: null/)
  assert.match(transformed, /const ownPoeEligible = computed/)
  assert.match(transformed, /if \(!ownPoeEligible\.value\) return \[\]/)
  assert.equal(transformed.match(/poeLabel\?: string \| null/g)?.length, 1)
})

test('selector legacy layout still receives coloader props and defaults', () => {
  const legacy = [
    '  poeId?: string | null',
    '  podId?: string | null',
    '  poeId: null,',
    '  podId: null,',
  ].join('\n')
  const transformed = patchLclSelectorRouteLabels(legacy)
  assert.match(transformed, /poeLabel\?: string \| null/)
  assert.match(transformed, /podLabel\?: string \| null/)
  assert.match(transformed, /poeLabel: null/)
  assert.match(transformed, /podLabel: null/)
})

test('strict transformations fail on unexpected layouts instead of silently omitting filters', () => {
  assert.throws(() => patchLclWizardColoaderRouteLabels('unrelated'), /LCL coloader route labels/)
  assert.throws(() => patchLclSelectorRouteLabels('unrelated'), /LCL selector legacy route label props/)
})

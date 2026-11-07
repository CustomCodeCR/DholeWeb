import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizePoeSelection } from '../src/modules/pricing/utils/pricingPoeSelection.ts'

test('multiple POE selection keeps order and active POE when ports are added', () => {
  const first = normalizePoeSelection(['caldera', 'moin'], '', ['caldera', 'moin', 'limon'])
  assert.deepEqual(first, { ids: ['caldera', 'moin'], activeId: 'caldera' })
  assert.deepEqual(
    normalizePoeSelection(['caldera', 'moin', 'limon'], first.activeId, ['caldera', 'moin', 'limon']),
    { ids: ['caldera', 'moin', 'limon'], activeId: 'caldera' },
  )
})

test('removal selects an existing POE and ignores duplicate/stale catalog IDs', () => {
  assert.deepEqual(normalizePoeSelection(['moin', 'moin', 'missing'], 'caldera', ['caldera', 'moin']),
    { ids: ['moin'], activeId: 'moin' })
  assert.deepEqual(normalizePoeSelection([], 'caldera', ['caldera', 'moin']), { ids: [], activeId: '' })
})

test('the multi-POE wizard has isolated route tabs and refuses silent partial saves', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const selector = readFileSync(new URL('../src/modules/pricing/components/PricingLocationSearchSelect.vue', import.meta.url), 'utf8')
  assert.match(wizard, /:model-values="selectedPoeIds"/)
  assert.match(wizard, /@update:model-values="setSelectedPoeIds"/)
  assert.match(wizard, /role="tablist" aria-label="Rutas por POE"/)
  assert.match(wizard, /rememberActivePoe\(\)/)
  assert.match(wizard, /switchingPoeRoute/)
  assert.match(wizard, /approvedRatesSearchSequence/)
  assert.match(wizard, /if \(!editingRate\.value && selectedPoeIds\.value\.length > 1\)/)
  assert.match(selector, /emit\('update:modelValues', next\)/)
  assert.match(selector, /multiSelected/)
})

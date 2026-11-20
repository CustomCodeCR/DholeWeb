import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8')
const wizard = read('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
const landTransform = read('../build/pricingFtlLandCostsFix.ts')
const sellerTransform = read('../build/pricingSellerMultimodalStep3Fix.ts')

test('all 11 Incoterms can reach the next screen without EXW/FCA-only location gates', () => {
  assert.match(wizard, /const exwLocationReady = computed\(\(\) => true\)/)
  assert.match(wizard, /const fcaLocationReady = computed\(\(\) => true\)/)
  assert.match(wizard, /const sellerCargoConditionReady = computed\(\(\) => true\)/)
  assert.doesNotMatch(wizard, /if \(step\.value === 3 && selectedIncotermCode\.value === 'EXW'/)
  assert.doesNotMatch(sellerTransform, /if \(!exwLocationReady\.value\) missing\.push/)
  assert.doesNotMatch(sellerTransform, /if \(!fcaLocationReady\.value\) missing\.push/)
  assert.doesNotMatch(sellerTransform, /cargoReadyAnchor/)
})

test('Incoterm responsibility no longer hides customer-quoted service sections', () => {
  assert.match(wizard, /new Set<RateSection>\(\[\.\.\.sectionOrder, \.\.\.incotermResponsibilitySections\.value\]\)/)
  assert.match(landTransform, /new Set<RateSection>\(sectionOrder\)/)
  assert.match(sellerTransform, /inlandServiceLocationsReady/)
})

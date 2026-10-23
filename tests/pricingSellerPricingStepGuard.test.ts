import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('the modification draft loads seller EXW/form after old quote hydration and never writes on opening', () => {
  const source = read('build/pricingSellerModificationWizard.ts')
  assert.match(source, /watch\(\[pricingModificationWorkItem, editingRate, loadingExistingRate\]/)
  assert.match(source, /loadingExistingRate\.value \|\| pricingModificationApplied\.value/)
  assert.match(source, /void applyPricingModification\(\)/)
  assert.match(source, /const proposal = pricingModificationWorkItem\.value\?\.payload\?\.form/)
  assert.match(source, /\(form as unknown as Record<string, unknown>\)\[key\] = JSON\.parse/)
  assert.match(source, /pricingModificationApplied\.value = true/)
  assert.match(source, /step\.value = 5/)
  assert.match(source, /La tarifa original no se ha guardado ni enviado/)
})

test('request read-only summary uses seller submitted values, not original quote fields', () => {
  const view = read('src/modules/pricing/views/PricingRateRequestResumeView.vue')
  assert.match(view, /const form = payload\?\.form \?\? \{\}/)
  assert.match(view, /const modificationIncotermLabel = computed/)
  assert.match(view, /requestContext\?\.incotermName/)
  assert.match(view, /:incoterm-label="modificationIncotermLabel"/)
  assert.match(view, /:snapshot="modificationSnapshot"/)
})

test('pricing request navigation and back button never expose Sales screens 1-4', () => {
  const source = read('build/pricingSellerPricingStepGuard.ts')
  assert.match(source, /props\.rateRequestId \|\| props\.modificationRequestId/)
  assert.match(source, /target < 5/)
  assert.match(source, /step\.value <= 5/)
  assert.match(source, /step\.value < 5\) step\.value = 5/)
  assert.match(source, /index >= 4/)
  assert.match(source, /pricingSellerScreensLocked && index < 4/)
  assert.match(source, /pricingSellerScreensLocked && step <= 5/)
  assert.match(source, /!props\.modificationRequestId \|\| pricingModificationApplied/)
  const vite = read('vite.config.ts')
  assert.ok(vite.indexOf('pricingSellerPricingStepGuard(),') > vite.indexOf('pricingSellerModificationWizard(),'))
  assert.ok(vite.indexOf('pricingSellerPricingStepGuard(),') < vite.indexOf('vue(),'))
})

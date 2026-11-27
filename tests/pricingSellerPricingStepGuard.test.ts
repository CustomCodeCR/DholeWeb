import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('the modification draft loads seller EXW/form after old quote hydration and never writes on opening', () => {
  const source = read('build/pricingSellerModificationWizard.ts')
  assert.match(source, /watch\(\[pricingModificationWorkItem, editingRate, loadingExistingRate, hydratingExistingRate, pricingDraftReady, pricingDraftRestoring\]/)
  assert.match(source, /loadingExistingRate\.value \|\| hydratingExistingRate\.value \|\| pricingModificationApplied\.value/)
  assert.match(source, /requestedForm\.serviceIds = effectiveServices\.value\.map/)
  assert.match(source, /form\.serviceIds = \[\.\.\.form\.serviceIds, cargoInsuranceService\.value\.id\]/)
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

test('Sales requests clamp navigation to step 4 even on direct assignments and draft restore', () => {
  const source = read('build/pricingSellerPricingStepGuard.ts')
  assert.match(source, /props\.sellerRequestMode && !pricingSellerScreensLocked\.value/)
  assert.match(source, /step\.value > 4\) step\.value = 4/)
  assert.match(source, /sellerRequestScreensLocked\.value && target > 4/)
  assert.match(source, /sellerRequestScreensLocked\.value && step\.value >= 4/)
  assert.match(source, /watch\(\[step, \(\) => props\.rateRequestId, \(\) => props\.modificationRequestId, \(\) => props\.sellerRequestMode\]/)
})

test('seller request draft scope is independent from the historical quote and awaits restoration', () => {
  const source = read('build/pricingSellerModificationWizard.ts')
  assert.match(source, /'pricing:modify:' \+ props\.modificationRequestId \+ ':' \+ props\.rateId/)
  assert.match(source, /!pricingDraftReady\.value \|\| pricingDraftRestoring\.value/)
  assert.match(source, /pricingModificationApplied\.value = true\s+syncSellerModificationInsurance\(\)/)
  assert.match(source, /if \(step\.value === 7\) syncSellerModificationInsurance\(\)/)
})

test('existing LCL seller request restores insurance independently of catalog-cost deltas and preserves edited amounts', () => {
  const source = read('build/pricingSellerModificationWizard.ts')
  const start = source.indexOf('function syncSellerModificationInsurance() {')
  const end = source.indexOf('async function applyPricingModification()', start)
  assert.ok(start >= 0 && end > start)
  const js = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const freight = { key: 'existing:F', detailId: 'F', costDetailType: 'Freight', included: true, costAmount: 50, saleAmount: 185 }
  const rateLines = { value: [freight] as any[] }
  const removed = new Set<string>()
  const run = new Function('props', 'pricingModificationApplied', 'hydratingExistingRate', 'isOwnLclMatrixContext',
    'pricingModificationWorkItem', 'number', 'cargoInsuranceService', 'rateLines', 'screen7LineWasRemoved',
    'explicitlyRemovedPersistedDetailIds', 'catalogs', 'calculateCargoInsurance', 'form', 'displayValue', 'cargoInsuranceNote',
    js + '\nreturn syncSellerModificationInsurance')(
      { modificationRequestId: 'R1' }, { value: true }, { value: false }, () => false,
      { value: { payload: { form: { cargoValue: 4020.2 } } } }, Number, { value: { id: 'INS' } },
      rateLines, (line: any) => removed.has(line.key), { value: new Set() },
      { currencies: [{ id: 'CRC', code: 'CRC' }, { id: 'USD', code: 'USD' }] },
      () => ({ cost: 35, sale: 95 }), { freightCost: 50 }, (item: any) => item.code, () => 'Seguro de carga')
  run()
  assert.equal(rateLines.value.length, 2)
  const insurance = rateLines.value[1]
  assert.equal(insurance.currencyCode, 'USD')
  assert.equal(insurance.saleAmount, 95)
  assert.equal(insurance.included, true)
  insurance.saleAmount = 110
  run()
  assert.equal(rateLines.value.length, 2)
  assert.equal(rateLines.value[1].saleAmount, 110)
  assert.equal(rateLines.value[0], freight)
  rateLines.value = [freight]
  run()
  assert.equal(rateLines.value.length, 2)
  removed.add('quote-edit:insurance')
  rateLines.value = [freight]
  run()
  assert.equal(rateLines.value.length, 1)
})

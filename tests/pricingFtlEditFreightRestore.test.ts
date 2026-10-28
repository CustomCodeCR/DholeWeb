import assert from 'node:assert/strict'
import test from 'node:test'
import { patchPricingWizardFtlEditFreightRestore } from '../build/pricingWizardFtlEditFreightRestore.ts'

// Minimal fixture representing the FTL/LTL screen after the earlier Vite transforms.
const fixture = [
  '<script setup lang="ts">',
  'async function searchApprovedRates() {',
  '  availableRates.value = []',
  '  form.selectedImportRateId = \'\'',
  '}',
  '</script>',
  `          <template v-else-if="form.modality === 'Land' && (shipmentModeForApi === 'Ltl' || (shipmentModeForApi === 'Ftl' && resolvedFtlTariff))">`,
  '          </template>',
].join('\n')

test('FTL edit restores original cost and sale even when origin, POE or equipment changed', () => {
  const output = patchPricingWizardFtlEditFreightRestore(fixture)
  const guard = output.split('async function searchApprovedRates() {')[1].split('  }\n  availableRates.value = []')[0]
  assert.match(output, /return \(rate\.rateDetails \?\? \[\]\)\.find\(\(detail\) => detail\.costDetailType === 'Freight'\)/)
  assert.doesNotMatch(output, /if \(rate\.polId !== form\.originId \|\| rate\.poeId !== form\.destinationId/)
  assert.match(guard, /const savedFtlFreight = savedFtlFreightForCurrentEdit\(\)/)
  assert.match(guard, /form\.freightCost = number\(savedFtlFreight\.costAmount\)/)
  assert.match(guard, /form\.freightSale = number\(savedFtlFreight\.saleAmount\)/)
  assert.match(guard, /return/)
})

test('shows original prices and warns about a changed route without assigning fake cost', () => {
  const output = patchPricingWizardFtlEditFreightRestore(fixture)
  assert.match(output, /persistedFtlContextChanged/)
  assert.match(output, /Costo original del flete/)
  assert.match(output, /Venta original del flete/)
  assert.match(output, /persistedFtlFreightForEdit\.costAmount/)
  assert.match(output, /persistedFtlFreightForEdit\.saleAmount/)
  assert.match(output, /No se recalculan automáticamente/)
  assert.match(output, /Revisar y ajustar costo \/ venta/)
  assert.doesNotMatch(output, /form\.freightCost = number\(tariff\.priceAmount\)/)
  assert.doesNotMatch(output, /form\.freightSale = number\(tariff\.priceAmount\)/)
})

test('master tariff lookup is read-only and never replaces historical freight', () => {
  const output = patchPricingWizardFtlEditFreightRestore(fixture)
  const consult = output.split('async function consultFtlTariffForEditedRoute() {')[1].split('async function searchApprovedRates() {')[0]
  assert.match(consult, /FtlTariffService\.resolve/)
  assert.match(consult, /ftlEditTariffPreview\.value = tariff/)
  assert.doesNotMatch(consult, /form\.freightCost\s*=/)
  assert.doesNotMatch(consult, /form\.freightSale\s*=/)
})

test('fails on changed Vite transform anchors and is idempotent', () => {
  assert.throws(
    () => patchPricingWizardFtlEditFreightRestore('<script></script>'),
    /Expected a single search and screen 5 anchor/,
  )
  const once = patchPricingWizardFtlEditFreightRestore(fixture)
  assert.equal(patchPricingWizardFtlEditFreightRestore(once), once)
})

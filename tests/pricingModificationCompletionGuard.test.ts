import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('opening a seller modification cannot enable delivery without a saved revision', () => {
  const resume = read('src/modules/pricing/views/PricingRateRequestResumeView.vue')
  const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  assert.match(wizard, /pendingModificationDelivery\.value = true/)
  assert.match(wizard, /savedModificationRevision\.value = persistedRate\.revisionNumber/)
  assert.match(resume, /const savedRevisionAvailable = ref<number \| null>\(null\)/)
  assert.match(resume, /RateRequestLeaseService\.prepareModification\(id, rateId, revisionNumber\)/)
})

test('pricing queue disables send action until preparation is persisted', () => {
  const panel = read('src/modules/pricing/components/PricingRateRequestsPanel.vue')
  assert.match(panel, /function canSendModification/)
  assert.match(panel, /isModification\(request\) && !canSendModification\(request\)/)
})

test('wizard prepares exact persisted revision only after successful save', () => {
  const patch = read('build/pricingSellerModificationWizard.ts')
  const saveNavigation = patch.indexOf("const stayInRevision =")
  assert.ok(saveNavigation > 0)
  const content = patch.slice(saveNavigation)
  assert.ok(content.indexOf('await PricingService.getRate(rateId)') <
    content.indexOf('await RateRequestLeaseService.prepareModification('))
  assert.match(content, /dhole:pricing:modification-prepared/)
})

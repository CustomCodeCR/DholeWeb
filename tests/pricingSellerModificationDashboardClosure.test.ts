import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('send verifies the persisted Completed state before reporting success', () => {
  const service = read('src/modules/pricing/services/rateRequestLeaseService.ts')
  assert.match(service, /const persisted = unwrapApiResponse<\{ status: string; rateId\?: string \| null \}>/)
  assert.match(service, /persisted\.status !== 'Completed'/)
  assert.match(service, /persisted\.rateId\?\.toLowerCase\(\) !== rateId\.toLowerCase\(\)/)
  assert.match(service, /dhole:pricing:rate-request-completed/)
})

test('wizard cannot save a second quote revision after a failed send or preparation', () => {
  const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  const save = wizard.indexOf('async function saveRate()')
  const update = wizard.indexOf('await PricingService.updateRate(', save)
  const remember = wizard.indexOf('pendingModificationDelivery.value = true', update)
  const prepare = wizard.indexOf('await RateRequestLeaseService.prepareModification(', remember)
  const complete = wizard.indexOf('await RateRequestLeaseService.completeRate(', prepare)

  assert.ok(save >= 0 && update > save && remember > update && prepare > remember && complete > prepare)
  assert.match(wizard, /if \(pendingModificationDelivery\.value\) \{[\s\S]*?await retrySavedModificationDelivery\(\)[\s\S]*?return/)
  assert.match(wizard, /Reintentar envío sin duplicar revisión/)
  assert.match(wizard, /persistedRate\.revisionNumber !== revision/)
})

test('previously saved open modifications can be completed without another updateRate', () => {
  const resume = read('src/modules/pricing/views/PricingRateRequestResumeView.vue')
  const start = resume.indexOf('async function sendAlreadySavedRevision()')
  const end = resume.indexOf('async function begin(', start)
  const recovery = resume.slice(start, end)
  assert.ok(start > 0 && end > start)
  assert.match(recovery, /PricingService\.getRate\(rateId\)/)
  assert.match(recovery, /RateRequestLeaseService\.prepareModification\(id, rateId, revisionNumber\)/)
  assert.match(recovery, /RateRequestLeaseService\.completeRate\(/)
  assert.doesNotMatch(recovery, /PricingService\.updateRate\(/)
  assert.match(resume, /Enviar revisión ya guardada/)
})

test('a changed quote revision is immediately recognized as a completed seller request', () => {
  const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  const afterUpdate = wizard.slice(wizard.indexOf('await PricingService.updateRate('))
  const confirm = afterUpdate.indexOf("savedRequest.status === 'Completed'")
  const prepare = afterUpdate.indexOf('await RateRequestLeaseService.prepareModification(')
  assert.ok(confirm >= 0 && prepare > confirm,
    'the wizard must check automatic database completion before trying the legacy prepare/send path')
  assert.match(afterUpdate.slice(confirm, prepare), /await router\.replace\(/)
  assert.match(afterUpdate, /const savedRequest = unwrapApiResponse/)
})

test('seller dashboard refetches open work after a completion event', () => {
  const panel = read('src/modules/pricing/components/PricingRateRequestsPanel.vue')
  assert.match(panel, /dhole:pricing:rate-request-completed/)
  assert.match(panel, /'Cache-Control': 'no-cache'/)
  assert.match(panel, /function handleCompletedRequest\(\) \{\s*void load\(\)/)
})

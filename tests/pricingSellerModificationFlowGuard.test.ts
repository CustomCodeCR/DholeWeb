import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (name: string) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')

test('seller modification bypasses manual update-reason dialog and starts in Pricing screen five', () => {
  const wizard = read('build/pricingSellerModificationWizard.ts')
  assert.match(wizard, /Solicitud de modificacion de vendedor/)
  assert.match(wizard, /editReasonConfirmed\.value = true/)
  assert.match(wizard, /if \(props\.rateId\) await hydrateExistingRate\(\)/)
  assert.match(wizard, /step\.value = 5/)
  assert.match(wizard, /!props\.modificationRequestId" class="mt-4 rounded-2xl/)
  assert.match(wizard, /updateReason: props\.modificationRequestId \? 'Solicitud de modificacion de vendedor'/)
  assert.match(wizard, /!props\.modificationRequestId && !props\.viewOnly && editingRate\.value/)
})

test('open modification does not unmount the wizard because of elapsed time or a transient heartbeat error', () => {
  const resume = read('src/modules/pricing/views/PricingRateRequestResumeView.vue')
  assert.doesNotMatch(resume, /idleTimeoutMs|15 \* 60 \* 1000/)
  assert.match(resume, /async function renewLease\(/)
  assert.match(resume, /await RateRequestLeaseService\.heartbeat\(id\)/)
  assert.match(resume, /await RateRequestLeaseService\.claim\(id\)/)
  assert.match(resume, /document\.addEventListener\('visibilitychange'/)
  assert.match(resume, /leaseWarning/)
  assert.doesNotMatch(resume, /Se perdió la reserva de esta solicitud\. Ya no puede editarla/)
})

test('seller sees attended only when a saved revision is explicitly prepared and completed', () => {
  const dashboard = read('src/modules/dashboard/components/SellerRoleDashboard.vue')
  assert.match(dashboard, /function modificationActuallyCompleted/)
  assert.match(dashboard, /request\.preparedRevisionNumber/)
  assert.match(dashboard, /request\.completedAtUtc/)
  assert.match(dashboard, /function modificationStillPending/)
  assert.match(dashboard, /Modificación pendiente de verificar/)
  assert.match(dashboard, /if \(modificationActuallyCompleted\(request\)\) return 'Modificación atendida'/)
})

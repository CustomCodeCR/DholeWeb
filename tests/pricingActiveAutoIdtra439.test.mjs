import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const router = readFileSync('src/core/router/index.ts', 'utf8')
const entry = readFileSync('src/modules/pricing/views/PricingOverviewView.vue', 'utf8')
const active = readFileSync('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', 'utf8')

function region(start, end) {
  const a = active.indexOf(start)
  const b = active.indexOf(end, a + 1)
  assert.ok(a >= 0 && b > a, `Missing active wizard section ${start}`)
  return active.slice(a, b)
}

test('rate wizard route uses PricingAlternativeWizardCrystal (not the legacy stable wizard)', () => {
  assert.match(router, /path: 'pricing\/rates\/:rateId\/wizard'/)
  assert.match(router, /import\('@\/modules\/pricing\/views\/PricingOverviewView\.vue'\)/)
  assert.match(entry, /import PricingAlternativeWizardCrystal from/)
  assert.match(entry, /<PricingAlternativeWizardCrystal/)
})

test('actual P9 acceptance does not ask for or transmit a manual IDTRA', () => {
  const acceptance = region('async function submitCommercialDecision()', 'async function approveCurrentRate()')
  const panel = region('<div v-if="commercialAction === \'accept\'"', '<div v-if="commercialAction === \'reject\'"')
  assert.match(acceptance, /status: 'AcceptedByClient'/)
  assert.match(acceptance, /selectRateGroup\(rateId\)/)
  assert.doesNotMatch(acceptance, /idtraNumber\s*:/)
  assert.doesNotMatch(panel, /v-model="commercialIdtra"/)
  assert.doesNotMatch(panel, /label="Números IDTRA/)
  assert.match(panel, /Operations creará el trámite/)
  assert.match(panel, /v-model="commercialOtherReferences"/)
})

test('P8 displays historic IDs without modification and P9 explains the automatic IDTRA', () => {
  assert.doesNotMatch(active, /v-model="form\.idtraNumber"/)
  assert.match(active, /IDTRA históricos asociados a Dynamics \(solo lectura\)/)
  assert.match(active, /Se genera automáticamente al aceptar/)
  assert.match(active, /name: 'operations-cases'/)
})


test('accepted quote can link an existing manual IDTRA without automatic creation or direct dual write', () => {
  assert.match(active, /operationsApi\.linkQuote\(target.id, identity.option, target.version\)/)
  assert.match(active, /linkedOperationsCases\.value\.map\(item => item\.idtra\)/)
  assert.match(active, /apertureType: 'MANUAL'/)
})

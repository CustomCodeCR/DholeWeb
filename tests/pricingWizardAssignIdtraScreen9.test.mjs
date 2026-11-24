import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../src/modules/pricing/components/', import.meta.url)
const alternative = readFileSync(new URL('PricingAlternativeWizardCrystal.vue', root), 'utf8')
const stable = readFileSync(new URL('PricingRateExistingWizardStable.vue', root), 'utf8')
const modal = readFileSync(new URL('PricingAssignIdtraModal.vue', root), 'utf8')
const service = readFileSync(new URL('../src/core/services/pricingService.ts', import.meta.url), 'utf8')

for (const [name, code] of [['stable legacy wizard', stable]]) {
  test(name + ': step 9 exposes Assign IDTRA next to pending IDTRA', () => {
    assert.match(code, /<div v-else-if="step === 9 && viewOnly && editingRate"/)
    assert.match(code, /data-testid="pricing-screen9-idtra-action"/)
    assert.match(code, /<DhButton v-if="showAssignIdtra" size="sm" :disabled="!canAssignIdtra" @click="openAssignIdtra">Asignar IDTRA<\/DhButton>/)
    assert.match(code, /const showAssignIdtra = computed\(\(\) => editingRate\.value\?\.status === 'AcceptedByClient'/)
    assert.match(code, /isIdtraPending\(editingRate\.value\.idtraNumber\)/)
    assert.match(code, /pendiente\(\?: de asignar\)\?/)
    assert.match(code, /canUpdateRateStatus\.value \|\| canApproveLowMargin\.value/)
    assert.match(code, /component: PricingAssignIdtraModal/)
    assert.match(code, /onSaved: async \(\) => \{ await hydrateExistingRate\(\) \}/)
  })
}

test('assignment persists via dedicated API; it does not edit the quote or create a revision', () => {
  assert.match(modal, /PricingService\.assignRateIdtra\(props\.rate\.id, normalizedIdtraCsv\.value, otherReferences\.value\.trim\(\)\)/)
  assert.match(modal, /props\.rate\.status !== 'AcceptedByClient' \|\| props\.rate\.idtraNumber\?\.trim\(\)/)
  assert.match(service, /async assignRateIdtra\(/)
})

test('active wizard does not offer manual IDTRA assignment after client acceptance', () => {
  assert.match(alternative, /data-testid="pricing-screen9-operations-idtra-status"/)
  assert.match(alternative, /Sincronización con Operations por verificar/)
  assert.doesNotMatch(alternative, /<DhButton[^>]*>Asignar IDTRA<\/DhButton>/)
  assert.doesNotMatch(alternative, /component: PricingAssignIdtraModal/)
  assert.match(alternative, /name: 'operations-cases'/)
})

test('legacy stable wizard preserves manual IDTRA support for historical records only', () => {
  assert.match(stable, /<DhButton v-if="showAssignIdtra"/)
  assert.match(stable, /:disabled="!canAssignIdtra"/)
  assert.match(stable, /showAssignIdtra && !canAssignIdtra/)
})

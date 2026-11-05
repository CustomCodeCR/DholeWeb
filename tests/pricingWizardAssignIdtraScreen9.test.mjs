import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../src/modules/pricing/components/', import.meta.url)
const alternative = readFileSync(new URL('PricingAlternativeWizardCrystal.vue', root), 'utf8')
const stable = readFileSync(new URL('PricingRateExistingWizardStable.vue', root), 'utf8')
const modal = readFileSync(new URL('PricingAssignIdtraModal.vue', root), 'utf8')
const service = readFileSync(new URL('../src/core/services/pricingService.ts', import.meta.url), 'utf8')

for (const [name, code] of [['alternative wizard', alternative], ['stable wizard', stable]]) {
  test(name + ': step 9 exposes Assign IDTRA next to pending IDTRA', () => {
    assert.match(code, /<div v-else-if="step === 9 && viewOnly && editingRate"/)
    assert.match(code, /<p class="min-w-0 break-words text-sm font-bold">IDTRA: {{ editingRate\.idtraNumber \|\| 'Pendiente' }}<\/p>\s*<DhButton v-if="canAssignIdtra" size="sm" @click="openAssignIdtra">Asignar IDTRA<\/DhButton>/)
    assert.match(code, /const canAssignIdtra = computed\(\(\) => editingRate\.value\?\.status === 'AcceptedByClient'/)
    assert.match(code, /!String\(editingRate\.value\.idtraNumber \?\? ''\)\.trim\(\)/)
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

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wizard = readFileSync('src/modules/pricing/components/PricingRateExistingWizardStable.vue', 'utf8')
const pricingTypes = readFileSync('src/core/interfaces/pricing.ts', 'utf8')
const listing = readFileSync('src/modules/pricing/views/PricingRatesView.vue', 'utf8')
const dashboard = readFileSync('src/modules/dashboard/components/PricingRoleDashboard.vue', 'utf8')
const statusLabels = readFileSync('src/modules/pricing/utils/pricingFormat.ts', 'utf8')

test('user can identify and link a different accepted quotation in the wizard', () => {
  assert.match(wizard, /Cliente aceptó otra QUO/)
  assert.match(wizard, /status: 'QUOVinculada', linkedAcceptedRateId: linkedAcceptedRateId\.value/)
  assert.match(wizard, /statuses: \['AcceptedByClient'\]/)
  assert.match(wizard, /isSameQuoteClient\(editingRate\.value!, rate\)/)
  assert.match(wizard, /editingRate\.linkedAcceptedRateId/)
  assert.match(wizard, /Confirmar vínculo/)
})

test('linked quotation is represented as its own distinct rate state', () => {
  assert.match(pricingTypes, /\| 'QUOVinculada'/)
  assert.match(pricingTypes, /linkedAcceptedRateId\?: string \| null/)
  assert.match(listing, /value: 'QUOVinculada'/)
  assert.match(dashboard, /label: 'QUO vinculadas'/)
  assert.match(statusLabels, /QUOVinculada: \['Cliente aceptó otra QUO'/)
})

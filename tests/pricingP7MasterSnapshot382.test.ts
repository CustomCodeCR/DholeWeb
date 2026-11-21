import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reconcileActiveCostCatalog } from '../src/modules/pricing/utils/pricingScreenSevenCostRecovery.ts'

test('unselected optional catalogue charges do not enter wizard candidate costs', () => {
  const catalog = [
    { id: 'agency', costType: 'Fixed', costAmount: 350 },
    { id: 'despacho', costType: 'Optional', costAmount: 50 },
  ]
  const contextual = [{ id: 'agency', costType: 'Fixed', costAmount: 350 }]
  assert.deepEqual(reconcileActiveCostCatalog(contextual, catalog, x => x.costType !== 'Optional'), contextual)
  assert.deepEqual(reconcileActiveCostCatalog([], catalog, x => x.costType !== 'Optional').map(x => x.id), ['agency'])
})
test('saved quotations are authoritative and tier query follows cargo hydration', () => {
  const source = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  assert.match(source, /if \(props\.rateId \|\| !editingRate\.value \|\| props\.viewOnly\) return 0/)
  assert.match(source, /costs\.value = reconcileActiveCostCatalog\([\s\S]*?cost => cost\.costType !== 'Optional'/)
  assert.match(source, /PricingService\.selectWizardCosts\(/)
  assert.match(source, /containerTypeId: form\.equipmentId \|\| undefined/)
  assert.match(source, /storageDays: number\(form\.storageDays\) > 0/)
  const hydration = source.slice(source.indexOf('async function hydrateExistingRate()'), source.indexOf('function editCurrentRate()'))
  assert.ok(hydration.indexOf('form.storageDays = Math.max') < hydration.indexOf('await loadApplicableCosts()'))
  assert.ok(hydration.indexOf('await loadApplicableCosts()') < hydration.indexOf('rateLines.value = rate.rateDetails.filter'))
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { reconcileActiveCostCatalog } from '../src/modules/pricing/utils/pricingScreenSevenCostRecovery.ts'
import { costRelationMatches } from '../src/modules/pricing/utils/pricingCostMultiRelations.ts'

const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')

test('P7 recovers fixed MAERSK destination and WWL agent charges if contextual API only returns optionals', () => {
  const active = [
    { id: 'caldera-maersk-dest', name: 'Cargos en destino de la Linea Naviera', costType: 'Fixed', carrierId: 'maersk', poeId: 'caldera', costAmount: 280, saleAmount: 435 },
    { id: 'caldera-maersk-doc', name: 'Doc Fee', costType: 'Fixed', carrierId: 'maersk', poeId: 'caldera', costAmount: 60, saleAmount: 65 },
    { id: 'wwl-manejos', name: 'Manejos', costType: 'Fixed', agentId: 'wwl', costAmount: 50, saleAmount: 0 },
    { id: 'maersk-optional', name: 'Inland Caldera a GAM', costType: 'Optional', carrierId: 'maersk', poeId: 'caldera', costAmount: 505, saleAmount: 795 },
  ]
  const contextual = [active[3]]
  const combined = reconcileActiveCostCatalog(contextual, active)
  assert.equal(combined.length, 4)
  assert.deepEqual(new Set(combined.filter(c => c.costType === 'Fixed').map(c => c.id)),
    new Set(['caldera-maersk-dest', 'caldera-maersk-doc', 'wwl-manejos']))
  assert.equal(combined.find(c => c.id === 'caldera-maersk-dest')?.saleAmount, 435)
  assert.match(wizard, /costs.value = reconcileActiveCostCatalog\(received, allCosts.value\)/)
  assert.match(wizard, /\.filter\(applicableCost\)/)
})

test('a CostId remains unique while names and different providers may repeat', () => {
  const catalog = [{ id: 'a', name: 'Manejos', costAmount: 50 },
    { id: 'b', name: 'Manejos', costAmount: 75 }]
  const combined = reconcileActiveCostCatalog([{ ...catalog[0], costAmount: 55 }], catalog)
  assert.equal(combined.length, 2)
  assert.equal(combined.find(item => item.id === 'a')?.costAmount, 55)
  assert.equal(costRelationMatches([{ id: 'maersk' }], 'maersk', 'other'), false)
  assert.equal(costRelationMatches([{ id: 'wwl' }], 'wwl', 'wwl'), true)
})

test('P7 rejects empty cached cost-line drafts, preserves any-shipment costs, and retries without refreshing page', () => {
  assert.match(wizard, /alternativeCostsLoaded.value\[key\] === context && rateLines.value.length > 0/)
  assert.match(wizard, /cost.shipmentMode !== 'Any'/)
  assert.match(wizard, /restoreMissingScreenSevenLines\(\)/)
  assert.match(wizard, /await reloadCurrentAlternativeCosts\(\)/)
  assert.match(wizard, /Reconstruir cargos/)
  assert.match(wizard, /const freightRequested =/)
  assert.match(wizard, /number\(form.freightCost\) > 0 \|\| number\(form.freightSale\) > 0/)
})

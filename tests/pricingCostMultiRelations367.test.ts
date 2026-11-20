import assert from 'node:assert/strict'
import test from 'node:test'
import { costLegacyPortMatches, costRelationMatches } from '../src/modules/pricing/utils/pricingCostMultiRelations.ts'

test('second POE/POD in multi-select is valid regardless of legacy first item', () => {
  const firstPoe = 'poe-caldera'
  const secondPoe = 'poe-moin'
  assert.equal(costRelationMatches([{ id: firstPoe }, { id: secondPoe }], firstPoe, secondPoe), true)
  assert.equal(costRelationMatches([{ id: firstPoe }, { id: secondPoe }], firstPoe, 'poe-not-configured'), false)
  assert.equal(costLegacyPortMatches({
    portId: firstPoe, portRole: 'Poe', poes: [{ id: firstPoe }, { id: secondPoe }],
  }, { poeId: secondPoe }), true)
  assert.equal(costLegacyPortMatches({ portId: firstPoe, portRole: 'Poe', poes: [] }, { poeId: secondPoe }), false)
})

test('configured multi-naviera or agent list is authoritative, not the legacy first ID', () => {
  assert.equal(costRelationMatches([{ id: 'one' }, { id: 'cma-cgm' }], 'one', 'cma-cgm'), true)
  assert.equal(costRelationMatches([{ id: 'one' }, { id: 'cma-cgm' }], 'one', 'hapag'), false)
  assert.equal(costRelationMatches([{ id: 'rs' }, { id: 'wwl' }], 'rs', 'wwl'), true)
})

test('generic costs are unrestricted while concrete restrictions require real selection', () => {
  assert.equal(costRelationMatches([], null, ''), true)
  assert.equal(costRelationMatches(null, 'poe-caldera', ''), false)
  assert.equal(costRelationMatches([{ id: 'poe-caldera' }], null, null), false)
  assert.equal(costRelationMatches([], 'poe-caldera', 'poe-caldera'), true)
  assert.equal(costLegacyPortMatches({ portId: 'pol-shanghai', portRole: 'Pol' }, { polId: 'pol-shanghai' }), true)
  assert.equal(costLegacyPortMatches({ portId: 'pol-shanghai', portRole: 'Pol' }, { polId: 'pol-ningbo' }), false)
})

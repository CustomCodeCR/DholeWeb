import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateDuplicatedFclFreight } from '../src/modules/pricing/utils/pricingDuplicatedFclFreightValidation.ts'

const validManual = {
  sourceRateId: '',
  manual: true,
  agentId: 'agent-a',
  carrierId: 'carrier-a',
  currencyId: 'usd',
  freightCost: 120,
  freightSale: 200,
  lines: [{ type: 'Freight', included: true, saleAmount: 200 }],
}

test('fresh imported FCL freight remains valid after switching equipment', () => {
  assert.equal(validateDuplicatedFclFreight({ ...validManual, sourceRateId: 'new-rate', manual: false, lines: [] }), true)
})

test('new manual FCL freight is accepted when no compatible imported bundle exists', () => {
  assert.equal(validateDuplicatedFclFreight(validManual), true)
  assert.equal(validateDuplicatedFclFreight({ ...validManual, freightCost: 0 }), true)
})

test('manual freight cannot save without provider, currency, positive sale or priced freight line', () => {
  assert.equal(validateDuplicatedFclFreight({ ...validManual, agentId: '' }), false)
  assert.equal(validateDuplicatedFclFreight({ ...validManual, carrierId: '' }), false)
  assert.equal(validateDuplicatedFclFreight({ ...validManual, currencyId: '' }), false)
  assert.equal(validateDuplicatedFclFreight({ ...validManual, manual: false }), false)
  assert.equal(validateDuplicatedFclFreight({ ...validManual, freightCost: -5 }), false)
  assert.equal(validateDuplicatedFclFreight({ ...validManual, freightSale: 0 }), false)
  assert.equal(validateDuplicatedFclFreight({ ...validManual, freightSale: 'NaN' }), false)
  assert.equal(validateDuplicatedFclFreight({ ...validManual, lines: [] }), false)
  assert.equal(validateDuplicatedFclFreight({ ...validManual, lines: [{ type: 'Customs', included: true, saleAmount: 200 }] }), false)
  assert.equal(validateDuplicatedFclFreight({ ...validManual, lines: [{ type: 'Freight', included: false, saleAmount: 200 }] }), false)
})

test('every selected POE/carrier alternative must have its own fresh freight', () => {
  const alternatives = [
    validManual,
    { ...validManual, agentId: 'agent-b', carrierId: 'carrier-b', freightSale: 350 },
  ]
  assert.equal(alternatives.every(validateDuplicatedFclFreight), true)
  assert.equal([...alternatives, { ...validManual, freightSale: 0 }].every(validateDuplicatedFclFreight), false)
})

test('Vite wizard transform no longer forbids manual freight on duplicated FCL', () => {
  const plugin = readFileSync(new URL('../build/pricingDuplicateRateRefreshWorkflow.ts', import.meta.url), 'utf8')
  assert.match(plugin, /function hasNewDuplicatedFclFreight\(\)/)
  assert.match(plugin, /validateDuplicatedFclFreight/)
  assert.match(plugin, /selectedCarrierRoutes\.value\.every/)
  assert.match(plugin, /rememberCurrentCarrierDraft\(\)/)
  assert.doesNotMatch(plugin, /no se permite continuar con flete manual/i)
  assert.doesNotMatch(plugin, /&& !form\.selectedImportRateId\) \{/)
})

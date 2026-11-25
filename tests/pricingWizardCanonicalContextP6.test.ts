import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { repairPricingCostContextReferences } from '../build/pricingWizardRuntimeReferenceGuard.ts'

const ftl = readFileSync(new URL('../build/pricingFtlLandCostsFix.ts', import.meta.url), 'utf8')
const haulage = readFileSync(new URL('../build/pricingWizardHaulageComparison20261008.ts', import.meta.url), 'utf8')

test('P6: compatibility guard preserves all existing canonical Pricing context bindings', () => {
  const start = ftl.indexOf('function costContextImportRateId() {')
  const end = ftl.indexOf('function costSpecificity', start)
  const loaderStart = ftl.indexOf('async function loadApplicableCosts() {')
  const loaderEnd = ftl.indexOf('function rebuildRateLines', loaderStart)
  assert.ok(start >= 0 && end > start && loaderStart >= 0 && loaderEnd > loaderStart)
  const fixture = ftl.slice(start, end) + ftl.slice(loaderStart, loaderEnd)
  const transformed = repairPricingCostContextReferences(fixture)
  assert.equal(transformed, fixture)
  assert.match(transformed, /const contextKey = currentCostContextKey\(\)/)
  assert.match(transformed, /__dholePricingContextKey: contextKey/)
  assert.match(transformed, /costResolvedByBackendContext\(cost\)/)
  assert.match(haulage, /if \(contextKey !== currentCostContextKey\(\)\) return false/)
  assert.match(haulage, /costResolvedByBackendContext\(cost\)/)
})

test('P6: unchanged MSC Caldera context accepts returned Merchant and Carrier rows; stale alternative is rejected', () => {
  const source = ftl.match(/function currentCostContextKey\(\) \{[\s\S]*?\n\}/)?.[0]
  assert.ok(source)
  const form = {
    originId: 'origin', podId: 'san-jose', incotermId: 'FOB', carrierId: 'MSC',
    serviceIds: ['international-transport'], equipmentId: '40HC', equipmentQuantity: 1,
    cargoWeightKg: 12000, cargoPackages: 4, cargoPallets: 0, storageDays: 0,
    crmClientKind: 'Account', clientId: 'customer-a',
  }
  let poe = 'caldera'
  const key = new Function('form', 'costShipmentModeForApi', 'costContextPoeId',
    'costContextAgentId', 'costContextImportRateId', source + '\nreturn currentCostContextKey()')
  const current = () => key(form, () => 'Fcl', () => poe, () => 'WWL', () => '')
  const captured = current()
  const rows = [
    { id: '66b0460d-ef01-4123-b5b6-4d78d6bc5361', name: 'Inland Caldera a GAM (Merchant)', costAmount: 590 },
    { id: '3a500ea2-c34b-42fd-a4c2-fdf34927ec2c', name: 'Inland Caldera a GAM (Naviera)', costAmount: 663 },
  ].map(row => ({ ...row, __dholePricingContextKey: captured }))
  const accepted = () => rows.filter(row => row.__dholePricingContextKey === current())
  assert.equal(captured, current())
  assert.equal(accepted().length, 2)
  assert.equal(accepted().sort((a, b) => a.costAmount - b.costAmount)[0]?.costAmount, 590)
  for (const [field, value] of Object.entries({ carrierId: 'MAERSK', equipmentId: '20DV', cargoWeightKg: 13000, clientId: 'customer-b' })) {
    const original = Reflect.get(form, field)
    Reflect.set(form, field, value)
    assert.equal(accepted().length, 0, field)
    Reflect.set(form, field, original)
  }
  poe = 'moin'
  assert.equal(accepted().length, 0)
})

test('P6: fallback rewrites still repair absent runtime references', () => {
  const fixture = '    const contextKey = currentCostContextKey()\n  const backendContextMatched = costResolvedByBackendContext(cost)'
  const transformed = repairPricingCostContextReferences(fixture)
  assert.match(transformed, /const contextKey = dholeRuntimeCostContextKey\(\)/)
  assert.match(transformed, /const backendContextMatched = dholeRuntimeCostResolvedByBackendContext\(cost\)/)
})

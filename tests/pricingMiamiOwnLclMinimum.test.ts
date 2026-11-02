import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import { pricingMiamiOwnLclBreakdown } from '../build/pricingMiamiOwnLclBreakdown.ts'

const wizardPath = '/project/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const fixture = [
  '<script setup lang="ts">',
  'const providerCost = computed(() => 0)',
  'async function saveRate() {}',
  '</script>',
  '<div v-else-if="step === 8" class="space-y-6">',
  '  <table><tr v-for="line in includedLines" :key="line.key" class="row"><td>Line</td></tr></table>',
  '</div>',
  '<div v-else-if="step === 9" class="space-y-6"></div>',
].join('\n')

const plugin = pricingMiamiOwnLclBreakdown()
const transform = plugin.transform as unknown as
  (source: string, id: string) => { code: string }
const patched = transform(fixture, wizardPath).code
const start = patched.indexOf('function enforceMiamiNvoccAMinimum() {')
const end = patched.indexOf('\nwatch(', start)
assert.ok(start >= 0 && end > start, 'minimum guard is injected into the wizard')
assert.match(patched, /async function saveRate\(\) \{\n  enforceMiamiNvoccAMinimum\(\)/,
  'save payload must be normalized even if sale was edited after the watcher')
assert.match(patched, /function enforceMiamiNvoccAMinimum\(\)[\s\S]*\nwatch\(/,
  'the quote preview must react to source, cargo, and plan changes')

const executable = ts.transpileModule(patched.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

function runGuard(options: {
  quantity?: number
  saleAmount?: number
  plan?: string
  notes?: string
  viewOnly?: boolean
  own?: boolean
  currency?: string
  hydrating?: boolean
} = {}) {
  const quantity = options.quantity ?? 11.172
  const freight = {
    included: true,
    costDetailType: 'Freight',
    chargeBasis: 'PerChargeableCft',
    notes: options.notes ?? 'LCL PROPIO · ConsolidadoId: 44444444-4444-4444-4444-444444444444',
    currencyCode: options.currency ?? 'USD',
    costAmount: 2.60,
    saleAmount: options.saleAmount ?? 2.69,
  }
  const form = { miamiCommercialPlan: options.plan ?? 'NVOCC-A', freightSale: freight.saleAmount }
  const env = {
    props: { viewOnly: options.viewOnly ?? false },
    hydratingExistingRate: { value: options.hydrating ?? false },
    isMiamiLcl: { value: true },
    form,
    isOwnLclMatrixContext: () => options.own ?? true,
    rateLines: { value: [freight] },
    canonicalCurrencyCode: (line: typeof freight) => line.currencyCode,
    number: (value: unknown) => Number(value) || 0,
    quantityForRateLine: () => quantity,
    miamiCommercialRate: { value: { minimumFreightSale: 95 } },
  }
  vm.runInNewContext(executable + '\nenforceMiamiNvoccAMinimum()', env)
  return { freight, form, subtotal: freight.saleAmount * quantity }
}

test('NVOCC-A Miami: 11.172 CFT below minimum is corrected for persisted cent precision', () => {
  const result = runGuard()
  assert.equal(result.freight.saleAmount, 8.51)
  assert.equal(result.form.freightSale, 8.51)
  assert.ok(result.subtotal >= 95)
  assert.ok(result.subtotal < 95.08)
  assert.equal(result.freight.costAmount, 2.60, 'cost is not altered')
})

test('NVOCC-A: backend fractional unit sale is rounded UP, never below 95 after saving', () => {
  const result = runGuard({ saleAmount: 95 / 11.172 })
  assert.equal(result.freight.saleAmount, 8.51)
  assert.ok(result.subtotal >= 95)
})

test('NVOCC-A: valid subtotal and exact whole-unit minimum are retained', () => {
  assert.equal(runGuard({ saleAmount: 9 }).freight.saleAmount, 9)
  assert.equal(runGuard({ quantity: 20, saleAmount: 4.75 }).subtotal, 95)
  assert.equal(runGuard({ quantity: 50, saleAmount: 2.60 }).subtotal, 130)
})

test('NVOCC-A guard does not reprice coloaders, other plans, view-only or loading snapshots', () => {
  assert.equal(runGuard({ notes: 'LCL COLOADER · RateId: 111' }).freight.saleAmount, 2.69)
  assert.equal(runGuard({ own: false }).freight.saleAmount, 2.69)
  assert.equal(runGuard({ plan: 'A' }).freight.saleAmount, 2.69)
  assert.equal(runGuard({ viewOnly: true }).freight.saleAmount, 2.69)
  assert.equal(runGuard({ hydrating: true }).freight.saleAmount, 2.69)
  assert.equal(runGuard({ currency: 'CRC' }).freight.saleAmount, 2.69)
})

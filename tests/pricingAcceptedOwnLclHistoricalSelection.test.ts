import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../src/modules/pricing/components/PricingLclRateSourceSelector.vue', import.meta.url),
  'utf8',
)
const wizardPlugin = readFileSync(
  new URL('../build/pricingWizardEnhancements.ts', import.meta.url),
  'utf8',
)

function filteredRows(id: string, rows: Array<Record<string, unknown>>, poeEligible = true) {
  const start = source.indexOf('const filteredOwn = computed(() => {')
  const end = source.indexOf('\nconst filteredColoaders = computed(', start)
  assert.ok(start > 0 && end > start, 'selector must define own consolidation filtering')
  const script = source.slice(start, end)
  const env: Record<string, any> = {
    computed: (fn: () => unknown) => ({ get value() { return fn() } }),
    historicalOwnId: { value: id.toLowerCase() },
    ownPoeEligible: { value: poeEligible },
    search: { value: '' },
    ownRows: { value: rows },
    showAllOwnConsolidations: { value: false },
    normalize: (value: unknown) => String(value ?? '').toLowerCase().trim(),
    isHistoricalOwn: (row: any) => Boolean(id && String(row.id).toLowerCase() === id.toLowerCase()),
    ownDepartureExpired: (row: any) => Boolean(row.expired),
    ownConsolidationSupportsPoe: (row: any) => row.poeCompatible !== false,
    ownConsolidationSupportsPol: (row: any) => row.polCompatible !== false,
  }
  vm.runInNewContext(script + '\nthis.result = filteredOwn.value.map((row) => row.id)', env)
  return Array.from(env.result) as string[]
}

const accepted = {
  id: 'historical-55',
  name: 'Consolidado de tarifa aceptada',
  status: 'Closed',
  isActive: false,
  expired: true,
  poeCompatible: false,
  polCompatible: false,
}

test('accepted quotation displays its original closed, inactive and expired consolidated source', () => {
  const rows = [
    accepted,
    { id: 'other-closed', status: 'Closed', isActive: true },
    { id: 'new-open', status: 'Open', isActive: true },
  ]
  assert.deepEqual(filteredRows(accepted.id, rows), ['historical-55', 'new-open'])
  assert.deepEqual(filteredRows(accepted.id, rows, false), ['historical-55'])
})

test('ordinary quotations never display closed or expired own consolidations', () => {
  const rows = [
    accepted,
    { id: 'other-closed', status: 'Closed', isActive: true },
    { id: 'other-expired', status: 'Open', isActive: true, expired: true },
    { id: 'new-open', status: 'Open', isActive: true },
  ]
  assert.deepEqual(filteredRows('', rows), ['new-open'])
})

test('historic source is fetched by exact ID and remains read-only, with correct parent scope', () => {
  assert.match(source, /OwnLclConsolidationService\.get\(historicalId\)/)
  assert.match(source, /if \(props\.viewOnly\) return/)
  assert.match(source, /historicalOwnUnavailable\(row\)/)
  assert.match(wizardPlugin, /historical-own-consolidation-id/)
  assert.match(wizardPlugin, /AcceptedByClient/)
})

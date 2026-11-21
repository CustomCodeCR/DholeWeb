import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { replaceScopedOptionalCostFunction } from '../build/pricingOptionalCostFunctionScope.ts'
import { assertIncotermPricingRuntime } from '../build/pricingCrmPreferredRuntimeGuard.ts'

const read = (path: string) =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8')

const fixture = [
  'function shouldIncludeOptionalCost(line: { name: string }) {',
  '  if (!line.name) {',
  '    return false',
  '  }',
  '  return true',
  '}',
  '',
  'const explicitlyQuotedOutsideIncoterm = ref(new Set<string>())',
  'const expandedOutsideIncotermGroups = ref(new Set<string>())',
  'const outsideIncotermScopeKey = (line: RateLine) => line.key',
  'function isAutomaticOutsideIncoterm(line: RateLine) { return true }',
  'function rememberExplicitOutsideIncoterm(line: RateLine, selected: boolean) {}',
  'function applyIncotermAutomaticChargeGuard() {}',
  'function outsideIncotermCandidateLines(groupKey: string) {}',
  'function toggleOutsideIncotermGroup(groupKey: string) {}',
  'function quoteOutsideIncotermByAgreement(line: RateLine) {}',
  '',
  'const selectableOptionalLines = computed(() => [])',
].join('\n')

test('replacing optional-cost inclusion never deletes adjacent Incoterm helpers', () => {
  const result = replaceScopedOptionalCostFunction(
    fixture,
    'function shouldIncludeOptionalCost(line: { name: string }) { return false }',
    'test',
  )
  for (const name of [
    'explicitlyQuotedOutsideIncoterm', 'outsideIncotermScopeKey',
    'isAutomaticOutsideIncoterm', 'applyIncotermAutomaticChargeGuard',
    'outsideIncotermCandidateLines', 'quoteOutsideIncotermByAgreement',
    'selectableOptionalLines',
  ]) assert.ok(result.includes(name), name)
  assert.match(result, /return false \}/)
  assert.doesNotMatch(result, /return true\n\}/)
})

test('optional-cost replacement fails closed for missing or duplicate functions', () => {
  assert.throws(
    () => replaceScopedOptionalCostFunction('const noHelper = true', 'replacement', 'test'),
    /Expected one shouldIncludeOptionalCost function; found 0/,
  )
  assert.throws(
    () => replaceScopedOptionalCostFunction(fixture + '\n' + fixture, 'replacement', 'test'),
    /Expected one shouldIncludeOptionalCost function; found 2/,
  )
})

test('both Vite transforms use the narrowly scoped optional-cost replacement', () => {
  for (const path of [
    'build/pricingWizardScreen4CostSelectors.ts',
    'build/pricingCostOperationalConditions.ts',
  ]) {
    const source = read(path)
    assert.match(source, /import \{ replaceScopedOptionalCostFunction \}/)
    assert.match(source, /code = replaceScopedOptionalCostFunction\(/)
  }
})

test('final wizard runtime assertion prevents missing declarations before Vue compilation', () => {
  const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  assert.doesNotThrow(() => assertIncotermPricingRuntime(wizard))
  assert.throws(
    () => assertIncotermPricingRuntime(
      wizard.replace('function applyIncotermAutomaticChargeGuard()', 'function removedGuard()'),
    ),
    /applyIncotermAutomaticChargeGuard/,
  )
  assert.throws(
    () => assertIncotermPricingRuntime(
      wizard.replace('const expandedOutsideIncotermGroups = ref(', 'const removedGroups = ref('),
    ),
    /expandedOutsideIncotermGroups/,
  )
  assert.match(read('vite.config.ts'), /pricingCrmPreferredRuntimeGuard\(\),\s*vue\(\)/)
})

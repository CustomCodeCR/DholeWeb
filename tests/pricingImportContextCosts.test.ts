import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const landTransform = readFileSync(new URL('../build/pricingFtlLandCostsFix.ts', import.meta.url), 'utf8')
const crystal = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const stable = readFileSync(new URL('../src/modules/pricing/components/PricingRateExistingWizardStable.vue', import.meta.url), 'utf8')
const sections = ['pickup_origin', 'origin_charges', 'international_freight', 'destination_charges', 'delivery_destination']

function resolvedSections(
  transportService: boolean,
  charges: Array<{ id: string; section: string; costDetailType: string; isActive?: boolean; applicable?: boolean }>,
  modality = 'Maritime',
) {
  const start = landTransform.indexOf('`const visibleSections = computed<RateSection[]>(() => {')
  const end = landTransform.indexOf('const includedLines = computed`', start)
  assert.ok(start >= 0 && end > start, 'transform must create a visible-sections block')
  const snippet = landTransform.slice(start + 1, end)
  const js = ts.transpileModule(snippet, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText
  const env = {
    computed: (callback: () => unknown) => ({ get value() { return callback() } }),
    form: { modality },
    shipmentModeForApi: { value: modality === 'Land' ? 'Ltl' : 'Fcl' },
    incotermResponsibilitySections: { value: ['destination_charges', 'delivery_destination'] },
    hasInternationalTransportService: { value: transportService },
    sectionOrder: sections,
    costs: { value: charges },
    applicableCost: (item: { applicable?: boolean }) => item.applicable !== false,
    sectionForCost: (item: { section: string }) => item.section,
  }
  return Array.from(vm.runInNewContext(js + '\nvisibleSections.value', env) as string[])
}

test('CIF import reveals matched origin, destination and documentation costs without forcing freight', () => {
  const result = resolvedSections(false, [
    { id: 'handling', section: 'origin_charges', costDetailType: 'OriginCharge' },
    { id: 'customs', section: 'destination_charges', costDetailType: 'DestinationCharge' },
    { id: 'bl', section: 'international_freight', costDetailType: 'Documentation' },
    { id: 'freight', section: 'international_freight', costDetailType: 'Freight' },
    { id: 'other-route', section: 'pickup_origin', costDetailType: 'OriginCharge', applicable: false },
  ])
  assert.ok(result.includes('origin_charges'), 'matched origin handling must not vanish because CIF buyer sections omit it')
  assert.ok(result.includes('destination_charges'))
  assert.ok(result.includes('international_freight'), 'matched documentation may appear without a purchased freight leg')
  assert.ok(!result.includes('pickup_origin'), 'unmatched route costs remain excluded')
})

test('CIF import without an international transport service does not invent a freight stage', () => {
  const result = resolvedSections(false, [
    { id: 'destination', section: 'destination_charges', costDetailType: 'DestinationCharge' },
    { id: 'freight', section: 'international_freight', costDetailType: 'Freight' },
  ])
  assert.ok(!result.includes('international_freight'))
  assert.ok(result.includes('destination_charges'))
  assert.ok(resolvedSections(true, []).includes('international_freight'),
    'explicitly selected International Transport must be available under CIF')
})

test('inactive and unmatched catalog costs never widen the visible sections', () => {
  const result = resolvedSections(false, [
    { id: 'inactive', section: 'pickup_origin', costDetailType: 'OriginCharge', isActive: false },
    { id: 'another-provider', section: 'origin_charges', costDetailType: 'OriginCharge', applicable: false },
  ])
  assert.ok(!result.includes('pickup_origin'))
  assert.ok(!result.includes('origin_charges'))
})

test('FTL/LTL preserve all stage choices independently of the Incoterm', () => {
  assert.deepEqual(resolvedSections(false, [], 'Land'), sections)
})

test('contextual API costs are authoritative; catalog fallback still checks exact route and provider', () => {
  const start = landTransform.indexOf('if (maritimeFcl) {')
  const end = landTransform.indexOf('} else {', start)
  const block = landTransform.slice(start, end)
  assert.match(block, /fullCatalog\s*\.filter\(maritimeFclCostMatchesCurrentContext\)/)
  assert.match(block, /contextualCosts\s*\.filter\(\(cost\) => cost\.isActive !== false\)/)
  assert.doesNotMatch(block, /contextualCosts\s*\.filter\(maritimeFclCostMatchesCurrentContext\)/)
  assert.match(landTransform, /cost\.incoterms\?\.length/)
  assert.match(landTransform, /maritimeFclRelationMatches\(cost\.pods/)
  assert.match(landTransform, /maritimeFclRelationMatches\(cost\.carriers/)
})

test('new and legacy wizards allow manual charges in any stage without Incoterm hiding', () => {
  for (const source of [crystal, stable]) {
    assert.match(source, /:options="sectionOrder\.map\(\(value\) => \(\{ value, label: sectionLabel\(value\) \}\)\)"/)
    assert.doesNotMatch(source, /if \(!incotermResponsibilitySections\.value\.includes\(sectionForCost\(cost\)\)\) return false/)
  }
  assert.match(stable, /for \(const cost of costs\.value\)/)
})

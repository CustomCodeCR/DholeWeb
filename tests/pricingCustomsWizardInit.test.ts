import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('customs-only wizard registers commercial watch after computed service is initialized', () => {
  const plugin = readFileSync(new URL('../build/pricingCustomsOnlyWizard.ts', import.meta.url), 'utf8')
  const computed = plugin.indexOf("'const hasInternationalTransportService = computed")
  const watcher = plugin.indexOf("'watch([hasInternationalTransportService, draftCommercialTerms]")
  assert.ok(computed >= 0, 'service computed must be declared')
  assert.ok(watcher > computed, 'watch must be registered after service computed')
  assert.ok(!plugin.includes("const commercialDraftAnchor = 'const draftCommercialTermsInitialized = ref(false)'"),
    'do not insert watch into the earlier draft ref initialization')
})

test('freight selection follows the quoted party, not an unconditional CFR-through-DDP exclusion', () => {
  const plugin = readFileSync(new URL('../build/pricingCustomsOnlyWizard.ts', import.meta.url), 'utf8')
  for (const incoterm of ['CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']) {
    assert.ok(plugin.includes(incoterm), incoterm + ' must be recognized by the commercial responsibility rule')
  }
  assert.ok(plugin.includes("!incotermClientPaysMainTransport(perspective, match[2].toUpperCase())"),
    'commercial freight follows exporter/importer perspective rather than excluding DDP exports')
  assert.ok(plugin.includes('!freightNotRequiredByIncoterm.value && ('),
    'service selection still considers the correctly computed Incoterm responsibility')
  assert.ok(plugin.includes("  const destination = selectedPod.value ?? selectedDestination.value"),
    'the destination country determines the direction of an international operation')
  assert.ok(plugin.includes("form.selectedImportRateId = ''"),
    'a no-freight operation must not retain a selected imported tariff')
  assert.ok(plugin.includes("'    form.freightCost = 0'"),
    'freight cost must reset only when the operation has no contracted freight')
  assert.ok(plugin.includes("'    form.freightSale = 0'"),
    'freight sale must reset only when the operation has no contracted freight')
  assert.ok(plugin.includes("'  if (!hasInternationalTransportService.value && step.value === 5) step.value = 6'"),
    'Tarifas (step 5) must be skipped')
  assert.ok(plugin.includes("(hasInternationalTransportService.value || line.costDetailType !== 'Freight')"),
    'submitted detail lines must omit freight only when there is no contracted freight')
  assert.ok(plugin.includes("&& shouldIncludePricedLine(line, lineMatchesPickupCargoCondition(line))"),
    'screen 8 must include selectable insurance and obey pickup rules on other charges')
  assert.ok(plugin.includes("rateLines.value = rateLines.value.filter((line) => line.costDetailType !== 'Freight')"),
    'the step 7 watcher must retain destination charges')
  assert.ok(plugin.includes("if (lines[i]?.costDetailType === 'Freight') lines.splice(i, 1)"),
    'the rebuild must preserve ancillary destination charges')
  assert.ok(!plugin.includes("!isInternationalTransportTerm(line.name)"),
    'Manejos, Release, HBL, Carrusel, Marchamo and Inland must not be removed by name')
  assert.ok(!plugin.includes("line.section !== 'international_freight'"),
    'agent and document charges must not be removed solely by their section')
})

test('land delivery transit stays visible, is not reset and persists without freight', () => {
  const plugin = readFileSync(new URL('../build/pricingCustomsOnlyWizard.ts', import.meta.url), 'utf8')
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')

  assert.ok(wizard.includes('v-model.number="form.transitDays"'), 'reuse the persisted transit model')
  assert.ok(wizard.includes('label="Días de tránsito"'), 'transit field uses the original label for all modalities')
  assert.ok(!plugin.includes('Días de tránsito para la entrega'), 'land-specific label must not be applied')
  assert.ok(!plugin.includes('Días de tránsito normal'), 'do not add a normal qualifier')
  assert.ok(plugin.includes("(hasInternationalTransportService || form.modality === 'Land')"),
    'do not hide delivery transit when international freight is not selected')
  assert.equal(plugin.split("if (form.modality !== 'Land') form.transitDays = 0").length - 1, 2,
    'both no-freight transitions must preserve land transit')
  assert.ok(plugin.includes("transitTime: (hasInternationalTransportService.value || form.modality === 'Land')"),
    'keep the transit time in the saved land rate')
  assert.ok(plugin.includes("hasInternationalTransportService || form.modality === \\'Land\\'"),
    'show persisted transit in the rate summary')
})

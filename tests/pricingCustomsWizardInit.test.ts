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

test('international freight selection depends on the contracted service across Incoterms', () => {
  const plugin = readFileSync(new URL('../build/pricingCustomsOnlyWizard.ts', import.meta.url), 'utf8')
  assert.ok(plugin.includes('Incoterms define who is responsible for freight'),
    'the selected quoted service, not the Incoterm, controls whether freight is billable')
  assert.ok(!plugin.includes('freightNotRequiredByIncoterm'),
    'a seller-paid Incoterm must never silently clear an explicitly quoted freight line')
  assert.ok(plugin.includes("'const hasInternationalTransportService = computed(() => ('"),
    'the service selection determines whether freight appears in the wizard')
  assert.ok(plugin.includes("selectedServices.value.some((item) => {"),
    'resolve the International Transport service by catalog selection')
  assert.ok(plugin.includes("form.selectedImportRateId = ''"),
    'a quote without transport service must not retain an imported ocean freight tariff')
  assert.ok(plugin.includes("'    form.freightCost = 0'"),
    'freight cost resets only when International Transport is not selected')
  assert.ok(plugin.includes("'    form.freightSale = 0'"),
    'freight sale resets only when International Transport is not selected')
  assert.ok(plugin.includes("'  if (!hasInternationalTransportService.value && step.value === 5) step.value = 6'"),
    'Tarifas (step 5) is skipped only for customs-only quotes')
  assert.ok(plugin.includes("(hasInternationalTransportService.value || line.costDetailType !== 'Freight')"),
    'preserve freight when the quoted service is selected')
  assert.ok(plugin.includes(": shouldIncludePricedLine(line, lineMatchesPickupCargoCondition(line))"),
    'newly selected charges still follow their selection and pickup conditions')
  assert.ok(plugin.includes("props.rateId && line.detailId"),
    'historical RateDetail lines cannot disappear due to changing customs-only catalog context')
  assert.ok(plugin.includes("rateLines.value = rateLines.value.filter((line) => line.costDetailType !== 'Freight')"),
    'only quotes without transport service drop freight when leaving step 7')
  assert.ok(plugin.includes("if (lines[i]?.costDetailType === 'Freight') lines.splice(i, 1)"),
    'catalog rebuild only removes freight for service-free quotes')
  assert.ok(!plugin.includes("!isInternationalTransportTerm(line.name)"),
    'other selected charges must not be removed by keyword')
  assert.ok(!plugin.includes("line.section !== 'international_freight'"),
    'agent and documentation charges remain selectable')
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

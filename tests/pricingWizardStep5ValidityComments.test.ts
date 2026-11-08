import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { patchPricingWizardStep5ValidityComments } from '../build/pricingWizardStep5ValidityComments.ts'

// Fixture is deliberately the materialized markup from the earlier FCL,
// expiry-chip and carrier-filter transforms, not the untransformed Vue source.
const fixture = [
  "const rateCarrierFilter = ref('')",
  "<template v-else-if=\"shipmentModeForApi === 'Fcl' && fclRateBundles.length\">",
  '            <div class="crystal-soft space-y-4 p-4 md:p-5">',
  '              <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">',
  '                <div>Navieras</div>',
  '              </div>',
  '              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Reglas FCL</p>',
  '            </div>',
  '            <div v-if="!visibleFclRateBundles.length" class="crystal-empty p-7 text-center">',
  '              <p>No hay combinaciones completas para las navieras seleccionadas</p>',
  '            </div>',
  '              <button',
  '                v-for="bundle in visibleFclRateBundles"',
  '                :key="bundle.key"',
  '                type="button"',
  '                class="crystal-rate-card text-left"',
  '                @click="chooseFclRateBundle(bundle)"',
  '              >',
  '                    <DhBadge v-if="multiCarrierSelectionMode && isSelectedFclBundle(bundle.carrierId, bundle.carrier, bundle.key)" variant="success"><Check class="mr-1 inline h-3.5 w-3.5" /> Naviera seleccionada</DhBadge>',
  '                        <strong class="block font-black">Comentarios de la tarifa</strong>',
  "                          <span class=\"mt-0.5 block whitespace-pre-line font-semibold\">{{ line.rate.spaceComment || 'Sin observaciones registradas' }}</span>",
  '                <div class="mt-4 flex flex-col gap-3 border-t border-[var(--dh-border)] pt-4 sm:flex-row sm:items-end sm:justify-between">',
  '              </button>',
  '<template v-else-if="availableRates.length">',
  '            <div class="crystal-soft flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">Naviera</div>',
  '            <div v-if="!sortedAvailableRates.length" class="crystal-empty p-7 text-center">',
  '              <p>No hay tarifas para la naviera seleccionada</p>',
  '            </div>',
  '              <button',
  '                v-for="rate in sortedAvailableRates"',
  '                :key="rate.id"',
  '                type="button"',
  '                class="crystal-rate-card"',
  '                @click="chooseRate(rate)"',
  '              >',
  '                <strong class="block font-black text-[var(--dh-text)]">Comentarios de la tarifa</strong>',
  "                  <span class=\"mt-1 block whitespace-pre-line font-semibold\">{{ rate.spaceComment || 'Sin comentarios registrados' }}</span>",
  '              </button>',
].join('\n')

test('adds date controls for FCL bundles and normal rates without changing shipment date', () => {
  const result = patchPricingWizardStep5ValidityComments(fixture)
  assert.equal((result.match(/v-model="step5ValidityFrom"/g) ?? []).length, 2)
  assert.equal((result.match(/v-model="step5ValidityTo"/g) ?? []).length, 2)
  assert.match(result, /const step5VisibleFclRateBundles = computed/)
  assert.match(result, /uniqueVisibleFclBundles\(/)
  assert.match(result, /const step5UniqueFclBundleCount = computed/)
  assert.match(result, /ofertas comerciales distintas/)
  assert.match(result, /registros originales consultados/)
  assert.match(result, /const step5VisibleAvailableRates = computed/)
  assert.match(result, /step5RateMatchesDates\(bundle\.validFrom, bundle\.validTo\)/)
  assert.match(result, /step5RateMatchesDates\(rate\.validFrom, rate\.validTo\)/)
  assert.doesNotMatch(result, /form\.loadDate\s*=/)
})

test('comment actions are independently focusable and never select the rate', () => {
  const result = patchPricingWizardStep5ValidityComments(fixture)
  assert.match(result, /v-for="bundle in step5VisibleFclRateBundles"/)
  assert.match(result, /v-for="rate in step5VisibleAvailableRates"/)
  assert.match(result, /@keydown\.enter\.self="chooseFclRateBundle\(bundle\)"/)
  assert.match(result, /@keydown\.space\.self\.prevent="chooseRate\(rate\)"/)
  assert.equal((result.match(/@click\.stop="step5ToggleComment/g) ?? []).length, 3)
  assert.equal((result.match(/:aria-expanded=/g) ?? []).length, 3)
  assert.match(result, /bundle\.groupedAlternatives\.length/)
  assert.match(result, /chooseFclRateBundle\(alternative\)/)
  assert.equal((result.match(/<button/g) ?? []).length, 4)
  assert.equal((result.match(/<\/button>/g) ?? []).length, 4)
})

test('a selected alternative keeps the parent FCL tariff card highlighted', () => {
  const withSelection = fixture.replace(
    '                @click="chooseFclRateBundle(bundle)"',
    '                :aria-pressed="multiCarrierSelectionMode ? isSelectedFclBundle(bundle.carrierId, bundle.carrier, bundle.key) : selectedFclBundleKey === bundle.key"\n' +
    '                @click="chooseFclRateBundle(bundle)"',
  )
  const result = patchPricingWizardStep5ValidityComments(withSelection)
  assert.match(result, /function step5IsBundleSelected/)
  assert.match(result, /:aria-pressed="step5IsBundleSelected\(bundle\)"/)
  assert.match(result, /isSelectedFclBundle\(option\.carrierId, option\.carrier, option\.key\)/)
  assert.match(result, /selectedFclBundleKey\.value === option\.key/)
  assert.doesNotMatch(result, /fclBundleHasSelectedSources/)
  assert.match(result, /Tarifa elegida/)
  assert.match(result, /Naviera agregada/)
})

test('fails loudly instead of silently dropping a future markup change', () => {
  assert.throws(
    () => patchPricingWizardStep5ValidityComments(fixture.replace('No hay tarifas para la naviera seleccionada', 'No se encontraron tarifas')),
    /single-rate empty label/,
  )
})

test('Screen 5 uses last known working v1.12.7 card layout without experimental carrier grouping', () => {
  const step5 = readFileSync(new URL('../build/pricingWizardStep5ValidityComments.ts', import.meta.url), 'utf8')
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const bundle = readFileSync(new URL('../build/pricingWizardFclRateBundles.ts', import.meta.url), 'utf8')
  assert.ok(step5.includes('uniqueVisibleFclBundles('))
  assert.ok(!step5.includes('groupFclCarrierCards('))
  assert.ok(!wizard.includes('groupFclCarrierCards'))
  assert.ok(!bundle.includes("':source:' + rate.id"))
  assert.ok(wizard.includes('async function loadImportSources(_rates: ImportRateSelectDto[])'))
  assert.ok(!wizard.includes('await Promise.all(batchIds.map'))
  assert.ok(wizard.includes('component: PricingEmailSourceModal'))
  assert.ok(wizard.includes('return selectedBundleByOption.value[route] === bundleKey'))
})

test('stable visual selection is tied to real FCL import source IDs on each POE', () => {
  const bundles = readFileSync(new URL('../build/pricingWizardFclRateBundles.ts', import.meta.url), 'utf8')
  const stability = readFileSync(new URL('../build/pricingWizardScreen5Stability.ts', import.meta.url), 'utf8')
  const expiry = readFileSync(new URL('../build/pricingWizardFclExpiryChip.ts', import.meta.url), 'utf8')
  // Prevent the production blank page regressions seen in v1.12.11:
  // Vue rendered a helper unavailable to setup, and read FCL coverage while
  // its referenced bundle const was still in the temporal dead zone.
  assert.ok(!bundles.includes('function fclBundleHasSelectedSources'))
  assert.ok(!bundles.includes('fclBundleHasSelectedSources('))
  assert.ok(!bundles.includes('const fclRateCoverage = computed'))
  assert.ok(expiry.includes('v-for="requirement in fclRateRequirements"'))
  assert.ok(expiry.includes('requirement.rates.length'))
  assert.ok(stability.includes("key: 'single:' + String(rate.id),"))
  assert.ok(!stability.includes("key: 'single:' + String(rate.id) + ':' + index"))
  assert.ok(expiry.includes('fclRatesByContainer[requirement.containerTypeId]'))
  assert.ok(expiry.includes('oferta'))
})

test('Pricing wizard runtime setup does not depend on late-injected selection functions or forward FCL declarations', () => {
  const step5 = readFileSync(new URL('../build/pricingWizardStep5ValidityComments.ts', import.meta.url), 'utf8')
  const bundles = readFileSync(new URL('../build/pricingWizardFclRateBundles.ts', import.meta.url), 'utf8')
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')

  assert.match(wizard, /function isSelectedFclBundle\(carrierId: string, carrierName: string, bundleKey: string\)/)
  assert.match(step5, /isSelectedFclBundle\(option\.carrierId, option\.carrier, option\.key\)/)
  assert.match(step5, /selectedFclBundleKey\.value === option\.key/)
  assert.doesNotMatch(step5, /fclBundleHasSelectedSources/)
  assert.doesNotMatch(bundles, /fclBundleHasSelectedSources/)
  const bundleDeclaration = bundles.indexOf('const fclRateBundles = computed<FclRateBundle[]>')
  const coverageDeclaration = bundles.indexOf('const fclRateCoverage = computed')
  assert.ok(bundleDeclaration > 0)
  assert.equal(coverageDeclaration, -1, 'Remove coverage computed that can trigger a TDZ failure')
})

test('Pricing handles wizard setup failures without a blank page or unguarded template reduction', () => {
  const boundary = readFileSync(new URL('../src/modules/pricing/components/PricingWizardBoundary.vue', import.meta.url), 'utf8')
  const view = readFileSync(new URL('../src/modules/pricing/views/PricingOverviewView.vue', import.meta.url), 'utf8')
  const step5 = readFileSync(new URL('../build/pricingWizardStep5ValidityComments.ts', import.meta.url), 'utf8')
  assert.match(boundary, /onErrorCaptured\(/)
  assert.match(boundary, /Reintentar carga/)
  assert.match(view, /<PricingWizardBoundary v-else>/)
  assert.match(step5, /const step5RawImportRowCount = computed/)
  assert.doesNotMatch(step5, /fclRateCoverage\.reduce/)
})

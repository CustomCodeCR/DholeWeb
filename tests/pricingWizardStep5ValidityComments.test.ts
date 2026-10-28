import assert from 'node:assert/strict'
import test from 'node:test'
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
  '                        <strong class="block font-black">Comentarios de la tarifa</strong>',
  "                          <span class=\"mt-0.5 block whitespace-pre-line font-semibold\">{{ line.rate.spaceComment || 'Sin observaciones registradas' }}</span>",
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
  assert.equal((result.match(/@click\.stop="step5ToggleComment/g) ?? []).length, 2)
  assert.equal((result.match(/:aria-expanded=/g) ?? []).length, 2)
  assert.equal((result.match(/<button/g) ?? []).length, 2)
  assert.equal((result.match(/<\/button>/g) ?? []).length, 2)
})

test('fails loudly instead of silently dropping a future markup change', () => {
  assert.throws(
    () => patchPricingWizardStep5ValidityComments(fixture.replace('No hay tarifas para la naviera seleccionada', 'No se encontraron tarifas')),
    /single-rate empty label/,
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { patchPricingWizardLandModeTerminology } from '../build/pricingWizardLandModeTerminology.ts'

const sellerCard = [
  '          <div v-if="rateRequestId" class="crystal-soft space-y-4 border border-[rgb(var(--dh-primary-rgb)/0.28)] p-4 md:p-5">',
  '            <p>Datos definidos por Ventas</p>',
  '            <p>Pricing recibe POE y POD exactamente como los definió Ventas, además del contenedor, Incoterm, fecha de carga lista y la indicación de Anticipado/Redestino antes de seleccionar la tarifa.</p>',
  '            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">',
  '              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">',
  '                <span>Contenedor</span>',
  "                <strong>{{ shipmentModeForApi === 'Lcl' ? 'LCL' : displayValue(selectedEquipment) || form.equipmentType || 'Por definir' }}</strong>",
  '              </div>',
  '              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">',
  '                <span>POE</span>',
  "                <strong>{{ requestedPoeName || displayValue(selectedDestination) || 'No indicado' }}</strong>",
  '              </div>',
  '              <div class="rounded-xl border border-[rgb(var(--dh-primary-rgb)/0.32)] bg-[rgb(var(--dh-primary-rgb)/0.06)] p-3">',
  '                <span>POD</span>',
  '              </div>',
  '              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">',
  '                <span>Muellaje</span>',
  '              </div>',
  '            </div>',
  '          </div>',
].join('\n')

const wizard = [
  '<script setup lang="ts">',
  "import { computed, onMounted, reactive, ref, watch } from 'vue'",
  'const supportDocuments = ref<SupportDocument[]>([])',
  'async function hydrateRateRequest() {',
  '    const request = unwrapApiResponse<SellerRateRequestDto>(response as never)',
  '}',
  'async function saveRate() {',
  '}',
  '</script>',
  '<div v-else-if="step === 3">',
  '  <PricingLocationSearchSelect',
  '                label="Origen (POL)"',
  '                placeholder="Buscar puerto de origen"',
  '  />',
  '  <PricingLocationSearchSelect',
  '                label="Destino (POE)"',
  '                placeholder="Buscar puerto de salida"',
  '  />',
  '  <PricingLocationSearchSelect',
  '                v-model="form.podId"',
  '                label="POD"',
  '  />',
  '</div>',
  '<div v-else-if="step === 5" class="space-y-6">',
  '  <h2>Seleccione tarifa</h2>',
  sellerCard,
  '  <p>Tarifas LTL y FCL</p>',
  '</div>',
  '<div v-else-if="step === 6" class="space-y-6">',
  '          <div>',
  '            <p>Pantalla 6</p>',
  '          </div>',
  '          <div>Proveedor y flete</div>',
  '</div>',
  '<div v-else-if="step === 4" class="space-y-6"></div>',
  '<div v-else-if="step === 7" class="space-y-6"></div>',
  '    <section class="crystal-panel min-h-[470px]"></section>',
  "<p>{{ form.modality === 'Air' ? 'Aéreo' : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.' }}</p>",
].join('\n')

test('completar solicitud and crear tarifa use the same step 5 source selector', () => {
  const output = patchPricingWizardLandModeTerminology(wizard)
  const five = output.split('<div v-else-if="step === 5"')[1].split('<div v-else-if="step === 6"')[0]
  assert.match(five, /Seleccione tarifa/)
  assert.match(five, /Tarifas LTL y FCL/)
  assert.doesNotMatch(five, /rateRequestId|Datos definidos por Ventas|Contenedor|Muellaje/)
})

test('shared commercial validity inputs appear on screen 6 for both paths', () => {
  const output = patchPricingWizardLandModeTerminology(wizard)
  const six = output.split('<div v-else-if="step === 6"')[1].split('<div v-else-if="step === 4"')[0]
  assert.match(six, /data-shared-pricing-validity/)
  assert.match(six, /v-model="form.loadDate"/)
  assert.match(six, /v-model="form.validTo"/)
  assert.doesNotMatch(six, /rateRequestId|sellerRequestMode/)
})

test('terrestrial route does not inherit maritime port names', () => {
  const output = patchPricingWizardLandModeTerminology(wizard)
  assert.match(output, /Origen terrestre/)
  assert.match(output, /Destino terrestre/)
  assert.match(output, /Buscar origen terrestre/)
  assert.match(output, /v-if="form.modality !== 'Land'"/)
  assert.match(output, /Origen \(POL\)/)
  assert.match(output, /Destino \(POE\)/)
  assert.match(output, /La búsqueda terrestre utiliza origen, destino, equipo/)
})

test('fails on unexpected wizard structure rather than silently diverging', () => {
  assert.throws(() => patchPricingWizardLandModeTerminology('<div></div>'), /Expected one seller handoff/)
})

test('resume shows original Sales snapshot and downloadable documents instead of editable steps', () => {
  const output = patchPricingWizardLandModeTerminology(wizard)
  assert.match(output, /Información enviada por Ventas/)
  assert.match(output, /sellerHandoffSnapshot/)
  assert.match(output, /cargoObservations/)
  assert.match(output, /pickupLocations/)
  assert.match(output, /downloadSellerHandoffFile/)
  assert.match(output, /StorageService.downloadFile/)
})

test('GAM pickup is required in LTL lines before a rate can be saved', () => {
  const output = patchPricingWizardLandModeTerminology(wizard)
  assert.match(output, /landLtlPickupRequired/)
  assert.match(output, /Recolecta obligatoria/)
  assert.match(output, /Number\(line.saleAmount\) > 0/)
  assert.match(output, /step.value = 7/)
})

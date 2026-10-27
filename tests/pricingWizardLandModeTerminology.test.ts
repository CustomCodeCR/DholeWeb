import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
  "import { useRouter } from 'vue-router'",
  'const supportDocuments = ref<SupportDocument[]>([])',
  'async function hydrateRateRequest() {',
  '    const request = unwrapApiResponse<SellerRateRequestDto>(response as never)',
  '    if (request.payload?.form) {',
  '      Object.assign(form, request.payload.form)',
  '      restoreRequestedFclContainers((request.payload.form as Record<string, unknown>).fclContainers)',
  '    }',
  '    rateRequestPriority.value = request.priority',
  '    step.value = hasInternationalTransportService.value ? 5 : 6',
  '    if (hasInternationalTransportService.value) await searchApprovedRates()',
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
  assert.match(output, /PricingSellerHandoffPreview/)
  assert.match(output, /:service-labels/)
  assert.match(output, /@download="downloadSellerHandoffFile"/)
  assert.match(output, /sellerHandoffSnapshot/)
  const childComponent = readFileSync(
    new URL('../src/modules/pricing/components/PricingSellerHandoffPreview.vue', import.meta.url),
    'utf8',
  )
  assert.match(childComponent, /cargoObservations/)
  // Consolidated LCL/LTL cargo must not inherit a full container or trailer size.
  assert.match(childComponent, /const isConsolidated = computed\(\(\) => \['LCL', 'LTL'\]\.includes\(shipmentMode\.value\)\)/)
  assert.match(childComponent, /v-if="!isConsolidated"><dt[^>]*>\{\{ isLand \? 'Tamaño de furgón' : 'Tamaño de contenedor' \}\}/)
  assert.match(childComponent, /v-if="!isConsolidated"><dt[^>]*>Cantidad<\/dt>/)
  assert.match(childComponent, /isConsolidated\.value \? 'Carga consolidada'/)
  assert.match(childComponent, /pickupCards/)
  assert.match(childComponent, /emit\('download', document\)/)
  assert.doesNotMatch(childComponent, /JSON\.stringify\(/)
  assert.match(output, /pickupLocations/)
  assert.match(output, /downloadSellerHandoffFile/)
  assert.match(output, /StorageService.downloadFile/)
})

test('consolidated lines restore after seller and FCL hydration for customs-only and international quotes', () => {
  for (const continuation of [
    'step.value = hasInternationalTransportService.value ? 5 : 6',
    'step.value = 5',
  ]) {
    const source = wizard.replace(
      'step.value = hasInternationalTransportService.value ? 5 : 6',
      continuation,
    )
    const output = patchPricingWizardLandModeTerminology(source)
    const formAssign = output.indexOf('Object.assign(form, request.payload.form)')
    const fclRestore = output.indexOf('restoreRequestedFclContainers(', formAssign)
    const priority = output.indexOf('rateRequestPriority.value = request.priority', formAssign)
    const cargoRestore = output.indexOf('restoreSellerConsolidatedCargo(', priority)
    const continuationPos = output.indexOf(continuation, priority)
    assert.ok(formAssign >= 0 && fclRestore > formAssign)
    assert.ok(priority > fclRestore && cargoRestore > priority)
    assert.ok(continuationPos > cargoRestore)
    assert.match(output, /function restoreSellerConsolidatedCargo\(/)
    assert.match(output, /context\?\.consolidatedCargoLines/)
    assert.match(output, /sourceForm\.cargoLengthCm/)
    assert.match(output, /sourceForm\.cargoPallets/)
    assert.match(output, /cargoDimensionUnit\.value === 'in'/)
  }
})

test('LCL quantity basis multiplies physical CBM and chargeable CBM separately', () => {
  const enhanced = readFileSync(
    new URL('../build/pricingWizardEnhancements.ts', import.meta.url),
    'utf8',
  )
  assert.match(enhanced, /basis === 'PerCbm'[\s\S]*?lclPhysicalCbm\.value/)
  assert.match(enhanced, /basis === 'PerChargeableCbm'[\s\S]*?lclChargeableCbm\.value/)
  assert.doesNotMatch(enhanced, /return Math\.max\(1, number\(lclChargeableCbm\.value\)\)/)
  const consolidated = readFileSync(
    new URL('../build/pricingConsolidatedCargo20261001.ts', import.meta.url),
    'utf8',
  )
  assert.match(consolidated, /consolidatedCargoLines\.value\.reduce\(\(sum, line\) => sum \+ cargoLinePhysicalCbm\(line\)/)
  assert.match(consolidated, /cargoLineQuantity\(line\)/)
})

test('GAM pickup is required in LTL lines before a rate can be saved', () => {
  const output = patchPricingWizardLandModeTerminology(wizard)
  assert.match(output, /landLtlPickupRequired/)
  assert.match(output, /Recolecta obligatoria/)
  assert.match(output, /Number\(line.saleAmount\) > 0/)
  assert.match(output, /step.value = 7/)
})

test('pricing dashboard shows LCL/LTL as consolidated without container or trailer quantities', () => {
  const source = readFileSync(
    new URL('../src/modules/pricing/components/PricingRateRequestsPanel.vue', import.meta.url),
    'utf8',
  )
  assert.match(source, /function isConsolidated\(request: RateRequestDto\): boolean \{[\s\S]*?\['LCL', 'LTL'\]\.includes\(shipmentMode\(request\)\)/)
  assert.match(source, /function equipmentLabel\(request: RateRequestDto\) \{\s*if \(isConsolidated\(request\)\) \{/)
  assert.match(source, /LTL · Consolidado terrestre/)
  assert.match(source, /LCL · Consolidado/)
  assert.match(source, /function equipmentQuantity\(request: RateRequestDto\) \{\s*if \(isConsolidated\(request\)\) return '—'/)
  assert.match(source, />Embarque \/ equipo<\/th>/)
  assert.match(source, />Cant\. equipos<\/th>/)
})

test('original Sales information stays visible during screen 5 even before its snapshot loads', () => {
  const output = patchPricingWizardLandModeTerminology(wizard)
  assert.match(output, /v-if="props\.rateRequestId && step >= 5"/)
  assert.match(output, /:snapshot="sellerHandoffSnapshot \|\| sellerHandoffFallback"/)
  assert.match(output, /watch\(\(\) => props\.rateRequestId,/)
  assert.match(output, /async function reloadSellerHandoffSnapshot\(\)/)
  assert.match(output, /captureSellerHandoffSnapshot\(request\)/)
  assert.match(output, /request\.payload\?\.supportDocuments/)
  assert.match(output, /request\.payload\?\.pickupLocations/)
  assert.match(output, /@click="reloadSellerHandoffSnapshot"/)
  assert.equal(output.match(/<PricingSellerHandoffPreview/g)?.length, 1)
})

test('Pricing screen 6 filters agents by origin and only offers maritime carriers', () => {
  const providers = readFileSync(new URL('../build/pricingWizardLclGroupAgent.ts', import.meta.url), 'utf8')
  const land = readFileSync(new URL('../build/pricingLandProviderCurrencyValue.ts', import.meta.url), 'utf8')
  const wizardSource = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')

  assert.ok(wizardSource.includes('function agentMatchesSelectedPol('))
  assert.ok(wizardSource.includes('const eligibleAgents = computed(() => catalogs.agents.filter(agentMatchesSelectedPol))'))
  assert.ok(providers.includes("shipmentModeForApi === \\'Lcl\\' ? lclAgentOptions : agentOptions"))
  assert.ok(providers.includes("eligibleAgents.value.some((agent) => agent.id === form.agentId)"))
  assert.ok(!providers.includes('const landAgentOptions = computed('))
  assert.ok(!providers.includes('Transportista / proveedor terrestre'))
  assert.ok(!providers.includes('Aerolínea / proveedor'))
  assert.ok(providers.includes('Naviera / proveedor'))
  assert.ok(providers.includes("form.modality === \\'Maritime\\' || form.modality === \\'Multimodal\\'"))
  assert.ok(providers.includes("form.modality !== 'Air'"))
  assert.ok(providers.includes("carrierId: (' + maritimeCarrier + ') ? (carrier?.id ?? null) : null"))
  assert.ok(providers.includes("country-matching save guard"))
  assert.ok(providers.includes('form.modality, form.carrierId, hydratingExistingRate.value'))
  assert.ok(land.includes('findById(catalogs.agents, form.agentId)'))
})


test('bultos declarados no se multiplican por tarimas en LCL y LTL', () => {
  const cargo = readFileSync(new URL('../build/pricingConsolidatedCargo20261001.ts', import.meta.url), 'utf8')
  const units = readFileSync(new URL('../build/pricingConsolidatedUnitConversions20261015.ts', import.meta.url), 'utf8')
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const summary = readFileSync(new URL('../src/modules/pricing/components/PricingSellerHandoffPreview.vue', import.meta.url), 'utf8')
  assert.match(cargo, /unitType: 'Pallet'/)
  assert.match(cargo, /const consolidatedTotalPallets = computed/)
  assert.match(cargo, /form\.cargoPallets = consolidatedTotalPallets\.value/)
  assert.match(cargo, /line\.unitType === 'Pallet' \? 0 : cargoLineQuantity\(line\)/)
  assert.match(cargo, /line\.unitType === 'Pallet' \? cargoLineQuantity\(line\) : 0/)
  assert.match(cargo, /Math\.trunc\(number\(form\.cargoPackages\)\)/)
  assert.match(cargo, /sum \+ Math\.max\(0, number\(line\.weightKg\)\)/)
  assert.match(cargo, /lengthCm \* widthCm \* heightCm \* quantity \/ 1_000_000/)
  assert.match(cargo, /Tipo de embalaje/)
  assert.match(cargo, /Cantidad de tarimas/)
  assert.match(units, /Peso sumado de las líneas/)
  assert.match(wizard, /Piezas de mercancía \(opcional\)/)
  assert.match(summary, /sellerCargoLines/)
  assert.match(summary, /sellerVolumeMismatch/)
  assert.match(summary, /Unidades sin clasificar|Unidad sin clasificar/)

  // Tres carretillas declaradas dentro de una sola tarima no son tres tarimas.
  const cbm = (quantity: number) => quantity * 165 * 140 * 130 / 1_000_000
  assert.equal(cbm(1), 3.003)
  assert.equal(cbm(3), 9.009)
  const declaredPieces = 3
  const pallets = 1
  assert.equal(cbm(pallets), 3.003)
  assert.equal(declaredPieces, 3)
})


test('LCL y LTL distinguen bultos declarados de cantidades por unidad de carga', () => {
  const source = readFileSync(new URL('../build/pricingConsolidatedCargo20261001.ts', import.meta.url), 'utf8')
  assert.match(source, /Cantidad de tarimas/)
  assert.match(source, /Cantidad de bultos sueltos/)
  assert.match(source, /Cantidad de cajas/)
  assert.match(source, /Las piezas de mercancía indicadas arriba no multiplican el volumen/)
  assert.match(source, /lengthCm \* widthCm \* heightCm \* quantity \/ 1_000_000/)
  assert.match(source, /sum \+ Math\.max\(0, number\(line\.weightKg\)\)/)
})


test('captura consolidada usa dos filas, piezas informativas y unidades dinámicas', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const cargo = readFileSync(new URL('../build/pricingConsolidatedCargo20261001.ts', import.meta.url), 'utf8')
  const miami = readFileSync(new URL('../build/pricingMiamiLclRules20261002.ts', import.meta.url), 'utf8')
  const preview = readFileSync(new URL('../src/modules/pricing/components/PricingSellerHandoffPreview.vue', import.meta.url), 'utf8')
  assert.match(wizard, /Piezas de mercancía \(opcional\)/)
  assert.match(cargo, /xl:grid-cols-4/)
  assert.match(cargo, /Medidas exteriores por cada unidad de embalaje/)
  assert.match(cargo, /Piezas declaradas · informativo/)
  assert.match(cargo, /Unidades de embalaje · para volumen/)
  assert.match(miami, /return kg.toFixed\(2\) \+ ' kg → ' \+ lb.toFixed\(2\)/)
  assert.match(preview, /Piezas de mercancía declaradas/)
  assert.match(preview, /Dimensiones exteriores por embalaje/)
})

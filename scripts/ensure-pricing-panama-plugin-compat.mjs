import { readFile, writeFile } from 'node:fs/promises'

const wizardPath = new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url)

let source = await readFile(wizardPath, 'utf8')
let changed = false

const enhancedReset = `  availableRates.value = []
  continuationRates.value = []
  panamaLandFreightAmount.value = 0
  panamaDoubleMaritimeStage.value = 'A'
  rateLines.value = []
  supportEntityId.value`
const compatibleReset = `  availableRates.value = []
  rateLines.value = []
  supportEntityId.value`

// pricingWizardEnhancements runs inside Vite and still owns this reset anchor.
// The Panama state is already cleared by its route/mode watchers and every
// tariff search, so keep the original anchor intact for the Vite transform.
if (source.includes(enhancedReset)) {
  source = source.replace(enhancedReset, compatibleReset)
  changed = true
  console.log('[pricing-panama-compat] Reset anchor restored for Vite transforms')
} else {
  console.log('[pricing-panama-compat] Reset anchor already compatible')
}

const panamaStep5Header = `            <h2 class="crystal-title">{{ isPanamaMultimodal ? 'Primer tramo marítimo hasta Panamá' : 'Tarifas pre-aprobadas disponibles' }}</h2>
            <p class="crystal-description">
              {{ isPanamaMultimodal
                ? 'Primero seleccione el flete marítimo hasta un POE real en Panamá. Después Dhole resolverá el segundo tramo según la alternativa elegida.'
                : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.' }}
            </p>`
const compatibleStep5Header = `            <h2 class="crystal-title">Tarifas pre-aprobadas disponibles</h2>
            <p class="crystal-description">La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.</p>`

// The LCL Vite plugin owns the same Pantalla 5 header. Restore its exact anchor
// before Vite runs; the Panama flow remains explicit through the continuation
// selector in Pantalla 3 and the dedicated second-leg panel in Pantalla 5.
if (source.includes(panamaStep5Header)) {
  source = source.replace(panamaStep5Header, compatibleStep5Header)
  changed = true
  console.log('[pricing-panama-compat] Pantalla 5 header restored for LCL transform')
} else {
  console.log('[pricing-panama-compat] Pantalla 5 header already compatible')
}

if (changed) {
  await writeFile(wizardPath, source)
}

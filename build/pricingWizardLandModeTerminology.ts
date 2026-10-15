import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const HANDOFF_START = '          <div v-if="rateRequestId" class="crystal-soft space-y-4 border border-[rgb(var(--dh-primary-rgb)/0.28)] p-4 md:p-5">'
const HANDOFF_END = '\n          </div>'
const STEP_SIX = '<div v-else-if="step === 6" class="space-y-6">'
const STEP_FOUR = '<div v-else-if="step === 4" class="space-y-6">'

// Sales provides steps 1-4. Pricing uses the same step 5-8 UI as new quotes.
// Preserve Sales information in form state instead of a second rate selector UI.
function removeRequestSpecificScreenFiveCard(source: string): string {
  const start = source.indexOf(HANDOFF_START)
  if (start < 0 || source.indexOf(HANDOFF_START, start + HANDOFF_START.length) >= 0) {
    throw new Error('[pricingWizardLandModeTerminology] Expected one seller handoff block')
  }
  const end = source.indexOf(HANDOFF_END, start + HANDOFF_START.length)
  if (end < 0) throw new Error('[pricingWizardLandModeTerminology] Unclosed seller handoff')
  return source.slice(0, start) + source.slice(end + HANDOFF_END.length)
}

function patchStepThreeForLand(source: string): string {
  const start = source.indexOf('<div v-else-if="step === 3"')
  const end = source.indexOf('<div v-else-if="step === 4"', start)
  if (start < 0 || end < 0) throw new Error('[pricingWizardLandModeTerminology] Missing route step')
  let block = source.slice(start, end)
  const replacements: Array<[string, string]> = [
    ['label="Origen (POL)"', ":label=\"form.modality === 'Land' ? 'Origen terrestre' : 'Origen (POL)'\""],
    ['label="Destino (POE)"', ":label=\"form.modality === 'Land' ? 'Destino terrestre' : 'Destino (POE)'\""],
    ['placeholder="Buscar puerto de origen"', ":placeholder=\"form.modality === 'Land' ? 'Buscar origen terrestre' : 'Buscar puerto de origen'\""],
    ['placeholder="Buscar puerto de salida"', ":placeholder=\"form.modality === 'Land' ? 'Buscar destino terrestre' : 'Buscar puerto de salida'\""],
  ]
  for (const [before, after] of replacements) {
    if (block.includes(before)) block = block.replace(before, after)
  }
  const podSelect = '<PricingLocationSearchSelect\n                v-model="form.podId"'
  if (block.includes(podSelect)) {
    block = block.replace(
      podSelect,
      '<PricingLocationSearchSelect\n                v-if="form.modality !== \'Land\'"\n                v-model="form.podId"',
    )
  }
  return source.slice(0, start) + block + source.slice(end)
}

function patchStepFiveHelp(source: string): string {
  const help = ": 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.'"
  if (!source.includes(help)) return source
  return source.replace(
    help,
    ": form.modality === 'Land' ? 'La búsqueda terrestre utiliza origen, destino, equipo y fecha de carga lista.' : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.'",
  )
}

// Both paths must let Pricing manage validity at step 6. Sales already provided
// the route and cargo-ready date, so returning to step 3 is not necessary.
function addSharedCommercialValidity(source: string): string {
  const start = source.indexOf(STEP_SIX)
  const end = start >= 0 ? source.indexOf(STEP_FOUR, start + STEP_SIX.length) : -1
  if (start < 0 || end < 0) {
    throw new Error('[pricingWizardLandModeTerminology] Missing provider and freight step')
  }
  const stepSix = source.slice(start, end)
  if (stepSix.includes('data-shared-pricing-validity')) return source
  const introEnd = stepSix.indexOf('\n          </div>', STEP_SIX.length)
  if (introEnd < 0) throw new Error('[pricingWizardLandModeTerminology] Missing step 6 heading')
  const point = start + introEnd + '\n          </div>'.length
  const inputs = [
    '',
    '          <div data-shared-pricing-validity class="crystal-soft grid gap-4 p-4 md:grid-cols-2 md:p-5">',
    '            <DhInput v-model="form.loadDate" type="date" label="Vigente desde / carga lista" />',
    '            <DhInput v-model="form.validTo" type="date" label="Vigente hasta" :min="form.loadDate || undefined" />',
    '          </div>',
  ].join('\n')
  return source.slice(0, point) + '\n' + inputs + source.slice(point)
}

export function patchPricingWizardLandModeTerminology(source: string): string {
  const commonWizard = removeRequestSpecificScreenFiveCard(source)
  return addSharedCommercialValidity(patchStepFiveHelp(patchStepThreeForLand(commonWizard)))
}

export function pricingWizardLandModeTerminology(): Plugin {
  return {
    name: 'dhole-pricing-wizard-land-mode-terminology',
    // Must run after the Sales, LTL and customs-only wizard transforms.
    transform(source, id) {
      if (id.includes('?')) return null
      const normalized = id.replaceAll('\\', '/').split('?')[0]
      if (!normalized.endsWith(WIZARD_PATH)) return null
      return { code: patchPricingWizardLandModeTerminology(source), map: null }
    },
  }
}

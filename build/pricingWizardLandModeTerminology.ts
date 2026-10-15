import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const HANDOFF_START = '          <div v-if="rateRequestId" class="crystal-soft space-y-4 border border-[rgb(var(--dh-primary-rgb)/0.28)] p-4 md:p-5">'
const HANDOFF_END = '\n          </div>'

function replaceRequired(source: string, before: string, after: string, label: string): string {
  const occurrences = source.split(before).length - 1
  if (occurrences !== 1) {
    throw new Error('[pricingWizardLandModeTerminology] Expected one ' + label + ', found ' + occurrences)
  }
  return source.replace(before, after)
}

function addCardVisibility(block: string, label: string, condition: string): string {
  const labelAt = block.indexOf('>' + label + '</span>')
  if (labelAt < 0) throw new Error('[pricingWizardLandModeTerminology] Missing ' + label + ' card')
  const cardStart = block.lastIndexOf('              <div class="rounded-xl', labelAt)
  const openEnd = block.indexOf('>', cardStart)
  if (cardStart < 0 || openEnd < 0 || openEnd > labelAt) {
    throw new Error('[pricingWizardLandModeTerminology] Invalid ' + label + ' card')
  }
  const opening = block.slice(cardStart, openEnd + 1)
  return block.slice(0, cardStart)
    + opening.replace('<div ', '<div v-if="' + condition + '" ')
    + block.slice(openEnd + 1)
}

function patchHandoff(source: string): string {
  const start = source.indexOf(HANDOFF_START)
  if (start < 0) throw new Error('[pricingWizardLandModeTerminology] Missing seller handoff')
  const end = source.indexOf(HANDOFF_END, start + HANDOFF_START.length)
  if (end < 0) throw new Error('[pricingWizardLandModeTerminology] Unclosed seller handoff')

  let block = source.slice(start, end + HANDOFF_END.length)
  block = replaceRequired(
    block,
    'Pricing recibe POE y POD exactamente como los definió Ventas, además del contenedor, Incoterm, fecha de carga lista y la indicación de Anticipado/Redestino antes de seleccionar la tarifa.',
    "{{ form.modality === 'Land' ? 'Pricing recibe el origen y destino terrestre definidos por Ventas, la modalidad de carga, el Incoterm y la fecha de carga lista. La vigencia comercial se establece aquí.' : 'Pricing recibe POE y POD exactamente como los definió Ventas, además del contenedor, Incoterm, fecha de carga lista y la indicación de Anticipado/Redestino antes de seleccionar la tarifa.' }}",
    'handoff description',
  )
  block = replaceRequired(
    block,
    'class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"',
    'class="grid gap-3 sm:grid-cols-2" :class="form.modality === \'Land\' ? \'xl:grid-cols-4\' : \'xl:grid-cols-6\'"',
    'handoff grid',
  )
  block = replaceRequired(
    block,
    '>Contenedor</span>',
    ">{{ form.modality === 'Land' ? (shipmentModeForApi === 'Ltl' ? 'Modalidad terrestre' : 'Equipo terrestre') : 'Contenedor' }}</span>",
    'equipment label',
  )
  block = replaceRequired(
    block,
    "{{ shipmentModeForApi === 'Lcl' ? 'LCL' : displayValue(selectedEquipment) || form.equipmentType || 'Por definir' }}",
    "{{ shipmentModeForApi === 'Ltl' ? 'LTL · carga consolidada' : shipmentModeForApi === 'Lcl' ? 'LCL' : displayValue(selectedEquipment) || form.equipmentType || 'Por definir' }}",
    'equipment value',
  )
  block = replaceRequired(
    block,
    '>POE</span>',
    ">{{ form.modality === 'Land' ? 'Ruta terrestre' : 'POE' }}</span>",
    'POE label',
  )
  block = replaceRequired(
    block,
    "{{ requestedPoeName || displayValue(selectedDestination) || 'No indicado' }}",
    "{{ form.modality === 'Land' ? (displayValue(selectedOrigin) || 'Origen no indicado') + ' → ' + (requestedPoeName || displayValue(selectedDestination) || 'Destino no indicado') : (requestedPoeName || displayValue(selectedDestination) || 'No indicado') }}",
    'terrestrial route display',
  )
  block = addCardVisibility(block, 'POD', "form.modality !== 'Land'")
  block = addCardVisibility(block, 'Muellaje', "form.modality !== 'Land' && shipmentModeForApi === 'Fcl'")

  return source.slice(0, start) + block + source.slice(end + HANDOFF_END.length)
}

function patchStepThree(source: string): string {
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
  const maritimeHelp = ": 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.'"
  if (!source.includes(maritimeHelp)) return source
  return source.replace(
    maritimeHelp,
    ": form.modality === 'Land' ? 'La búsqueda terrestre utiliza origen, destino, equipo y fecha de carga lista.' : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.'",
  )
}

export function patchPricingWizardLandModeTerminology(source: string): string {
  return patchHandoff(patchStepFiveHelp(patchStepThree(source)))
}

// Must run after the plugins that inject the seller summary and the LTL source selector.
export function pricingWizardLandModeTerminology(): Plugin {
  return {
    name: 'dhole-pricing-wizard-land-mode-terminology',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalized = id.replaceAll('\\', '/').split('?')[0]
      if (!normalized.endsWith(WIZARD_PATH)) return null
      return { code: patchPricingWizardLandModeTerminology(source), map: null }
    },
  }
}

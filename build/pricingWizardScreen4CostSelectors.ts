import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceTextOnce(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error('[pricingWizardScreen4CostSelectors] Expected one ' + label + ', found ' + count + '.')
  }
  return source.replace(anchor, replacement)
}

function replaceRegexOnce(source: string, pattern: RegExp, replacement: string, label: string) {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
  const matches = source.match(new RegExp(pattern.source, flags))
  const count = matches?.length ?? 0
  if (count !== 1) {
    throw new Error('[pricingWizardScreen4CostSelectors] Expected one ' + label + ', found ' + count + '.')
  }
  pattern.lastIndex = 0
  return source.replace(pattern, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceRegexOnce(
    code,
    /(portHandlingMode:\s*'' as '' \| 'Anticipado' \| 'Redestino',)/,
    "$1\n  emptyReturn: false,\n  electronicSeal: false,",
    'screen 4 optional state',
  )

  const cargoCondition = [
    "function cargoConditionSelection(line: { name: string; notes?: string | null }) {",
    "  const value = normalizeCatalogValue(String(line.name ?? '') + ' ' + String(line.notes ?? ''))",
    "  if (value.includes('carga peligrosa') || value.includes('dangerous') || value.includes('hazmat')) return ltlCargoMode.value ? false : form.dangerousCargo",
    "  const threeAxles = value.includes('3 ejes') || value.includes('3 eje') || value.includes('tres ejes') || value.includes('3 axles') || value.includes('3 axle') || value.includes('three axles') || value.includes('tridem')",
    "  if (value.includes('sobrepeso') || value.includes('sobre peso') || value.includes('overweight') || value.includes('over weight') || (shipmentModeForApi.value === 'Fcl' && threeAxles)) return ltlCargoMode.value ? false : form.overweight",
    "  return null",
    "}",
  ].join('\n')

  code = replaceRegexOnce(
    code,
    /function cargoConditionSelection\([\s\S]*?\n\}(?=\n\nfunction portHandlingConditionSelection)/,
    cargoCondition,
    'cargo condition selector',
  )

  const screen4OptionalCondition = [
    "function screen4OptionalConditionSelection(line: { name: string; notes?: string | null }) {",
    "  if (form.modality !== 'Maritime' || shipmentModeForApi.value !== 'Fcl') return null",
    "  const value = normalizeCatalogValue(String(line.name ?? '') + ' ' + String(line.notes ?? ''))",
    "  const emptyReturn = value.includes('retiro vacio') || value.includes('retiro de vacio') || value.includes('empty return') || value.includes('empty container return') || value.includes('return empty')",
    "  if (emptyReturn) return form.emptyReturn",
    "  const electronicSeal = value.includes('marchamo electronico') || value.includes('electronic seal') || value.includes('electronic security seal') || value.includes('e seal')",
    "  if (electronicSeal) return form.electronicSeal",
    "  return null",
    "}",
  ].join('\n')

  code = replaceRegexOnce(
    code,
    /(function portHandlingConditionSelection\([\s\S]*?\n\})\n\nfunction automaticOptionalCostId/,
    "$1\n\n" + screen4OptionalCondition + "\n\nfunction automaticOptionalCostId",
    'screen 4 optional matcher insertion',
  )

  const shouldIncludeOptional = [
    "function shouldIncludeOptionalCost(line: { id?: string | null; costId?: string | null; name: string; notes?: string | null }) {",
    "  const automaticCostId = automaticOptionalCostId(line)",
    "  if (automaticCostId && dismissedAutomaticOptionalCostIds.value.has(automaticCostId)) return false",
    "",
    "  const screen4Selection = screen4OptionalConditionSelection(line)",
    "  if (screen4Selection === false) return false",
    "  if (screen4Selection === true) return true",
    "",
    "  const cargoSelected = cargoConditionSelection(line)",
    "  if (cargoSelected === false) return false",
    "  const portHandlingSelected = portHandlingConditionSelection(line)",
    "  if (portHandlingSelected === false) return false",
    "  const association = haulageAssociation(line)",
    "  if (association === 'merchant' && !form.merchantHaulage) return false",
    "  if (association === 'carrier' && !form.carrierHaulage) return false",
    "  if (cargoSelected === true || portHandlingSelected === true) return true",
    "  if (association === 'merchant') return form.merchantHaulage",
    "  if (association === 'carrier') return form.carrierHaulage",
    "",
    "  return true",
    "}",
  ].join('\n')

  code = replaceRegexOnce(
    code,
    /function shouldIncludeOptionalCost\([\s\S]*?\n\}(?=\n\nasync function loadApplicableCosts)/,
    shouldIncludeOptional,
    'automatic optional inclusion',
  )

  const syncOptionalLines = [
    "function syncHaulageOptionalLines() {",
    "  if (props.viewOnly && props.rateId) return",
    "",
    "  rateLines.value.forEach((line) => {",
    "    if (!line.optional) return",
    "    const cargoCondition = cargoConditionSelection(line)",
    "    const portHandlingCondition = portHandlingConditionSelection(line)",
    "    const screen4Selection = screen4OptionalConditionSelection(line)",
    "    const association = haulageAssociation(line)",
    "    if (cargoCondition === null && portHandlingCondition === null && screen4Selection === null && association === null) return",
    "    line.included = shouldIncludeOptionalCost(line)",
    "    if (!line.included) line.applyDestinationTax = false",
    "  })",
    "}",
  ].join('\n')

  code = replaceRegexOnce(
    code,
    /function syncHaulageOptionalLines\(\) \{[\s\S]*?\n\}(?=\n\nfunction toggleMerchantHaulage)/,
    syncOptionalLines,
    'screen 4 optional synchronization',
  )

  code = replaceTextOnce(
    code,
    "  () => [form.dangerousCargo, form.overweight, form.merchantHaulage, form.carrierHaulage, form.portHandlingMode] as const,",
    "  () => [form.dangerousCargo, form.overweight, form.merchantHaulage, form.carrierHaulage, form.portHandlingMode, form.emptyReturn, form.electronicSeal] as const,",
    'optional synchronization watcher',
  )

  const optionalSelectorStart = code.indexOf('const selectableOptionalLines = computed')
  const optionalSelectorEnd = code.indexOf('const optionalChargeOptions = computed', optionalSelectorStart)
  if (optionalSelectorStart < 0 || optionalSelectorEnd < 0) {
    throw new Error('[pricingWizardScreen4CostSelectors] Optional selector boundaries were not found.')
  }
  const screen7OptionalSelector = [
    "const selectableOptionalLines = computed(() =>",
    "  rateLines.value.filter((line) =>",
    "    line.optional",
    "    && cargoConditionSelection(line) === null",
    "    && portHandlingConditionSelection(line) === null",
    "    && screen4OptionalConditionSelection(line) === null",
    "    && haulageAssociation(line) === null,",
    "  ),",
    ")",
    "",
  ].join('\\n')
  code = code.slice(0, optionalSelectorStart) + screen7OptionalSelector + code.slice(optionalSelectorEnd)

  code = replaceTextOnce(
    code,
    "    form.portHandlingMode = ''\n    sellerPortHandlingMode.value = ''",
    "    form.portHandlingMode = ''\n    form.emptyReturn = false\n    form.electronicSeal = false\n    sellerPortHandlingMode.value = ''",
    'land maritime state cleanup',
  )

  code = replaceRegexOnce(
    code,
    /(function chooseShipmentMode\(value: string\) \{[\s\S]*?)(\n  step\.value = 3\n\})/,
    "$1\n  if (mode !== 'FCL') {\n    form.emptyReturn = false\n    form.electronicSeal = false\n  }$2",
    'shipment mode cleanup',
  )

  code = replaceTextOnce(
    code,
    "    carrierHaulage: false,\n    manualName: '',",
    "    carrierHaulage: false,\n    portHandlingMode: '',\n    emptyReturn: false,\n    electronicSeal: false,\n    manualName: '',",
    'wizard reset state',
  )

  code = replaceTextOnce(
    code,
    "  } else {\n    form.portHandlingMode = ''\n  }\n}\n\nfunction relinkExistingDetailIdsForEdit() {",
    [
      "  } else {",
      "    form.portHandlingMode = ''",
      "  }",
      "",
      "  form.overweight = form.overweight || hasOptionalDetail('3 ejes', '3 eje', 'tres ejes', '3 axles', '3 axle', 'three axles', 'tridem')",
      "  form.emptyReturn = hasOptionalDetail('retiro vacio', 'retiro de vacio', 'empty return', 'empty container return', 'return empty')",
      "    || persistedEditTermContains(includeLines, 'retiro vacio', 'retiro de vacio', 'empty return', 'empty container return')",
      "  form.electronicSeal = hasOptionalDetail('marchamo electronico', 'electronic seal', 'electronic security seal', 'e seal')",
      "    || persistedEditTermContains(includeLines, 'marchamo electronico', 'electronic seal', 'electronic security seal', 'e seal')",
      "}",
      "",
      "function relinkExistingDetailIdsForEdit() {",
    ].join('\n'),
    'edit hydration for screen 4 optionals',
  )

  code = replaceTextOnce(
    code,
    "              <Check v-if=\"form.overweight\" class=\"h-4 w-4\" /> Sobrepeso",
    "              <Check v-if=\"form.overweight\" class=\"h-4 w-4\" /> {{ shipmentModeForApi === 'Fcl' ? 'Sobrepeso · 3 ejes' : 'Sobrepeso' }}",
    'overweight button label',
  )

  const carrierButtonTail = [
    "              <Check v-if=\"form.carrierHaulage\" class=\"h-4 w-4\" /> Carrier",
    "            </button>",
  ].join('\n')
  const extraButtons = [
    carrierButtonTail,
    "            <button v-if=\"!sellerRequestMode && form.modality === 'Maritime' && shipmentModeForApi === 'Fcl'\" type=\"button\" class=\"crystal-flag\" :class=\"form.emptyReturn ? 'crystal-flag--active' : ''\" @click=\"form.emptyReturn = !form.emptyReturn\">",
    "              <Check v-if=\"form.emptyReturn\" class=\"h-4 w-4\" /> Retiro de vacío",
    "            </button>",
    "            <button v-if=\"!sellerRequestMode && form.modality === 'Maritime' && shipmentModeForApi === 'Fcl'\" type=\"button\" class=\"crystal-flag\" :class=\"form.electronicSeal ? 'crystal-flag--active' : ''\" @click=\"form.electronicSeal = !form.electronicSeal\">",
    "              <Check v-if=\"form.electronicSeal\" class=\"h-4 w-4\" /> Marchamo electrónico",
    "            </button>",
  ].join('\n')
  code = replaceTextOnce(code, carrierButtonTail, extraButtons, 'screen 4 optional buttons')

  return code
}

export function pricingWizardScreen4CostSelectors(): Plugin {
  return {
    name: 'dhole-pricing-wizard-screen4-cost-selectors',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

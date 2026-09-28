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
    "  const cargoSelected = cargoConditionSelection(line)",
    "  const portHandlingSelected = portHandlingConditionSelection(line)",
    "  const association = haulageAssociation(line)",
    "",
    "  // Las reglas explícitas se combinan con AND. Ejemplo: Retiro Vacio",
    "  // (Merchant) requiere tanto Retiro de vacío como Merchant seleccionados.",
    "  if (screen4Selection === false || cargoSelected === false || portHandlingSelected === false) return false",
    "  if (association === 'merchant' && !form.merchantHaulage) return false",
    "  if (association === 'carrier' && !form.carrierHaulage) return false",
    "",
    "  const hasAutomaticRule =",
    "    screen4Selection !== null",
    "    || cargoSelected !== null",
    "    || portHandlingSelected !== null",
    "    || association !== null",
    "",
    "  // Un Optional sin regla de Pantalla 4 queda disponible para selección manual,",
    "  // pero no se preselecciona solo por existir en /costs/select.",
    "  return hasAutomaticRule",
    "}",
  ].join('\n')

  code = replaceRegexOnce(
    code,
    /function shouldIncludeOptionalCost\([\s\S]*?\n\}(?=\n\n(?:const selectableOptionalLines = computed|async function loadApplicableCosts))/,
    shouldIncludeOptional,
    'automatic optional inclusion',
  )

  const preservedRuntimeAnchors = [
    'const selectableOptionalLines = computed',
    'const optionalChargeOptions = computed',
    'const canNext = computed',
    'function sectionForCost(',
    'function defaultChargeBasis(',
    'function applicableConfiguredCosts(',
    'function quantityForRateLine(',
  ]
  preservedRuntimeAnchors.forEach((anchor) => {
    if (!code.includes(anchor)) {
      throw new Error('[pricingWizardScreen4CostSelectors] Runtime helper was removed unexpectedly: ' + anchor)
    }
  })

  // En edición, Step4NavigationHardFix completa RateDetails con los costos que devolvió
  // Pricing. Solo reutilizar una línea histórica por nombre cuando aún NO tiene CostId;
  // una línea ya ligada a otro CostId nunca debe absorber un segundo costo distinto.
  code = replaceRegexOnce(
    code,
    /  const normalizedCostName = normalizeCatalogValue\(cost\.name\)\n  const sameNameLines = rateLines\.value\.filter\(\n    \(line\) => normalizeCatalogValue\(line\.name\) === normalizedCostName,\n  \)\n  const equivalent =\n    sameNameLines\.find\(\(line\) => line\.costDetailType === cost\.costDetailType\)\n    \?\? \(sameNameLines\.length === 1 \? sameNameLines\[0\] : undefined\)/,
    `  const normalizedCostName = normalizeCatalogValue(cost.name)
  const sameNameLines = rateLines.value.filter(
    (line) => normalizeCatalogValue(line.name) === normalizedCostName,
  )
  const equivalent =
    sameNameLines.find((line) => !line.costId && line.costDetailType === cost.costDetailType)
    ?? (sameNameLines.length === 1 && !sameNameLines[0].costId ? sameNameLines[0] : undefined)`,
    'edit configured-cost identity hydration',
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

  // Reaplicar selección automática después de construir/mezclar las líneas.
  // Esto evita que Merchant/Naviera, Sobrepeso, Retiro de vacío, Marchamo o Muellaje
  // queden visibles pero desmarcados al entrar a Pantalla 7.
  const rebuildStart = code.indexOf('function rebuildRateLines() {')
  const rebuildEnd = rebuildStart >= 0 ? code.indexOf('\n}\n\nfunction mergeConfiguredOptionalCostsIntoRateLines', rebuildStart) : -1
  if (rebuildStart >= 0 && rebuildEnd >= 0) {
    let rebuildBlock = code.slice(rebuildStart, rebuildEnd + 2)

    // Cada fila que /costs/select devuelve tiene un id de costo autoritativo. No
    // colapsar dos costos distintos solo porque comparten nombre + tipo de detalle.
    const equivalentHelper = [
      "  const hasEquivalent = (name: string, detailType: CostDetailType) =>",
      "    lines.some((line) =>",
      "      line.costDetailType === detailType &&",
      "      normalizeCatalogValue(line.name) === normalizeCatalogValue(name),",
      "    )",
    ].join('\n')
    if (!rebuildBlock.includes(equivalentHelper)) {
      throw new Error('[pricingWizardScreen4CostSelectors] Missing legacy configured-cost name dedupe helper.')
    }
    rebuildBlock = rebuildBlock.replace(equivalentHelper + '\n', '')
    rebuildBlock = rebuildBlock.replace(
      "    if (hasEquivalent(cost.name, cost.costDetailType)) return\n",
      '',
    )

    if (!rebuildBlock.includes('syncHaulageOptionalLines()')) {
      const assignment = '  rateLines.value = lines'
      if (!rebuildBlock.includes(assignment)) {
        throw new Error('[pricingWizardScreen4CostSelectors] Missing rebuild rateLines assignment.')
      }
      rebuildBlock = rebuildBlock.replace(
        assignment,
        assignment + '\n  syncHaulageOptionalLines()',
      )
    }

    code = code.slice(0, rebuildStart) + rebuildBlock + code.slice(rebuildEnd + 2)
  }

  const mergeStart = code.indexOf('function mergeConfiguredOptionalCostsIntoRateLines(')
  const mergeEnd = mergeStart >= 0 ? code.indexOf('\n}\n\nfunction addManualCharge', mergeStart) : -1
  if (mergeStart >= 0 && mergeEnd >= 0) {
    let mergeBlock = code.slice(mergeStart, mergeEnd + 2)

    // /costs/select es el catálogo autoritativo del contexto actual. Al hidratar una
    // edición o un borrador, agregar TODOS los ids devueltos: fijos y opcionales.
    // No volver a filtrarlos por visibleSections ni por nombre, porque eso elimina
    // cargos válidos cuando existen filas distintas con el mismo nombre comercial.
    mergeBlock = mergeBlock.replace(
      "  const visible = new Set(visibleSections.value)\n",
      '',
    )
    const existingKeysBlock = [
      "  const existingKeys = new Set(",
      "    rateLines.value.map((line) => `${normalizeCatalogValue(line.name)}|${line.costDetailType}`),",
      "  )",
      "",
    ].join('\n')
    mergeBlock = mergeBlock.replace(existingKeysBlock, '')
    mergeBlock = mergeBlock.replace(
      "      const equivalentKey = `${normalizeCatalogValue(cost.name)}|${cost.costDetailType}`\n",
      '',
    )
    mergeBlock = mergeBlock.replace(
      "      if (!visible.has(section) || existingCostIds.has(cost.id) || existingKeys.has(equivalentKey)) return",
      "      if (existingCostIds.has(cost.id)) return",
    )
    mergeBlock = mergeBlock.replace(
      "        included: includeFixed && cost.costType !== 'Optional',",
      "        included: cost.costType === 'Optional' ? shouldIncludeOptionalCost(cost) : includeFixed,",
    )

    const pushEnd = "      })\n    })"
    if (!mergeBlock.includes(pushEnd)) {
      throw new Error('[pricingWizardScreen4CostSelectors] Missing configured cost push end.')
    }
    mergeBlock = mergeBlock.replace(
      pushEnd,
      "      })\n      existingCostIds.add(cost.id)\n    })",
    )

    if (!mergeBlock.includes('syncHaulageOptionalLines()')) {
      const currencySync = [
        "  rateLines.value.forEach((line) => {",
        "    line.amountCurrencyCode ||= canonicalCurrencyCode(line)",
        "    enforceLineCurrency(line)",
        "  })",
      ].join('\n')
      if (mergeBlock.includes(currencySync)) {
        mergeBlock = mergeBlock.replace(currencySync, currencySync + '\n  syncHaulageOptionalLines()')
      }
    }
    code = code.slice(0, mergeStart) + mergeBlock + code.slice(mergeEnd + 2)
  }


  // Al entrar realmente a Pantalla 7 todas las líneas ya existen. Reconciliar una vez
  // más en ese punto cubre rutas de edición/borrador que preservan RateDetails.
  const carrierToggleEnd = [
    "function toggleCarrierHaulage() {",
    "  form.carrierHaulage = !form.carrierHaulage",
    "  if (form.carrierHaulage) form.merchantHaulage = false",
    "  syncHaulageOptionalLines()",
    "}",
  ].join('\n')
  if (code.includes(carrierToggleEnd) && !code.includes('dholeScreen7AutomaticOptionalSync')) {
    code = code.replace(
      carrierToggleEnd,
      carrierToggleEnd + [
        "",
        "const dholeScreen7AutomaticOptionalSync = watch(",
        "  () => step.value,",
        "  (currentStep) => {",
        "    if (currentStep === 7) {",
        "      mergeConfiguredOptionalCostsIntoRateLines(true)",
        "      syncHaulageOptionalLines()",
        "    }",
        "  },",
        "  { flush: 'post' },",
        ")",
      ].join('\n'),
    )
  }

  const optionalSelectorStart = code.indexOf('const selectableOptionalLines = computed')
  const optionalSelectorEnd = code.indexOf('const optionalChargeOptions = computed', optionalSelectorStart)
  if (optionalSelectorStart >= 0 && optionalSelectorEnd >= 0) {
    const screen7OptionalSelector = [
      "const selectableOptionalLines = computed(() =>",
      "  // /costs/select ya filtró modalidad, ruta/puertos, Incoterm, servicios",
      "  // y Naviera/Agente. Pantalla 4 solo preselecciona; nunca oculta opciones.",
      "  rateLines.value.filter((line) => line.optional),",
      ")",
      "",
    ].join('\n')
    code = code.slice(0, optionalSelectorStart) + screen7OptionalSelector + code.slice(optionalSelectorEnd)
  }

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

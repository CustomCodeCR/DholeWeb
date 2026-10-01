import type { Plugin } from 'vite'

const WIZARD_SUFFIXES = [
  '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
]
const MARKER = '// dhole-consolidated-cargo-20261001'
const CARGO_RUNTIME = "\ninterface ConsolidatedCargoLineUi {\n  key: string\n  description: string\n  quantity: number\n  weightKg: number\n  length: number\n  width: number\n  height: number\n  isStackable: boolean\n}\n\nconst CFT_PER_CBM = 35.31466672148859\nconst INCH_TO_CM = 2.54\nconst FORCED_NON_STACKABLE_HEIGHT_CM = 177.8\nconst NON_STACKABLE_BILLABLE_HEIGHT_CM = 266\nlet consolidatedCargoLineSequence = 0\n\nfunction createConsolidatedCargoLine(): ConsolidatedCargoLineUi {\n  consolidatedCargoLineSequence += 1\n  return {\n    key: 'cargo-' + consolidatedCargoLineSequence,\n    description: '',\n    quantity: 1,\n    weightKg: 0,\n    length: 0,\n    width: 0,\n    height: 0,\n    isStackable: true,\n  }\n}\n\nconst consolidatedCargoLines = ref<ConsolidatedCargoLineUi[]>([createConsolidatedCargoLine()])\n\nconst isUnitedStatesPol = computed(() => {\n  const origin = selectedOrigin.value\n  const tokens = countryTokens(origin)\n  const normalizedValues = new Set([\n    ...tokens,\n    normalizeCatalogValue(String(origin?.code ?? '')),\n    normalizeCatalogValue(String(origin?.label ?? '')),\n    normalizeCatalogValue(String(origin?.value ?? '')),\n    normalizeCatalogValue(displayValue(origin)),\n  ])\n  return [...normalizedValues].some((token) =>\n    token === 'us'\n    || token === 'usa'\n    || token === 'eeuu'\n    || token === 'eua'\n    || token.includes('united states')\n    || token.includes('estados unidos')\n    || /^us[a-z0-9]{3}$/.test(token)\n  )\n})\n\nconst cargoVolumeUnit = computed(() => isUnitedStatesPol.value ? 'CFT' : 'CBM')\nconst cargoDimensionUnit = computed(() => isUnitedStatesPol.value ? 'in' : 'cm')\n\nfunction cargoDimensionToCm(value: number) {\n  const normalized = Math.max(0, number(value))\n  return isUnitedStatesPol.value ? normalized * INCH_TO_CM : normalized\n}\n\nfunction cargoDimensionFromCm(value: number) {\n  const normalized = Math.max(0, number(value))\n  return isUnitedStatesPol.value ? normalized / INCH_TO_CM : normalized\n}\n\nfunction cargoLineQuantity(line: ConsolidatedCargoLineUi) {\n  return Math.max(1, Math.trunc(number(line.quantity)))\n}\n\nfunction cargoLineForcedNonStackable(line: ConsolidatedCargoLineUi) {\n  return cargoDimensionToCm(line.height) >= FORCED_NON_STACKABLE_HEIGHT_CM - 0.0001\n}\n\nfunction cargoLineEffectiveStackable(line: ConsolidatedCargoLineUi) {\n  return !cargoLineForcedNonStackable(line) && Boolean(line.isStackable)\n}\n\nfunction cargoLinePhysicalCbm(line: ConsolidatedCargoLineUi) {\n  const quantity = cargoLineQuantity(line)\n  const lengthCm = cargoDimensionToCm(line.length)\n  const widthCm = cargoDimensionToCm(line.width)\n  const heightCm = cargoDimensionToCm(line.height)\n  return Math.max(0, lengthCm * widthCm * heightCm * quantity / 1_000_000)\n}\n\nfunction cargoLineBillableCbm(line: ConsolidatedCargoLineUi) {\n  const quantity = cargoLineQuantity(line)\n  const lengthCm = cargoDimensionToCm(line.length)\n  const widthCm = cargoDimensionToCm(line.width)\n  const heightCm = cargoDimensionToCm(line.height)\n  const billableHeightCm = cargoLineEffectiveStackable(line)\n    ? heightCm\n    : Math.max(NON_STACKABLE_BILLABLE_HEIGHT_CM, heightCm)\n  return Math.max(0, lengthCm * widthCm * billableHeightCm * quantity / 1_000_000)\n}\n\nfunction addConsolidatedCargoLine() {\n  consolidatedCargoLines.value.push(createConsolidatedCargoLine())\n}\n\nfunction removeConsolidatedCargoLine(index: number) {\n  if (consolidatedCargoLines.value.length <= 1) return\n  consolidatedCargoLines.value.splice(index, 1)\n}\n\nfunction setConsolidatedCargoLineStackable(line: ConsolidatedCargoLineUi, isStackable: boolean) {\n  line.isStackable = cargoLineForcedNonStackable(line) ? false : isStackable\n}\n\nconst consolidatedCargoLinesReady = computed(() =>\n  consolidatedCargoLines.value.length > 0\n  && consolidatedCargoLines.value.every((line) =>\n    cargoLineQuantity(line) > 0\n    && number(line.length) > 0\n    && number(line.width) > 0\n    && number(line.height) > 0,\n  ),\n)\n\nconst consolidatedTotalPackages = computed(() =>\n  consolidatedCargoLines.value.reduce((sum, line) => sum + cargoLineQuantity(line), 0),\n)\nconst consolidatedTotalWeightKg = computed(() =>\n  consolidatedCargoLines.value.reduce((sum, line) => sum + Math.max(0, number(line.weightKg)), 0),\n)\n\nconst lclPhysicalCbm = computed(() =>\n  consolidatedCargoLines.value.reduce((sum, line) => sum + cargoLinePhysicalCbm(line), 0),\n)\nconst lclDimensionalCbm = computed(() =>\n  consolidatedCargoLines.value.reduce((sum, line) => sum + cargoLineBillableCbm(line), 0),\n)\nconst lclDeadSpaceCbm = computed(() => Math.max(0, lclDimensionalCbm.value - lclPhysicalCbm.value))\nconst consolidatedKgPerCbm = computed(() => shipmentModeForApi.value === 'Ltl' ? 330 : 500)\nconst lclWeightCbm = computed(() =>\n  consolidatedTotalWeightKg.value / Math.max(1, consolidatedKgPerCbm.value),\n)\nconst lclChargeableCbm = computed(() => {\n  const calculated = Math.max(lclDimensionalCbm.value, lclWeightCbm.value)\n  return calculated > 0 ? Math.max(1, calculated) : 0\n})\n\nfunction cargoVolumeForDisplay(cbm: number) {\n  return Math.max(0, number(cbm)) * (isUnitedStatesPol.value ? CFT_PER_CBM : 1)\n}\n\nfunction formatCargoVolume(cbm: number) {\n  return cargoVolumeForDisplay(cbm).toFixed(3) + ' ' + cargoVolumeUnit.value\n}\n\nconst lclCargoLines = computed(() => consolidatedCargoMode.value && lclChargeableCbm.value > 0\n  ? consolidatedCargoLines.value.map((line, index) => ({\n      description: line.description.trim() || form.cargoDescription.trim() || ('Carga ' + form.shipmentMode.toUpperCase() + ' ' + (index + 1)),\n      units: cargoLineQuantity(line),\n      totalWeightKg: Math.max(0, number(line.weightKg)),\n      lengthCm: cargoDimensionToCm(line.length),\n      widthCm: cargoDimensionToCm(line.width),\n      heightCm: cargoDimensionToCm(line.height),\n    }))\n  : [])\n\nfunction syncConsolidatedCargoForm() {\n  for (const line of consolidatedCargoLines.value) {\n    if (cargoLineForcedNonStackable(line)) line.isStackable = false\n  }\n  const first = consolidatedCargoLines.value[0]\n  form.cargoPallets = consolidatedTotalPackages.value\n  form.cargoWeightKg = consolidatedTotalWeightKg.value\n  form.cargoLengthCm = first ? cargoDimensionToCm(first.length) : 0\n  form.cargoWidthCm = first ? cargoDimensionToCm(first.width) : 0\n  form.cargoHeightCm = first ? cargoDimensionToCm(first.height) : 0\n  form.nonStackable = consolidatedCargoLines.value.some((line) => !cargoLineEffectiveStackable(line))\n}\n\nwatch(consolidatedCargoLines, syncConsolidatedCargoForm, { deep: true, immediate: true })\n\nwatch(isUnitedStatesPol, (current, previous) => {\n  if (current === previous) return\n  const multiplier = current ? (1 / INCH_TO_CM) : INCH_TO_CM\n  for (const line of consolidatedCargoLines.value) {\n    line.length = number(line.length) * multiplier\n    line.width = number(line.width) * multiplier\n    line.height = number(line.height) * multiplier\n  }\n  syncConsolidatedCargoForm()\n})\n\nfunction hydrateConsolidatedCargoLines(rate: RateDto) {\n  if (!consolidatedCargoMode.value) return\n  const rows = Array.isArray(rate.cargoLines) ? rate.cargoLines : []\n  if (!rows.length) return\n\n  consolidatedCargoLines.value = rows.map((row, index) => {\n    consolidatedCargoLineSequence += 1\n    const heightCm = Math.max(0, number(row.heightCm))\n    const persistedStackable = row.isStackable !== false && heightCm < FORCED_NON_STACKABLE_HEIGHT_CM\n    return {\n      key: 'cargo-' + consolidatedCargoLineSequence + '-' + index,\n      description: String(row.description ?? '').trim(),\n      quantity: Math.max(1, Math.trunc(number(row.packages || row.pallets || 1))),\n      weightKg: Math.max(0, number(row.weightKg)),\n      length: cargoDimensionFromCm(number(row.lengthCm)),\n      width: cargoDimensionFromCm(number(row.widthCm)),\n      height: cargoDimensionFromCm(heightCm),\n      isStackable: persistedStackable,\n    }\n  })\n  syncConsolidatedCargoForm()\n}\n\nfunction consolidatedCargoPayload(commonText = '') {\n  if (!consolidatedCargoMode.value) {\n    const description = [\n      form.cabysCode ? 'CABYS ' + form.cabysCode : '',\n      form.cargoDescription,\n      form.cargoObservations ? 'Observaciones: ' + form.cargoObservations : '',\n      commonText,\n    ].filter(Boolean).join(' · ')\n    return description ? [{\n      description,\n      packages: 0,\n      pallets: 0,\n      weightKg: 0,\n      lengthCm: 0,\n      widthCm: 0,\n      heightCm: 0,\n      isStackable: true,\n    }] : []\n  }\n\n  return consolidatedCargoLines.value.map((line, index) => {\n    const heightCm = cargoDimensionToCm(line.height)\n    const isStackable = heightCm >= FORCED_NON_STACKABLE_HEIGHT_CM\n      ? false\n      : Boolean(line.isStackable)\n    return {\n      description: [\n        line.description.trim() || (index === 0 ? form.cargoDescription.trim() : '') || ('Carga ' + form.shipmentMode.toUpperCase() + ' ' + (index + 1)),\n        index === 0 && form.cabysCode ? 'CABYS ' + form.cabysCode : '',\n        index === 0 && form.cargoObservations ? 'Observaciones: ' + form.cargoObservations : '',\n        index === 0 ? commonText : '',\n      ].filter(Boolean).join(' · '),\n      packages: cargoLineQuantity(line),\n      pallets: cargoLineQuantity(line),\n      weightKg: Math.max(0, number(line.weightKg)),\n      lengthCm: cargoDimensionToCm(line.length),\n      widthCm: cargoDimensionToCm(line.width),\n      heightCm,\n      isStackable,\n    }\n  })\n}\n"
const CARGO_TEMPLATE = "\n            <div v-if=\"consolidatedCargoMode\" class=\"space-y-4 rounded-[22px] border border-[rgb(var(--dh-primary-rgb)/0.22)] bg-[rgb(var(--dh-primary-rgb)/0.05)] p-4\">\n              <div class=\"flex flex-wrap items-start justify-between gap-3\">\n                <div>\n                  <p class=\"font-black\">Medidas de la carga {{ shipmentModeForApi === 'Ltl' ? 'LTL' : 'LCL' }}</p>\n                  <p class=\"mt-1 text-xs font-semibold text-[var(--dh-text-muted)]\">\n                    {{ isUnitedStatesPol\n                      ? 'POL Estados Unidos: capture dimensiones en pulgadas y el volumen comercial se trabaja en CFT.'\n                      : 'Capture dimensiones en centímetros y el volumen comercial se trabaja en CBM.' }}\n                    Se compara contra {{ shipmentModeForApi === 'Ltl' ? 'peso/330' : 'peso/500' }}.\n                  </p>\n                  <p class=\"mt-1 text-xs font-semibold text-[var(--dh-text-muted)]\">\n                    Desde 70 in (177.8 cm) la carga queda No estibable automáticamente. Si no es estibable, la altura facturable mínima es 2.66 m.\n                  </p>\n                </div>\n                <DhButton variant=\"secondary\" @click=\"addConsolidatedCargoLine\">+ Línea</DhButton>\n              </div>\n\n              <div class=\"space-y-3\">\n                <div\n                  v-for=\"(line, index) in consolidatedCargoLines\"\n                  :key=\"line.key\"\n                  class=\"rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3\"\n                >\n                  <div class=\"mb-3 flex items-center justify-between gap-3\">\n                    <p class=\"text-xs font-black uppercase tracking-[0.12em]\">Paquete / línea {{ index + 1 }}</p>\n                    <button\n                      type=\"button\"\n                      class=\"text-xs font-black text-red-500 disabled:cursor-not-allowed disabled:opacity-40\"\n                      :disabled=\"consolidatedCargoLines.length === 1\"\n                      @click=\"removeConsolidatedCargoLine(index)\"\n                    >\n                      Eliminar\n                    </button>\n                  </div>\n                  <div class=\"grid gap-3 sm:grid-cols-2 xl:grid-cols-7\">\n                    <DhInput v-model=\"line.description\" label=\"Descripción\" />\n                    <DhInput v-model.number=\"line.quantity\" type=\"number\" min=\"1\" step=\"1\" label=\"Cantidad\" />\n                    <DhInput v-model.number=\"line.weightKg\" type=\"number\" min=\"0\" step=\"0.01\" label=\"Peso total (kg) · opcional\" />\n                    <DhInput v-model.number=\"line.length\" type=\"number\" min=\"0\" step=\"0.01\" :label=\"'Largo (' + cargoDimensionUnit + ')'\" />\n                    <DhInput v-model.number=\"line.width\" type=\"number\" min=\"0\" step=\"0.01\" :label=\"'Ancho (' + cargoDimensionUnit + ')'\" />\n                    <DhInput v-model.number=\"line.height\" type=\"number\" min=\"0\" step=\"0.01\" :label=\"'Alto (' + cargoDimensionUnit + ')'\" />\n                    <button\n                      type=\"button\"\n                      class=\"crystal-flag self-end\"\n                      :class=\"cargoLineEffectiveStackable(line) ? 'crystal-flag--active' : ''\"\n                      :disabled=\"cargoLineForcedNonStackable(line)\"\n                      @click=\"setConsolidatedCargoLineStackable(line, !cargoLineEffectiveStackable(line))\"\n                    >\n                      <Check v-if=\"cargoLineEffectiveStackable(line)\" class=\"h-4 w-4\" />\n                      {{ cargoLineEffectiveStackable(line) ? 'Estibable' : 'No estibable' }}\n                    </button>\n                  </div>\n                  <p v-if=\"cargoLineForcedNonStackable(line)\" class=\"mt-2 text-xs font-black text-amber-600\">\n                    Alto ≥ 70 in / 177.8 cm: No estibable automático. Altura facturable: {{ Math.max(266, cargoDimensionToCm(line.height)).toFixed(1) }} cm.\n                  </p>\n                </div>\n              </div>\n\n              <div class=\"grid gap-3 sm:grid-cols-2 xl:grid-cols-4\">\n                <div class=\"crystal-metric crystal-metric--neutral\">\n                  <span class=\"block text-[10px] font-black uppercase tracking-[0.12em]\">Volumen físico</span>\n                  <strong class=\"mt-1 block text-base\">{{ formatCargoVolume(lclPhysicalCbm) }}</strong>\n                </div>\n                <div class=\"crystal-metric crystal-metric--neutral\">\n                  <span class=\"block text-[10px] font-black uppercase tracking-[0.12em]\">Volumen facturable</span>\n                  <strong class=\"mt-1 block text-base\">{{ formatCargoVolume(lclDimensionalCbm) }}</strong>\n                  <small v-if=\"lclDeadSpaceCbm > 0\">Espacio muerto: {{ formatCargoVolume(lclDeadSpaceCbm) }}</small>\n                </div>\n                <div class=\"crystal-metric crystal-metric--neutral\">\n                  <span class=\"block text-[10px] font-black uppercase tracking-[0.12em]\">Equivalente por peso</span>\n                  <strong class=\"mt-1 block text-base\">{{ formatCargoVolume(lclWeightCbm) }}</strong>\n                </div>\n                <div class=\"crystal-metric crystal-metric--sale\">\n                  <span class=\"block text-[10px] font-black uppercase tracking-[0.12em]\">{{ cargoVolumeUnit }} cobrable</span>\n                  <strong class=\"mt-1 block text-base\">{{ formatCargoVolume(lclChargeableCbm) }}</strong>\n                  <small>{{ isUnitedStatesPol ? 'Mínimo facturable: 35.315 CFT (1 CBM)' : 'Mínimo facturable: 1 CBM' }}</small>\n                </div>\n              </div>\n\n              <p v-if=\"!consolidatedCargoLinesReady\" class=\"text-xs font-bold text-amber-600\">\n                Complete cantidad, largo, ancho y alto en todas las líneas para continuar. El peso es opcional.\n              </p>\n            </div>\n"

function patchPayloads(source: string) {
  let code = source
  code = code.replaceAll(
    'totalPackages: consolidatedCargoMode.value ? Math.max(1, Math.trunc(number(form.cargoPallets))) : 0,',
    'totalPackages: consolidatedCargoMode.value ? consolidatedTotalPackages.value : 0,',
  )
  code = code.replaceAll(
    'totalPallets: consolidatedCargoMode.value ? Math.max(1, Math.trunc(number(form.cargoPallets))) : 0,',
    'totalPallets: consolidatedCargoMode.value ? consolidatedTotalPackages.value : 0,',
  )
  code = code.replaceAll(
    'totalWeightKg: consolidatedCargoMode.value ? Math.max(0, number(form.cargoWeightKg)) : 0,',
    'totalWeightKg: consolidatedCargoMode.value ? consolidatedTotalWeightKg.value : 0,',
  )
  code = code.replaceAll(
    'totalVolumeCbm: consolidatedCargoMode.value ? lclDimensionalCbm.value : 0,',
    'totalVolumeCbm: consolidatedCargoMode.value ? lclPhysicalCbm.value : 0,',
  )

  const kgAnchor = '      kgPerCbm: consolidatedCargoMode.value ? consolidatedKgPerCbm.value : undefined,'
  let cursor = 0
  let payloadIndex = 0
  while (true) {
    const kgStart = code.indexOf(kgAnchor, cursor)
    if (kgStart < 0) break
    const start = code.indexOf('      cargoLines:', kgStart + kgAnchor.length)
    if (start < 0) throw new Error('[pricingConsolidatedCargo20261001] cargo payload start not found.')
    const detailsWithColon = code.indexOf('      details:', start)
    const detailsWithComma = code.indexOf('      details,', start)
    const candidates = [detailsWithColon, detailsWithComma].filter((index) => index >= 0)
    const end = candidates.length ? Math.min(...candidates) : -1
    if (end < 0) throw new Error('[pricingConsolidatedCargo20261001] cargo payload end not found.')
    const block = code.slice(start, end)
    const commonText = block.includes('supportSummaryText()') || payloadIndex > 0
      ? 'supportSummaryText()'
      : 'supportText'
    code = code.slice(0, start)
      + '      cargoLines: consolidatedCargoPayload(' + commonText + '),\n'
      + code.slice(end)
    cursor = start + 80
    payloadIndex += 1
  }
  if (payloadIndex < 2) {
    throw new Error('[pricingConsolidatedCargo20261001] expected both create/open cargo payloads, found ' + payloadIndex + '.')
  }
  return code
}

function patchFunction(source: string, name: string, transform: (block: string) => string) {
  const start = source.indexOf('function ' + name + '(')
  if (start < 0) return source
  let brace = source.indexOf('{', start)
  if (brace < 0) return source
  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        const block = source.slice(start, index + 1)
        return source.slice(0, start) + transform(block) + source.slice(index + 1)
      }
    }
  }
  return source
}

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  let code = source

  const runtimeStart = code.indexOf('const lclDimensionalCbm = computed(() => {')
  const runtimeEnd = code.indexOf('const direction = computed(() => {', runtimeStart)
  if (runtimeStart < 0 || runtimeEnd < 0) {
    throw new Error('[pricingConsolidatedCargo20261001] consolidated cargo runtime anchors not found.')
  }
  code = code.slice(0, runtimeStart) + CARGO_RUNTIME + '\n' + code.slice(runtimeEnd)

  const templateStart = code.indexOf('            <div v-if="consolidatedCargoMode"')
  const templateEnd = code.indexOf('            <DhTextarea v-model="form.cargoObservations"', templateStart)
  if (templateStart < 0 || templateEnd < 0) {
    throw new Error('[pricingConsolidatedCargo20261001] screen 4 template anchors not found.')
  }
  code = code.slice(0, templateStart) + CARGO_TEMPLATE + '\n' + code.slice(templateEnd)

  code = code.replace(
    /  if \(step\.value === 4\) \{[\s\S]*?\n  \}\n  if \(step\.value === 5\)/,
    "  if (step.value === 4) {\n    if (!consolidatedCargoMode.value) return true\n    return consolidatedCargoLinesReady.value\n  }\n  if (step.value === 5)",
  )

  code = patchPayloads(code)

  code = code.replaceAll(
    'form.cargoHeightCm = Number(rate.cargoLines?.[0]?.heightCm ?? 0)',
    "form.cargoHeightCm = Number(rate.cargoLines?.[0]?.heightCm ?? 0)\n    hydrateConsolidatedCargoLines(rate)",
  )

  code = patchFunction(code, 'quantityForChargeBasis', (block) => {
    if (block.includes("basis === 'PerChargeableCft'")) return block
    const brace = block.indexOf('{')
    return block.slice(0, brace + 1)
      + "\n  if (consolidatedCargoMode.value && basis === 'PerCft') return Math.max(0.001, number(lclPhysicalCbm.value) * CFT_PER_CBM)"
      + "\n  if (consolidatedCargoMode.value && basis === 'PerChargeableCft') return Math.max(CFT_PER_CBM, number(lclChargeableCbm.value) * CFT_PER_CBM)"
      + block.slice(brace + 1)
  })

  code = patchFunction(code, 'defaultChargeBasis', (block) =>
    block.replace(
      "return 'PerChargeableCbm'",
      "return isUnitedStatesPol.value ? 'PerChargeableCft' : 'PerChargeableCbm'",
    ),
  )

  code = code.replaceAll(
    "PerChargeableCbm: 'Por CBM cobrable',",
    "PerChargeableCbm: 'Por CBM cobrable',\n    PerCft: 'Por CFT',\n    PerChargeableCft: 'Por CFT cobrable',",
  )

  code = code.replace(
    /<button([^>]*:class="form\.dangerousCargo \? 'crystal-flag--active' : ''"[^>]*)>/,
    (tag) => tag
      .replace(/\s+v-if="[^"]*"/, '')
      .replace('> Carga peligrosa', "> {{ shipmentModeForApi === 'Ltl' ? 'Carga IMO' : 'Carga peligrosa' }}"),
  )
  code = code.replace(
    /<Check v-if="form\.dangerousCargo" class="h-4 w-4" \/> Carga peligrosa/,
    "<Check v-if=\"form.dangerousCargo\" class=\"h-4 w-4\" /> {{ shipmentModeForApi === 'Ltl' ? 'Carga IMO' : 'Carga peligrosa' }}",
  )
  code = code.replaceAll(
    'v-if="!ltlCargoMode && form.dangerousCargo && !hasDangerousTechSheet"',
    'v-if="form.dangerousCargo && !hasDangerousTechSheet"',
  )
  code = code.replaceAll(
    "!ltlCargoMode.value && form.dangerousCargo ? 'Carga peligrosa' : null",
    "form.dangerousCargo ? (shipmentModeForApi.value === 'Ltl' ? 'Carga IMO' : 'Carga peligrosa') : null",
  )

  code = code.replace(
    /<button([^>]*:class="form\.nonStackable \? 'crystal-flag--active' : ''"[^>]*)>/,
    (tag) => {
      if (tag.includes('v-if="')) {
        return tag.replace(/v-if="([^"]*)"/, 'v-if="$1 && !consolidatedCargoMode"')
      }
      return tag.replace('<button', '<button v-if="!consolidatedCargoMode"')
    },
  )

  code = code.replaceAll(
    '{{ landLtlBillableCbm(resolvedFtlTariff).toFixed(3) }} CBM cobrable',
    '{{ formatCargoVolume(landLtlBillableCbm(resolvedFtlTariff)) }} cobrable',
  )

  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd < 0) throw new Error('[pricingConsolidatedCargo20261001] script end not found.')
  code = code.slice(0, scriptEnd) + '\n' + MARKER + '\n' + code.slice(scriptEnd)
  return code
}

export function pricingConsolidatedCargo20261001(): Plugin {
  return {
    name: 'dhole-pricing-consolidated-cargo-20261001',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (normalizedId.includes('/src/modules/pricing/existing/')) return null
      if (!WIZARD_SUFFIXES.some((suffix) => normalizedId.endsWith(suffix))) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

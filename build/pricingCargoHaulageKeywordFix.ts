import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingCargoHaulageKeywordFix] Missing ${label} anchor.`)
  }

  return source.replace(anchor, replacement)
}

function replaceRegexRequired(source: string, pattern: RegExp, replacement: string, label: string) {
  if (!pattern.test(source)) {
    throw new Error(`[pricingCargoHaulageKeywordFix] Missing ${label} pattern.`)
  }

  pattern.lastIndex = 0
  return source.replace(pattern, replacement)
}

export function pricingCargoHaulageKeywordFix(): Plugin {
  return {
    name: 'dhole-pricing-cargo-haulage-keyword-fix',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null

      let code = source

      code = replaceRegexRequired(
        code,
        /(\n\s*carrierHaulage:\s*false,)/,
        `$1\n  portHandlingMode: '' as '' | 'Anticipado' | 'Redestino',`,
        'port handling form state',
      )

      code = replaceRequired(
        code,
        `function haulageAssociation(line: { name: string }) {\n  const value = normalizeCatalogValue(line.name)\n  if (value.includes('inland gam naviera') || value.includes('carrier haulage')) return 'carrier'\n  if (value.includes('inland gam merchant') || value.includes('merchant haulage') || value === 'gate') return 'merchant'\n  return null\n}`,
        `function haulageAssociation(line: { name: string }) {\n  const value = normalizeCatalogValue(line.name)\n  // La asociación no depende de un nombre exacto del costo. Cualquier línea cuyo\n  // nombre contenga Naviera/Carrier o Merchant pertenece a ese tipo de haulage.\n  if (value.includes('naviera') || value.includes('carrier')) return 'carrier'\n  if (value.includes('merchant') || value === 'gate') return 'merchant'\n  return null\n}\n\nfunction cargoConditionSelection(line: { name: string; notes?: string | null }) {\n  const value = normalizeCatalogValue(\`${'${line.name}'} ${'${line.notes ?? \'\'}'}\`)\n  if (value.includes('carga peligrosa') || value.includes('dangerous') || value.includes('hazmat')) {\n    return form.dangerousCargo\n  }\n  if (value.includes('sobrepeso') || value.includes('overweight') || value.includes('over weight')) {\n    return form.overweight\n  }\n  return null\n}\n\nfunction portHandlingConditionSelection(line: { name: string; notes?: string | null }) {\n  const value = normalizeCatalogValue(\`${'${line.name}'} ${'${line.notes ?? \'\'}'}\`)\n  const hasAnticipado = value.includes('anticipado')\n  const hasRedestino = value.includes('redestino')\n  if (!hasAnticipado && !hasRedestino) return null\n\n  // Si una línea genérica menciona ambas alternativas, cualquiera de las dos\n  // selecciones la habilita. Cuando el costo está separado por nombre, exige la\n  // alternativa exacta seleccionada.\n  if (hasAnticipado && hasRedestino) return form.portHandlingMode !== ''\n  if (hasAnticipado) return form.portHandlingMode === 'Anticipado'\n  return form.portHandlingMode === 'Redestino'\n}\n\nfunction shouldIncludeOptionalCost(line: { name: string; notes?: string | null }) {\n  const cargoSelected = cargoConditionSelection(line)\n  if (cargoSelected === false) return false\n\n  const portHandlingSelected = portHandlingConditionSelection(line)\n  if (portHandlingSelected === false) return false\n\n  const association = haulageAssociation(line)\n  if (association === 'merchant' && !form.merchantHaulage) return false\n  if (association === 'carrier' && !form.carrierHaulage) return false\n\n  // Las líneas administradas por una condición solo quedan incluidas cuando la\n  // condición está activa. Merchant/Naviera sin otra condición siguen el botón\n  // de haulage. Otros opcionales continúan siendo manuales.\n  if (cargoSelected === true || portHandlingSelected === true) return true\n  if (association === 'merchant') return form.merchantHaulage\n  if (association === 'carrier') return form.carrierHaulage\n  return false\n}`,
        'haulage keyword association',
      )

      code = replaceRequired(
        code,
        `      included:\n        cost.costType !== 'Optional' ||\n        (form.dangerousCargo && isDangerousCargoCost(cost)) ||\n        (form.overweight && isOverweightCost(cost)) ||\n        (form.merchantHaulage && haulageAssociation(cost) === 'merchant') ||\n        (form.carrierHaulage && haulageAssociation(cost) === 'carrier'),`,
        `      included:\n        cost.costType !== 'Optional' ||\n        shouldIncludeOptionalCost(cost),`,
        'optional cost selection',
      )

      code = replaceRequired(
        code,
        `    line.included =\n      (association === 'merchant' && form.merchantHaulage) ||\n      (association === 'carrier' && form.carrierHaulage)`,
        `    line.included = shouldIncludeOptionalCost(line)`,
        'haulage optional line synchronization',
      )

      code = replaceRequired(
        code,
        `    if (!line.optional) return false\n    const association = haulageAssociation(line)`,
        `    if (!line.optional) return false\n    if (cargoConditionSelection(line) === false || portHandlingConditionSelection(line) === false) return false\n    const association = haulageAssociation(line)`,
        'optional line visibility',
      )

      code = replaceRegexRequired(
        code,
        /(function toggleCarrierHaulage\(\) \{[\s\S]*?syncHaulageOptionalLines\(\)\n\})/,
        `$1\n\nfunction togglePortHandlingMode(mode: 'Anticipado' | 'Redestino') {\n  form.portHandlingMode = form.portHandlingMode === mode ? '' : mode\n  syncHaulageOptionalLines()\n}\n\nwatch(\n  () => [\n    form.dangerousCargo,\n    form.overweight,\n    form.merchantHaulage,\n    form.carrierHaulage,\n    form.portHandlingMode,\n  ] as const,\n  () => syncHaulageOptionalLines(),\n)\n\nwatch(shipmentModeForApi, (mode) => {\n  if (String(mode).toLowerCase() !== 'lcl' || !form.portHandlingMode) return\n  form.portHandlingMode = ''\n  syncHaulageOptionalLines()\n})`,
        'condition synchronization functions',
      )

      code = replaceRegexRequired(
        code,
        /(<button[^>]*@click="toggleCarrierHaulage"[^>]*>[\s\S]*?<\/button>)/,
        `$1\n            <button v-if="!props.sellerRequestMode && shipmentModeForApi !== 'Lcl'" type="button" class="crystal-flag" :class="form.portHandlingMode === 'Anticipado' ? 'crystal-flag--active' : ''" @click="togglePortHandlingMode('Anticipado')">\n              <Check v-if="form.portHandlingMode === 'Anticipado'" class="h-4 w-4" /> Anticipado\n            </button>\n            <button v-if="!props.sellerRequestMode && shipmentModeForApi !== 'Lcl'" type="button" class="crystal-flag" :class="form.portHandlingMode === 'Redestino' ? 'crystal-flag--active' : ''" @click="togglePortHandlingMode('Redestino')">\n              <Check v-if="form.portHandlingMode === 'Redestino'" class="h-4 w-4" /> Redestino\n            </button>`,
        'Anticipado/Redestino buttons',
      )

      return { code, map: null }
    },
  }
}

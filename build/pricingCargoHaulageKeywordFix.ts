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
        `function haulageAssociation(line: { name: string }) {\n  const value = normalizeCatalogValue(line.name)\n  if (value.includes('naviera') || value.includes('carrier')) return 'carrier'\n  if (value.includes('merchant') || value === 'gate') return 'merchant'\n  return null\n}\n\nfunction cargoConditionSelection(line: { name: string; notes?: string | null }) {\n  const value = normalizeCatalogValue(\`${'${line.name}'} ${'${line.notes ?? \'\'}'}\`)\n  if (value.includes('carga peligrosa') || value.includes('dangerous') || value.includes('hazmat')) return form.dangerousCargo\n  if (value.includes('sobrepeso') || value.includes('sobre peso') || value.includes('overweight') || value.includes('over weight')) return form.overweight\n  return null\n}\n\nfunction portHandlingConditionSelection(line: { name: string; notes?: string | null }) {\n  const value = normalizeCatalogValue(\`${'${line.name}'} ${'${line.notes ?? \'\'}'}\`)\n  const hasAnticipado = value.includes('anticipado')\n  const hasRedestino = value.includes('redestino')\n  if (!hasAnticipado && !hasRedestino) return null\n  if (hasAnticipado && hasRedestino) return form.portHandlingMode !== ''\n  if (hasAnticipado) return form.portHandlingMode === 'Anticipado'\n  return form.portHandlingMode === 'Redestino'\n}\n\nfunction shouldIncludeOptionalCost(line: { name: string; notes?: string | null }) {\n  const cargoSelected = cargoConditionSelection(line)\n  if (cargoSelected === false) return false\n  const portHandlingSelected = portHandlingConditionSelection(line)\n  if (portHandlingSelected === false) return false\n  const association = haulageAssociation(line)\n  if (association === 'merchant' && !form.merchantHaulage) return false\n  if (association === 'carrier' && !form.carrierHaulage) return false\n  if (cargoSelected === true || portHandlingSelected === true) return true\n  if (association === 'merchant') return form.merchantHaulage\n  if (association === 'carrier') return form.carrierHaulage\n  return false\n}`,
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
        `function syncHaulageOptionalLines() {\n  rateLines.value.forEach((line) => {\n    if (!line.optional) return\n    const association = haulageAssociation(line)\n    if (!association) return\n\n    line.included =\n      (association === 'merchant' && form.merchantHaulage) ||\n      (association === 'carrier' && form.carrierHaulage)\n\n    if (!line.included) {\n      line.applyDestinationTax = false\n    }\n  })\n}`,
        `function syncHaulageOptionalLines() {\n  rateLines.value.forEach((line) => {\n    if (!line.optional) return\n    const cargoCondition = cargoConditionSelection(line)\n    const portHandlingCondition = portHandlingConditionSelection(line)\n    const association = haulageAssociation(line)\n    if (cargoCondition === null && portHandlingCondition === null && association === null) return\n    line.included = shouldIncludeOptionalCost(line)\n    if (!line.included) line.applyDestinationTax = false\n  })\n}`,
        'full optional condition synchronization',
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
        `$1\n\nfunction togglePortHandlingMode(mode: 'Anticipado' | 'Redestino') {\n  form.portHandlingMode = form.portHandlingMode === mode ? '' : mode\n  syncHaulageOptionalLines()\n}\n\nwatch(\n  () => [form.dangerousCargo, form.overweight, form.merchantHaulage, form.carrierHaulage, form.portHandlingMode] as const,\n  () => syncHaulageOptionalLines(),\n)`,
        'condition synchronization functions',
      )

      const supportHeading = `            <div>\n              <p class="font-black">Documentos de respaldo de la solicitud</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Imágenes, PDF, Word y Excel quedan guardados en Storage y vinculados a esta solicitud.</p>\n            </div>`
      const pricingPortHandlingCard = `            <div v-if="!sellerRequestMode && shipmentModeForApi !== 'Lcl'" class="mb-4 space-y-3 rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[var(--dh-card)] p-4">\n              <div>\n                <p class="font-black">Muellaje en destino</p>\n                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Seleccione Anticipado o Redestino cuando corresponda.</p>\n              </div>\n              <div class="grid gap-3 sm:grid-cols-2">\n                <button type="button" class="crystal-flag" :class="form.portHandlingMode === 'Anticipado' ? 'crystal-flag--active' : ''" @click="togglePortHandlingMode('Anticipado')">\n                  <Check v-if="form.portHandlingMode === 'Anticipado'" class="h-4 w-4" /> Anticipado\n                </button>\n                <button type="button" class="crystal-flag" :class="form.portHandlingMode === 'Redestino' ? 'crystal-flag--active' : ''" @click="togglePortHandlingMode('Redestino')">\n                  <Check v-if="form.portHandlingMode === 'Redestino'" class="h-4 w-4" /> Redestino\n                </button>\n              </div>\n            </div>\n\n${supportHeading}`
      code = replaceRequired(code, supportHeading, pricingPortHandlingCard, 'pricing port handling card')

      return { code, map: null }
    },
  }
}

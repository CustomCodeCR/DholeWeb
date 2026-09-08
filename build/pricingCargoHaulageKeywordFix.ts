import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingCargoHaulageKeywordFix] Missing ${label} anchor.`)
  }

  return source.replace(anchor, replacement)
}

export function pricingCargoHaulageKeywordFix(): Plugin {
  return {
    name: 'dhole-pricing-cargo-haulage-keyword-fix',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null

      let code = source

      code = replaceRequired(
        code,
        `function haulageAssociation(line: { name: string }) {\n  const value = normalizeCatalogValue(line.name)\n  if (value.includes('inland gam naviera') || value.includes('carrier haulage')) return 'carrier'\n  if (value.includes('inland gam merchant') || value.includes('merchant haulage') || value === 'gate') return 'merchant'\n  return null\n}`,
        `function haulageAssociation(line: { name: string }) {\n  const value = normalizeCatalogValue(line.name)\n  // La asociación no depende de un nombre exacto del costo. Cualquier línea cuyo\n  // nombre contenga Naviera/Carrier o Merchant pertenece a ese tipo de haulage.\n  if (value.includes('naviera') || value.includes('carrier')) return 'carrier'\n  if (value.includes('merchant') || value === 'gate') return 'merchant'\n  return null\n}\n\nfunction cargoConditionSelection(line: { name: string; notes?: string | null }) {\n  const value = normalizeCatalogValue(\`${'${line.name}'} ${'${line.notes ?? \'\'}'}\`)\n  if (value.includes('carga peligrosa') || value.includes('dangerous') || value.includes('hazmat')) {\n    return form.dangerousCargo\n  }\n  if (value.includes('sobrepeso') || value.includes('overweight') || value.includes('over weight')) {\n    return form.overweight\n  }\n  return null\n}\n\nfunction shouldIncludeOptionalCost(line: { name: string; notes?: string | null }) {\n  const cargoSelected = cargoConditionSelection(line)\n  if (cargoSelected === false) return false\n\n  const association = haulageAssociation(line)\n  if (association === 'merchant') return form.merchantHaulage\n  if (association === 'carrier') return form.carrierHaulage\n\n  // Un recargo genérico de sobrepeso/carga peligrosa que no indica Merchant o\n  // Naviera sigue la selección de la condición de carga. Otros opcionales siguen\n  // siendo manuales.\n  return cargoSelected === true\n}`,
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
        `    const cargoSelected = cargoConditionSelection(line)\n    line.included = cargoSelected !== false && (\n      (association === 'merchant' && form.merchantHaulage) ||\n      (association === 'carrier' && form.carrierHaulage)\n    )`,
        'haulage optional line synchronization',
      )

      code = replaceRequired(
        code,
        `    if (!line.optional) return false\n    const association = haulageAssociation(line)`,
        `    if (!line.optional) return false\n    if (cargoConditionSelection(line) === false) return false\n    const association = haulageAssociation(line)`,
        'optional line visibility',
      )

      return { code, map: null }
    },
  }
}

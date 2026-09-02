import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const LCL_SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardLclCorrections] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  const visibleTitlesAnchor = "const visibleStepTitles = computed(() => props.viewOnly ? [...stepTitles, 'Vista completa'] : stepTitles)"
  const visibleTitlesReplacement = `const visibleStepTitles = computed(() => {\n  const titles = [...stepTitles]\n  if (form.shipmentMode.trim().toUpperCase() === 'LCL') titles[2] = 'Ruta'\n  return props.viewOnly ? [...titles, 'Vista completa'] : titles\n})`
  code = replaceOne(code, visibleTitlesAnchor, visibleTitlesReplacement, 'dynamic LCL step title')

  const selectedEquipmentAnchor = 'const selectedEquipment = computed(() => findById(equipmentSource.value, form.equipmentId))'
  const selectedEquipmentReplacement = `const selectedEquipment = computed(() => {\n  const selected = findById(equipmentSource.value, form.equipmentId)\n  if (selected || form.shipmentMode.trim().toUpperCase() !== 'LCL') return selected\n\n  // LCL is sold by cargo/CBM, not by a user-selected container. Pricing still\n  // keeps a legacy container snapshot in the rate payload, so resolve it\n  // internally without exposing container size/type/quantity in the wizard.\n  const explicitlyLcl = equipmentSource.value.find((item) => {\n    const meta = metadata(item)\n    const modes = Array.isArray(meta?.shipmentModes) ? meta.shipmentModes : []\n    const text = normalizeCatalogValue([item.code, item.slug, item.label, displayValue(item)].filter(Boolean).join(' '))\n    return modes.some((mode) => String(mode).trim().toUpperCase() === 'LCL')\n      || text.includes('lcl')\n      || text.includes('consolid')\n      || text.includes('loose')\n  })\n\n  return explicitlyLcl ?? equipmentSource.value[0] ?? catalogs.containers[0] ?? null\n})`
  code = replaceOne(code, selectedEquipmentAnchor, selectedEquipmentReplacement, 'internal LCL equipment resolver')

  const canNextEquipmentAnchor = `      selectedEquipment.value &&\n      form.equipmentQuantity > 0 &&`
  const canNextEquipmentReplacement = `      (shipmentModeForApi.value === 'Lcl' || (selectedEquipment.value && form.equipmentQuantity > 0)) &&`
  code = replaceOne(code, canNextEquipmentAnchor, canNextEquipmentReplacement, 'LCL route validation without equipment')

  const step3HeadingAnchor = `            <h2 class="crystal-title">{{ form.modality === 'Land' ? 'Ruta, furgón, Incoterm y servicios' : 'Ruta, equipo, Incoterm y servicios' }}</h2>`
  const step3HeadingReplacement = `            <h2 class="crystal-title">{{ shipmentModeForApi === 'Lcl' ? 'Ruta, Incoterm y servicios' : form.modality === 'Land' ? 'Ruta, furgón, Incoterm y servicios' : 'Ruta, equipo, Incoterm y servicios' }}</h2>`
  code = replaceOne(code, step3HeadingAnchor, step3HeadingReplacement, 'Pantalla 3 LCL heading')

  const equipmentBlockAnchor = `            <!-- Fila 3: tamaño, tipo y cantidad del equipo. -->\n            <div class="grid gap-4 md:grid-cols-3">`
  const equipmentBlockReplacement = `            <!-- Fila 3: equipo aplica solamente a FCL/FTL/LTL. LCL se cotiza por carga/CBM. -->\n            <div v-if="shipmentModeForApi !== 'Lcl'" class="grid gap-4 md:grid-cols-3">`
  code = replaceOne(code, equipmentBlockAnchor, equipmentBlockReplacement, 'hide LCL equipment fields')

  const summaryAnchor = `{{ direction }} · {{ form.modality }} · {{ form.shipmentMode }} · {{ displayValue(selectedEquipment) }} · {{ displayValue(selectedIncoterm) }}`
  const summaryReplacement = `{{ [direction, form.modality, form.shipmentMode, shipmentModeForApi === 'Lcl' ? null : displayValue(selectedEquipment), displayValue(selectedIncoterm)].filter(Boolean).join(' · ') }}`
  code = replaceOne(code, summaryAnchor, summaryReplacement, 'LCL summary without equipment')

  return code
}

function patchLclSelector(source: string) {
  let code = source

  const crDestinationAnchor = `  if (value.includes('costa rica') || value.includes('san jose') || value.includes('san josé')) return 'CR'`
  const crDestinationReplacement = `  if (value.includes('costa rica') || value.includes('san jose') || value.includes('san josé') || value.includes('caldera') || value.includes('limon') || value.includes('limón') || value.includes('moin') || value.includes('moín')) return 'CR'`
  code = replaceOne(code, crDestinationAnchor, crDestinationReplacement, 'Costa Rica LCL destination aliases')

  const chinaOriginAnchor = `const chinaOwnLclOrigins = new Set([\n  'shanghai', 'ningbo', 'qingdao', 'xiamen', 'shantou', 'dalian',\n  'chongqing', 'fuzhou', 'shenzhen', 'xingang', 'shekou', 'guangzhou',\n])\n\nfunction ownConsolidationSupportsPol(row: OwnLclConsolidationDto, pol: string) {\n  if (!pol || normalize(row.polCode) === pol) return true\n  return normalize(row.polCode) === 'shanghai' && chinaOwnLclOrigins.has(pol)\n}`
  const chinaOriginReplacement = `const chinaOwnLclOrigins = new Set([\n  'shanghai', 'ningbo', 'qingdao', 'xiamen', 'shantou', 'dalian',\n  'chongqing', 'fuzhou', 'shenzhen', 'xingang', 'shekou', 'guangzhou',\n])\n\nconst chinaOwnLclOriginAliases: Record<string, string> = {\n  shanghai: 'shanghai',\n  cnsha: 'shanghai',\n  ningbo: 'ningbo',\n  cnngb: 'ningbo',\n  qingdao: 'qingdao',\n  cnqng: 'qingdao',\n  xiamen: 'xiamen',\n  cnxmn: 'xiamen',\n  shantou: 'shantou',\n  cnswa: 'shantou',\n  dalian: 'dalian',\n  cndlc: 'dalian',\n  chongqing: 'chongqing',\n  cnckg: 'chongqing',\n  fuzhou: 'fuzhou',\n  cnfoc: 'fuzhou',\n  shenzhen: 'shenzhen',\n  cnszx: 'shenzhen',\n  xingang: 'xingang',\n  tianjin: 'xingang',\n  cntsn: 'xingang',\n  shekou: 'shekou',\n  cnshk: 'shekou',\n  guangzhou: 'guangzhou',\n  cncan: 'guangzhou',\n}\n\nfunction canonicalChinaOwnLclOrigin(value: unknown) {\n  const key = normalize(value).replace(/[^a-z0-9]/g, '')\n  return chinaOwnLclOriginAliases[key] ?? key\n}\n\nfunction ownConsolidationSupportsPol(row: OwnLclConsolidationDto, pol: string) {\n  if (!pol) return true\n\n  const requestedOrigin = canonicalChinaOwnLclOrigin(pol)\n  const consolidationOrigins = [row.polCode, row.polName]\n    .map(canonicalChinaOwnLclOrigin)\n    .filter(Boolean)\n\n  if (consolidationOrigins.includes(requestedOrigin)) return true\n\n  // Consolidado propio China: la base marítima es Shanghai → Balboa.\n  // Otros POL de China (Ningbo, Qingdao, etc.) se valorizan por la matriz\n  // de origen y deben poder seleccionar ese mismo consolidado Shanghai.\n  return consolidationOrigins.includes('shanghai') && chinaOwnLclOrigins.has(requestedOrigin)\n}`
  code = replaceOne(code, chinaOriginAnchor, chinaOriginReplacement, 'China own LCL POL aliases')

  return code
}

export function pricingWizardLclCorrections(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-corrections',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      if (normalizedId.endsWith(LCL_SELECTOR_PATH)) return { code: patchLclSelector(source), map: null }
      return null
    },
  }
}

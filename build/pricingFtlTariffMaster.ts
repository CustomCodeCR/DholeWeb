import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const ROUTER_PATH = '/src/core/router/index.ts'
const SIDEBAR_PATH = '/src/core/composables/useSidebarItems.ts'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingFtlTariffMaster] ${label} anchor not found.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceRequired(
    code,
    `import { PricingService } from '@/core/services/pricingService'`,
    `import { PricingService } from '@/core/services/pricingService'\nimport { FtlTariffService } from '@/core/services/ftlTariffService'`,
    'FTL tariff service import',
  )

  const applicableAnchor = `function applicableCost(cost: CostSelectDto) {`
  code = replaceRequired(
    code,
    applicableAnchor,
    `function selectedFtlEquipmentClass() {\n  const equipment = selectedEquipment.value\n  if (!equipment) return ''\n  const text = normalizeCatalogValue([\n    equipment.code,\n    equipment.slug,\n    equipment.label,\n    displayValue(equipment),\n    equipment.metadataJson,\n  ].filter(Boolean).join(' '))\n\n  if (/(^|[^0-9])(48|53)([^0-9]|$)/.test(text)) return '48_53'\n  if (/(^|[^0-9])(5|6|7)([^0-9]|$).*\\b(ton|tons|tonelada|toneladas)\\b/.test(text)) return '5_7_TON'\n  if (/\\b(ton|tons|tonelada|toneladas)\\b.*(^|[^0-9])(5|6|7)([^0-9]|$)/.test(text)) return '5_7_TON'\n  if (/5\\s*(a|-|\\/)\\s*7/.test(text)) return '5_7_TON'\n  return ''\n}\n\n${applicableAnchor}`,
    'FTL equipment helper',
  )

  const searchStart = `async function searchApprovedRates() {`
  const searchIndex = code.indexOf(searchStart)
  if (searchIndex < 0) throw new Error('[pricingFtlTariffMaster] searchApprovedRates anchor not found.')
  const firstGuardIndex = code.indexOf(`\n  if (`, searchIndex + searchStart.length)
  if (firstGuardIndex < 0) throw new Error('[pricingFtlTariffMaster] searchApprovedRates first guard not found.')

  const ftlSearchBranch = `\n  if (shipmentModeForApi.value === 'Ftl') {\n    form.manualRate = true\n    const equipmentClass = selectedFtlEquipmentClass()\n\n    if (!equipmentClass) {\n      form.freightCost = 0\n      form.freightSale = 0\n      form.transitDays = 0\n      toastStore.warning('Equipo FTL sin equivalencia', 'No se pudo determinar si el equipo corresponde a 48/53 pies o 5–7 toneladas.')\n      return\n    }\n\n    try {\n      const configured = await FtlTariffService.resolve({\n        originId: form.originId || null,\n        destinationId: form.destinationId || null,\n        originName: selectedOrigin.value ? displayValue(selectedOrigin.value) : null,\n        destinationName: selectedDestination.value ? displayValue(selectedDestination.value) : null,\n        equipmentClass,\n      })\n\n      if (configured) {\n        form.freightCost = number(configured.priceAmount)\n        form.freightSale = number(configured.priceAmount)\n        form.transitDays = configured.transitDays ?? 0\n        if (configured.currencyId) form.currencyId = configured.currencyId\n      } else {\n        form.freightCost = 0\n        form.freightSale = 0\n        form.transitDays = 0\n        toastStore.warning('Tarifa FTL no configurada', 'No existe una tarifa maestra para la ruta y el equipo seleccionados.')\n      }\n    } catch (error) {\n      form.freightCost = 0\n      form.freightSale = 0\n      form.transitDays = 0\n      toastStore.backendError(error, 'No se pudo consultar la matriz maestra de tarifas FTL.')\n    }\n    return\n  }\n`

  code = code.slice(0, firstGuardIndex) + ftlSearchBranch + code.slice(firstGuardIndex)

  return code
}

function patchRouter(source: string) {
  if (source.includes(`path: 'pricing/ftl-tariffs'`)) return source

  const pathIndex = source.indexOf(`path: 'pricing/costs'`)
  if (pathIndex < 0) throw new Error('[pricingFtlTariffMaster] pricing costs route not found.')
  const blockStart = source.lastIndexOf('{', pathIndex)
  if (blockStart < 0) throw new Error('[pricingFtlTariffMaster] pricing costs route block not found.')

  const ftlRoute = `        {\n          path: 'pricing/ftl-tariffs',\n          name: 'pricing-ftl-tariffs',\n          component: () => import('@/modules/pricing/views/PricingFtlTariffsView.vue'),\n          meta: {\n            tabTitle: 'Tarifas FTL',\n            closable: true,\n            requiredScope: VIEW_SCOPES.pricingCosts,\n          },\n        },\n`

  return source.slice(0, blockStart) + ftlRoute + source.slice(blockStart)
}

function patchSidebar(source: string) {
  let code = source

  if (!/\bTruck\b/.test(code.slice(0, code.indexOf(`} from 'lucide-vue-next'`)))) {
    const importEnd = code.indexOf(`} from 'lucide-vue-next'`)
    if (importEnd < 0) throw new Error('[pricingFtlTariffMaster] lucide import end not found.')
    code = code.slice(0, importEnd) + `  Truck,\n` + code.slice(importEnd)
  }

  if (code.includes(`to: '/pricing/ftl-tariffs'`)) return code

  const pathIndex = code.indexOf(`to: '/pricing/costs'`)
  if (pathIndex < 0) throw new Error('[pricingFtlTariffMaster] pricing costs sidebar item not found.')
  const blockStart = code.lastIndexOf('{', pathIndex)
  if (blockStart < 0) throw new Error('[pricingFtlTariffMaster] pricing costs sidebar block not found.')

  const ftlItem = `          {\n            labelKey: 'Tarifas FTL',\n            icon: Truck,\n            to: '/pricing/ftl-tariffs',\n            name: 'pricing-ftl-tariffs',\n            requiredScope: VIEW_SCOPES.pricingCosts,\n          },\n`

  return code.slice(0, blockStart) + ftlItem + code.slice(blockStart)
}

export function pricingFtlTariffMaster(): Plugin {
  return {
    name: 'dhole-pricing-ftl-tariff-master',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      if (normalizedId.endsWith(ROUTER_PATH)) return { code: patchRouter(source), map: null }
      if (normalizedId.endsWith(SIDEBAR_PATH)) return { code: patchSidebar(source), map: null }
      return null
    },
  }
}

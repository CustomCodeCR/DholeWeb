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
    `import { PricingService } from '@/core/services/pricingService'\nimport { FtlTariffService, type FtlTariffDto } from '@/core/services/ftlTariffService'`,
    'FTL tariff service import',
  )

  code = replaceRequired(
    code,
    `const rateCarrierFilter = ref('')`,
    `const rateCarrierFilter = ref('')\nconst resolvedFtlTariff = ref<FtlTariffDto | null>(null)`,
    'FTL tariff selection state',
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

  const ftlSearchBranch = `\n  if (shipmentModeForApi.value === 'Ftl') {\n    resolvedFtlTariff.value = null\n    form.manualRate = false\n    const equipmentClass = selectedFtlEquipmentClass()\n\n    if (!equipmentClass) {\n      form.manualRate = true\n      form.freightCost = 0\n      form.freightSale = 0\n      form.transitDays = 0\n      toastStore.warning('Equipo FTL sin equivalencia', 'No se pudo determinar si el equipo corresponde a 48/53 pies o 5–7 toneladas.')\n      return\n    }\n\n    try {\n      loadingRates.value = true\n      const configured = await FtlTariffService.resolve({\n        originId: form.originId || null,\n        destinationId: form.destinationId || null,\n        originName: selectedOrigin.value ? displayValue(selectedOrigin.value) : null,\n        destinationName: selectedDestination.value ? displayValue(selectedDestination.value) : null,\n        originCode: selectedOrigin.value?.code ?? null,\n        destinationCode: selectedDestination.value?.code ?? null,\n        equipmentClass,\n      })\n\n      if (configured) {\n        resolvedFtlTariff.value = configured\n        form.manualRate = false\n        form.freightCost = number(configured.priceAmount)\n        form.freightSale = number(configured.priceAmount)\n        form.transitDays = configured.transitDays ?? 0\n        if (configured.currencyId) form.currencyId = configured.currencyId\n      } else {\n        form.manualRate = true\n        form.freightCost = 0\n        form.freightSale = 0\n        form.transitDays = 0\n        toastStore.warning('Tarifa FTL no configurada', 'No existe una tarifa maestra activa para la ruta y el equipo seleccionados.')\n      }\n    } catch (error) {\n      form.manualRate = true\n      form.freightCost = 0\n      form.freightSale = 0\n      form.transitDays = 0\n      toastStore.backendError(error, 'No se pudo consultar la matriz maestra de tarifas FTL.')\n    } finally {\n      loadingRates.value = false\n    }\n    return\n  }\n`

  code = code.slice(0, firstGuardIndex) + ftlSearchBranch + code.slice(firstGuardIndex)

  const ratesTemplateAnchor = `          <template v-else-if="availableRates.length">`
  const ftlTemplate = `          <template v-else-if="shipmentModeForApi === 'Ftl' && resolvedFtlTariff">\n            <div class="grid gap-4 lg:grid-cols-2">\n              <button\n                type="button"\n                class="crystal-rate-card crystal-rate-card--active text-left"\n                @click="form.manualRate = false"\n              >\n                <div class="flex flex-wrap items-start justify-between gap-3">\n                  <div>\n                    <p class="font-black">Tarifa terrestre FTL</p>\n                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">\n                      {{ resolvedFtlTariff.originName }} → {{ resolvedFtlTariff.destinationName }} · {{ resolvedFtlTariff.equipmentLabel }}\n                    </p>\n                  </div>\n                  <DhBadge variant="success">Matriz maestra</DhBadge>\n                </div>\n                <p class="mt-5 text-2xl font-black">\n                  {{ formatMoney(resolvedFtlTariff.priceAmount, resolvedFtlTariff.currencyCode || resolvedFtlTariff.currencyName || 'USD') }}\n                </p>\n                <div class="mt-4 grid gap-2 sm:grid-cols-2">\n                  <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2">\n                    <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Tránsito</span>\n                    <strong class="mt-1 block text-sm">{{ resolvedFtlTariff.transitDays != null ? resolvedFtlTariff.transitDays + ' días' : 'Por confirmar' }}</strong>\n                  </div>\n                  <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2">\n                    <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Fuente</span>\n                    <strong class="mt-1 block text-sm">{{ resolvedFtlTariff.source || 'Pricing FTL' }}</strong>\n                  </div>\n                </div>\n                <p v-if="resolvedFtlTariff.notes" class="mt-3 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold text-[var(--dh-text-muted)]">\n                  {{ resolvedFtlTariff.notes }}\n                </p>\n              </button>\n            </div>\n            <div class="flex flex-wrap justify-end gap-2">\n              <DhButton variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>\n              <DhButton @click="next">Usar tarifa FTL</DhButton>\n            </div>\n          </template>\n\n${ratesTemplateAnchor}`
  code = replaceRequired(code, ratesTemplateAnchor, ftlTemplate, 'FTL screen 5 tariff card')

  const titleAnchor = `<h2 class="crystal-title">Tarifas pre-aprobadas disponibles</h2>`
  if (code.includes(titleAnchor)) {
    code = code.replace(
      titleAnchor,
      `<h2 class="crystal-title">{{ shipmentModeForApi === 'Ftl' ? 'Tarifa terrestre disponible' : 'Tarifas pre-aprobadas disponibles' }}</h2>`,
    )
  }

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
    enforce: 'pre',
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

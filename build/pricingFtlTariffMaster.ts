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
    `import { PricingService } from '@/core/services/pricingService'\nimport { FtlTariffService, type FtlTariffDto, type LandCommercialProfile } from '@/core/services/ftlTariffService'`,
    'FTL tariff service import',
  )

  code = replaceRequired(
    code,
    `const rateCarrierFilter = ref('')`,
    `const rateCarrierFilter = ref('')\nconst resolvedFtlTariff = ref<FtlTariffDto | null>(null)\nconst landLtlCommercialProfile = ref<LandCommercialProfile | ''>('')`,
    'FTL tariff selection state',
  )

  const applicableAnchor = `function applicableCost(cost: CostSelectDto) {`
  code = replaceRequired(
    code,
    applicableAnchor,
    `function isPanamaLandLtlTariff(tariff: FtlTariffDto) {\n  const route = normalizeCatalogValue(tariff.originName + ' ' + (tariff.originCode ?? ''))\n  return route.includes('panama') || route.includes('cfz') || route.includes('colon free zone')\n}\n\nfunction landLtlBillableCbm(tariff: FtlTariffDto) {\n  const factor = Math.max(1, number(tariff.weightKgPerCbm) || 330)\n  const weightCbm = Math.max(0, number(form.cargoWeightKg)) / factor\n  const calculated = Math.max(number(lclDimensionalCbm.value), weightCbm)\n  return calculated > 0 ? Math.max(1, calculated) : 0\n}\n\nfunction applyResolvedLandLtlFreight() {\n  if (shipmentModeForApi.value !== 'Ltl' || !resolvedFtlTariff.value) return\n  const tariff = resolvedFtlTariff.value\n  const cbm = landLtlBillableCbm(tariff)\n  const panamaSurcharge = isPanamaLandLtlTariff(tariff) ? number(tariff.panamaCostSurchargePerCbm ?? 9) : 0\n  const effectiveCostPerCbm = number(tariff.costPerCbm) + panamaSurcharge\n  const cost = effectiveCostPerCbm * cbm\n  const sale = Math.max(\n    number(tariff.priceAmount) * cbm,\n    number(tariff.minimumAmount),\n  )\n  form.freightCost = cost\n  form.freightSale = sale\n}\n\nasync function chooseLandLtlCommercialProfile(profile: LandCommercialProfile) {\n  if (profile === landLtlCommercialProfile.value && resolvedFtlTariff.value) return\n  landLtlCommercialProfile.value = profile\n  await searchApprovedRates()\n}\n\n${applicableAnchor}`,
    'land tariff helpers',
  )

  const searchStart = `async function searchApprovedRates() {`
  const searchIndex = code.indexOf(searchStart)
  if (searchIndex < 0) throw new Error('[pricingFtlTariffMaster] searchApprovedRates anchor not found.')
  const firstGuardIndex = code.indexOf(`\n  if (`, searchIndex + searchStart.length)
  if (firstGuardIndex < 0) throw new Error('[pricingFtlTariffMaster] searchApprovedRates first guard not found.')

  const ftlSearchBranch = `\n  if (form.modality === 'Land' && (shipmentModeForApi.value === 'Ftl' || shipmentModeForApi.value === 'Ltl')) {\n    resolvedFtlTariff.value = null\n    form.manualRate = false\n    const isLandLtl = shipmentModeForApi.value === 'Ltl'\n\n    if (isLandLtl && !landLtlCommercialProfile.value) {\n      form.manualRate = false\n      form.freightCost = 0\n      form.freightSale = 0\n      form.transitDays = 0\n      loadingRates.value = false\n      return\n    }\n\n    const equipmentClass = isLandLtl ? 'LTL_CBM' : (() => {\n      const equipment = selectedEquipment.value\n      if (!equipment) return ''\n      return String(equipment.code || displayValue(equipment) || equipment.slug || equipment.id).trim()\n    })()\n\n    if (!equipmentClass) {\n      form.manualRate = true\n      form.freightCost = 0\n      form.freightSale = 0\n      form.transitDays = 0\n      toastStore.warning('Furgón terrestre sin código', 'El furgón seleccionado en land-equipment-sizes no tiene un código o valor utilizable.')\n      return\n    }\n\n    try {\n      loadingRates.value = true\n      const configured = await FtlTariffService.resolve({\n        originId: form.originId || null,\n        destinationId: form.destinationId || null,\n        originName: selectedOrigin.value ? displayValue(selectedOrigin.value) : null,\n        destinationName: selectedDestination.value ? displayValue(selectedDestination.value) : null,\n        originCode: selectedOrigin.value?.code ?? null,\n        destinationCode: selectedDestination.value?.code ?? null,\n        equipmentClass,\n        shipmentMode: isLandLtl ? 'Ltl' : 'Ftl',\n        commercialProfile: isLandLtl ? landLtlCommercialProfile.value : 'General',\n        quoteDate: form.loadDate,\n      })\n\n      const configuredMatchesRoute = configured && (() => {\n        const selectedOriginId = String(form.originId || '').trim()\n        const selectedDestinationId = String(form.destinationId || '').trim()\n        const configuredOriginIds = new Set([configured.originId, ...(configured.applicableOriginIds ?? [])].filter(Boolean).map(String))\n        const configuredDestinationIds = new Set([configured.destinationId, ...(configured.applicableDestinationIds ?? [])].filter(Boolean).map(String))\n\n        const landRouteKey = (value: unknown) => {\n          const normalized = normalizeCatalogValue(String(value ?? ''))\n          if (\n            normalized.includes('cfz')\n            || normalized.includes('colon free zone')\n            || normalized.includes('zona libre de colon')\n          ) return 'cfz-panama'\n          return normalized\n        }\n\n        const selectedOriginName = landRouteKey(selectedOrigin.value ? displayValue(selectedOrigin.value) : '')\n        const selectedDestinationName = landRouteKey(selectedDestination.value ? displayValue(selectedDestination.value) : '')\n        const selectedOriginCode = landRouteKey(selectedOrigin.value?.code ?? '')\n        const selectedDestinationCode = landRouteKey(selectedDestination.value?.code ?? '')\n        const configuredOriginName = landRouteKey(configured.originName ?? '')\n        const configuredDestinationName = landRouteKey(configured.destinationName ?? '')\n        const configuredOriginCode = landRouteKey(configured.originCode ?? '')\n        const configuredDestinationCode = landRouteKey(configured.destinationCode ?? '')\n\n        const originMatchesById = Boolean(selectedOriginId) && configuredOriginIds.has(selectedOriginId)\n        const destinationMatchesById = Boolean(selectedDestinationId) && configuredDestinationIds.has(selectedDestinationId)\n        const originMatchesByRoute = Boolean(selectedOriginName) && configuredOriginName === selectedOriginName\n          || Boolean(selectedOriginCode) && configuredOriginCode === selectedOriginCode\n        const destinationMatchesByRoute = Boolean(selectedDestinationName) && configuredDestinationName === selectedDestinationName\n          || Boolean(selectedDestinationCode) && configuredDestinationCode === selectedDestinationCode\n\n        return (originMatchesById || originMatchesByRoute)\n          && (destinationMatchesById || destinationMatchesByRoute)\n      })()\n\n      if (configured && configuredMatchesRoute) {\n        resolvedFtlTariff.value = configured\n        form.manualRate = false\n        if (isLandLtl) {\n          applyResolvedLandLtlFreight()\n        } else {\n          form.freightCost = number(configured.priceAmount)\n          form.freightSale = number(configured.priceAmount)\n        }\n        form.transitDays = configured.transitDays ?? 0\n        if (configured.currencyId) form.currencyId = configured.currencyId\n      } else {\n        form.manualRate = true\n        form.freightCost = 0\n        form.freightSale = 0\n        form.transitDays = 0\n        toastStore.warning(\n          isLandLtl ? 'Tarifa LTL no configurada' : 'Tarifa FTL no configurada',\n          'No existe una tarifa maestra terrestre activa para la ruta, fecha y modalidad seleccionadas.',\n        )\n      }\n    } catch (error) {\n      form.manualRate = true\n      form.freightCost = 0\n      form.freightSale = 0\n      form.transitDays = 0\n      toastStore.backendError(error, 'No se pudo consultar el tarifario maestro terrestre.')\n    } finally {\n      loadingRates.value = false\n    }\n    return\n  }\n`

  code = code.slice(0, firstGuardIndex) + ftlSearchBranch + code.slice(firstGuardIndex)

  const ratesTemplateAnchor = `          <template v-else-if="availableRates.length">`
  const ftlTemplate = `          <template v-else-if="form.modality === 'Land' && (shipmentModeForApi === 'Ltl' || (shipmentModeForApi === 'Ftl' && resolvedFtlTariff))">
            <div v-if="shipmentModeForApi === 'Ltl'" class="mb-4 space-y-4 rounded-[22px] border border-[rgb(var(--dh-primary-rgb)/0.22)] bg-[rgb(var(--dh-primary-rgb)/0.05)] p-4">
              <div>
                <p class="font-black">Seleccione la fuente tarifaria LTL</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">La ruta y los datos de carga ya están definidos. Seleccione Consolidados propios o Coloaders para calcular la tarifa.</p>
              </div>
              <div class="grid gap-2 sm:grid-cols-2">
                <button type="button" class="crystal-choice min-h-[82px] text-left" :class="landLtlCommercialProfile === 'FinalClient' ? 'crystal-choice--active' : ''" @click="chooseLandLtlCommercialProfile('FinalClient')">
                  <strong>Consolidados propios</strong><span class="mt-1 block text-xs text-[var(--dh-text-muted)]">Tarifas LTL propias de Grupo Castro Fallas.</span>
                </button>
                <button type="button" class="crystal-choice min-h-[82px] text-left" :class="landLtlCommercialProfile === 'Nvocc' ? 'crystal-choice--active' : ''" @click="chooseLandLtlCommercialProfile('Nvocc')">
                  <strong>Coloaders</strong><span class="mt-1 block text-xs text-[var(--dh-text-muted)]">Tarifas LTL cargadas para proveedores coloader.</span>
                </button>
              </div>

              <div
                v-if="landLtlCommercialProfile === 'FinalClient'"
                class="flex flex-col gap-3 rounded-[18px] border border-dashed border-[rgb(var(--dh-primary-rgb)/0.35)] bg-[rgb(var(--dh-primary-rgb)/0.04)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p class="font-black">Tarifa LTL propia manual</p>
                  <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                    Siempre puede crear una tarifa propia manual, aunque exista una tarifa vigente para esta ruta.
                  </p>
                </div>
                <DhButton class="shrink-0" variant="secondary" @click="continueWithManualLandLtlTariff">
                  Crear tarifa manual
                </DhButton>
              </div>
            </div>
            <div v-if="shipmentModeForApi === 'Ltl' && !landLtlCommercialProfile" class="crystal-soft p-6 text-center">
              <p class="font-black">Seleccione Consolidados propios o Coloaders</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">La tarifa se consulta automáticamente para la ruta de esta cotización.</p>
            </div>
            <div v-else-if="shipmentModeForApi === 'Ltl' && loadingRates" class="py-10 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Calculando tarifa LTL…</div>
            <div v-else-if="resolvedFtlTariff" class="grid gap-4 lg:grid-cols-2">
              <button type="button" class="crystal-rate-card crystal-rate-card--active text-left" @click="form.manualRate = false">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="font-black">Tarifa terrestre {{ shipmentModeForApi.toUpperCase() }}<span v-if="shipmentModeForApi === 'Ltl'"> · {{ landLtlCommercialProfile === 'Nvocc' ? 'Coloader' : 'Propio' }}</span></p>
                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ resolvedFtlTariff.originName }} → {{ resolvedFtlTariff.destinationName }}<span v-if="shipmentModeForApi === 'Ftl'"> · {{ resolvedFtlTariff.equipmentLabel }}</span></p>
                  </div>
                  <DhBadge variant="success">Tarifario maestro</DhBadge>
                </div>
                <p class="mt-5 text-2xl font-black">
                  {{ formatMoney(resolvedFtlTariff.priceAmount, resolvedFtlTariff.currencyCode || resolvedFtlTariff.currencyName || 'USD') }}
                  <span v-if="shipmentModeForApi === 'Ltl'" class="text-sm text-[var(--dh-text-muted)]">/ CBM</span>
                </p>
                <p v-if="shipmentModeForApi === 'Ltl'" class="mt-1 text-xs font-bold text-[var(--dh-text-muted)]">
                  Mínimo: {{ formatMoney(resolvedFtlTariff.minimumAmount || 0, resolvedFtlTariff.currencyCode || 'USD') }}
                  · CBM tarifado: {{ landLtlBillableCbm(resolvedFtlTariff).toFixed(3) }}
                  · Venta calculada: {{ formatMoney(form.freightSale, resolvedFtlTariff.currencyCode || 'USD') }}
                  · Costo calculado: {{ formatMoney(form.freightCost, resolvedFtlTariff.currencyCode || 'USD') }}
                  · Peso: {{ number(resolvedFtlTariff.weightKgPerCbm || 330) }} kg/CBM
                </p>
                <div class="mt-4 grid gap-2 sm:grid-cols-2">
                  <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2">
                    <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Tránsito</span>
                    <strong class="mt-1 block text-sm">{{ resolvedFtlTariff.transitDays != null ? resolvedFtlTariff.transitDays + ' días' : 'Por confirmar' }}</strong>
                  </div>
                  <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2">
                    <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Fuente</span>
                    <strong class="mt-1 block text-sm">{{ resolvedFtlTariff.source || 'Pricing terrestre' }}</strong>
                  </div>
                </div>
                <p v-if="resolvedFtlTariff.warehouseName" class="mt-3 text-xs font-bold text-[var(--dh-text-muted)]">Almacén de ingreso: {{ resolvedFtlTariff.warehouseName }}</p>
              </button>
            </div>
            <div v-else-if="shipmentModeForApi === 'Ltl' && landLtlCommercialProfile" class="crystal-empty p-8 text-center">
              <p class="text-lg font-black">No existe tarifa LTL para esta combinación</p>
              <p class="mt-2 text-sm font-semibold text-[var(--dh-text-muted)]">No se encontró una tarifa activa de {{ landLtlCommercialProfile === 'Nvocc' ? 'Coloader' : 'Consolidado propio' }} para la ruta y fecha seleccionadas.</p>
            </div>
            <div v-if="resolvedFtlTariff" class="flex flex-wrap justify-end gap-2">
              <DhButton v-if="shipmentModeForApi === 'Ftl'" variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>
              <DhButton :disabled="shipmentModeForApi === 'Ltl' && lclChargeableCbm <= 0" @click="next">Usar tarifa {{ shipmentModeForApi.toUpperCase() }}</DhButton>
            </div>
          </template>

${ratesTemplateAnchor}`
  code = replaceRequired(code, ratesTemplateAnchor, ftlTemplate, 'FTL screen 5 tariff card')

  const titleAnchor = `<h2 class="crystal-title">Tarifas pre-aprobadas disponibles</h2>`
  if (code.includes(titleAnchor)) {
    code = code.replace(
      titleAnchor,
      `<h2 class="crystal-title">{{ shipmentModeForApi === 'Ltl' ? 'Seleccione la fuente tarifaria LTL' : form.modality === 'Land' && shipmentModeForApi === 'Ftl' ? 'Tarifa terrestre disponible' : 'Tarifas pre-aprobadas disponibles' }}</h2>`,
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

  const ftlRoute = `        {\n          path: 'pricing/ftl-tariffs',\n          name: 'pricing-ftl-tariffs',\n          component: () => import('@/modules/pricing/views/PricingFtlTariffsView.vue'),\n          meta: {\n            tabTitle: 'Tarifas terrestres',\n            closable: true,\n            requiredScope: VIEW_SCOPES.pricingCosts,\n          },\n        },\n`

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

  const ftlItem = `          {\n            labelKey: 'Tarifas terrestres',\n            icon: Truck,\n            to: '/pricing/ftl-tariffs',\n            name: 'pricing-ftl-tariffs',\n            requiredScope: VIEW_SCOPES.pricingCosts,\n          },\n`

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

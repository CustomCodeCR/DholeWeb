import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) throw new Error(`[pricingSellerRateRequestResponsibilities] Expected one ${label}, found ${count}.`)
  return source.replace(anchor, replacement)
}

function hideSellerHaulageFlag(source: string, field: 'merchantHaulage' | 'carrierHaulage') {
  const marker = `:class="form.${field} ? 'crystal-flag--active' : ''"`
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0 || source.indexOf(marker, markerIndex + marker.length) >= 0) {
    throw new Error(`[pricingSellerRateRequestResponsibilities] Expected one ${field} flag.`)
  }

  const start = source.lastIndexOf('<button', markerIndex)
  const end = source.indexOf('>', markerIndex)
  if (start < 0 || end < 0) throw new Error(`[pricingSellerRateRequestResponsibilities] Invalid ${field} button.`)

  const opening = source.slice(start, end + 1)
  let replacement = opening
  if (opening.includes(`v-if="shipmentModeForApi !== 'Lcl'"`)) {
    replacement = opening.replace(
      `v-if="shipmentModeForApi !== 'Lcl'"`,
      `v-if="!sellerRequestMode && shipmentModeForApi !== 'Lcl'"`,
    )
  } else if (!opening.includes('v-if=')) {
    replacement = opening.replace('<button ', '<button v-if="!sellerRequestMode" ')
  } else {
    throw new Error(`[pricingSellerRateRequestResponsibilities] Unexpected ${field} visibility condition.`)
  }

  return source.slice(0, start) + replacement + source.slice(end + 1)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `const rateRequestPriority = ref<SellerRateRequestPriority>('Green')`,
    `type SellerPortHandlingMode = 'Anticipado' | 'Redestino'\nconst sellerPortHandlingMode = ref<SellerPortHandlingMode | ''>('')\nconst requestedCargoReadyDate = ref('')\nconst requestedPortHandlingMode = ref<SellerPortHandlingMode | ''>('')\nconst rateRequestPriority = ref<SellerRateRequestPriority>('Green')`,
    'seller request state',
  )

  code = replaceOne(
    code,
    `<DhInput v-model="form.loadDate" type="date" label="Vigente desde / carga lista" />\n              <DhInput v-model="form.validTo" type="date" label="Vigente hasta" />`,
    `<DhInput v-model="form.loadDate" type="date" :label="sellerRequestMode ? 'Fecha de carga lista' : 'Vigente desde / carga lista'" />\n              <DhInput v-if="!sellerRequestMode" v-model="form.validTo" type="date" label="Vigente hasta" />`,
    'seller validity fields',
  )

  code = hideSellerHaulageFlag(code, 'merchantHaulage')
  code = hideSellerHaulageFlag(code, 'carrierHaulage')

  const supportHeading = `            <div>\n              <p class="font-black">Documentos de respaldo de la solicitud</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Imágenes, PDF, Word y Excel quedan guardados en Storage y vinculados a esta solicitud.</p>\n            </div>`
  const sellerHandlingCard = `            <div v-if="sellerRequestMode && shipmentModeForApi === 'Fcl'" class="mb-4 space-y-3 rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[var(--dh-card)] p-4">\n              <div>\n                <p class="font-black">Muellaje en destino</p>\n                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Ventas puede indicar si el movimiento será Anticipado o Redestino. La selección viaja a Pricing con la solicitud.</p>\n              </div>\n              <div class="grid gap-3 sm:grid-cols-2">\n                <button type="button" class="crystal-flag" :class="sellerPortHandlingMode === 'Anticipado' ? 'crystal-flag--active' : ''" @click="sellerPortHandlingMode = sellerPortHandlingMode === 'Anticipado' ? '' : 'Anticipado'">\n                  <Check v-if="sellerPortHandlingMode === 'Anticipado'" class="h-4 w-4" /> Anticipado\n                </button>\n                <button type="button" class="crystal-flag" :class="sellerPortHandlingMode === 'Redestino' ? 'crystal-flag--active' : ''" @click="sellerPortHandlingMode = sellerPortHandlingMode === 'Redestino' ? '' : 'Redestino'">\n                  <Check v-if="sellerPortHandlingMode === 'Redestino'" class="h-4 w-4" /> Redestino\n                </button>\n              </div>\n            </div>\n\n${supportHeading}`
  code = replaceOne(code, supportHeading, sellerHandlingCard, 'seller port handling card')

  code = replaceOne(
    code,
    `async function saveOpenRequest() {\n  const origin = selectedOrigin.value`,
    `async function saveOpenRequest() {\n  if (props.sellerRequestMode) {\n    // Ventas no define el proveedor del inland ni la vigencia comercial.\n    form.merchantHaulage = false\n    form.carrierHaulage = false\n    form.validTo = ''\n  }\n\n  const origin = selectedOrigin.value`,
    'seller request sanitization',
  )

  code = replaceOne(
    code,
    `            supportEntityId: supportEntityId.value,\n            supportDocuments: supportDocuments.value,`,
    `            supportEntityId: supportEntityId.value,\n            supportDocuments: supportDocuments.value,\n            sellerContext: {\n              cargoReadyDate: form.loadDate || null,\n              portHandlingMode: sellerPortHandlingMode.value || null,\n            },`,
    'seller context payload',
  )

  code = replaceOne(
    code,
    `    rateRequestPriority.value = 'Green'`,
    `    rateRequestPriority.value = 'Green'\n    sellerPortHandlingMode.value = ''`,
    'seller request reset',
  )

  code = replaceOne(
    code,
    `    if (request.payload?.form) Object.assign(form, request.payload.form)\n    if (request.payload?.supportEntityId) supportEntityId.value = request.payload.supportEntityId`,
    `    if (request.payload?.form) Object.assign(form, request.payload.form)\n    const sellerContext = (request.payload as unknown as { sellerContext?: { cargoReadyDate?: string | null; portHandlingMode?: SellerPortHandlingMode | null } } | null)?.sellerContext\n    requestedCargoReadyDate.value = sellerContext?.cargoReadyDate || form.loadDate || ''\n    requestedPortHandlingMode.value = sellerContext?.portHandlingMode || ''\n    if (!form.validTo && form.loadDate) form.validTo = addDaysIso(form.loadDate, 30)\n    if (request.payload?.supportEntityId) supportEntityId.value = request.payload.supportEntityId`,
    'seller context hydration',
  )

  const screen5Marker = `<h2 class="crystal-title">Tarifas pre-aprobadas disponibles</h2>`
  const pricingHandoff = `          <div v-if="rateRequestId" class="crystal-soft space-y-4 border border-[rgb(var(--dh-primary-rgb)/0.28)] p-4 md:p-5">\n            <div>\n              <p class="text-sm font-black">Datos definidos por Ventas</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Pricing recibe el tipo de contenedor, Incoterm, fecha de carga lista y la indicación de Anticipado/Redestino antes de seleccionar la tarifa.</p>\n            </div>\n            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">\n              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">\n                <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Contenedor</span>\n                <strong class="mt-1 block text-sm">{{ shipmentModeForApi === 'Lcl' ? 'LCL' : displayValue(selectedEquipment) || form.equipmentType || 'Por definir' }}</strong>\n              </div>\n              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">\n                <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Incoterm</span>\n                <strong class="mt-1 block text-sm">{{ displayValue(selectedIncoterm) || 'Por definir' }}</strong>\n              </div>\n              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">\n                <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Carga lista</span>\n                <strong class="mt-1 block text-sm">{{ requestedCargoReadyDate || 'No indicada' }}</strong>\n              </div>\n              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">\n                <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Muellaje</span>\n                <strong class="mt-1 block text-sm">{{ requestedPortHandlingMode || 'No indicado' }}</strong>\n              </div>\n            </div>\n\n            <div class="grid gap-4 md:grid-cols-2">\n              <DhInput v-model="form.loadDate" type="date" label="Vigente desde" />\n              <DhInput v-model="form.validTo" type="date" label="Vigente hasta" />\n            </div>\n\n            <div v-if="shipmentModeForApi === 'Fcl'" class="space-y-2">\n              <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Inland definido por Pricing</p>\n              <div class="grid gap-3 sm:grid-cols-2">\n                <button type="button" class="crystal-flag" :class="form.merchantHaulage ? 'crystal-flag--active' : ''" @click="toggleMerchantHaulage">\n                  <Check v-if="form.merchantHaulage" class="h-4 w-4" /> Merchant\n                </button>\n                <button type="button" class="crystal-flag" :class="form.carrierHaulage ? 'crystal-flag--active' : ''" @click="toggleCarrierHaulage">\n                  <Check v-if="form.carrierHaulage" class="h-4 w-4" /> Naviera\n                </button>\n              </div>\n            </div>\n          </div>`

  const markerIndex = code.indexOf(screen5Marker)
  if (markerIndex < 0 || code.indexOf(screen5Marker, markerIndex + screen5Marker.length) >= 0) {
    throw new Error('[pricingSellerRateRequestResponsibilities] Expected one screen 5 header.')
  }
  const headerCloseMarker = '          </div>'
  const headerClose = code.indexOf(headerCloseMarker, markerIndex + screen5Marker.length)
  if (headerClose < 0) {
    throw new Error('[pricingSellerRateRequestResponsibilities] Could not locate the screen 5 header closing element.')
  }
  const insertionPoint = headerClose + headerCloseMarker.length
  code = code.slice(0, insertionPoint) + `\n\n${pricingHandoff}` + code.slice(insertionPoint)

  return code
}

export function pricingSellerRateRequestResponsibilities(): Plugin {
  return {
    name: 'dhole-pricing-seller-rate-request-responsibilities',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (id.includes('?')) return null
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

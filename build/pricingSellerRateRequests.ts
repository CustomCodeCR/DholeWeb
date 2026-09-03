import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const RATES_PATH = '/src/modules/pricing/views/PricingRatesView.vue'
const ROUTER_PATH = '/src/core/router/index.ts'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) throw new Error(`[pricingSellerRateRequests] Expected one ${label}, found ${count}.`)
  return source.replace(anchor, replacement)
}

function replaceBetween(source: string, start: string, end: string, replacement: string, label: string) {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) throw new Error(`[pricingSellerRateRequests] Missing ${label} start.`)
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (endIndex < 0) throw new Error(`[pricingSellerRateRequests] Missing ${label} end.`)
  return source.slice(0, startIndex) + replacement + source.slice(endIndex)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `const props = withDefaults(defineProps<{ rateId?: string | null; viewOnly?: boolean }>(), {\n  rateId: null,\n  viewOnly: false,\n})`,
    `const props = withDefaults(defineProps<{\n  rateId?: string | null\n  viewOnly?: boolean\n  sellerRequestMode?: boolean\n  rateRequestId?: string | null\n}>(), {\n  rateId: null,\n  viewOnly: false,\n  sellerRequestMode: false,\n  rateRequestId: null,\n})`,
    'wizard props',
  )

  code = replaceOne(
    code,
    `const supportEntityId = ref(crypto.randomUUID())\nconst supportDocuments = ref<SupportDocument[]>([])`,
    `const supportEntityId = ref(crypto.randomUUID())\nconst supportDocuments = ref<SupportDocument[]>([])\ntype SellerRateRequestPriority = 'Green' | 'Yellow' | 'Red'\ninterface SellerRateRequestDto {\n  id: string\n  priority: SellerRateRequestPriority\n  status: string\n  rateId?: string | null\n  payload?: { form?: Record<string, unknown>; supportEntityId?: string; supportDocuments?: SupportDocument[] } | null\n}\nconst rateRequestPriority = ref<SellerRateRequestPriority>('Green')\nconst rateRequestPriorityOptions = [\n  { value: 'Green', label: 'Verde · máximo 24 horas' },\n  { value: 'Yellow', label: 'Amarillo · máximo 48 horas' },\n  { value: 'Red', label: 'Rojo · máximo 72 horas' },\n]`,
    'rate request state',
  )

  code = replaceOne(
    code,
    `const visibleStepTitles = computed(() => props.viewOnly ? [...stepTitles, 'Vista completa'] : stepTitles)`,
    `const visibleStepTitles = computed(() =>\n  props.sellerRequestMode\n    ? stepTitles.slice(0, 3)\n    : props.viewOnly\n      ? [...stepTitles, 'Vista completa']\n      : stepTitles,\n)`,
    'visible step titles',
  )

  code = replaceOne(
    code,
    `const pageTitle = computed(() => isEditing.value ? (props.viewOnly ? 'Visualizar tarifa' : 'Editar tarifa') : 'Seleccionar alternativa')\nconst pageDescription = computed(() => isEditing.value\n  ? 'Toda la tarifa se revisa en el mismo wizard. Las tarifas aceptadas crean una nueva revisión al guardar.'\n  : 'Construya la alternativa paso a paso con catálogos filtrados por modalidad.')`,
    `const pageTitle = computed(() =>\n  props.sellerRequestMode\n    ? 'Solicitud de tarifa para Pricing'\n    : props.rateRequestId\n      ? 'Completar solicitud de tarifa'\n      : isEditing.value\n        ? (props.viewOnly ? 'Visualizar tarifa' : 'Editar tarifa')\n        : 'Seleccionar alternativa',\n)\nconst pageDescription = computed(() =>\n  props.sellerRequestMode\n    ? 'Ventas completa únicamente las pantallas 0 a 3. Pricing recibe la solicitud y continúa desde la pantalla 4.'\n    : props.rateRequestId\n      ? 'Solicitud creada por Ventas. Continúe desde la pantalla 4 hasta completar y enviar la tarifa.'\n      : isEditing.value\n        ? 'Toda la tarifa se revisa en el mismo wizard. Las tarifas aceptadas crean una nueva revisión al guardar.'\n        : 'Construya la alternativa paso a paso con catálogos filtrados por modalidad.',\n)`,
    'page title',
  )

  code = replaceBetween(
    code,
    `async function saveOpenRequest() {`,
    `\n\nasync function saveRate() {`,
    `async function saveOpenRequest() {\n  const origin = selectedOrigin.value\n  const destination = selectedDestination.value\n  const equipment = selectedEquipment.value\n  const incoterm = selectedIncoterm.value\n\n  if (!origin || !destination || !equipment || !incoterm) {\n    toastStore.error('Complete las pantallas 0 a 3 antes de enviar la solicitud a Pricing.')\n    return\n  }\n\n  try {\n    saving.value = true\n    const response = await callEndpoint<unknown, Record<string, unknown>>(\n      { method: 'POST', path: '/api/pricing/rate-requests', headers: { Accept: 'application/json' } },\n      {\n        body: {\n          priority: rateRequestPriority.value,\n          clientName: form.clientName.trim() || null,\n          executiveName: form.executiveName.trim() || null,\n          shipmentMode: shipmentModeForApi.value,\n          originName: displayValue(origin),\n          destinationName: displayValue(destination),\n          payload: {\n            form: JSON.parse(JSON.stringify(form)),\n            supportEntityId: supportEntityId.value,\n            supportDocuments: supportDocuments.value,\n          },\n        },\n      },\n    )\n    const requestId = unwrapApiResponse<string>(response as never)\n    const sla = rateRequestPriority.value === 'Green' ? '24 horas' : rateRequestPriority.value === 'Yellow' ? '48 horas' : '72 horas'\n    toastStore.success('Solicitud enviada a Pricing', 'Solicitud ' + requestId + ' · tiempo máximo ' + sla + '.')\n    resetWizard()\n    rateRequestPriority.value = 'Green'\n  } catch (error) {\n    toastStore.backendError(error, 'No se pudo enviar la solicitud abierta a Pricing.')\n  } finally {\n    saving.value = false\n  }\n}\n\nasync function saveRate() {`,
    'save open request',
  )

  code = replaceOne(
    code,
    `    createdRateId.value = rateId\n    await router.push({ name: 'pricing-rates' })`,
    `    if (props.rateRequestId && !editingRate.value) {\n      await callEndpoint<unknown, { rateId: string }>(\n        { method: 'POST', path: '/api/pricing/rate-requests/' + props.rateRequestId + '/attach-rate', headers: { Accept: 'application/json' } },\n        { body: { rateId } },\n      )\n    }\n    createdRateId.value = rateId\n    await router.push({ name: 'pricing-rates' })`,
    'attach created rate',
  )

  code = replaceOne(
    code,
    `function modalityForRate(rate: RateDto): Modality {`,
    `async function hydrateRateRequest() {\n  if (!props.rateRequestId) return\n  try {\n    loadingExistingRate.value = true\n    const response = await callEndpoint<unknown>({\n      method: 'GET',\n      path: '/api/pricing/rate-requests/' + props.rateRequestId,\n      headers: { Accept: 'application/json' },\n    })\n    const request = unwrapApiResponse<SellerRateRequestDto>(response as never)\n    if (request.rateId) {\n      await router.replace({ name: 'pricing-rate-wizard', params: { rateId: request.rateId }, query: { mode: 'edit' } })\n      return\n    }\n    if (request.payload?.form) Object.assign(form, request.payload.form)\n    if (request.payload?.supportEntityId) supportEntityId.value = request.payload.supportEntityId\n    supportDocuments.value = Array.isArray(request.payload?.supportDocuments) ? request.payload.supportDocuments : []\n    rateRequestPriority.value = request.priority\n    step.value = 4\n  } catch (error) {\n    toastStore.backendError(error, 'No se pudo recuperar la solicitud enviada por Ventas.')\n    await router.push({ name: 'pricing-rates' })\n  } finally {\n    loadingExistingRate.value = false\n  }\n}\n\nfunction modalityForRate(rate: RateDto): Modality {`,
    'request hydration',
  )

  code = replaceOne(
    code,
    `  if (props.rateId || target <= step.value) step.value = target`,
    `  if (props.rateId || props.rateRequestId || target <= step.value) step.value = target`,
    'request step navigation',
  )

  code = replaceOne(
    code,
    `onMounted(async () => {\n  await loadCatalogs()\n  if (props.rateId) await hydrateExistingRate()\n  else await loadHaciendaExchangeRate(true)\n})`,
    `onMounted(async () => {\n  await loadCatalogs()\n  if (props.rateId) await hydrateExistingRate()\n  else if (props.rateRequestId) {\n    await hydrateRateRequest()\n    await loadHaciendaExchangeRate(true)\n  } else await loadHaciendaExchangeRate(true)\n})`,
    'mounted request hydration',
  )

  code = replaceOne(
    code,
    `<div v-else-if="step === 3" class="space-y-6">\n          <div>\n            <p class="crystal-kicker">Pantalla 3</p>\n            <h2 class="crystal-title">{{ form.modality === 'Land' ? 'Ruta, furgón, Incoterm y servicios' : 'Ruta, equipo, Incoterm y servicios' }}</h2>\n            <p class="crystal-description">Seleccione el POE. El POD es opcional; si existe una equivalencia clara, se sugiere automáticamente.</p>\n          </div>`,
    `<div v-else-if="step === 3" class="space-y-6">\n          <div>\n            <p class="crystal-kicker">Pantalla 3</p>\n            <h2 class="crystal-title">{{ form.modality === 'Land' ? 'Ruta, furgón, Incoterm y servicios' : 'Ruta, equipo, Incoterm y servicios' }}</h2>\n            <p class="crystal-description">Seleccione el POE. El POD es opcional; si existe una equivalencia clara, se sugiere automáticamente.</p>\n          </div>\n\n          <div v-if="sellerRequestMode" class="crystal-soft border border-[rgb(var(--dh-primary-rgb)/0.28)] p-4 md:p-5">\n            <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] md:items-end">\n              <div>\n                <p class="text-sm font-black">Tipo de tarifa / tiempo máximo</p>\n                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Verde: 24 horas · Amarillo: 48 horas · Rojo: 72 horas. Pricing atiende primero Verde, luego Amarillo y por último Rojo.</p>\n              </div>\n              <DhSelect v-model="rateRequestPriority" label="Tipo de tarifa" :options="rateRequestPriorityOptions" />\n            </div>\n          </div>`,
    'seller priority selector',
  )

  code = replaceOne(
    code,
    `      <DhButton v-if="isEditing && step < maxStep" :disabled="saving" @click="next">Siguiente <ChevronRight class="h-4 w-4" /></DhButton>\n      <DhButton v-else-if="!isEditing && step < 8 && ![1, 2, 5].includes(step)" :disabled="!canNext || loadingRates" @click="next">Continuar <ChevronRight class="h-4 w-4" /></DhButton>`,
    `      <DhButton v-if="sellerRequestMode && step === 3" :disabled="saving || !canNext" @click="saveOpenRequest"><Check class="h-4 w-4" /> {{ saving ? 'Enviando…' : 'Enviar solicitud a Pricing' }}</DhButton>\n      <DhButton v-else-if="isEditing && step < maxStep" :disabled="saving" @click="next">Siguiente <ChevronRight class="h-4 w-4" /></DhButton>\n      <DhButton v-else-if="!isEditing && step < 8 && ![1, 2, 5].includes(step)" :disabled="!canNext || loadingRates" @click="next">Continuar <ChevronRight class="h-4 w-4" /></DhButton>`,
    'seller final action',
  )

  return code
}

function patchRates(source: string) {
  let code = source
  code = replaceOne(
    code,
    `import PricingDuplicateRateModal from '@/modules/pricing/components/PricingDuplicateRateModal.vue'`,
    `import PricingDuplicateRateModal from '@/modules/pricing/components/PricingDuplicateRateModal.vue'\nimport PricingRateRequestsPanel from '@/modules/pricing/components/PricingRateRequestsPanel.vue'`,
    'request panel import',
  )
  code = replaceOne(
    code,
    `    <DhPageHeader\n      title="Tarifas oficiales"\n      subtitle="Seguimiento comercial únicamente por Abiertas, Enviadas, Vencidas, Aceptadas y No aceptadas."\n      :icon="ReceiptText"\n    />`,
    `    <DhPageHeader\n      title="Tarifas oficiales"\n      subtitle="Seguimiento comercial únicamente por Abiertas, Enviadas, Vencidas, Aceptadas y No aceptadas."\n      :icon="ReceiptText"\n    />\n\n    <PricingRateRequestsPanel />`,
    'request panel placement',
  )
  return code
}

function patchRouter(source: string) {
  const anchor = `        {\n          path: 'pricing/rates',\n          name: 'pricing-rates',`
  const routes = `        {\n          path: 'pricing/request-rate',\n          name: 'pricing-seller-rate-request',\n          component: () => import('@/modules/pricing/views/PricingSellerRateRequestView.vue'),\n          meta: {\n            tabTitle: 'Solicitar tarifa',\n            closable: true,\n            requiredScope: 'pricing.rate-request.create',\n          },\n        },\n        {\n          path: 'pricing/rate-requests/:requestId/wizard',\n          name: 'pricing-rate-request-resume',\n          component: () => import('@/modules/pricing/views/PricingRateRequestResumeView.vue'),\n          meta: {\n            tabTitle: 'Completar solicitud',\n            closable: true,\n            requiredScope: 'pricing.rate.update',\n          },\n        },\n${anchor}`
  return replaceOne(source, anchor, routes, 'request routes')
}

export function pricingSellerRateRequests(): Plugin {
  return {
    name: 'dhole-pricing-seller-rate-requests',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      if (normalizedId.endsWith(RATES_PATH)) return { code: patchRates(source), map: null }
      if (normalizedId.endsWith(ROUTER_PATH)) return { code: patchRouter(source), map: null }
      return null
    },
  }
}

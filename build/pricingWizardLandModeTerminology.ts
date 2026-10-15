import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const HANDOFF_START = '          <div v-if="rateRequestId" class="crystal-soft space-y-4 border border-[rgb(var(--dh-primary-rgb)/0.28)] p-4 md:p-5">'
const HANDOFF_END = '\n          </div>'
const STEP_SIX = '<div v-else-if="step === 6" class="space-y-6">'
const STEP_FOUR = '<div v-else-if="step === 4" class="space-y-6">'

// Sales provides steps 1-4. Pricing uses the same step 5-8 UI as new quotes.
// Preserve Sales information in form state instead of a second rate selector UI.
function removeRequestSpecificScreenFiveCard(source: string): string {
  const start = source.indexOf(HANDOFF_START)
  if (start < 0 || source.indexOf(HANDOFF_START, start + HANDOFF_START.length) >= 0) {
    throw new Error('[pricingWizardLandModeTerminology] Expected one seller handoff block')
  }
  const end = source.indexOf(HANDOFF_END, start + HANDOFF_START.length)
  if (end < 0) throw new Error('[pricingWizardLandModeTerminology] Unclosed seller handoff')
  return source.slice(0, start) + source.slice(end + HANDOFF_END.length)
}

function patchStepThreeForLand(source: string): string {
  const start = source.indexOf('<div v-else-if="step === 3"')
  const end = source.indexOf('<div v-else-if="step === 4"', start)
  if (start < 0 || end < 0) throw new Error('[pricingWizardLandModeTerminology] Missing route step')
  let block = source.slice(start, end)
  const replacements: Array<[string, string]> = [
    ['label="Origen (POL)"', ":label=\"form.modality === 'Land' ? 'Origen terrestre' : 'Origen (POL)'\""],
    ['label="Destino (POE)"', ":label=\"form.modality === 'Land' ? 'Destino terrestre' : 'Destino (POE)'\""],
    ['placeholder="Buscar puerto de origen"', ":placeholder=\"form.modality === 'Land' ? 'Buscar origen terrestre' : 'Buscar puerto de origen'\""],
    ['placeholder="Buscar puerto de salida"', ":placeholder=\"form.modality === 'Land' ? 'Buscar destino terrestre' : 'Buscar puerto de salida'\""],
  ]
  for (const [before, after] of replacements) {
    if (block.includes(before)) block = block.replace(before, after)
  }
  const podSelect = '<PricingLocationSearchSelect\n                v-model="form.podId"'
  if (block.includes(podSelect)) {
    block = block.replace(
      podSelect,
      '<PricingLocationSearchSelect\n                v-if="form.modality !== \'Land\'"\n                v-model="form.podId"',
    )
  }
  return source.slice(0, start) + block + source.slice(end)
}

function patchStepFiveHelp(source: string): string {
  const help = ": 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.'"
  if (!source.includes(help)) return source
  return source.replace(
    help,
    ": form.modality === 'Land' ? 'La búsqueda terrestre utiliza origen, destino, equipo y fecha de carga lista.' : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.'",
  )
}

// Both paths must let Pricing manage validity at step 6. Sales already provided
// the route and cargo-ready date, so returning to step 3 is not necessary.
function addSharedCommercialValidity(source: string): string {
  const start = source.indexOf(STEP_SIX)
  const end = start >= 0 ? source.indexOf(STEP_FOUR, start + STEP_SIX.length) : -1
  if (start < 0 || end < 0) {
    throw new Error('[pricingWizardLandModeTerminology] Missing provider and freight step')
  }
  const stepSix = source.slice(start, end)
  if (stepSix.includes('data-shared-pricing-validity')) return source
  const introEnd = stepSix.indexOf('\n          </div>', STEP_SIX.length)
  if (introEnd < 0) throw new Error('[pricingWizardLandModeTerminology] Missing step 6 heading')
  const point = start + introEnd + '\n          </div>'.length
  const inputs = [
    '',
    '          <div data-shared-pricing-validity class="crystal-soft grid gap-4 p-4 md:grid-cols-2 md:p-5">',
    '            <DhInput v-model="form.loadDate" type="date" label="Vigente desde / carga lista" />',
    '            <DhInput v-model="form.validTo" type="date" label="Vigente hasta" :min="form.loadDate || undefined" />',
    '          </div>',
  ].join('\n')
  return source.slice(0, point) + '\n' + inputs + source.slice(point)
}

const SALES_READ_ONLY_PREVIEW = "    <details v-if=\"rateRequestId && sellerHandoffSnapshot && step >= 5\" open class=\"rounded-[24px] border border-[rgb(var(--dh-primary-rgb)/0.3)] bg-[var(--dh-card)] p-4 md:p-5\">\n      <summary class=\"cursor-pointer text-sm font-black text-[var(--dh-text)]\">Información enviada por Ventas · pantallas 1–4 · ver datos, comentarios y adjuntos</summary>\n      <p class=\"mt-2 text-xs font-semibold text-[var(--dh-text-muted)]\">Registro original de la solicitud. La información se consulta sin modificarla; Pricing continúa cotizando en las mismas pantallas 5–8 de Crear tarifa.</p>\n      <div class=\"mt-4 grid gap-4 lg:grid-cols-2\">\n        <section class=\"space-y-2 rounded-xl border border-[var(--dh-border)] p-4\">\n          <p class=\"text-xs font-black uppercase text-[var(--dh-primary)]\">Pantalla 1 · Modalidad</p>\n          <p><strong>Modalidad:</strong> {{ sellerContextValue('modality') }}</p>\n          <p><strong>Tipo de embarque:</strong> {{ sellerContextValue('shipmentMode') }}</p>\n          <p><strong>Cliente:</strong> {{ sellerHandoffSnapshot.clientName || 'No indicado' }}</p>\n          <p><strong>Ejecutivo:</strong> {{ sellerHandoffSnapshot.executiveName || 'No indicado' }}</p>\n          <p><strong>Prioridad:</strong> {{ sellerHandoffSnapshot.priority }}</p>\n        </section>\n        <section class=\"space-y-2 rounded-xl border border-[var(--dh-border)] p-4\">\n          <p class=\"text-xs font-black uppercase text-[var(--dh-primary)]\">Pantalla 2 · Embarque</p>\n          <p><strong>Tipo de carga:</strong> {{ sellerContextValue('shipmentMode') }}</p>\n          <p><strong>Equipo:</strong> {{ displayValue(selectedEquipment) || sellerContextValue('equipmentType') }}</p>\n          <p><strong>Tamaño:</strong> {{ sellerContextValue('equipmentSize') }}</p>\n          <p><strong>Cantidad de equipos:</strong> {{ sellerContextValue('equipmentQuantity') }}</p>\n          <p><strong>Servicios:</strong> {{ selectedServices.length ? selectedServices.map((service) => displayValue(service)).join(', ') : sellerContextValue('serviceIds') }}</p>\n        </section>\n        <section class=\"space-y-2 rounded-xl border border-[var(--dh-border)] p-4\">\n          <p class=\"text-xs font-black uppercase text-[var(--dh-primary)]\">Pantalla 3 · Ruta e Incoterm</p>\n          <p><strong>Origen:</strong> {{ sellerHandoffSnapshot.originName || displayValue(selectedOrigin) || 'No indicado' }}</p>\n          <p><strong>Destino terrestre / POE:</strong> {{ sellerHandoffSnapshot.poeName || sellerHandoffSnapshot.destinationName || displayValue(selectedDestination) || 'No indicado' }}</p>\n          <p v-if=\"form.modality !== 'Land'\"><strong>POD / destino final:</strong> {{ sellerHandoffSnapshot.podName || displayValue(selectedPod) || 'No indicado' }}</p>\n          <p><strong>Incoterm:</strong> {{ displayValue(selectedIncoterm) || sellerContextValue('incotermId') }}</p>\n          <p><strong>Carga lista:</strong> {{ sellerContextValue('cargoReadyDate') !== 'No indicado' ? sellerContextValue('cargoReadyDate') : sellerContextValue('loadDate') }}</p>\n          <p><strong>Dirección de recolecta:</strong> {{ sellerContextValue('pickupAddress') }}</p>\n          <p><strong>Almacén / WHS:</strong> {{ sellerContextValue('warehouseId') }}</p>\n          <p v-if=\"form.modality !== 'Land'\"><strong>Muellaje:</strong> {{ sellerContextValue('portHandlingMode') }}</p>\n          <p v-if=\"sellerHandoffSnapshot.pickupLocations.length\" class=\"font-black\">Puntos de recolecta indicados por Ventas:</p>\n          <ul v-if=\"sellerHandoffSnapshot.pickupLocations.length\" class=\"list-disc space-y-1 pl-5 text-xs\">\n            <li v-for=\"(pickup, index) in sellerHandoffSnapshot.pickupLocations\" :key=\"index\">{{ JSON.stringify(pickup) }}</li>\n          </ul>\n        </section>\n        <section class=\"space-y-2 rounded-xl border border-[var(--dh-border)] p-4\">\n          <p class=\"text-xs font-black uppercase text-[var(--dh-primary)]\">Pantalla 4 · Carga y comentarios</p>\n          <p><strong>Descripción:</strong> {{ sellerContextValue('cargoDescription') }}</p>\n          <p class=\"whitespace-pre-wrap\"><strong>Observaciones del vendedor:</strong> {{ sellerContextValue('cargoObservations') }}</p>\n          <p><strong>Bultos:</strong> {{ sellerContextValue('cargoPackages') }} · <strong>Tarimas:</strong> {{ sellerContextValue('cargoPallets') }}</p>\n          <p><strong>Peso total:</strong> {{ sellerContextValue('cargoWeightKg') }} kg</p>\n          <p><strong>Medidas (cm):</strong> {{ sellerContextValue('cargoLengthCm') }} × {{ sellerContextValue('cargoWidthCm') }} × {{ sellerContextValue('cargoHeightCm') }}</p>\n          <p><strong>Valor de carga:</strong> {{ sellerContextValue('cargoValue') }} · <strong>CABYS:</strong> {{ sellerContextValue('cabysCode') }}</p>\n          <p><strong>Carga peligrosa:</strong> {{ sellerContextValue('dangerousCargo') }} · <strong>No estibable:</strong> {{ sellerContextValue('nonStackable') }}</p>\n          <p><strong>Sobrepeso:</strong> {{ sellerContextValue('overweight') }} · <strong>Almacenaje (días):</strong> {{ sellerContextValue('storageDays') }}</p>\n          <p v-if=\"sellerContextValue('notes') !== 'No indicado'\" class=\"whitespace-pre-wrap\"><strong>Notas:</strong> {{ sellerContextValue('notes') }}</p>\n          <p v-if=\"sellerContextValue('comments') !== 'No indicado'\" class=\"whitespace-pre-wrap\"><strong>Comentarios adicionales:</strong> {{ sellerContextValue('comments') }}</p>\n        </section>\n      </div>\n      <section class=\"mt-4 rounded-xl border border-[var(--dh-border)] p-4\">\n        <p class=\"text-xs font-black uppercase text-[var(--dh-primary)]\">Adjuntos originales de Ventas ({{ sellerHandoffSnapshot.documents.length }})</p>\n        <div v-if=\"sellerHandoffSnapshot.documents.length\" class=\"mt-3 grid gap-2 md:grid-cols-2\">\n          <div v-for=\"document in sellerHandoffSnapshot.documents\" :key=\"document.id\" class=\"flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs\">\n            <span class=\"min-w-0\"><strong class=\"block\">{{ document.categoryLabel }}</strong><span class=\"break-all\">{{ document.fileName }}</span></span>\n            <DhButton variant=\"secondary\" size=\"sm\" @click=\"downloadSellerHandoffFile(document)\">Descargar</DhButton>\n          </div>\n        </div>\n        <p v-else class=\"mt-2 text-xs font-semibold text-[var(--dh-text-muted)]\">Ventas no adjuntó documentos a esta solicitud.</p>\n      </section>\n    </details>"

function addSellerHandoffPreview(source: string): string {
  const stateAnchor = 'const supportDocuments = ref<SupportDocument[]>([])'
  const hydrateAnchor = '    const request = unwrapApiResponse<SellerRateRequestDto>(response as never)'
  const templateAnchor = '    <div class="crystal-stepbar'
  if (!source.includes(stateAnchor) || !source.includes(hydrateAnchor) || !source.includes(templateAnchor)) {
    throw new Error('[pricingWizardLandModeTerminology] Cannot place read-only Sales context')
  }
  const stateLines = [
    stateAnchor,
    "type SellerHandoffSnapshot = {",
    "  form: Record<string, unknown>",
    "  context: Record<string, unknown>",
    "  sellerContext: Record<string, unknown>",
    "  pickupLocations: RatePickupLocationDto[]",
    "  documents: SupportDocument[]",
    "  clientName: string",
    "  executiveName: string",
    "  originName: string",
    "  destinationName: string",
    "  poeName: string",
    "  podName: string",
    "  priority: string",
    "}",
    "const sellerHandoffSnapshot = ref<SellerHandoffSnapshot | null>(null)",
    "function sellerContextValue(key: string): string {",
    "  const data = sellerHandoffSnapshot.value",
    "  const value = data?.form[key] ?? data?.context[key] ?? data?.sellerContext[key]",
    "  if (value == null || value === '') return 'No indicado'",
    "  if (typeof value === 'boolean') return value ? 'Sí' : 'No'",
    "  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join(', ') || 'No indicado'",
    "  return String(value)",
    "}",
    "async function downloadSellerHandoffFile(document: SupportDocument) {",
    "  try {",
    "    await StorageService.downloadFile({ id: document.id, fileName: document.fileName })",
    "  } catch (error) {",
    "    toastStore.backendError(error, 'No se pudo descargar el respaldo enviado por Ventas.')",
    "  }",
    "}",
  ].join('\n')
  let code = source.replace(stateAnchor, stateLines)
  const hydrateLines = [
    hydrateAnchor,
    "    const sellerPayload = (request.payload ?? {}) as Record<string, unknown>",
    "    const sellerTyped = request as unknown as Record<string, unknown>",
    "    const sellerForm = (request.payload?.form ?? {}) as Record<string, unknown>",
    "    const originalContext = sellerPayload.requestContext",
    "    const originalSellerContext = sellerPayload.sellerContext",
    "    sellerHandoffSnapshot.value = {",
    "      form: { ...sellerForm },",
    "      context: originalContext && typeof originalContext === 'object' ? { ...(originalContext as Record<string, unknown>) } : {},",
    "      sellerContext: originalSellerContext && typeof originalSellerContext === 'object' ? { ...(originalSellerContext as Record<string, unknown>) } : {},",
    "      pickupLocations: Array.isArray(request.payload?.pickupLocations) ? request.payload.pickupLocations.map((location) => ({ ...location })) : [],",
    "      documents: Array.isArray(request.payload?.supportDocuments) ? request.payload.supportDocuments.map((document) => ({ ...document })) : [],",
    "      clientName: String(sellerTyped.clientName ?? sellerForm.clientName ?? ''),",
    "      executiveName: String(sellerTyped.executiveName ?? sellerForm.executiveName ?? ''),",
    "      originName: String(sellerTyped.originName ?? originalContext && (originalContext as Record<string, unknown>).originName ?? ''),",
    "      destinationName: String(sellerTyped.destinationName ?? sellerTyped.poeName ?? ''),",
    "      poeName: String(sellerTyped.poeName ?? ''),",
    "      podName: String(sellerTyped.podName ?? ''),",
    "      priority: String(request.priority ?? ''),",
    "    }",
  ].join('\n')
  code = code.replace(hydrateAnchor, hydrateLines)
  return code.replace(templateAnchor, SALES_READ_ONLY_PREVIEW + '\n' + templateAnchor)
}

export function patchPricingWizardLandModeTerminology(source: string): string {
  const commonWizard = removeRequestSpecificScreenFiveCard(source)
  const shared = addSharedCommercialValidity(patchStepFiveHelp(patchStepThreeForLand(commonWizard)))
  return addSellerHandoffPreview(shared)
}

export function pricingWizardLandModeTerminology(): Plugin {
  return {
    name: 'dhole-pricing-wizard-land-mode-terminology',
    // Must run after the Sales, LTL and customs-only wizard transforms.
    transform(source, id) {
      if (id.includes('?')) return null
      const normalized = id.replaceAll('\\', '/').split('?')[0]
      if (!normalized.endsWith(WIZARD_PATH)) return null
      return { code: patchPricingWizardLandModeTerminology(source), map: null }
    },
  }
}

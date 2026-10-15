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

const SALES_READ_ONLY_PREVIEW = [
  '    <PricingSellerHandoffPreview',
  '      v-if="rateRequestId && sellerHandoffSnapshot && step >= 5"',
  '      :snapshot="sellerHandoffSnapshot"',
  '      :equipment-label="selectedEquipment ? displayValue(selectedEquipment) : \'\'"',
  '      :service-label="selectedServices.map((service) => displayValue(service)).join(\', \')"',
  '      :origin-label="selectedOrigin ? displayValue(selectedOrigin) : \'\'"',
  '      :destination-label="selectedDestination ? displayValue(selectedDestination) : \'\'"',
  '      :pod-label="selectedPod ? displayValue(selectedPod) : \'\'"',
  '      :incoterm-label="selectedIncoterm ? displayValue(selectedIncoterm) : \'\'"',
  '      :is-land="form.modality === \'Land\'"',
  '      @download="downloadSellerHandoffFile"',
  '    />',
].join('\n')

function addSellerHandoffPreview(source: string): string {
  const stateAnchor = 'const supportDocuments = ref<SupportDocument[]>([])'
  const hydrateAnchor = '    const request = unwrapApiResponse<SellerRateRequestDto>(response as never)'
  const templateAnchor = '    <section class="crystal-panel'
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
  const importAnchor = "import { useRouter } from 'vue-router'"
  if (!source.includes(importAnchor)) {
    throw new Error('[pricingWizardLandModeTerminology] Missing Vue router import for Sales preview')
  }
  let code = source.replace(
    importAnchor,
    importAnchor + "\nimport PricingSellerHandoffPreview from '@/modules/pricing/components/PricingSellerHandoffPreview.vue'",
  ).replace(stateAnchor, stateLines)
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
    "      originName: String(sellerTyped.originName ?? (originalContext && (originalContext as Record<string, unknown>).originName) ?? ''),",
    "      destinationName: String(sellerTyped.destinationName ?? sellerTyped.poeName ?? ''),",
    "      poeName: String(sellerTyped.poeName ?? ''),",
    "      podName: String(sellerTyped.podName ?? ''),",
    "      priority: String(request.priority ?? ''),",
    "    }",
  ].join('\n')
  code = code.replace(hydrateAnchor, hydrateLines)
  return code.replace(templateAnchor, SALES_READ_ONLY_PREVIEW + '\n' + templateAnchor)
}


function addGamPickupRequirement(source: string): string {
  const vueImport = '<script setup lang="ts">'
  const saveAnchor = 'async function saveRate() {'
  const screenSeven = '<div v-else-if="step === 7"'
  if (!source.includes(vueImport) || !source.includes(saveAnchor) || !source.includes(screenSeven)) {
    throw new Error('[pricingWizardLandModeTerminology] Missing pickup validation anchors')
  }
  let code = source.replace(
    vueImport,
    vueImport + "\nimport { isLtlGamPickupLocation } from '@/modules/pricing/utils/ltlGamRouting'",
  )
  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd < 0) throw new Error('[pricingWizardLandModeTerminology] Missing script end')
  const pickupComputed = [
    'const landLtlPickupRequired = computed(() =>',
    "  shipmentModeForApi.value === 'Ltl'",
    '  && isLtlGamPickupLocation([',
    "    selectedOrigin.value ? displayValue(selectedOrigin.value) : '',",
    "    selectedOrigin.value?.code ?? '',",
    "  ].join(' ')),",
    ')',
    '',
  ].join('\n')
  code = code.slice(0, scriptEnd) + pickupComputed + code.slice(scriptEnd)
  const validation = [
    saveAnchor,
    '  if (landLtlPickupRequired.value) {',
    "    const pickup = rateLines.value.find((line) =>",
    "      /recolecta|recoleccion|pickup|pick up/i.test(String(line.name ?? '') + ' ' + String(line.key ?? ''))",
    '      && line.included',
    '      && Number(line.saleAmount) > 0,',
    '    )',
    '    if (!pickup) {',
    '      step.value = 7',
    "      toastStore.error('Recolecta obligatoria: Alajuela, Heredia y Coyol requieren un cargo de recolecta con precio de venta mayor que cero. Configure el importe en Líneas antes de guardar.')",
    '      return',
    '    }',
    '  }',
  ].join('\n')
  code = code.replace(saveAnchor, validation)
  const stepSevenStart = code.indexOf(screenSeven)
  const stepSevenOpenEnd = code.indexOf('>', stepSevenStart)
  if (stepSevenStart < 0 || stepSevenOpenEnd < 0) throw new Error('[pricingWizardLandModeTerminology] Missing step 7 opening tag')
  return code.slice(0, stepSevenOpenEnd + 1) + [

    '',
    '          <div v-if="landLtlPickupRequired" class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">',
    '            Recolecta obligatoria para origen Alajuela, Heredia o Coyol. Complete costo y precio de venta del cargo Recolecta; el flete LTL de San José permanece separado. No se aplica ningún importe supuesto.',
    '          </div>',
  ].join('\n') + code.slice(stepSevenOpenEnd + 1)
}

export function patchPricingWizardLandModeTerminology(source: string): string {
  const commonWizard = removeRequestSpecificScreenFiveCard(source)
  const shared = addSharedCommercialValidity(patchStepFiveHelp(patchStepThreeForLand(commonWizard)))
  return addGamPickupRequirement(addSellerHandoffPreview(shared))
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

import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function patchWizard(source: string) {
  let code = source

  // Pantalla 1: Multimodal deja de ser una modalidad independiente.
  code = code.replace(
    /\n\s*\{\s*value:\s*'Multimodal',\s*label:\s*'Multimodal',\s*caption:\s*'Marítimo \+ terrestre'\s*\},?/g,
    '',
  )

  code = code.replace(
    `<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">\n            <button\n              v-for="option in modalityOptions"`,
    `<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">\n            <button\n              v-for="option in modalityOptions"`,
  )

  const panamaCatalogDetector = `function isPanamaCatalogItem(item: CatalogItemSelectDto | null | undefined) {
  if (!item) return false
  const meta = metadata(item)
  const countryCode = String(meta?.countryCode ?? '').trim().toUpperCase()
  const code = String(item.code ?? '').trim().toUpperCase()
  const descriptor = normalizeCatalogValue([item.code, item.slug, item.label, displayValue(item)].filter(Boolean).join(' '))
  return countryCode === 'PA'
    || code === 'PA'
    || code.startsWith('PA-')
    || /^PA[A-Z0-9]{3,}$/.test(code)
    || descriptor.includes('panama')
}`

  const robustPanamaDetector = `function isRealPanamaPoe(item: CatalogItemSelectDto | null | undefined) {
  return Boolean(item && !isMultimodalViaPanama(item) && isPanamaCatalogItem(item))
}`

  // pricingRequirements20260908 already introduces isRealPanamaPoe before this plugin
  // runs. Always enhance that helper instead of assuming this plugin created it.
  if (code.includes('function isRealPanamaPoe(')) {
    if (!code.includes('function isPanamaCatalogItem(')) {
      code = code.replace(
        `function isRealPanamaPoe(item: CatalogItemSelectDto | null | undefined) {`,
        `${panamaCatalogDetector}\n\nfunction isRealPanamaPoe(item: CatalogItemSelectDto | null | undefined) {`,
      )
    }
    code = code.replace(
      /function isRealPanamaPoe\(item: CatalogItemSelectDto \| null \| undefined\) \{[\s\S]*?\n\}/,
      robustPanamaDetector,
    )
  } else {
    const routeAnchor = `const originOptions = computed(() => catalogs.pol.map((item) => ({ value: item.id, label: displayValue(item) })))\nconst destinationOptions = computed(() => catalogs.poe.map((item) => ({ value: item.id, label: displayValue(item) })))`
    if (!code.includes(routeAnchor)) {
      throw new Error('[pricingWizardMaritimePanamaFix] Route options anchor not found.')
    }

    const routeReplacement = `function isMultimodalViaPanama(item: CatalogItemSelectDto | null | undefined) {
  if (!item) return false
  const meta = metadata(item)
  const descriptor = normalizeCatalogValue([item.code, item.slug, item.label, displayValue(item)].filter(Boolean).join(' '))
  return meta?.multimodalViaPanama === true
    || String(item.code ?? '').trim().toUpperCase() === 'MULTIMODAL_VIA_PANAMA'
    || descriptor.includes('multimodal via panama')
}

${panamaCatalogDetector}

${robustPanamaDetector}

const panamaPoeItems = computed(() => catalogs.poe.filter(isRealPanamaPoe))

const originOptions = computed(() => catalogs.pol.map((item) => ({ value: item.id, label: displayValue(item) })))
const destinationOptions = computed(() => {
  if (form.modality === 'Maritime' && shipmentModeForApi.value === 'Fcl') {
    return catalogs.poe.map((item) => ({ value: item.id, label: displayValue(item) }))
  }
  return catalogs.poe
    .filter((item) => !isMultimodalViaPanama(item))
    .map((item) => ({ value: item.id, label: displayValue(item) }))
})`

    code = code.replace(routeAnchor, routeReplacement)
  }

  // FCL marítimo debe permitir seleccionar POE reales de Panamá; el POD decide si
  // permanece como ruta Panamá -> Panamá o si se convierte al POE sintético.
  code = code.replace(
    `return catalogs.poe.filter((item) => isMultimodalViaPanama(item) || !isRealPanamaPoe(item))`,
    `return catalogs.poe`,
  )

  if (!code.includes('const multimodalViaPanamaPoe = computed(')) {
    const panamaItemsAnchor = `const panamaPoeItems = computed(() => catalogs.poe.filter(isRealPanamaPoe))`
    if (!code.includes(panamaItemsAnchor)) {
      throw new Error('[pricingWizardMaritimePanamaFix] Panama POE items anchor not found.')
    }
    code = code.replace(
      panamaItemsAnchor,
      `${panamaItemsAnchor}\nconst multimodalViaPanamaPoe = computed(() => catalogs.poe.find(isMultimodalViaPanama) ?? null)`,
    )
  }

  // Important: this behavior must be injected even when an earlier Vite transform
  // already declared isRealPanamaPoe. The old implementation skipped this block in
  // that case, which is why Balboa + San José remained as Balboa in production.
  if (!code.includes('// dhole-panama-route-auto-switch')) {
    const behaviorAnchor = `const multimodalViaPanamaPoe = computed(() => catalogs.poe.find(isMultimodalViaPanama) ?? null)`
    if (!code.includes(behaviorAnchor)) {
      throw new Error('[pricingWizardMaritimePanamaFix] Multimodal Panama anchor not found.')
    }

    const behavior = `// dhole-panama-route-auto-switch
watch(
  () => [form.destinationId, form.podId, form.modality, form.shipmentMode] as const,
  () => {
    if (hydratingExistingRate.value) return
    if (form.modality !== 'Maritime' || shipmentModeForApi.value !== 'Fcl') return

    // Resolve directly from the master catalogs so this rule is independent from
    // later CY/SD route filtering transforms.
    const poe = findById(catalogs.poe, form.destinationId)
    const pod = findById(catalogs.pod, form.podId)
    if (!isRealPanamaPoe(poe) || !pod || isPanamaCatalogItem(pod)) return

    const multimodal = multimodalViaPanamaPoe.value
    if (!multimodal || form.destinationId === multimodal.id) return

    // Panamá + POD fuera de Panamá => mantener el POD y convertir únicamente el POE.
    form.destinationId = multimodal.id
    form.selectedImportRateId = ''
    availableRates.value = []
  },
  { flush: 'sync' },
)

function shouldBrowseAllPanamaRates() {
  const poe = findById(catalogs.poe, form.destinationId)
  const pod = findById(catalogs.pod, form.podId)
  return isMultimodalViaPanama(poe)
    || (isRealPanamaPoe(poe) && isPanamaCatalogItem(pod))
}`

    code = code.replace(behaviorAnchor, `${behaviorAnchor}\n\n${behavior}`)
  }

  const panamaSelectHelper = `async function selectImportRatesForSelectedPoe(query: BrowseImportRatesQuery) {
  if (!shouldBrowseAllPanamaRates()) {
    return PricingService.selectImportRates(query)
  }

  // Tanto el POE sintético "Multimodal Via Panamá" como una ruta Panamá -> Panamá
  // consultan todas las tarifas importadas cuyo POE pertenece a Panamá.
  return PricingService.selectImportRates({
    ...query,
    poe: 'contains:Panama|Panamá',
  })
}`

  if (code.includes('async function selectImportRatesForSelectedPoe(')) {
    code = code.replace(
      /async function selectImportRatesForSelectedPoe\(query: BrowseImportRatesQuery\) \{[\s\S]*?\n\}/,
      panamaSelectHelper,
    )
  } else {
    code = code.split('PricingService.selectImportRates(query)').join('selectImportRatesForSelectedPoe(query)')

    const selectedDestinationAnchor = `const selectedDestination = computed(() => findById(catalogs.poe, form.destinationId))`
    if (!code.includes(selectedDestinationAnchor)) {
      throw new Error('[pricingWizardMaritimePanamaFix] Selected destination anchor not found.')
    }

    code = code.replace(
      selectedDestinationAnchor,
      `${selectedDestinationAnchor}\n\n${panamaSelectHelper}`,
    )
  }

  // ALL IN es exclusivo de "Multimodal Via Panamá".
  code = code.replace(
    `<DhButton\n                variant="secondary"\n                type="button"\n                @click="allInPresentation = !allInPresentation"`,
    `<DhButton\n                v-if="isMultimodalViaPanama(selectedDestination)"\n                variant="secondary"\n                type="button"\n                @click="allInPresentation = !allInPresentation"`,
  )

  code = code.replace(
    `<div v-if="allInPresentation" class="mt-5 overflow-hidden rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[rgb(var(--dh-primary-rgb)/0.06)]">`,
    `<div v-if="allInPresentation && isMultimodalViaPanama(selectedDestination)" class="mt-5 overflow-hidden rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[rgb(var(--dh-primary-rgb)/0.06)]">`,
  )

  code = code.replace(
    `useAllInPresentation: allInPresentation.value,`,
    `useAllInPresentation: isMultimodalViaPanama(selectedDestination.value) && allInPresentation.value,`,
  )

  return code
}

export function pricingWizardMaritimePanamaFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-maritime-panama-fix',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

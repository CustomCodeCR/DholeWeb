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

  const robustPanamaDetector = `function isRealPanamaPoe(item: CatalogItemSelectDto | null | undefined) {
  if (!item || isMultimodalViaPanama(item)) return false
  const meta = metadata(item)
  const countryCode = String(meta?.countryCode ?? '').trim().toUpperCase()
  const code = String(item.code ?? '').trim().toUpperCase()
  const descriptor = normalizeCatalogValue([item.code, item.label, displayValue(item)].filter(Boolean).join(' '))
  return countryCode === 'PA' || code.startsWith('PA-') || descriptor.includes('panama')
}`

  if (code.includes('function isRealPanamaPoe(')) {
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
  const descriptor = normalizeCatalogValue([item.code, item.label, displayValue(item)].filter(Boolean).join(' '))
  return meta?.multimodalViaPanama === true
    || String(item.code ?? '').trim().toUpperCase() === 'MULTIMODAL_VIA_PANAMA'
    || descriptor.includes('multimodal via panama')
}

${robustPanamaDetector}

const panamaPoeItems = computed(() => catalogs.poe.filter(isRealPanamaPoe))
const originOptions = computed(() => catalogs.pol.map((item) => ({ value: item.id, label: displayValue(item) })))
const destinationOptions = computed(() => {
  if (form.modality === 'Maritime' && shipmentModeForApi.value === 'Fcl') {
    return catalogs.poe
      .filter((item) => isMultimodalViaPanama(item) || !isRealPanamaPoe(item))
      .map((item) => ({ value: item.id, label: displayValue(item) }))
  }
  return catalogs.poe
    .filter((item) => !isMultimodalViaPanama(item))
    .map((item) => ({ value: item.id, label: displayValue(item) }))
})`

    code = code.replace(routeAnchor, routeReplacement)
  }

  if (!code.includes('async function selectImportRatesForSelectedPoe(')) {
    // Redirect every normal rate lookup through the Panama-aware helper. The helper
    // falls through unchanged for every normal POE and every non-FCL flow.
    code = code.split('PricingService.selectImportRates(query)').join('selectImportRatesForSelectedPoe(query)')

    const selectedDestinationAnchor = `const selectedDestination = computed(() => findById(catalogs.poe, form.destinationId))`
    if (!code.includes(selectedDestinationAnchor)) {
      throw new Error('[pricingWizardMaritimePanamaFix] Selected destination anchor not found.')
    }

    const helper = `${selectedDestinationAnchor}

async function selectImportRatesForSelectedPoe(query: BrowseImportRatesQuery) {
  if (!isMultimodalViaPanama(selectedDestination.value)) {
    return PricingService.selectImportRates(query)
  }

  if (!panamaPoeItems.value.length) {
    toastStore.warning('POE Panamá no configurados', 'Multimodal Via Panamá requiere al menos un POE real de Panamá en Config.')
    return [] as ImportRateSelectDto[]
  }

  const results = await Promise.all(
    panamaPoeItems.value.map((poe) => PricingService.selectImportRates({
      ...query,
      poe: catalogSearchText(poe),
    })),
  )
  const unique = new Map<string, ImportRateSelectDto>()
  results.flat().forEach((rate) => unique.set(rate.id, rate))
  return [...unique.values()]
}`

    code = code.replace(selectedDestinationAnchor, helper)
  }

  // ALL IN is exclusive to the synthetic "Multimodal Via Panamá" POE. If the POE
  // changes to any other destination, clear the state so it cannot leak into the PDF
  // or the persisted rate after the button disappears.
  const selectedDestinationAnchor = `const selectedDestination = computed(() => findById(catalogs.poe, form.destinationId))`
  const allInResetGuard = `watch(selectedDestination, (destination) => {
  if (!isMultimodalViaPanama(destination)) allInPresentation.value = false
})`
  if (!code.includes(allInResetGuard)) {
    if (!code.includes(selectedDestinationAnchor)) {
      throw new Error('[pricingWizardMaritimePanamaFix] ALL IN destination guard anchor not found.')
    }
    code = code.replace(selectedDestinationAnchor, `${selectedDestinationAnchor}\n\n${allInResetGuard}`)
  }

  const allInButtonAnchor = `<DhButton\n                variant="secondary"\n                type="button"\n                @click="allInPresentation = !allInPresentation"`
  const allInButtonReplacement = `<DhButton\n                v-if="isMultimodalViaPanama(selectedDestination)"\n                variant="secondary"\n                type="button"\n                @click="allInPresentation = !allInPresentation"`
  if (code.includes(allInButtonAnchor)) {
    code = code.replace(allInButtonAnchor, allInButtonReplacement)
  } else if (!code.includes('v-if="isMultimodalViaPanama(selectedDestination)"')) {
    throw new Error('[pricingWizardMaritimePanamaFix] ALL IN button anchor not found.')
  }

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

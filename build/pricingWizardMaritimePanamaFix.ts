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

  const panamaSelectHelper = `async function selectImportRatesForSelectedPoe(query: BrowseImportRatesQuery) {
  if (!isMultimodalViaPanama(selectedDestination.value)) {
    return PricingService.selectImportRates(query)
  }

  // El POE sintético "Multimodal Via Panamá" representa todas las tarifas cuyo
  // POE real contiene Panamá/Panama. El backend interpreta el prefijo contains:
  // sin alterar el comportamiento exacto de los POE normales.
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
    // Redirect every normal rate lookup through the Panama-aware helper. The helper
    // falls through unchanged for every normal POE and every non-FCL flow.
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

  // ALL IN is a commercial presentation option exclusive to the synthetic
  // "Multimodal Via Panamá" POE. Normal POEs must never expose or persist it.
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

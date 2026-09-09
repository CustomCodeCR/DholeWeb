import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function patchWizard(source: string) {
  let code = source

  // Compatibility with earlier September transforms: remove the temporary dedicated
  // land route catalogs. POL and POE are now shared and terminalType selects CY vs SD.
  code = code.replace(
    `  landPol: [] as CatalogItemSelectDto[],\n  landPoe: [] as CatalogItemSelectDto[],\n`,
    '',
  )
  code = code.split(
    `      poe,\n      landPol,\n      landPoe,\n      landEquipmentTypes,`,
  ).join(
    `      poe,\n      landEquipmentTypes,`,
  )
  code = code.replace(
    `      select('poe'),\n      select('land-pol'),\n      select('land-poe'),\n      select('land-equipment-types'),`,
    `      select('poe'),\n      select('land-equipment-types'),`,
  )

  if (!code.includes('function routeTerminalType(')) {
    const panamaAnchor = `const panamaPoeItems = computed(() => catalogs.poe.filter(isRealPanamaPoe))`
    if (!code.includes(panamaAnchor)) {
      throw new Error('[pricingWizardRouteTerminalTypes] Panama POE anchor not found.')
    }

    const terminalHelpers = `function routeTerminalType(item: CatalogItemSelectDto | null | undefined, fallback: 'CY' | 'SD') {
  if (!item) return fallback
  const meta = (metadata(item) ?? {}) as unknown as Record<string, unknown>
  const configured = String(meta.terminalType ?? '').trim().toUpperCase()
  if (configured === 'CY' || configured === 'SD') return configured as 'CY' | 'SD'

  const codeValue = String(item.code ?? '').trim().toUpperCase()
  if (codeValue.startsWith('CY_') || codeValue.endsWith('_CY') || codeValue.includes('_CY_')) return 'CY'
  if (codeValue.startsWith('SD_') || codeValue.endsWith('_SD') || codeValue.includes('_SD_')) return 'SD'
  return fallback
}

function routeItemsByTerminal(items: CatalogItemSelectDto[], terminalType: 'CY' | 'SD', fallback: 'CY' | 'SD') {
  return items.filter((item) => routeTerminalType(item, fallback) === terminalType)
}

const panamaPoeItems = computed(() =>
  routeItemsByTerminal(catalogs.poe, 'CY', 'CY').filter(isRealPanamaPoe),
)`

    code = code.replace(panamaAnchor, terminalHelpers)
  }

  const routeStartToken = code.includes('const originCatalog = computed(')
    ? 'const originCatalog = computed('
    : 'const originOptions = computed('
  const routeStart = code.indexOf(routeStartToken)
  const routeEnd = routeStart >= 0 ? code.indexOf('const incotermOptions = computed(', routeStart) : -1
  if (routeStart < 0 || routeEnd < 0) {
    throw new Error('[pricingWizardRouteTerminalTypes] Route option block not found.')
  }

  const routeBlock = `const maritimePolCatalog = computed(() => routeItemsByTerminal(catalogs.pol, 'CY', 'CY'))
const terrestrialPolCatalog = computed(() => routeItemsByTerminal(catalogs.pol, 'SD', 'CY'))
const maritimePoeCatalog = computed(() => routeItemsByTerminal(catalogs.poe, 'CY', 'CY'))
const terrestrialPoeCatalog = computed(() => routeItemsByTerminal(catalogs.poe, 'SD', 'CY'))
const maritimePodCatalog = computed(() => routeItemsByTerminal(catalogs.pod, 'SD', 'SD'))

const originCatalog = computed(() =>
  form.modality === 'Land' ? terrestrialPolCatalog.value : maritimePolCatalog.value,
)
const destinationCatalog = computed(() => {
  if (form.modality === 'Land') return terrestrialPoeCatalog.value
  if (form.modality === 'Maritime' && shipmentModeForApi.value === 'Fcl') {
    return maritimePoeCatalog.value.filter((item) => isMultimodalViaPanama(item) || !isRealPanamaPoe(item))
  }
  return maritimePoeCatalog.value.filter((item) => !isMultimodalViaPanama(item))
})

const originOptions = computed(() => originCatalog.value.map((item) => ({ value: item.id, label: displayValue(item) })))
const destinationOptions = computed(() => destinationCatalog.value.map((item) => ({ value: item.id, label: displayValue(item) })))
const podOptions = computed(() => form.modality === 'Land'
  ? []
  : maritimePodCatalog.value.map((item) => ({ value: item.id, label: displayValue(item) })))
`
  code = code.slice(0, routeStart) + routeBlock + code.slice(routeEnd)

  code = code.replace(
    `const selectedOrigin = computed(() => findById(catalogs.pol, form.originId))`,
    `const selectedOrigin = computed(() => findById(originCatalog.value, form.originId))`,
  )
  code = code.replace(
    `const selectedDestination = computed(() => findById(catalogs.poe, form.destinationId))`,
    `const selectedDestination = computed(() => findById(destinationCatalog.value, form.destinationId))`,
  )
  code = code.replace(
    `const selectedPod = computed(() => findById(catalogs.pod, form.podId))`,
    `const selectedPod = computed(() => form.modality === 'Land' ? null : findById(maritimePodCatalog.value, form.podId))`,
  )
  code = code.replace(
    `const selectedPod = computed(() => form.modality === 'Land' ? null : findById(catalogs.pod, form.podId))`,
    `const selectedPod = computed(() => form.modality === 'Land' ? null : findById(maritimePodCatalog.value, form.podId))`,
  )

  code = code.replace(
    `terminal-type="CY"\n                :options="originOptions"`,
    `:terminal-type="form.modality === 'Land' ? 'SD' : 'CY'"\n                :options="originOptions"`,
  )
  code = code.replace(
    `terminal-type="CY"\n                :options="destinationOptions"`,
    `:terminal-type="form.modality === 'Land' ? 'SD' : 'CY'"\n                :options="destinationOptions"`,
  )

  if (!code.includes(`<PricingLocationSearchSelect\n                v-if="form.modality !== 'Land'"\n                v-model="form.podId"`)) {
    const podComponentAnchor = `<PricingLocationSearchSelect\n                v-model="form.podId"`
    if (!code.includes(podComponentAnchor)) {
      throw new Error('[pricingWizardRouteTerminalTypes] POD component anchor not found.')
    }
    code = code.replace(
      podComponentAnchor,
      `<PricingLocationSearchSelect\n                v-if="form.modality !== 'Land'"\n                v-model="form.podId"`,
    )
  }

  code = code.replace(
    `Seleccione POL y POE del catálogo terrestre. Para terrestre no se utiliza POD.`,
    `Seleccione POL y POE de tipo SD. Para terrestre no se utiliza POD.`,
  )

  const destinationWatcher = `watch(\n  () => form.destinationId,\n  () => {\n    const equivalent = findEquivalent(catalogs.pod, selectedDestination.value)\n    form.podId = equivalent?.id ?? ''\n  },\n)`
  if (code.includes(destinationWatcher)) {
    code = code.replace(
      destinationWatcher,
      `watch(\n  () => form.destinationId,\n  () => {\n    if (form.modality === 'Land') {\n      form.podId = ''\n      return\n    }\n    const equivalent = findEquivalent(maritimePodCatalog.value, selectedDestination.value)\n    form.podId = equivalent?.id ?? ''\n  },\n)`,
    )
  }

  const modalityAnchor = `function chooseModality(value: Modality) {\n  form.modality = value`
  if (code.includes(modalityAnchor) && !code.includes(`if (value === 'Land') form.podId = ''`)) {
    code = code.replace(
      modalityAnchor,
      `function chooseModality(value: Modality) {\n  form.modality = value\n  if (value === 'Land') form.podId = ''`,
    )
  }

  if (!code.includes('// shared-route-catalog land POD guard')) {
    const originWatchAnchor = `watch(\n  () => form.originId,\n  () => assignAgentForOrigin(),\n)`
    if (code.includes(originWatchAnchor)) {
      code = code.replace(
        originWatchAnchor,
        `// shared-route-catalog land POD guard\nwatch(\n  () => form.modality,\n  (modality) => {\n    if (modality === 'Land') form.podId = ''\n  },\n)\n\n${originWatchAnchor}`,
      )
    }
  }

  return code
}

export function pricingWizardRouteTerminalTypes(): Plugin {
  return {
    name: 'dhole-pricing-wizard-route-terminal-types',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}

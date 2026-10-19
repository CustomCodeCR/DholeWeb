import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const LCL_SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardLclFclParityFix] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}


/**
 * The wizard now supplies poe-code/poe-name for the Balboa-only own-LCL rule.
 * Keep them untouched while adding the text labels used by coloader filtering.
 */
export function patchLclWizardColoaderRouteLabels(source: string): string {
  const poeAwareAnchor = `            :poe-id="selectedDestination?.id ?? null"
            :poe-code="selectedDestination?.code ?? null"
            :poe-name="displayValue(selectedDestination)"
            :pod-id="selectedPod?.id ?? null"`
  const legacyAnchor = `            :poe-id="selectedDestination?.id ?? null"
            :pod-id="selectedPod?.id ?? null"`

  const poeAwareReplacement = `            :poe-id="selectedDestination?.id ?? null"
            :poe-code="selectedDestination?.code ?? null"
            :poe-name="displayValue(selectedDestination)"
            :poe-label="displayValue(selectedDestination)"
            :pod-id="selectedPod?.id ?? null"
            :pod-label="selectedPod ? displayValue(selectedPod) : null"`
  const legacyReplacement = `            :poe-id="selectedDestination?.id ?? null"
            :poe-label="displayValue(selectedDestination)"
            :pod-id="selectedPod?.id ?? null"
            :pod-label="selectedPod ? displayValue(selectedPod) : null"`

  if (source.includes(poeAwareAnchor)) {
    return replaceOne(source, poeAwareAnchor, poeAwareReplacement, 'LCL coloader route labels with Balboa POE')
  }
  return replaceOne(source, legacyAnchor, legacyReplacement, 'LCL coloader route labels')
}

/** Preserve poeCode/poeName when the Balboa filtering feature is enabled. */
export function patchLclSelectorRouteLabels(source: string): string {
  const poeAwareProps = `  poeId?: string | null
  poeCode?: string | null
  poeName?: string | null
  podId?: string | null`
  const legacyProps = `  poeId?: string | null
  podId?: string | null`
  const poeAwareDefaults = `  poeId: null,
  poeCode: null,
  poeName: null,
  podId: null,`
  const legacyDefaults = `  poeId: null,
  podId: null,`

  if (source.includes(poeAwareProps)) {
    source = replaceOne(source, poeAwareProps, `  poeId?: string | null
  poeCode?: string | null
  poeName?: string | null
  poeLabel?: string | null
  podId?: string | null
  podLabel?: string | null`, 'LCL selector Balboa-aware route label props')
  } else {
    source = replaceOne(source, legacyProps, `  poeId?: string | null
  poeLabel?: string | null
  podId?: string | null
  podLabel?: string | null`, 'LCL selector legacy route label props')
  }

  if (source.includes(poeAwareDefaults)) {
    source = replaceOne(source, poeAwareDefaults, `  poeId: null,
  poeCode: null,
  poeName: null,
  poeLabel: null,
  podId: null,
  podLabel: null,`, 'LCL selector Balboa-aware route label defaults')
  } else {
    source = replaceOne(source, legacyDefaults, `  poeId: null,
  poeLabel: null,
  podId: null,
  podLabel: null,`, 'LCL selector legacy route label defaults')
  }
  return source
}

function patchWizard(source: string) {
  let code = source

  // Config stores warehouses as WHS_NINGBO / "Ningbo, China" while POL codes can
  // be internal identifiers such as POL-2026-074. Resolve FOB WHS by all stable
  // references plus the real location name, exactly as the global FCA picker does.
  const warehouseResolverAnchor = `function warehousePolCodes(warehouse: CatalogItemSelectDto) {
  const meta = metadata(warehouse) as (CatalogMetadata & { polCodes?: string[] }) | null
  return Array.isArray(meta?.polCodes) ? meta.polCodes : []
}

function resolveWarehouseForOriginPol() {
  const origin = selectedOrigin.value
  if (!origin) return null
  const polCode = String(origin.code || displayValue(origin) || '').trim()
  if (!polCode) return null
  const normalizedPol = normalizeCatalogValue(polCode)
  const expectedWarehouseCode = normalizeCatalogValue('WHS_' + polCode)
  return catalogs.warehouses.find((warehouse) => {
    const warehouseCode = normalizeCatalogValue(String(warehouse.code || ''))
    if (warehouseCode === expectedWarehouseCode) return true
    return warehousePolCodes(warehouse).some((candidate) => normalizeCatalogValue(String(candidate)) === normalizedPol)
  }) ?? null
}`

  const warehouseResolverReplacement = `function warehousePolCodes(warehouse: CatalogItemSelectDto) {
  const meta = metadata(warehouse) as (CatalogMetadata & {
    polCode?: string
    polCodes?: string[]
    polId?: string
    polIds?: string[]
    originCode?: string
    originCodes?: string[]
    originId?: string
    originIds?: string[]
  }) | null
  return [
    meta?.polCode,
    ...(Array.isArray(meta?.polCodes) ? meta.polCodes : []),
    meta?.polId,
    ...(Array.isArray(meta?.polIds) ? meta.polIds : []),
    meta?.originCode,
    ...(Array.isArray(meta?.originCodes) ? meta.originCodes : []),
    meta?.originId,
    ...(Array.isArray(meta?.originIds) ? meta.originIds : []),
  ].filter((value): value is string => Boolean(value))
}

function compactWarehouseReference(value: unknown) {
  return normalizeCatalogValue(String(value ?? '')).replace(/[^a-z0-9]+/g, '')
}

function resolveWarehouseForOriginPol() {
  const origin = selectedOrigin.value
  if (!origin) return null

  const originMeta = metadata(origin) as (CatalogMetadata & {
    unlocode?: string
    portCode?: string
    city?: string
  }) | null
  const originLabel = String(displayValue(origin) || origin.label || '').trim()
  const originReferences = [
    origin.id,
    origin.code,
    origin.slug,
    origin.label,
    displayValue(origin),
    originMeta?.unlocode,
    originMeta?.portCode,
    originMeta?.city,
  ]
    .map(compactWarehouseReference)
    .filter(Boolean)
  const originReferenceSet = new Set(originReferences)
  const originCity = String(originMeta?.city || originLabel.split(',')[0] || '').trim()
  const originCityKey = compactWarehouseReference(originCity)
  const originLabelKey = compactWarehouseReference(originLabel)
  const expectedWarehouseCode = originCityKey ? 'whs' + originCityKey : ''

  return catalogs.warehouses.find((warehouse) => {
    const warehouseReferences = [
      warehouse.id,
      warehouse.code,
      warehouse.slug,
      warehouse.label,
      displayValue(warehouse),
      ...warehousePolCodes(warehouse),
    ]
      .map(compactWarehouseReference)
      .filter(Boolean)

    if (warehouseReferences.some((candidate) => originReferenceSet.has(candidate))) return true

    const warehouseCode = compactWarehouseReference(warehouse.code)
    if (expectedWarehouseCode && warehouseCode === expectedWarehouseCode) return true

    const warehouseLabel = compactWarehouseReference(displayValue(warehouse) || warehouse.label || '')
    if (originLabelKey && warehouseLabel === originLabelKey) return true

    // Backwards-compatible fallback for the seeded WHS_XIAMEN/WHS_NINGBO/etc.
    // directory. It never relies on the opaque POL-2026-xxx code.
    return Boolean(originCityKey && (
      warehouseCode.endsWith(originCityKey)
      || warehouseLabel.startsWith(originCityKey)
    ))
  }) ?? null
}`

  code = replaceOne(code, warehouseResolverAnchor, warehouseResolverReplacement, 'FOB WHS resolver')

  // Selection in Pantalla 5 must behave like FCL. The component's v-model event is
  // guaranteed to fire when the button changes to "Seleccionado", so use that same
  // event to advance to Proveedor; @select still hydrates the complete source object.
  code = replaceOne(
    code,
    `            v-model="lclSelectedSourceKey"`,
    `            :model-value="lclSelectedSourceKey"\n            @update:model-value="(value) => { lclSelectedSourceKey = String(value || ''); if (value) step = 6 }"`,
    'LCL source v-model advance',
  )

  code = replaceOne(
    code,
    `    if (shipmentModeForApi.value === 'Lcl') return Boolean(lclSelectedSource.value)`,
    `    if (shipmentModeForApi.value === 'Lcl') return Boolean(lclSelectedSource.value || lclSelectedSourceKey.value)`,
    'LCL selected source validation',
  )

  // Coloader filtering uses the same FCL context: POL + POE + optional POD + date.
  code = patchLclWizardColoaderRouteLabels(code)

  return code
}

function patchSelector(source: string) {
  let code = source

  code = patchLclSelectorRouteLabels(code)

  const legacyColoaderQueryAnchor = `        polId: props.polId,\n        poeId: props.poeId,\n        podId: props.podId,\n        incotermId: props.incotermId,\n        quoteDate: props.quoteDate,`
  const routeAwareColoaderQueryAnchor = `        modality: props.modality,\n        polId: props.polId,\n        pol: props.polName || props.polCode || undefined,\n        poeId: props.poeId,\n        poe: isAir.value ? props.destinationLabel || undefined : undefined,\n        podId: props.podId,\n        incotermId: props.incotermId,\n        quoteDate: props.quoteDate,`
  const coloaderQueryReplacement = `        modality: props.modality,\n        polId: props.polId,\n        pol: props.polName || props.polCode || undefined,\n        poeId: props.poeId,\n        poe: isAir.value ? (props.poeLabel || props.destinationLabel || undefined) : (props.poeLabel || undefined),\n        podId: props.podId,\n        pod: props.podLabel || undefined,\n        incotermId: props.incotermId,\n        quoteDate: props.quoteDate,`

  if (code.includes(routeAwareColoaderQueryAnchor)) {
    code = code.replace(routeAwareColoaderQueryAnchor, coloaderQueryReplacement)
  } else {
    code = replaceOne(
      code,
      legacyColoaderQueryAnchor,
      coloaderQueryReplacement,
      'FCL-style LCL coloader query',
    )
  }

  return code
}

export function pricingWizardLclFclParityFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-fcl-parity-fix',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      if (normalizedId.endsWith(LCL_SELECTOR_PATH)) return { code: patchSelector(source), map: null }
      return null
    },
  }
}

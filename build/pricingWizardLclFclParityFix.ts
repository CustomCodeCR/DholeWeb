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
  code = replaceOne(
    code,
    `            :poe-id="selectedDestination?.id ?? null"\n            :pod-id="selectedPod?.id ?? null"`,
    `            :poe-id="selectedDestination?.id ?? null"\n            :poe-label="displayValue(selectedDestination)"\n            :pod-id="selectedPod?.id ?? null"\n            :pod-label="selectedPod ? displayValue(selectedPod) : null"`,
    'LCL coloader route labels',
  )

  return code
}

function patchSelector(source: string) {
  let code = source

  code = replaceOne(
    code,
    `  poeId?: string | null\n  podId?: string | null`,
    `  poeId?: string | null\n  poeLabel?: string | null\n  podId?: string | null\n  podLabel?: string | null`,
    'LCL selector route label props',
  )

  code = replaceOne(
    code,
    `  poeId: null,\n  podId: null,`,
    `  poeId: null,\n  poeLabel: null,\n  podId: null,\n  podLabel: null,`,
    'LCL selector route label defaults',
  )

  code = replaceOne(
    code,
    `        polId: props.polId,\n        poeId: props.poeId,\n        podId: props.podId,\n        incotermId: props.incotermId,\n        quoteDate: props.quoteDate,`,
    `        polId: props.polId,\n        pol: props.polCode,\n        poeId: props.poeId,\n        poe: props.poeLabel,\n        podId: props.podId,\n        pod: props.podLabel,\n        incotermId: props.incotermId,\n        quoteDate: props.quoteDate,`,
    'FCL-style LCL coloader query',
  )

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

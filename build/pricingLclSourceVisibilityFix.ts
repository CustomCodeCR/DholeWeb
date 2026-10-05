import type { Plugin } from 'vite'

const LCL_SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingLclSourceVisibilityFix] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

export function pricingLclSourceVisibilityFix(): Plugin {
  return {
    name: 'dhole-pricing-lcl-source-visibility-fix',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(LCL_SELECTOR_PATH)) return null

      let code = source

      // The API browse endpoint already returns only active own consolidations.
      // Keep an explicit false as a safeguard, but do not hide a valid row when
      // an API serializer/version omits the isActive property.
      const activeFilterAnchor = `    if (!row.isActive || normalize(row.status) === 'closed') return false`
      const activeFilterReplacement = `    if (row.isActive === false || normalize(row.status) === 'closed') return false`
      code = replaceOne(code, activeFilterAnchor, activeFilterReplacement, 'own LCL active filter')

      // Own consolidations and coloader rates are independent sources. A failure
      // in one source must never erase the other source from Pantalla 5.
      // Air never queries the maritime own-consolidation source.
      const legacyLoadAnchor = `    const [own, coloaders] = await Promise.all([\n      OwnLclConsolidationService.browse(),\n      LclRateSourceService.browseColoaders({\n        polId: props.polId,\n        poeId: props.poeId,\n        podId: props.podId,\n        incotermId: props.incotermId,\n        quoteDate: props.quoteDate,\n      }),\n    ])\n    ownRows.value = own.map((row) => ({ ...row }))\n    coloaderRows.value = coloaders.map((row) => ({ ...row }))`
      const modalityLoadAnchor = `    const [own, coloaders] = await Promise.all([\n      isAir.value ? Promise.resolve([] as OwnLclConsolidationDto[]) : OwnLclConsolidationService.browse(),\n      LclRateSourceService.browseColoaders({\n        modality: props.modality,\n        polId: props.polId,\n        poeId: props.poeId,\n        podId: props.podId,\n        incotermId: props.incotermId,\n        quoteDate: props.quoteDate,\n      }),\n    ])\n    ownRows.value = own.map((row) => ({ ...row }))\n    coloaderRows.value = coloaders.map((row) => ({ ...row }))`
      const routeAwareLoadAnchor = `    const [own, coloaders] = await Promise.all([\n      isAir.value ? Promise.resolve([] as OwnLclConsolidationDto[]) : OwnLclConsolidationService.browse(),\n      LclRateSourceService.browseColoaders({\n        modality: props.modality,\n        polId: props.polId,\n        pol: props.polName || props.polCode || undefined,\n        poeId: props.poeId,\n        poe: isAir.value ? props.destinationLabel || undefined : undefined,\n        podId: props.podId,\n        incotermId: props.incotermId,\n        quoteDate: props.quoteDate,\n      }),\n    ])\n    ownRows.value = own.map((row) => ({ ...row }))\n    coloaderRows.value = coloaders.map((row) => ({ ...row }))`
      const loadReplacement = `    const [ownResult, coloaderResult] = await Promise.allSettled([\n      isAir.value ? Promise.resolve([] as OwnLclConsolidationDto[]) : OwnLclConsolidationService.browse(),\n      LclRateSourceService.browseColoaders({\n        modality: props.modality,\n        polId: props.polId,\n        pol: props.polName || props.polCode || undefined,\n        poeId: props.poeId,\n        poe: isAir.value ? props.destinationLabel || undefined : undefined,\n        podId: props.podId,\n        incotermId: props.incotermId,\n        quoteDate: props.quoteDate,\n      }),\n    ])\n\n    ownRows.value = ownResult.status === 'fulfilled'\n      ? ownResult.value.map((row) => ({ ...row }))\n      : []\n    coloaderRows.value = coloaderResult.status === 'fulfilled'\n      ? coloaderResult.value.map((row) => ({ ...row }))\n      : []\n\n    const sourceErrors = [\n      ownResult.status === 'rejected' ? ownResult.reason : null,\n      coloaderResult.status === 'rejected' ? coloaderResult.reason : null,\n    ].filter(Boolean)\n    if (sourceErrors.length) {\n      error.value = sourceErrors\n        .map((value) => value instanceof Error ? value.message : String(value))\n        .join(' · ')\n    }`
      if (code.includes(routeAwareLoadAnchor)) {
        code = code.replace(routeAwareLoadAnchor, loadReplacement)
      } else if (code.includes(modalityLoadAnchor)) {
        code = code.replace(modalityLoadAnchor, loadReplacement)
      } else {
        code = replaceOne(code, legacyLoadAnchor, loadReplacement, 'independent LCL source loading')
      }

      return { code, map: null }
    },
  }
}

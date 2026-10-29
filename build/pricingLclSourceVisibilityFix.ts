import type { Plugin } from 'vite'

const LCL_SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingLclSourceVisibilityFix] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

/**
 * Make the independent LCL sources resilient without rewriting their filters.
 * In particular, !ownPoeEligible must remain on the own browse request AND on
 * the assignment, so a stale request cannot reveal incompatible consolidations.
 */
export function patchIndependentLclSourceLoading(source: string): string {
  let code = replaceOne(
    source,
    '    const [own, coloaders] = await Promise.all([',
    '    const [ownResult, coloaderResult] = await Promise.allSettled([',
    'independent LCL source loading',
  )

  const balboaGuardedRows = '    ownRows.value = ownPoeEligible.value ? own.map((row) => ({ ...row })) : []'
  const legacyRows = '    ownRows.value = own.map((row) => ({ ...row }))'
  const guardedReplacement = `    ownRows.value = ownResult.status === 'fulfilled' && ownPoeEligible.value
      ? ownResult.value.map((row) => ({ ...row }))
      : []`
  const legacyReplacement = `    ownRows.value = ownResult.status === 'fulfilled'
      ? ownResult.value.map((row) => ({ ...row }))
      : []`

  if (code.includes(balboaGuardedRows)) {
    code = replaceOne(code, balboaGuardedRows, guardedReplacement, 'Balboa-gated own LCL rows')
  } else {
    code = replaceOne(code, legacyRows, legacyReplacement, 'legacy own LCL rows')
  }

  const coloaderRows = '    coloaderRows.value = coloaders.map((row) => ({ ...row }))'
  const independentResult = `    coloaderRows.value = coloaderResult.status === 'fulfilled'
      ? coloaderResult.value.map((row) => ({ ...row }))
      : []

    const sourceErrors = [
      ownResult.status === 'rejected' ? ownResult.reason : null,
      coloaderResult.status === 'rejected' ? coloaderResult.reason : null,
    ].filter(Boolean)
    if (sourceErrors.length) {
      error.value = sourceErrors
        .map((value) => value instanceof Error ? value.message : String(value))
        .join(' · ')
    }`
  code = replaceOne(code, coloaderRows, independentResult, 'independent coloader response')
  return code
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
      if (code.includes(activeFilterAnchor)) {
        code = replaceOne(code, activeFilterAnchor, activeFilterReplacement, 'own LCL active filter')
      } else if (!code.includes(activeFilterReplacement)) {
        throw new Error('[pricingLclSourceVisibilityFix] Own LCL active filter missing or changed unexpectedly.')
      }

      // Browse own consolidations and coloaders independently. Preserve each source's
      // original query and guards (including the POE Balboa condition) instead of
      // duplicating a fragile, exact source-code block in this Vite plugin.
      code = patchIndependentLclSourceLoading(code)

      return { code, map: null }
    },
  }
}

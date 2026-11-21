/**
 * DH-389: live, read-only wizard-bundle lookups while modifying a persisted quote.
 *
 * This is the LAST source transform, after DH-386 (canonical endpoint) and
 * DH-387 (rate-detail delta logic). It never rebuilds historical RateDetails;
 * only the existing explicit-delta logic may add lines.
 */
export function patchPricingWizardEditBundle389(source: string): string {
  // Unit fixtures for the standalone DH-386 cost-contract are intentionally tiny.
  if (!source.includes('function quoteEditApplyDelta387()')) return source
  let code = source

  // DH-385's FTL transform replaces this loader after SFC source transforms.
  const loaderStart = code.indexOf('async function loadApplicableCosts() {')
  const loaderEnd = code.indexOf('\nfunction rebuildRateLines', loaderStart)
  if (loaderStart < 0 || loaderEnd < loaderStart) {
    throw new Error('[DH-389] Final wizard-bundle loader was not found')
  }
  let loader = code.slice(loaderStart, loaderEnd)
  if (!loader.includes('PricingService.selectWizardCosts(')) {
    throw new Error('[DH-389] Required wizard-bundle endpoint missing')
  }
  const beforeGuard = 'if (props.rateId && !allowCatalogRefreshForSavedQuote.value) return true'
  if (loader.split(beforeGuard).length !== 2) {
    throw new Error('[DH-389] Saved quotation catalog guard changed')
  }
  loader = loader.replace('async function loadApplicableCosts() {',
    'async function loadApplicableCosts(forQuoteEditContext = false) {')
  loader = loader.replace(beforeGuard,
    'if (props.rateId && !allowCatalogRefreshForSavedQuote.value && !forQuoteEditContext) return true')
  code = code.slice(0, loaderStart) + loader + code.slice(loaderEnd)

  // The P6 Merchant/Carrier comparison must consult the SAME endpoint,
  // even when only inspecting (never repricing) a saved quotation.
  const compareStart = code.indexOf('let dholeHaulageRequestVersion = 0')
  const p6Marker = '    const requestedContext = currentCostContextKey()'
  const p6Start = code.indexOf(p6Marker, compareStart)
  const p6Call = code.indexOf('      await loadApplicableCosts()', p6Start)
  const p6End = code.indexOf('      if (', p6Call)
  if (compareStart < 0 || p6Start < 0 || p6Call < 0 || p6End < 0
    || p6End - p6Call > 240) {
    throw new Error('[DH-389] P6 Merchant/Carrier comparison anchor changed')
  }
  code = code.slice(0, p6Call)
    + '      const pricesLoaded = await loadApplicableCosts(Boolean(props.rateId))\n'
    + '      if (!pricesLoaded) return\n'
    + code.slice(p6Call + '      await loadApplicableCosts()'.length)

  // Quotation edits must not auto-switch saved Merchant/Carrier choices.
  const selectionStart = code.indexOf('let dholeHaulageRequestVersion = 0')
  const selectionText = '      if (!validCurrent) {'
  const idx = code.indexOf(selectionText, selectionStart)
  if (idx < 0 || idx - selectionStart > 17000) {
    throw new Error('[DH-389] P6 automatic haulage selection guard missing')
  }
  code = code.slice(0, idx)
    + '      if (!validCurrent && !props.rateId) {'
    + code.slice(idx + selectionText.length)

  // Newly requested route-specific land Freight has its own CostId and MUST
  // not be discarded as if it were the 40HC ocean Freight base line.
  const appendStart = code.indexOf('function appendConfiguredCostToPersistedEdit(cost: CostSelectDto) {')
  const appendEnd = code.indexOf('\nfunction addIncotermFallbackLine(', appendStart)
  if (appendStart < 0 || appendEnd < appendStart) {
    throw new Error('[DH-389] Persisted edit line insertion anchor missing')
  }
  let append = code.slice(appendStart, appendEnd)
  const skipAllFreight = "  if (cost.costDetailType === 'Freight') return"
  if (append.split(skipAllFreight).length !== 2) {
    throw new Error('[DH-389] Freight source exclusion changed')
  }
  append = append.replace(skipAllFreight,
    "  if (cost.costDetailType === 'Freight'\n"
    + "      && !/terrestre|land freight/.test(normalizeCatalogValue(cost.name))) return")
  code = code.slice(0, appendStart) + append + code.slice(appendEnd)

  return code
}

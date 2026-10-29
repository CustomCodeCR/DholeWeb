import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { patchIndependentLclSourceLoading } from '../build/pricingLclSourceVisibilityFix.ts'
import { patchOwnLclRoutePreviewWatcher } from '../build/pricingLclCostBreakdownUi.ts'

const selector = readFileSync(
  new URL('../src/modules/pricing/components/PricingLclRateSourceSelector.vue', import.meta.url),
  'utf8',
)

test('independent loading retains the Balboa POE guard and the original coloader query', () => {
  const originalBrowse = '!ownPoeEligible.value ? Promise.resolve([] as OwnLclConsolidationDto[]) : OwnLclConsolidationService.browse()'
  const originalColoaderQuery = 'poe: isAir.value ? props.destinationLabel || undefined : undefined'
  assert.ok(selector.includes(originalBrowse))
  assert.ok(selector.includes(originalColoaderQuery))

  const transformed = patchIndependentLclSourceLoading(selector)
  assert.match(transformed, /const \[ownResult, coloaderResult\] = await Promise\.allSettled/)
  assert.ok(transformed.includes(originalBrowse))
  assert.ok(transformed.includes(originalColoaderQuery))
  assert.match(transformed, /ownResult\.status === 'fulfilled' && ownPoeEligible\.value/)
  assert.match(transformed, /coloaderResult\.status === 'fulfilled'/)
  assert.match(transformed, /ownResult\.status === 'rejected' \? ownResult\.reason : null/)
  assert.match(transformed, /coloaderResult\.status === 'rejected' \? coloaderResult\.reason : null/)
  assert.doesNotMatch(transformed, /const \[own, coloaders\] = await Promise\.all\(/)
  assert.doesNotMatch(transformed, /ownRows\.value = ownPoeEligible\.value \? own\.map/)
  assert.match(transformed, /if \(!ownPoeEligible\.value\) tab\.value = 'Coloader'/)
})

test('legacy own-LCL loading is still patched without depending on a specific query', () => {
  const legacy = [
    '    const [own, coloaders] = await Promise.all([',
    '      OwnLclConsolidationService.browse(),',
    '      LclRateSourceService.browseColoaders({ quoteDate: props.quoteDate }),',
    '    ])',
    '    ownRows.value = own.map((row) => ({ ...row }))',
    '    coloaderRows.value = coloaders.map((row) => ({ ...row }))',
  ].join('\n')
  const transformed = patchIndependentLclSourceLoading(legacy)
  assert.match(transformed, /Promise\.allSettled/)
  assert.match(transformed, /ownResult\.status === 'fulfilled'/)
  assert.doesNotMatch(transformed, /ownPoeEligible/)
  assert.match(transformed, /quoteDate: props\.quoteDate/)
})

test('unexpected selector layouts fail fast instead of silently disabling route filtering', () => {
  assert.throws(() => patchIndependentLclSourceLoading('unrelated source'), /independent LCL source loading/)
})


test('own-LCL preview watcher preserves Miami/Moín route props and chargeable dependencies', () => {
  const transformed = patchOwnLclRoutePreviewWatcher(selector)
  const watchers = [...transformed.matchAll(/watch\(\s*\(\)\s*=>\s*\[([^\]\n]*)\],\s*\(\)\s*=>\s*void load\(\),\s*\)/g)]
  assert.equal(watchers.length, 1)
  const dependencies = watchers[0][1].split(',').map((value) => value.trim())
  for (const field of [
    'props.poeId', 'props.poeCode', 'props.poeName',
    'props.polId', 'props.polCode', 'props.polName',
    'props.chargeableVolumeUnit', 'props.incotermCode', 'props.requestedCbm',
  ]) {
    assert.equal(dependencies.filter((dependency) => dependency === field).length, 1, 'missing or duplicate watcher dependency: ' + field)
  }
})

test('own-LCL watcher patch accepts legacy route fields and fails fast on missing/ambiguous anchors', () => {
  const legacy = 'watch(() => [props.polId, props.poeId, props.podId, props.quoteDate], () => void load())'
  const result = patchOwnLclRoutePreviewWatcher(legacy)
  for (const field of ['props.polId', 'props.poeId', 'props.podId', 'props.quoteDate', 'props.chargeableVolumeUnit']) {
    assert.ok(result.includes(field))
  }
  assert.throws(() => patchOwnLclRoutePreviewWatcher('unrelated file'), /route preview watcher anchor, found 0/)
  assert.throws(() => patchOwnLclRoutePreviewWatcher(legacy + '\n' + legacy), /route preview watcher anchor, found 2/)
})


test('Guangzhou lists the physical Yantian consolidation instead of Shanghai', () => {
  assert.ok(selector.includes("requestedOrigins.has('guangzhou') && consolidationOrigins.has('yantian')"))
  assert.ok(selector.includes("consolidationOrigin === 'yantian' && requestedOwnLclOrigins().has('guangzhou')"))
  assert.ok(selector.includes("return 'GUANGZHOU'"))
  assert.ok(!selector.includes("'shekou', 'guangzhou',"))
  assert.ok(selector.includes("if (!consolidationOrigins.has('shanghai')) return false"))
})

test('all Shanghai and Yantian own sources remain visible, without allowing invalid quotations', () => {
  const mobilePatch = readFileSync(
    new URL('../build/pricingLclCostBreakdownUi.ts', import.meta.url),
    'utf8',
  )
  assert.ok(selector.includes("const showAllOwnConsolidations = ref(true)"))
  assert.ok(selector.includes("if (!showAllOwnConsolidations.value && !ownConsolidationSupportsPol(row)) return false"))
  assert.ok(selector.includes("if (!ownConsolidationSupportsPoe(row)) return false"))
  assert.ok(selector.includes("if (row.isActive === false || normalize(row.status) === 'closed') return false"))
  assert.ok(selector.includes("function ownSelectionBlockReason(row: OwnLclConsolidationDto)"))
  assert.ok(selector.includes("if (!ownConsolidationSupportsPol(row)) return 'Otro POL'"))
  assert.ok(selector.includes("if (ownDepartureExpired(row)) return 'Revisar ETD'"))
  assert.ok(selector.includes("if (row.capacityReached === true || remainingCbm(row) + 0.000001 < requested()) return 'Sin capacidad'"))
  assert.ok(selector.includes(':disabled="Boolean(ownSelectionBlockReason(row))"'))
  assert.ok(selector.includes("showAllOwnConsolidations = !showAllOwnConsolidations"))
  assert.ok(mobilePatch.includes(':disabled="Boolean(ownSelectionBlockReason(row))"'))
  assert.ok(mobilePatch.includes("await loadOwnPreviews(ownRows.value.filter((row) => ownConsolidationSupportsPoe(row)))"))
  assert.ok(mobilePatch.includes("{{ ownConsolidationSupportsPol(row) ? selectedPolDisplay(ownPreview(row)) : (row.polName || row.polCode || 'Otro origen') }}"))
  assert.ok(mobilePatch.includes("canonicalOwnLclOrigin(row.polName || row.polCode) === 'shanghai'"))
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { patchIndependentLclSourceLoading } from '../build/pricingLclSourceVisibilityFix.ts'

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

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../src/modules/dynamics/views/DynamicsQuoteSyncIssues.vue', import.meta.url),
  'utf8',
)
const css = source.split('<style scoped>')[1]?.split('</style>')[0] || ''

test('quote card content uses its full width instead of competing with the actions', () => {
  assert.match(css, /\.quote-sync-item\s*\{[^}]*display:grid;grid-template-columns:minmax\(0,1fr\)/)
  assert.match(css, /\.quote-sync-main\s*\{[^}]*min-width:0;width:100%;max-width:100%/)
  assert.match(css, /\.quote-sync-actions\s*\{[^}]*display:flex;flex-wrap:wrap;[^}]*width:100%;min-width:0/)
  assert.doesNotMatch(css, /\.quote-sync-actions\s*\{[^}]*flex-shrink:0/)
})

test('all Dynamics queue action buttons receive local styles and can wrap on narrow screens', () => {
  assert.match(css, /\.quote-sync-actions \.dynamics-outline-button,\.quote-sync-actions \.dynamics-primary-button\s*\{[^}]*white-space:normal/)
  assert.match(css, /\.quote-sync-actions \.dynamics-outline-button\s*\{[^}]*border:1px/)
  assert.match(css, /\.quote-sync-actions \.dynamics-primary-button\s*\{[^}]*background:var\(--dh-primary\)/)
  assert.match(css, /@media\(max-width:600px\)[^\n]*\.quote-sync-actions>\.dynamics-outline-button/)
})

test('administrative adoption controls and diagnostics stay within their own rows', () => {
  assert.match(css, /\.quote-sync-actions>p,\.quote-sync-actions>\.quote-sync-adoption\s*\{[^}]*flex:1 0 100%/)
  assert.match(css, /\.quote-sync-diagnosis>div\s*\{min-width:0;flex:1\}/)
  assert.match(source, /class="quote-sync-actions"/)
  assert.match(source, /@click="resumePartial\(issue, true\)"/)
})

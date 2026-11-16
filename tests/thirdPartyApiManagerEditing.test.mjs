import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const view = readFileSync(new URL('../src/modules/integrations/views/ThirdPartyApisView.vue', import.meta.url), 'utf8')

test('editing saved endpoints detaches Vue reactive proxies', () => {
  const row = { id: 'id', inputs: [], outputs: [{ public: 'id', internal: 'id' }] }
  const reactiveProxy = new Proxy(row, {})
  assert.throws(() => structuredClone(reactiveProxy))
  const clone = JSON.parse(JSON.stringify(reactiveProxy))
  clone.outputs[0].public = 'codigo'
  assert.equal(row.outputs[0].public, 'id')
  assert.match(view, /draft\.value = cloneEndpoint\(row\)/)
  assert.match(view, /draft\.value = cloneEndpoint\(updated\)/)
  assert.doesNotMatch(view, /structuredClone\((?:row|updated)\)/)
})

test('publication still requires configured technical identity', () => {
  assert.match(view, /if \(!row\.enabled && !catalog\.value\.find\(t => t\.code === row\.target\)\?\.ready\)/)
})

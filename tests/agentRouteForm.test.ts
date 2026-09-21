import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'

// Exercise the actual form submit handler without mounting the surrounding UI.
const component = await readFile(new URL('../src/modules/agent/components/routes/AgentRouteForm.vue', import.meta.url), 'utf8')
const handler = stripTypeScriptTypes(component.slice(component.indexOf('async function save()'), component.indexOf('watch(() =>')))

async function submit(overrides = {}, editing = false) {
  const calls: { operation: string; payload: any }[] = []
  const warnings: string[] = []
  const context = {
    form: { name: '', polCode: 'CNSHA', polName: ' Shanghai ', poeCode: 'CRCAL', poeName: ' Caldera ', podCode: '', podName: '', sortOrder: '0', isActive: true, ...overrides },
    props: { profileId: 'profile', route: editing ? { id: 'route' } : null },
    saving: { value: false },
    t: (_key: string, args?: { field: string }) => args?.field ?? _key,
    toastStore: { warning: (_title: string, message: string) => warnings.push(message), success() {}, backendError(error: unknown) { throw error } },
    emit() {},
    AgentService: { routes: {
      async create(_profile: string, payload: any) { calls.push({ operation: 'create', payload }) },
      async update(_profile: string, _route: string, payload: any) { calls.push({ operation: 'update', payload }) },
    } },
  }
  await runInNewContext(`${handler}\nsave()`, context)
  return { calls, warnings }
}

for (const editing of [false, true]) {
  test(`${editing ? 'update' : 'create'} accepts POL and POE with no POD`, async () => {
    const { calls, warnings } = await submit({}, editing)
    assert.equal(warnings.length, 0)
    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.payload.podName, null)
    assert.equal(calls[0]!.payload.podCode, null)
    assert.equal(calls[0]!.payload.poeName, 'Caldera')
  })
}
for (const [field, label] of [['polName', 'POL Name'], ['poeName', 'POE Name']]) {
  test(`rejects empty ${label}`, async () => {
    const { calls, warnings } = await submit({ [field!]: ' ', podName: 'San José' })
    assert.equal(calls.length, 0)
    assert.deepEqual(warnings, [label])
  })
}
test('preserves a supplied POD', async () => {
  const { calls } = await submit({ podName: ' San José ', podCode: ' CRSJO ' })
  assert.equal(calls[0]!.payload.podName, 'San José')
  assert.equal(calls[0]!.payload.podCode, 'CRSJO')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { MARKETING_GROUPS, localizeMarketing } from '../src/modules/marketing/config/marketingNavigation.ts'

test('FASE 35 presents human Marketing labels without breaking legacy navigation keys', () => {
  const allItems = MARKETING_GROUPS.flatMap((group) => group.items)
  const byKey = new Map(allItems.map((item) => [item.key, item]))

  assert.equal(localizeMarketing(byKey.get('dashboard')!.title, 'es'), 'Inicio')
  assert.equal(localizeMarketing(byKey.get('design-placements')!.title, 'es'), 'Ubicaciones del sitio')
  assert.equal(localizeMarketing(byKey.get('design-collections')!.title, 'es'), 'Colecciones de contenido')
  assert.equal(localizeMarketing(byKey.get('seo-redirects')!.title, 'es'), 'Cambios de dirección')
  assert.equal(localizeMarketing(byKey.get('capture-submissions')!.title, 'es'), 'Respuestas recibidas')
  assert.equal(localizeMarketing(byKey.get('capture-leads')!.title, 'es'), 'Contactos interesados')
  assert.equal(byKey.get('design-placements')!.label, 'Placements')
})

test('FASE 35 switches the normal content flow to the simplified Dhole workspace', async () => {
  const view = await readFile(new URL('../src/modules/marketing/views/MarketingView.vue', import.meta.url), 'utf8')
  const workspace = await readFile(new URL('../src/modules/marketing/components/MarketingContentWorkspace.vue', import.meta.url), 'utf8')

  assert.match(view, /MarketingContentWorkspace/)
  assert.doesNotMatch(view, /MarketingContentTab/)
  for (const component of ['DhDrawer', 'DhMediaPicker', 'DhConfirmDialog', 'DhButton', 'DhInput', 'DhTextarea', 'DhSelect', 'DhSwitch']) {
    assert.ok(workspace.includes(component), `Expected ${component} in simplified Marketing workspace`)
  }
  assert.doesNotMatch(workspace, /window\.prompt\s*\(/)
  assert.doesNotMatch(workspace, /window\.confirm\s*\(/)
  assert.doesNotMatch(workspace, /JSON-LD/)
  assert.doesNotMatch(workspace, /MediaReferenceId/)
  assert.doesNotMatch(workspace, /SettingsJson/)
})

test('FASE 35 resource views no longer expose internal ids or json as primary content', async () => {
  const resource = await readFile(new URL('../src/modules/marketing/components/MarketingResourceTab.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(resource, /Submission \$\{item\.id\.slice/)
  assert.doesNotMatch(resource, /item\.settingsJson/)
  assert.doesNotMatch(resource, /item\.allowedTypesJson/)
  assert.doesNotMatch(resource, /meetingTypeId\.slice/)
  assert.match(resource, /Respuesta recibida/)
  assert.match(resource, /Cambio permanente/)
})

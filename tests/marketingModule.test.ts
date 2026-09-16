import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { CONTENT_SCOPES } from '../src/core/auth/scopes.ts'
import { MARKETING_GROUPS, MARKETING_SECTION_KEYS, isMarketingSection } from '../src/modules/marketing/config/marketingNavigation.ts'
import { CMS_MOTION_PRESETS } from '../src/core/interfaces/pageBuilder.ts'

test('phase 22 exposes every requested Marketing menu group', () => {
  const phase22Groups = MARKETING_GROUPS.map((group) => group.label).filter((label) => label && label !== 'IA')
  assert.deepEqual(phase22Groups, ['Contenido', 'Multimedia', 'Diseño', 'SEO', 'Captación', 'Reuniones', 'Campañas', 'Publicación', 'Configuración'])
  assert.equal(MARKETING_SECTION_KEYS.length, 35)
  assert.equal(MARKETING_GROUPS[0]?.items[0]?.label, 'Dashboard')
})

test('phase 22 contains all requested Marketing menu entries plus FASE 35 animations', () => {
  const labels = MARKETING_GROUPS.flatMap((group) => group.items.map((item) => item.label))
  for (const expected of [
    'Páginas', 'Noticias', 'Artículos', 'Videos', 'Bloques reutilizables', 'Biblioteca', 'Imágenes', 'Documentos',
    'Banners', 'Animaciones', 'Placements', 'Menús', 'Collections', 'SEO de páginas', 'Redirects', 'Sitemap', 'Configuración global',
    'Formularios', 'Submissions', 'Leads', 'Tipos de reunión', 'Solicitudes', 'Agenda', 'Campañas', 'Landing Pages',
    'Calendario', 'Pendientes de aprobación', 'Programados', 'Historial', 'Información del sitio', 'Redes sociales', 'Datos de contacto',
  ]) assert.ok(labels.includes(expected), `Missing Marketing menu entry: ${expected}`)
})

test('Marketing section query guard only accepts registered sections', () => {
  assert.equal(isMarketingSection('capture-leads'), true)
  assert.equal(isMarketingSection('campaigns-campaigns'), true)
  assert.equal(isMarketingSection('design-animations'), true)
  assert.equal(isMarketingSection('ai-assistant'), true)
  assert.equal(isMarketingSection('unknown-section'), false)
  assert.equal(isMarketingSection(null), false)
})

test('Marketing service consumes the real ContentService phase 15-21 endpoints', async () => {
  const source = await readFile(new URL('../src/core/services/marketingService.ts', import.meta.url), 'utf8')
  for (const endpoint of ['/api/content/forms/', '/api/content/submissions/', '/api/content/leads/', '/api/content/meetings/types', '/api/content/meetings/requests', '/api/content/campaigns/', '/api/content/placements/', '/api/content/collections/', '/api/content/redirects/', '/api/content/sites/']) assert.ok(source.includes(endpoint), `Missing backend integration: ${endpoint}`)
})

test('Marketing dashboard includes the eight phase 22 indicators', async () => {
  const source = await readFile(new URL('../src/modules/marketing/views/MarketingView.vue', import.meta.url), 'utf8')
  for (const label of ['Contenido publicado', 'Drafts', 'Pendientes', 'Programados', 'Leads', 'Formularios', 'Reuniones', 'Campañas']) assert.ok(source.includes(`label: '${label}'`), `Missing dashboard indicator: ${label}`)
})

test('phase 23 exposes every granular Marketing scope while preserving legacy scopes', () => {
  const granular = [CONTENT_SCOPES.navigation.edit, CONTENT_SCOPES.collections.edit, CONTENT_SCOPES.forms.view, CONTENT_SCOPES.forms.edit, CONTENT_SCOPES.submissions.view, CONTENT_SCOPES.leads.view, CONTENT_SCOPES.leads.edit, CONTENT_SCOPES.meetings.view, CONTENT_SCOPES.meetings.edit, CONTENT_SCOPES.campaigns.view, CONTENT_SCOPES.campaigns.edit, CONTENT_SCOPES.redirects.edit, CONTENT_SCOPES.reviews.submit, CONTENT_SCOPES.reviews.approve]
  assert.deepEqual(granular, ['cms.navigation.edit', 'cms.collections.edit', 'cms.forms.view', 'cms.forms.edit', 'cms.submissions.view', 'cms.leads.view', 'cms.leads.edit', 'cms.meetings.view', 'cms.meetings.edit', 'cms.campaigns.view', 'cms.campaigns.edit', 'cms.redirects.edit', 'cms.reviews.submit', 'cms.reviews.approve'])
  assert.equal(CONTENT_SCOPES.view, 'cms.view')
  assert.equal(CONTENT_SCOPES.edit, 'cms.edit')
  assert.equal(CONTENT_SCOPES.publish, 'cms.publish')
})

test('phase 25 exposes the AI assistant inside Marketing without adding a publishing path', async () => {
  const view = await readFile(new URL('../src/modules/marketing/views/MarketingView.vue', import.meta.url), 'utf8')
  const assistant = await readFile(new URL('../src/modules/marketing/components/MarketingAiTab.vue', import.meta.url), 'utf8')
  const labels = MARKETING_GROUPS.flatMap((group) => group.items.map((item) => item.label))
  assert.ok(labels.includes('Asistente IA'))
  assert.ok(view.includes("activeSection === 'ai-assistant'"))
  assert.ok(assistant.includes('AiService.executeChat'))
  assert.ok(assistant.includes('Aprobar resultado'))
  assert.equal(assistant.includes('.publish('), false)
  assert.equal(assistant.includes('publishEditor('), false)
  assert.equal(assistant.includes('scheduleEditor('), false)
  assert.equal(assistant.includes('submitEditor('), false)
})

test('master phase 3 exposes Article as the existing Post content type and quick-create flow', async () => {
  const view = await readFile(new URL('../src/modules/marketing/views/MarketingView.vue', import.meta.url), 'utf8')
  assert.match(view, /'content-posts': \{ type: 'Post', title: tr\('Artículos', 'Articles'\), singular: tr\('Artículo', 'Article'\) \}/)
  assert.ok(view.includes("action: 'article'"))
  assert.ok(view.includes("createContent('content-posts')"))
  assert.ok(MARKETING_GROUPS.flatMap((group) => group.items.map((item) => item.label)).includes('Artículos'))
})

test('master phase 3 reuses preview and revision services in the content workspace', async () => {
  const workspace = await readFile(new URL('../src/modules/marketing/components/MarketingContentWorkspace.vue', import.meta.url), 'utf8')
  for (const fragment of [
    'MarketingLivePreview',
    'ContentService.getRevisions',
    'ContentService.restoreRevision',
    "value: 'Rejected'",
    'ContentService.scheduleEditor',
    "tr('Vista previa del borrador', 'Draft preview')",
    "tr('Historial de revisiones', 'Revision history')",
  ]) assert.ok(workspace.includes(fragment), `Missing master phase 3 workspace integration: ${fragment}`)
})

test('master phase 3 keeps the frontend content DTO aligned with revision, taxonomy and CMS metadata fields', async () => {
  const contracts = await readFile(new URL('../src/core/interfaces/content.ts', import.meta.url), 'utf8')
  for (const fragment of ['taxonomyTermIds: string[]', "'Rejected'", 'parentContentId?: string | null', 'templateKey?: string | null', 'sitemapPriority?: number | null']) {
    assert.ok(contracts.includes(fragment), `Missing content contract field: ${fragment}`)
  }
})

test('FASE 35 exposes all Fennec motion presets to Marketing with matching defaults and ranges', async () => {
  const source = await readFile(new URL('../src/core/marketing/contentMotion.ts', import.meta.url), 'utf8')
  assert.equal(CMS_MOTION_PRESETS.length, 13)
  for (const fragment of [
    "preset: 'none'", 'duration: 600', 'delay: 0', "easing: 'standard'", 'stagger: 100',
    "trigger: 'scroll'", 'once: true', 'distance: 32', '0, 3000', '0, 1000', '0, 160',
  ]) assert.ok(source.includes(fragment), `Missing FASE 35 motion contract fragment: ${fragment}`)
  assert.match(source, /normalizeCmsAnimation/)
  assert.match(source, /validateCmsAnimation/)
})

test('FASE 35 integrates Marketing with Page Builder without executing FASE 36 runtime motion', async () => {
  const service = await readFile(new URL('../src/core/services/pageBuilderService.ts', import.meta.url), 'utf8')
  const panel = await readFile(new URL('../src/modules/marketing/components/MarketingAnimationTab.vue', import.meta.url), 'utf8')
  const view = await readFile(new URL('../src/modules/marketing/views/MarketingView.vue', import.meta.url), 'utf8')
  assert.match(service, /\/api\/content\/page-builder\//)
  assert.match(panel, /animationJson:\s*JSON\.stringify/)
  assert.match(view, /MarketingAnimationTab/)
  assert.doesNotMatch(panel, /IntersectionObserver/)
  assert.doesNotMatch(panel, /CmsMotion/)
})

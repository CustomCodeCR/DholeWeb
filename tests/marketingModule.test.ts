import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { MARKETING_GROUPS, MARKETING_SECTION_KEYS, isMarketingSection } from '../src/modules/marketing/config/marketingNavigation.ts'

test('phase 22 exposes every requested Marketing menu group', () => {
  assert.deepEqual(
    MARKETING_GROUPS.map((group) => group.label).filter(Boolean),
    ['Contenido', 'Multimedia', 'Diseño', 'SEO', 'Captación', 'Reuniones', 'Campañas', 'Publicación', 'Configuración'],
  )
  assert.equal(MARKETING_SECTION_KEYS.length, 33)
  assert.equal(MARKETING_GROUPS[0]?.items[0]?.label, 'Dashboard')
})

test('phase 22 contains all requested Marketing menu entries', () => {
  const labels = MARKETING_GROUPS.flatMap((group) => group.items.map((item) => item.label))
  for (const expected of [
    'Páginas', 'Noticias', 'Posts', 'Videos', 'Bloques reutilizables',
    'Biblioteca', 'Imágenes', 'Documentos',
    'Banners', 'Placements', 'Menús', 'Collections',
    'SEO de páginas', 'Redirects', 'Sitemap', 'Configuración global',
    'Formularios', 'Submissions', 'Leads',
    'Tipos de reunión', 'Solicitudes', 'Agenda',
    'Campañas', 'Landing Pages',
    'Calendario', 'Pendientes de aprobación', 'Programados', 'Historial',
    'Información del sitio', 'Redes sociales', 'Datos de contacto',
  ]) {
    assert.ok(labels.includes(expected), `Missing Marketing menu entry: ${expected}`)
  }
})

test('Marketing section query guard only accepts registered sections', () => {
  assert.equal(isMarketingSection('capture-leads'), true)
  assert.equal(isMarketingSection('campaigns-campaigns'), true)
  assert.equal(isMarketingSection('unknown-section'), false)
  assert.equal(isMarketingSection(null), false)
})

test('Marketing service consumes the real ContentService phase 15-21 endpoints', async () => {
  const source = await readFile(new URL('../src/core/services/marketingService.ts', import.meta.url), 'utf8')
  for (const endpoint of [
    '/api/content/forms/',
    '/api/content/submissions/',
    '/api/content/leads/',
    '/api/content/meetings/types',
    '/api/content/meetings/requests',
    '/api/content/campaigns/',
    '/api/content/placements/',
    '/api/content/collections/',
    '/api/content/redirects/',
    '/api/content/sites/',
  ]) {
    assert.ok(source.includes(endpoint), `Missing backend integration: ${endpoint}`)
  }
})

test('Marketing dashboard includes the eight phase 22 indicators', async () => {
  const source = await readFile(new URL('../src/modules/marketing/views/MarketingView.vue', import.meta.url), 'utf8')
  for (const label of ['Contenido publicado', 'Drafts', 'Pendientes', 'Programados', 'Leads', 'Formularios', 'Reuniones', 'Campañas']) {
    assert.ok(source.includes(`label: '${label}'`), `Missing dashboard indicator: ${label}`)
  }
})

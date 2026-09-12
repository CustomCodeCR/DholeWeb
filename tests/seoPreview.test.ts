import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSeoPreview, validateSeoInput } from '../src/core/seo/seoPreview.ts'

test('SEO preview uses explicit values and canonical URL', () => {
  const preview = buildSeoPreview({
    title: 'Título contenido',
    slug: 'servicios',
    excerpt: 'Resumen',
    seoTitle: 'Título SEO',
    seoDescription: 'Descripción SEO',
    canonicalUrl: 'https://example.com/servicios',
  })
  assert.equal(preview.title, 'Título SEO')
  assert.equal(preview.description, 'Descripción SEO')
  assert.equal(preview.url, 'https://example.com/servicios')
})

test('SEO preview falls back to content title, excerpt and slug', () => {
  const preview = buildSeoPreview({ title: 'Servicios', slug: '/servicios', excerpt: 'Resumen' })
  assert.equal(preview.title, 'Servicios')
  assert.equal(preview.description, 'Resumen')
  assert.equal(preview.url, 'https://sitio/servicios')
})

test('SEO validation rejects invalid canonical URL and JSON-LD', () => {
  assert.match(validateSeoInput({ canonicalUrl: '/relative' }) ?? '', /canónica/)
  assert.match(validateSeoInput({ structuredDataJson: 'not-json' }) ?? '', /JSON-LD/)
})

test('SEO validation accepts valid canonical, robots and JSON-LD', () => {
  assert.equal(validateSeoInput({
    canonicalUrl: 'https://example.com/page',
    robots: 'index,follow',
    structuredDataJson: '{"@context":"https://schema.org","@type":"WebPage"}',
  }), null)
})

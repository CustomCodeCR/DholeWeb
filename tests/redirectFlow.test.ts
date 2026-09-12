import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePublicPath, shouldCreatePermanentRedirect } from '../src/core/redirects/redirectFlow.ts'

test('normalizes public paths like ContentService routes', () => {
  assert.equal(normalizePublicPath('Servicios//Maritimo/'), '/servicios/maritimo')
  assert.equal(normalizePublicPath('/'), '/')
})

test('offers permanent redirect only when route really changes', () => {
  assert.equal(shouldCreatePermanentRedirect('/servicios', '/servicios/'), false)
  assert.equal(shouldCreatePermanentRedirect('/servicios', '/servicios-nuevos'), true)
})

test('does not offer redirect without both paths', () => {
  assert.equal(shouldCreatePermanentRedirect('', '/nuevo'), false)
  assert.equal(shouldCreatePermanentRedirect('/viejo', ''), false)
})

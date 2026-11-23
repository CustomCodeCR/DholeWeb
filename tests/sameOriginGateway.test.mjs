import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveGatewayBaseUrl } from '../src/core/api/sameOriginGateway.ts'

test('production Gateway requests use the Web origin for trusted matching hosts', () => {
  assert.equal(resolveGatewayBaseUrl(
    'https://api.logisticacastrofallas.com/',
    'https://sistema.logisticacastrofallas.com',
  ), '')
})

test('staging Gateway requests use the Web origin for trusted matching hosts', () => {
  assert.equal(resolveGatewayBaseUrl(
    'https://dhole-api.customcodecr.com',
    'https://dhole.customcodecr.com',
  ), '')
})

test('unrecognized, custom or local hosts keep their original API URL', () => {
  assert.equal(resolveGatewayBaseUrl(
    'https://api.external.example.com/',
    'https://sistema.logisticacastrofallas.com',
  ), 'https://api.external.example.com')
  assert.equal(resolveGatewayBaseUrl(
    'http://localhost:5200',
    'http://localhost:5173',
  ), 'http://localhost:5200')
  assert.equal(resolveGatewayBaseUrl(
    'https://api.logisticacastrofallas.com',
    'https://unknown.example.com',
  ), 'https://api.logisticacastrofallas.com')
})

test('nginx forwards API requests to the Gateway without losing authorization', () => {
  const nginx = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8')
  assert.match(nginx, /location \/api\/ \{/)
  assert.match(nginx, /proxy_pass \$dhole_gateway\$request_uri;/)
  assert.match(nginx, /proxy_set_header Authorization \$http_authorization;/)
  assert.match(nginx, /location ~ \^\/api\/\(crm\|config\/srm\)\/hacienda\/lookup\$/)
})

test('catalog lookup cache is session-bound and invalidates on catalog mutations', () => {
  const service = readFileSync(new URL('../src/core/services/catalogItemsService.ts', import.meta.url), 'utf8')
  assert.match(service, /catalogLookupsInFlight/)
  assert.match(service, /auth\.sessionId/)
  assert.match(service, /getTransientAccessToken/)
  assert.match(service, /dhole:data:changed/)
  assert.match(service, /CATALOG_LOOKUP_TTL_MS = 60_000/)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
const read = (name: string) => readFileSync(name, 'utf8')
test('CRM Hacienda POST and legacy SRM GET use restricted same-origin route with authenticated Gateway', () => {
  const nginx = read('nginx.conf')
  const api = read('src/modules/crm/services/crmApi.ts')
  assert.ok(nginx.includes('location ~ ^/api/(crm|config/srm)/hacienda/lookup$'))
  assert.ok(nginx.includes('proxy_pass $dhole_hacienda_gateway$request_uri'))
  assert.ok(nginx.includes('proxy_set_header Authorization $http_authorization'))
  assert.ok(nginx.includes('resolver 127.0.0.11'))
  assert.ok(nginx.includes('access_log off;'))
  assert.ok(nginx.includes('limit_except GET POST { deny all; }'))
  assert.ok(nginx.includes('proxy_set_header Cookie ""'))
  assert.ok(api.includes("const endpoint = '/api/crm/hacienda/lookup'"))
  assert.ok(api.includes("return await fetchClient<T>(endpoint"))
  assert.ok(api.includes("method: 'POST'"))
  assert.ok(api.includes("credentials: 'omit'"))
  assert.ok(api.includes("identificacion: params.get('identificacion')"))
  assert.ok(api.includes("countryId: params.get('countryId')"))
  assert.ok(api.includes('return fetchClient<T>(endpoint +'))
  assert.ok(read('src/modules/crm/components/CrmHaciendaLookup.vue').includes('crmHaciendaRequest<HaciendaResult>(params)'))
  assert.ok(read('src/modules/crm/views/CrmRecordDetailView.vue').includes('crmHaciendaRequest<HaciendaResult>(params)'))
  assert.ok(read('src/modules/srm/services/srmApi.ts').includes("fetchClient<SrmHaciendaResult>(base + '/hacienda/lookup?' + query, { method: 'GET' }, '')"))
})
test('nginx accepts large scoped JWT request headers before route matching', () => {
  const nginx = read('nginx.conf')
  const route = '    location ~ ^/api/(crm|config/srm)/hacienda/lookup$'
  const routeOffset = nginx.indexOf(route)
  assert.ok(routeOffset > 0)
  const serverSettings = nginx.slice(0, routeOffset)
  assert.match(serverSettings, /^    client_header_buffer_size 16k;$/m)
  assert.match(serverSettings, /^    large_client_header_buffers 4 32k;$/m)
  // Authentication stays enabled and cookies are never forwarded to Gateway.
  assert.ok(nginx.includes('proxy_set_header Authorization $http_authorization;'))
  assert.ok(nginx.includes('proxy_set_header Cookie "";'))
})

test('Hacienda same-origin request retains common authenticated and impersonated JWT', () => {
  const client = read('src/core/api/fetchConfig.ts')
  assert.ok(client.includes('getUsableAccessToken(endpoint)'))
  assert.ok(client.includes('getTransientAccessToken'))
  assert.ok(client.includes('fetch(`${baseUrl}${endpoint}`, config)'))
})

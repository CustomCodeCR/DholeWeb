<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Database,
  Globe2, KeyRound, Pencil, Plus, Power, RefreshCw, Search, ChevronDown, ShieldCheck, Trash2,
} from 'lucide-vue-next'
import { fetchClient } from '@/core/api/fetchConfig'
import { ApiError } from '@/core/api/apiErrorHandler'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhTextarea from '@/shared/components/atoms/DhTextarea.vue'
import DhMultiSelect from '@/shared/components/atoms/DhMultiSelect.vue'
import DhModal from '@/shared/components/organisms/DhModal.vue'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type Mapping = { public: string; internal: string; required: boolean }
type FieldOption = { public: string; internal: string; label: string; required: boolean; selected: boolean; type?: string; group?: string }
type ApprovedTarget = {
  code: string; service: string; method: HttpMethod; path: string
  description: string; ready?: boolean
  inputFields: FieldOption[]; outputFields: FieldOption[]
  nestedInputFields?: Record<string, FieldOption[]>
}
type PublishedEndpoint = {
  id: string; name: string; slug: string; target: string
  inputs: Mapping[]; outputs: Mapping[]; responseRoot: string | null; enabled: boolean
  defaults?: Record<string, unknown>
}
type ServiceEntry = { service: string; prefix: string }
type DiscoveryResult = { service: string; documented: boolean; message: string; routes: ApprovedTarget[] }
type ManagerStatus = { routesRegistered: boolean; storageReady: boolean; message: string }
type KeyInfo = {
  id: string; label: string; prefix: string; active: boolean; expiresAt: string
  maxRequestsPerMinute: number; createdAt: string; lastUsedAt: string | null; endpointIds?: string[]
}

const root = '/api/integrations/third-party'
const base = (import.meta.env.VITE_API_URL || 'https://api.logisticacastrofallas.com').replace(/\/+$/, '')
const endpoints = ref<PublishedEndpoint[]>([])
const endpointsLoaded = ref(false)
const keyRegistryLoaded = ref(false)
const managerStatus = ref<ManagerStatus | null>(null)
const catalog = ref<ApprovedTarget[]>([])
const serviceInventory = ref<ServiceEntry[]>([])
const discoveryMessage = ref('')
const discoveryLoading = ref(false)
const manualRoute = ref('')
const routeSearch = ref('')
const serviceFilter = ref('')
const newInputPublic = ref('')
const newInputInternal = ref('')
const newOutputPublic = ref('')
const newOutputInternal = ref('')
const activePanel = ref<'apis' | 'keys'>('apis')
const keyRegistry = ref<KeyInfo[]>([])
const keyLabel = ref('')
const editingKeyId = ref('')
const keyEndpointIds = ref<string[]>([])
const keyBusy = ref(false)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const search = ref('')
const drawer = ref(false)
const step = ref(1)
const method = ref<HttpMethod>('GET')
const service = ref('pricing')
const expiresDays = ref('90')
const maxPerMinute = ref('30')
const secretModal = ref(false)
const issuedSecret = ref('')
const issuedLabel = ref('')
const testApiKey = ref('')
const testPayload = ref('{}')
const testId = ref('')
const mutationConfirmed = ref(false)
const testRunning = ref(false)
const testError = ref('')
const testResponse = ref('')
const testResult = ref<{ status: number; durationMs: number; ok: boolean } | null>(null)
const confirmRevoke = ref<KeyInfo | null>(null)
type CrmAccount = { id: string; displayName: string; executiveUserId?: string | null; isCastroFallasExecutive?: boolean }
const crmQuery = ref('')
const crmAccounts = ref<CrmAccount[]>([])
const crmLoading = ref(false)
const crmSelection = ref('')
const defaultErrors = ref('')
const defaultDrafts = ref<Record<string, string>>({})
async function searchCrmAccounts() {
  crmLoading.value = true
  defaultErrors.value = ''
  try {
    const result = await fetchClient<{ items: CrmAccount[] }>(
      '/api/crm/accounts?q=' + encodeURIComponent(crmQuery.value.trim()) + '&pageSize=30', { method: 'GET' })
    crmAccounts.value = result.items ?? []
  } catch (e) { defaultErrors.value = e instanceof Error ? e.message : 'No fue posible consultar CRM.' }
  finally { crmLoading.value = false }
}
function setLockedDefault(internal: string, value: unknown) {
  const entries = { ...(draft.value.defaults ?? {}) }
  entries[internal] = value
  draft.value.defaults = entries
  draft.value.inputs = draft.value.inputs.filter(f => f.internal !== internal)
}
async function useCrmAccount(id: string) {
  const account = crmAccounts.value.find(a => a.id === id)
  if (!account) return
  defaultErrors.value = ''
  if (!account.executiveUserId || account.executiveUserId === '00000000-0000-0000-0000-000000000000' ||
    account.isCastroFallasExecutive) {
    defaultErrors.value = 'La cuenta necesita un ejecutivo de ventas activo asignado en CRM.'
    return
  }
  try {
    const assignment = await fetchClient<{ displayName?: string | null }>(
      '/api/crm/accounts/' + encodeURIComponent(id) + '/assigned-executive', { method: 'GET' })
    if (!assignment.displayName) throw new Error('No se pudo resolver el ejecutivo asignado en CRM.')
    setLockedDefault('clientName', account.displayName)
    setLockedDefault('sellerUserId', account.executiveUserId)
    setLockedDefault('executiveName', assignment.displayName)
    crmSelection.value = id
  } catch (e) { defaultErrors.value = e instanceof Error ? e.message : 'Ejecutivo no disponible.' }
}
function changeDefault(field: FieldOption, value: string) {
  if (!value.trim()) { removeDefault(field.internal); return }
  if (field.type === 'UUID' && !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.trim())) {
    defaultErrors.value = 'Ingresá un UUID válido para ' + field.label
    return
  }
  try {
    const parsed = ['JSON', 'lista', 'número', 'booleano'].includes(field.type ?? '')
      ? JSON.parse(value) : value
    setLockedDefault(field.internal, parsed)
    defaultErrors.value = ''
  } catch { defaultErrors.value = 'Valor JSON inválido para ' + field.label }
}
function removeDefault(internal: string) {
  const entries = { ...(draft.value.defaults ?? {}) }
  delete entries[internal]
  draft.value.defaults = entries
}
const defaultCandidates = computed(() => method.value === 'GET' ? [] : inputCatalog.value.filter(f =>
  f.internal !== 'payload' && !f.internal.startsWith('payload.') &&
  !Object.prototype.hasOwnProperty.call(draft.value.defaults ?? {}, f.internal)))


const METHODS: { value: HttpMethod; label: string; detail: string }[] = [
  { value: 'GET', label: 'Consultar', detail: 'Obtener información' },
  { value: 'POST', label: 'Crear', detail: 'Registrar información nueva' },
  { value: 'PUT', label: 'Actualizar', detail: 'Modificar un registro' },
  { value: 'PATCH', label: 'Parcial', detail: 'Modificar campos específicos' },
  { value: 'DELETE', label: 'Eliminar', detail: 'Eliminar información' },
]
const blank = (): PublishedEndpoint => ({
  id: '', name: '', slug: '', target: '', inputs: [], outputs: [], responseRoot: null, enabled: false, defaults: {},
})
// Vue stores endpoint DTOs in reactive proxies, which structuredClone cannot copy.
// The contract is JSON-only; detach it before editing so Cancel never mutates the list.
const cloneEndpoint = (value: PublishedEndpoint): PublishedEndpoint =>
  JSON.parse(JSON.stringify(value)) as PublishedEndpoint
const draft = ref<PublishedEndpoint>(blank())
const isNew = computed(() => !draft.value.id)
const selectedTarget = computed(() => catalog.value.find(t => t.code === draft.value.target))
const ready = computed(() => selectedTarget.value?.ready === true)
const inputCatalog = computed(() => selectedTarget.value?.inputFields ?? [])
const outputCatalog = computed(() => selectedTarget.value?.outputFields ?? [])
const fieldCatalogLoaded = computed(() =>
  Boolean(selectedTarget.value && Array.isArray(selectedTarget.value.inputFields) && Array.isArray(selectedTarget.value.outputFields)))
const mandatoryInputs = computed(() => inputCatalog.value.filter(f => f.required && !Object.prototype.hasOwnProperty.call(draft.value.defaults ?? {}, f.internal)))
const optionalInputOptions = computed(() => inputCatalog.value.filter(f => !f.required)
  .map(f => ({ value: f.public, label: f.label, description: [f.group, f.type].filter(Boolean).join(' · ') })))
const outputOptions = computed(() => outputCatalog.value.map(f =>
  ({ value: f.public, label: f.label, description: [f.group, f.type].filter(Boolean).join(' · ') })))
const nestedStructures = computed(() => Object.entries(selectedTarget.value?.nestedInputFields ?? {})
  .map(([name, fields]) => ({
    name, fields, selected: draft.value.inputs.some(f => f.public === name),
    label: inputCatalog.value.find(f => f.public === name)?.label || name,
  }))
  .filter(section => section.selected && section.fields.length > 0))
function selectAllInputs() {
  selectedOptionalInputs.value = inputCatalog.value.filter(f => !f.required &&
    !Object.prototype.hasOwnProperty.call(draft.value.defaults ?? {}, f.internal)).map(f => f.public)
}
function clearOptionalInputs() { selectedOptionalInputs.value = [] }
function selectAllOutputs() { selectedOutputs.value = outputCatalog.value.map(f => f.public) }
function clearOutputs() { selectedOutputs.value = [] }
function mapSelected(options: FieldOption[], selected: string[]): Mapping[] {
  return options.filter(option => option.required || selected.includes(option.public))
    .map(option => ({ public: option.public, internal: option.internal, required: option.required }))
}
const selectedOptionalInputs = computed<string[]>({
  get: () => draft.value.inputs.filter(f => !mandatoryInputs.value.some(x => x.public === f.public))
    .map(f => f.public),
  set: values => {
    // Whole payload and individually selected nested payload fields are exclusive.
    // Selecting any nested field automatically switches to granular mode.
    const granular = draft.value.target === 'pricing-rate-request-create' &&
      values.some(value => inputCatalog.value.find(f => f.public === value)?.internal.startsWith('payload.'))
    const selected = granular
      ? values.filter(value => inputCatalog.value.find(f => f.public === value)?.internal !== 'payload')
      : values
    draft.value.inputs = [...mapSelected(inputCatalog.value.filter(f =>
      !Object.prototype.hasOwnProperty.call(draft.value.defaults ?? {}, f.internal)), selected),
      ...draft.value.inputs.filter(f => !inputCatalog.value.some(x => x.public === f.public))]
  },
})
const selectedOutputs = computed<string[]>({
  get: () => draft.value.outputs.map(f => f.public),
  set: values => {
    draft.value.outputs = [...mapSelected(outputCatalog.value, values),
      ...draft.value.outputs.filter(f => !outputCatalog.value.some(x => x.public === f.public))]
  },
})

const services = computed(() => [...new Set([
  ...serviceInventory.value.map(x => x.service), ...catalog.value.map(t => t.service),
])].sort().map(s => ({ label: s.toUpperCase(), value: s })))
const filteredServices = computed(() => services.value.filter(option =>
  option.label.toLowerCase().includes(serviceFilter.value.trim().toLowerCase())))
const operations = computed(() => catalog.value
  .filter(t => t.service === service.value && t.method === method.value)
  .filter(t => (t.path + ' ' + t.description).toLowerCase().includes(routeSearch.value.toLowerCase())))
const linkableEndpoints = computed(() => endpoints.value.map(x => ({
  value: x.id, label: x.name, description: '/api/external/v1/' + x.slug,
})))
const filtered = computed(() => endpoints.value.filter(x =>
  [x.name, x.slug, x.target].join(' ').toLowerCase().includes(search.value.toLowerCase())))
const externalUrl = (x: PublishedEndpoint) => base + '/api/external/v1/' + (x.slug || 'mi-api') +
  (catalog.value.find(t => t.code === x.target)?.path.includes('{id}') && !x.target.startsWith('route.') ? '/{id}' : '')
const example = computed(() => {
  if (!selectedTarget.value) return ''
  const target = selectedTarget.value
  const address = externalUrl(draft.value)
  const query = target.method === 'GET' && draft.value.inputs.length
    ? '?' + draft.value.inputs.map(f => encodeURIComponent(f.public) + '=valor').join('&')
    : ''
  const requestValue = (f: Mapping): unknown => {
    if (target.code === 'pricing-rate-request-create') {
      if (f.internal === 'priority') return 'Green'
      if (f.internal === 'sellerUserId') return 'UUID_VENDEDOR'
      if (f.internal === 'clientName') return 'Cliente de ejemplo'
      if (f.internal === 'shipmentMode') return 'Fcl'
      if (f.internal === 'originName') return 'Shanghai'
      if (f.internal === 'destinationName') return 'San José'
      if (f.internal === 'payload') return { descripcion: 'Detalles de la carga' }
    }
    return f.public === 'ids' ? ['ID_DEL_REGISTRO'] : 'valor'
  }
  const body = target.method !== 'GET' && draft.value.inputs.length
    ? ' \\\n  -H "Content-Type: application/json" \\\n  -d ' +
      "'" + JSON.stringify(Object.fromEntries(draft.value.inputs.map(f =>
        [f.public, requestValue(f)]))) + "'"
    : ''
  const idempotency = target.method === 'POST'
    ? ' \\\n  -H "Idempotency-Key: solicitud-unica-12345678"' : ''
  return 'curl -X ' + target.method + ' "' + address + query + '" \\\n' +
    '  -H "X-Api-Key: TU_API_KEY"' + idempotency + body
})

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
}
function methodName(value: string) {
  return METHODS.find(m => m.value === value)?.label || value
}
function targetName(value: ApprovedTarget): string {
  if (value.code.startsWith('route.')) return value.description || value.method + ' ' + value.path
  if (value.code.startsWith('config-catalog-')) return value.description.replace(/\s*\(solo lectura.*$/i, '')
  if (value.code === 'pricing-usd-crc') return 'Tipo de cambio USD / CRC'
  if (value.code === 'pricing-rate-detail') return 'Consultar una tarifa por ID'
  if (value.code === 'pricing-rates-list') return 'Consultar listado de tarifas'
  if (value.code === 'pricing-rate-create') return 'Crear tarifa'
  if (value.code === 'pricing-rate-update') return 'Actualizar tarifa por ID'
  if (value.code === 'pricing-rate-delete') return 'Eliminar tarifas por ID'
  if (value.code === 'pricing-rate-request-create') return 'Solicitar tarifa'
  if (value.code === 'pricing-rate-requests-open') return 'Solicitudes pendientes'
  if (value.code === 'pricing-rate-request-detail') return 'Consultar una solicitud'
  if (value.code === 'pricing-rate-requests-linked') return 'Historial de solicitudes'
  if (value.code === 'pricing-rate-exchange-eur-usd') return 'Tipo de cambio EUR / USD'
  return value.description || 'Función del módulo'
}
function targetHelp(value: ApprovedTarget): string {
  if (value.code.startsWith('config-catalog-')) return 'Consulta segura de ' + targetName(value) + '. La API expone únicamente los campos de Config seleccionados.'
  switch (value.code) {
    case 'pricing-usd-crc': return 'Compartir el precio de compra y venta del dólar.'
    case 'pricing-rate-detail': return 'El tercero consulta una tarifa indicando su identificador.'
    case 'pricing-rates-list': return 'El tercero consulta una lista de tarifas disponibles para su acceso.'
    case 'pricing-rate-create': return 'El tercero envía los datos para registrar una nueva tarifa.'
    case 'pricing-rate-update': return 'El tercero envía cambios a una tarifa existente.'
    case 'pricing-rate-delete': return 'El tercero solicita eliminar tarifas por identificador.'
    case 'pricing-rate-request-create': return 'Permite enviar una solicitud de cotización al equipo de Pricing, sin crear directamente una tarifa.'
    case 'pricing-rate-requests-open': return 'Consultar las solicitudes que aún necesitan atención.'
    case 'pricing-rate-request-detail': return 'Consultar el estado y los datos de una solicitud mediante su identificador.'
    case 'pricing-rate-requests-linked': return 'Consultar las solicitudes que ya tienen una tarifa vinculada.'
    case 'pricing-rate-exchange-eur-usd': return 'Compartir el tipo de cambio entre euro y dólar.'
    default: return 'Compartir esta función con un sistema externo.'
  }
}
function initialInputs(code: string): Mapping[] {
  if (code === 'pricing-rate-delete') return [
    { public: 'ids', internal: 'ids', required: true },
  ]
  if (code === 'pricing-rate-request-create') return [
    { public: 'prioridad', internal: 'priority', required: true },
    { public: 'vendedorId', internal: 'sellerUserId', required: true },
    { public: 'cliente', internal: 'clientName', required: false },
    { public: 'modalidad', internal: 'shipmentMode', required: false },
    { public: 'origen', internal: 'originName', required: false },
    { public: 'destino', internal: 'destinationName', required: false },
    { public: 'detalles', internal: 'payload', required: true },
  ]
  return []
}
function initialOutputs(code: string): Mapping[] {
  if (code.startsWith('config-catalog-')) return [
    { public: 'id', internal: 'id', required: false },
    { public: 'code', internal: 'code', required: false },
    { public: 'name', internal: 'name', required: false },
    { public: 'value', internal: 'value', required: false },
  ]
  if (code === 'pricing-rate-request-create') return [
    { public: 'solicitudId', internal: 'value', required: false },
  ]
  if (code === 'pricing-usd-crc') return [
    { public: 'compra', internal: 'purchase', required: false },
    { public: 'venta', internal: 'sale', required: false },
    { public: 'fecha', internal: 'rateDate', required: false },
  ]
  if (code === 'pricing-rate-exchange-eur-usd') return [
    { public: 'dolares', internal: 'dollars', required: false },
    { public: 'colones', internal: 'colones', required: false },
    { public: 'fecha', internal: 'rateDate', required: false },
  ]
  if (code === 'pricing-rate-requests-open' || code === 'pricing-rate-request-detail' || code === 'pricing-rate-requests-linked') return [
    { public: 'id', internal: 'id', required: false },
    { public: 'estado', internal: 'status', required: false },
    { public: 'cliente', internal: 'clientName', required: false },
    { public: 'prioridad', internal: 'priority', required: false },
  ]
  if (code === 'pricing-rate-detail' || code === 'pricing-rates-list') return [
    { public: 'id', internal: 'id', required: false },
    { public: 'estado', internal: 'status', required: false },
  ]
  return []
}
function resetApiTest() {
  testApiKey.value = ''
  testPayload.value = '{}'
  testId.value = ''
  mutationConfirmed.value = false
  testResult.value = null
  testResponse.value = ''
  testError.value = ''
}
function closeDrawer() {
  drawer.value = false
  secretModal.value = false
  issuedSecret.value = ''
  resetApiTest()
}
function fillTestExample() {
  testPayload.value = JSON.stringify(Object.fromEntries(
    draft.value.inputs.filter(f => f.required).map(f => [
      f.public, f.internal === 'priority' ? 'Green' : f.internal === 'payload' || f.internal === 'body' ? {} : 'valor',
    ])), null, 2)
}
async function runApiTest() {
  testError.value = ''
  testResult.value = null
  testResponse.value = ''
  if (!draft.value.id || !draft.value.enabled) {
    testError.value = 'Guardá y publicá la API antes de probarla.'
    return
  }
  const key = testApiKey.value.trim()
  if (!/^dh_ext_[a-f0-9]{64}$/.test(key)) {
    testError.value = 'Ingresá una API Key generada por Dhole para esta ruta.'
    return
  }
  if (method.value !== 'GET' && !mutationConfirmed.value) {
    testError.value = 'Confirmá que autorizás ejecutar esta operación sobre datos reales.'
    return
  }
  let params: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(testPayload.value.trim() || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Ingresá un objeto JSON con los parámetros de la API.')
    params = parsed as Record<string, unknown>
    if (Object.keys(params).some(name => !draft.value.inputs.some(f => f.public === name)))
      throw new Error('Hay campos que no están publicados en esta API.')
    const missing = draft.value.inputs.filter(f => f.required &&
      (params[f.public] === null || params[f.public] === undefined || params[f.public] === ''))
    if (missing.length) throw new Error('Faltan campos obligatorios: ' + missing.map(f => f.public).join(', '))
  } catch (e) {
    testError.value = e instanceof Error ? e.message : 'JSON inválido.'
    return
  }
  const url = new URL(externalUrl(draft.value))
  if (url.pathname.endsWith('/%7Bid%7D') || url.pathname.endsWith('/{id}')) {
    const id = testId.value.trim()
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(id)) {
      testError.value = 'Ingresá un identificador válido para esta ruta.'
      return
    }
    url.pathname = url.pathname.replace(/\/(?:%7Bid%7D|\{id\})$/i, '/' + encodeURIComponent(id))
  }
  const headers: Record<string, string> = { 'X-Api-Key': key, Accept: 'application/json' }
  const request: RequestInit = { method: method.value, headers, credentials: 'omit' }
  if (method.value === 'GET') {
    for (const [name, input] of Object.entries(params)) {
      for (const value of Array.isArray(input) ? input : [input]) {
        if (value === null || value === undefined) continue
        if (!['string', 'number', 'boolean'].includes(typeof value)) {
          testError.value = 'Los parámetros GET deben ser valores simples o listas de esos valores.'
          return
        }
        url.searchParams.append(name, String(value))
      }
    }
  } else {
    if (method.value === 'POST') headers['Idempotency-Key'] = crypto.randomUUID()
    if (draft.value.inputs.length) {
      headers['Content-Type'] = 'application/json'
      request.body = JSON.stringify(params)
    }
  }
  const started = performance.now()
  testRunning.value = true
  try {
    const response = await fetch(url.toString(), request)
    const content = await response.text()
    let formatted = content || '(Respuesta sin contenido)'
    if (content) {
      try { formatted = JSON.stringify(JSON.parse(content), null, 2) }
      catch { /* A non-JSON upstream response is displayed as text. */ }
    }
    testResult.value = { status: response.status, durationMs: Math.round(performance.now() - started), ok: response.ok }
    testResponse.value = formatted
  } catch (e) {
    testError.value = (e instanceof Error ? e.message : 'No se pudo probar la API.') +
      ' Revisá la conexión a API Gateway y las reglas CORS.'
  } finally {
    testRunning.value = false
    mutationConfirmed.value = false
  }
}
function requestFailure(label: string, endpoint: string, reason: unknown): string {
  const status = reason instanceof ApiError ? reason.status : undefined
  if (status === 404)
    return label + ': Gateway no tiene registrada la ruta GET ' + endpoint +
      ' (HTTP 404). Verificá que DholeApiGateway esté desplegado y que el módulo esté disponible.'
  const detail = reason instanceof Error ? reason.message : 'Error de conexión desconocido.'
  return label + ' (GET ' + endpoint + (status ? ', HTTP ' + status : '') + '): ' + detail
}
async function loadRegistryKeys() {
  keyRegistryLoaded.value = false
  try {
    keyRegistry.value = await fetchClient<KeyInfo[]>(root + '/keys', { method: 'GET' })
    keyRegistryLoaded.value = true
  } catch (e) { error.value = requestFailure('API Keys', root + '/keys', e) }
}
function showKeysPanel() {
  closeDrawer()
  activePanel.value = 'keys'
  error.value = ''
  void loadRegistryKeys()
}
function startKeyLinks(key: KeyInfo) {
  editingKeyId.value = key.id
  keyEndpointIds.value = [...(key.endpointIds ?? [])]
}
async function saveKeyLinks() {
  if (!editingKeyId.value) return
  error.value = ''
  keyBusy.value = true
  try {
    await fetchClient(root + '/keys/' + encodeURIComponent(editingKeyId.value) + '/endpoints', {
      method: 'PUT', body: { endpointIds: keyEndpointIds.value },
    })
    editingKeyId.value = ''
    keyEndpointIds.value = []
    await loadRegistryKeys()
    notice.value = 'Vínculos guardados. La clave solo puede utilizar las APIs seleccionadas cuando estén publicadas.'
  } catch (e) { error.value = e instanceof Error ? e.message : 'No se pudieron vincular las APIs.' }
  finally { keyBusy.value = false }
}
async function createStandaloneKey() {
  error.value = ''
  const label = keyLabel.value.trim()
  const days = Number(expiresDays.value)
  const limit = Number(maxPerMinute.value)
  if (!label || label.length > 100 || !Number.isInteger(days) || days < 1 || days > 365 ||
    !Number.isInteger(limit) || limit < 1 || limit > 300) {
    error.value = 'Ingresá el nombre, vigencia válida (1–365 días) y límite (1–300/min).'
    return
  }
  keyBusy.value = true
  try {
    const created = await fetchClient<{ id: string; apiKey: string }>(root + '/keys', {
      method: 'POST', body: { label, expiresInDays: days, maxRequestsPerMinute: limit },
    })
    issuedSecret.value = created.apiKey
    issuedLabel.value = label
    keyLabel.value = ''
    secretModal.value = true
    await loadRegistryKeys()
    notice.value = 'Clave generada sin APIs vinculadas. Elegí las autorizaciones de esta clave.'
  } catch (e) { error.value = e instanceof Error ? e.message : 'No se pudo generar la clave.' }
  finally { keyBusy.value = false }
}
async function previewApi() {
  testError.value = ''
  testResult.value = null
  testResponse.value = ''
  if (method.value !== 'GET' || !selectedTarget.value) {
    testError.value = 'Solo podés previsualizar operaciones GET con tu sesión.'
    return
  }
  let parameters: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(testPayload.value.trim() || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Ingresá parámetros en un objeto JSON.')
    parameters = parsed as Record<string, unknown>
  } catch (e) {
    testError.value = e instanceof Error ? e.message : 'JSON inválido.'
    return
  }
  testRunning.value = true
  const started = performance.now()
  try {
    const result = await fetchClient<{ status: number; data?: unknown; message?: string }>(root + '/preview', {
      method: 'POST', body: {
        endpoint: { ...draft.value, id: draft.value.id || '00000000-0000-0000-0000-000000000000', enabled: false },
        parameters, id: testId.value.trim() || null,
      },
    })
    testResult.value = { status: result.status, durationMs: Math.round(performance.now() - started),
      ok: result.status >= 200 && result.status < 300 }
    testResponse.value = JSON.stringify(result.data ?? { message: result.message ?? 'Respuesta vacía' }, null, 2)
  } catch (e) { testError.value = e instanceof Error ? e.message : 'No se pudo previsualizar la respuesta.' }
  finally { testRunning.value = false }
}
function create() {
  activePanel.value = 'apis'
  resetApiTest()
  crmSelection.value = ''
  crmAccounts.value = []
  draft.value = blank()
  routeSearch.value = ''
  serviceFilter.value = ''
  service.value = catalog.value[0]?.service || 'pricing'
  manualRoute.value = '/api/' + service.value + '/'
  void discoverService(service.value)
  method.value = 'GET'
  step.value = 1
  error.value = ''
  notice.value = ''
  pickOnlyAvailableAction()
  drawer.value = true
}
function edit(row: PublishedEndpoint) {
  resetApiTest()
  draft.value = cloneEndpoint(row)
  draft.value.defaults ??= {}
  crmSelection.value = ''
  const target = catalog.value.find(t => t.code === row.target)
  service.value = target?.service || 'pricing'
  manualRoute.value = target?.path || '/api/' + service.value + '/'
  method.value = target?.method || 'GET'
  step.value = 2
  error.value = ''
  drawer.value = true
  if (row.target.startsWith('route.')) void discoverService(service.value)
}
function pickOnlyAvailableAction() {
  const matches = catalog.value.filter(t => t.service === service.value && t.method === method.value)
  if (matches.length === 1) chooseTarget(matches[0]!)
}
function chooseMethod(value: HttpMethod) {
  if (method.value === value) return
  method.value = value
  draft.value.target = ''
  draft.value.inputs = []
  draft.value.outputs = []
  if (isNew.value) { draft.value.name = ''; draft.value.slug = '' }
  pickOnlyAvailableAction()
}
function chooseService(value: string | number) {
  if (service.value === String(value)) return
  service.value = String(value)
  draft.value.target = ''
  draft.value.inputs = []
  draft.value.outputs = []
  if (isNew.value) { draft.value.name = ''; draft.value.slug = '' }
  manualRoute.value = '/api/' + service.value + '/'
  routeSearch.value = ''
  serviceFilter.value = ''
  void discoverService(service.value)
  pickOnlyAvailableAction()
}
function chooseTarget(target: ApprovedTarget) {
  if (draft.value.target === target.code) return
  resetApiTest()
  draft.value.target = target.code
  draft.value.defaults = {}
  crmSelection.value = ''
  draft.value.inputs = mapSelected(target.inputFields || [], (target.inputFields || [])
    .filter(field => field.selected).map(field => field.public))
  draft.value.outputs = mapSelected(target.outputFields || [], (target.outputFields || [])
    .filter(field => field.selected).map(field => field.public))
  draft.value.responseRoot = target.code.startsWith('config-catalog-') ? 'data' : null
  if (isNew.value) {
    draft.value.name = targetName(target)
    // Automatic unique address: no one needs to invent or edit a slug.
    draft.value.slug = slugify(targetName(target)).slice(0, 53).replace(/-+$/, '') +
      '-' + Date.now().toString(36).slice(-7)
  }
}

async function discoverService(serviceName: string) {
  if (!serviceInventory.value.some(x => x.service === serviceName)) return
  discoveryLoading.value = true
  discoveryMessage.value = ''
  try {
    const found = await fetchClient<DiscoveryResult>(
      root + '/discover/' + encodeURIComponent(serviceName), { method: 'GET' })
    catalog.value = [...catalog.value.filter(t => !(
      t.service === serviceName && t.code.startsWith('route.') &&
      !endpoints.value.some(x => x.target === t.code) &&
      draft.value.target !== t.code)), ...found.routes.filter(t =>
      !catalog.value.some(existing => existing.code === t.code))]
    // Reconcile schema/ready metadata for routes already present.
    for (const route of found.routes) {
      const index = catalog.value.findIndex(t => t.code === route.code)
      if (index >= 0) catalog.value[index] = route
    }
    discoveryMessage.value = found.message
  } catch (e) {
    discoveryMessage.value = e instanceof Error ? e.message : 'No se pudo consultar el catálogo del servicio.'
  } finally { discoveryLoading.value = false }
}
async function registerManualRoute() {
  error.value = ''
  const path = manualRoute.value.trim()
  if (!path.startsWith('/api/' + service.value + '/')) {
    error.value = 'La ruta debe pertenecer al módulo seleccionado.'; return
  }
  try {
    const target = await fetchClient<ApprovedTarget>(root + '/resolve', {
      method: 'POST', body: { service: service.value, method: method.value, path },
    })
    if (!catalog.value.some(t => t.code === target.code)) catalog.value.push(target)
    chooseTarget(target)
  } catch (e) { error.value = e instanceof Error ? e.message : 'No se pudo validar la ruta.' }
}
function addDynamicField(section: 'input' | 'output') {
  if (!draft.value.target.startsWith('route.')) return
  const publicName = (section === 'input' ? newInputPublic.value : newOutputPublic.value).trim()
  const internalName = (section === 'input' ? newInputInternal.value : newOutputInternal.value).trim()
  const entry: Mapping = { public: publicName, internal: internalName, required: false }
  if (!validFields([entry])) { error.value = 'Usá identificadores válidos en nombres y rutas de campos.'; return }
  const set = section === 'input' ? draft.value.inputs : draft.value.outputs
  if (set.some(x => x.public === publicName)) { error.value = 'Ese nombre público ya existe.'; return }
  if (section === 'input' && !/^(query\.[A-Za-z][A-Za-z0-9_]*|body(?:\.[A-Za-z][A-Za-z0-9_.]*)?)$/.test(internalName)) {
    error.value = 'La entrada debe ser query.campo, body.campo o body completo.'; return
  }
  set.push(entry)
  if (section === 'input') { newInputPublic.value = ''; newInputInternal.value = '' }
  else { newOutputPublic.value = ''; newOutputInternal.value = '' }
  error.value = ''
}
function removeDynamicField(section: 'input' | 'output', index: number) {
  const set = section === 'input' ? draft.value.inputs : draft.value.outputs
  if (set[index]?.required) return
  set.splice(index, 1)
}
function resolveSavedDynamic(targetCode: string, endpoint: PublishedEndpoint): ApprovedTarget | null {
  const parts = targetCode.split('.')
  if (parts.length !== 4 || parts[0] !== 'route') return null
  try {
    const raw = parts[3]!.replace(/-/g, '+').replace(/_/g, '/')
    const path = atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '='))
    const verb = parts[2]!.toUpperCase() as HttpMethod
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(verb)) return null
    return { code: targetCode, service: parts[1]!, method: verb, path,
      description: verb + ' ' + path, ready: false,
      inputFields: endpoint.inputs.map(x => ({ ...x, label: x.public, selected: true })),
      outputFields: endpoint.outputs.map(x => ({ ...x, label: x.public, selected: true })) }
  } catch { return null }
}
function validFields(fields: Mapping[]): boolean {
  return fields.every(f => /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(f.public)
    && /^[A-Za-z][A-Za-z0-9_.]{0,159}$/.test(f.internal)) &&
    new Set(fields.map(f => f.public)).size === fields.length
}
function next() {
  error.value = ''
  if (step.value === 1) {
    if (!selectedTarget.value) { error.value = 'Elegí una operación para continuar.'; return }
    step.value = 2
    return
  }
  if (step.value === 2) {
    const d = draft.value
    if (!fieldCatalogLoaded.value) {
      error.value = 'No se pudo cargar la lista de campos. Actualizá la página después del despliegue de Gateway.'; return
    }
    if (!d.name.trim() || !/^[a-z][a-z0-9-]{2,63}$/.test(d.slug)) {
      error.value = 'Ingresá un nombre y una ruta de al menos 3 caracteres, con letras, números o guiones.'; return
    }
    if (d.target === 'pricing-rate-request-create' &&
        !d.inputs.some(f => f.internal === 'payload' || f.internal.startsWith('payload.'))) {
      error.value = 'Seleccioná payload completo o los datos de la solicitud que vas a compartir.'; return
    }
    if ((method.value === 'GET' && !d.outputs.length) ||
      !validFields(d.inputs) || !validFields(d.outputs)) {
      error.value = 'Revisá los campos: para GET elegí al menos un dato de respuesta.'; return
    }
    if (d.responseRoot && !/^[A-Za-z][A-Za-z0-9_.]*$/.test(d.responseRoot)) {
      error.value = 'La ubicación de los datos en la respuesta no es válida.'; return
    }
    step.value = 3
  }
}
async function load() {
  loading.value = true
  error.value = ''
  endpointsLoaded.value = false
  managerStatus.value = null
  const paths = {
    endpoints: root + '/endpoints', catalog: root + '/catalog',
    services: root + '/services', status: root + '/status',
  }
  try {
    // Preserve successful catalogs when a single request fails.
    const [saved, targets, inventory, status] = await Promise.allSettled([
      fetchClient<PublishedEndpoint[]>(paths.endpoints, { method: 'GET' }),
      fetchClient<ApprovedTarget[]>(paths.catalog, { method: 'GET' }),
      fetchClient<ServiceEntry[]>(paths.services, { method: 'GET' }),
      fetchClient<ManagerStatus>(paths.status, { method: 'GET' }),
    ])
    const problems: string[] = []
    if (saved.status === 'fulfilled') {
      endpoints.value = saved.value
      endpointsLoaded.value = true
    } else {
      endpoints.value = []
      problems.push(requestFailure('Mis APIs', paths.endpoints, saved.reason))
    }
    if (targets.status === 'fulfilled') catalog.value = [...targets.value]
    else { catalog.value = []; problems.push(requestFailure('Catálogo', paths.catalog, targets.reason)) }
    if (inventory.status === 'fulfilled') serviceInventory.value = inventory.value
    else { serviceInventory.value = []; problems.push(requestFailure('Microservicios', paths.services, inventory.reason)) }
    if (status.status === 'fulfilled') managerStatus.value = status.value
    else if (saved.status === 'rejected') problems.push(requestFailure('Estado de Gateway', paths.status, status.reason))
    for (const endpoint of endpoints.value) {
      if (endpoint.target.startsWith('route.') && !catalog.value.some(t => t.code === endpoint.target)) {
        const item = resolveSavedDynamic(endpoint.target, endpoint)
        if (item) catalog.value.push(item)
      }
    }
    error.value = problems.join(' | ')
  } finally { loading.value = false }
}
async function save() {
  error.value = ''
  const d = draft.value
  const persisted = endpoints.value.find(endpoint => endpoint.id === d.id)
  // Avoid a no-op PUT: the backend revokes every active key when a contract is updated.
  if (persisted && JSON.stringify(persisted) === JSON.stringify(d)) {
    notice.value = 'No hay cambios por guardar. Tus API Keys siguen activas.'
    return
  }
  if (d.target === 'pricing-rate-request-create' &&
      !d.inputs.some(f => f.internal === 'payload' || f.internal.startsWith('payload.')) &&
      !Object.keys(d.defaults ?? {}).some(f => f === 'payload' || f.startsWith('payload.'))) {
    error.value = 'Seleccioná los datos de la operación antes de guardar.'; step.value = 2; return
  }
  if (!fieldCatalogLoaded.value || !selectedTarget.value || !d.name.trim() || !/^[a-z][a-z0-9-]{2,63}$/.test(d.slug) ||
    (method.value === 'GET' && !d.outputs.length) || !validFields(d.inputs) || !validFields(d.outputs)) {
    step.value = 2
    error.value = 'Revisá los datos y campos de la API antes de guardarla.'
    return
  }
  saving.value = true
  try {
    const created = await fetchClient<PublishedEndpoint>(
      root + '/endpoints' + (d.id ? '/' + encodeURIComponent(d.id) : ''), {
        method: d.id ? 'PUT' : 'POST',
        body: { ...d, id: d.id || '00000000-0000-0000-0000-000000000000', responseRoot: d.responseRoot || null },
      })
    draft.value = created
    await load()
    step.value = 3
    notice.value = 'Ruta guardada como borrador. Podés publicarla cuando su acceso interno esté configurado.'
  } catch (e) { error.value = e instanceof Error ? e.message : 'No fue posible guardar la API.' }
  finally { saving.value = false }
}
async function toggle(row: PublishedEndpoint) {
  error.value = ''
  if (!row.enabled && !catalog.value.find(t => t.code === row.target)?.ready) {
    error.value = 'Esta operación todavía no tiene una identidad técnica configurada en Gateway. Podés guardar borradores, pero no publicarlos.'
    return
  }
  saving.value = true
  try {
    await fetchClient(root + '/endpoints/' + encodeURIComponent(row.id), {
      method: 'PUT', body: { ...row, enabled: !row.enabled },
    })
    await load()
    const updated = endpoints.value.find(x => x.id === row.id)
    if (updated && draft.value.id === row.id) draft.value = cloneEndpoint(updated)
    if (row.enabled) resetApiTest()
    notice.value = row.enabled ? 'API desactivada. Se conservaron las vinculaciones de sus claves.' : 'API publicada. Ahora vinculá una API Key desde la pestaña de credenciales.'
  } catch (e) { error.value = e instanceof Error ? e.message : 'No se pudo cambiar el estado.' }
  finally { saving.value = false }
}
async function revoke() {
  const key = confirmRevoke.value
  if (!key) return
  confirmRevoke.value = null
  error.value = ''
  try {
    await fetchClient(root + '/keys/' + encodeURIComponent(key.id), { method: 'DELETE' })
    notice.value = 'Clave revocada.'
    await loadRegistryKeys()
  } catch (e) { error.value = e instanceof Error ? e.message : 'No fue posible revocar la clave.' }
}
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); notice.value = 'Copiado al portapapeles.' }
  catch { notice.value = 'No se pudo copiar. Seleccioná el texto manualmente.' }
}
onMounted(() => { void load() })
</script>

<template>
  <main class="mx-auto flex w-full max-w-[1480px] flex-col gap-5 p-4 text-[var(--dh-text)] lg:p-7">
    <header v-if="!drawer" class="flex flex-col gap-5 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Dhole · APIs</p>
        <h1 class="mt-1 text-2xl font-black">Dhole API Manager</h1>
        <p class="mt-1 max-w-xl text-sm text-[var(--dh-text-muted)]">Administrá las rutas públicas y las credenciales de acceso de forma independiente, con permisos por API.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <DhButton variant="secondary" :icon="RefreshCw" label="Actualizar" :loading="loading" @click="load" />
        <DhButton :icon="Plus" label="Crear API" @click="create" />
      </div>
    </header>

    <nav v-if="!drawer" aria-label="Administración de integraciones" class="flex flex-wrap gap-2 border-b border-[var(--dh-border)] pb-3">
      <button type="button" :aria-current="activePanel === 'apis' ? 'page' : undefined"
        class="rounded-xl px-5 py-3 text-sm font-bold transition-colors"
        :class="activePanel === 'apis' ? 'bg-[var(--dh-primary)] text-white' : 'bg-[var(--dh-card)] text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]'"
        @click="activePanel = 'apis'"><Globe2 class="mr-2 inline h-4 w-4" /> APIs <span class="ml-1 opacity-75">{{ endpoints.length }}</span></button>
      <button type="button" :aria-current="activePanel === 'keys' ? 'page' : undefined"
        class="rounded-xl px-5 py-3 text-sm font-bold transition-colors"
        :class="activePanel === 'keys' ? 'bg-[var(--dh-primary)] text-white' : 'bg-[var(--dh-card)] text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]'"
        @click="showKeysPanel"><KeyRound class="mr-2 inline h-4 w-4" /> API Keys</button>
    </nav>

    <div v-if="error && !drawer" role="alert" class="rounded-xl border border-red-400/40 p-3 text-sm text-red-500">{{ error }}</div>
    <div v-if="notice && !drawer" role="status" class="rounded-xl border border-[var(--dh-border)] p-3 text-sm">{{ notice }}</div>
    <div v-if="managerStatus && !managerStatus.storageReady && !drawer" role="status"
      class="rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
      <strong class="block">API Manager: almacenamiento no disponible</strong>
      <p class="mt-1 text-[var(--dh-text-muted)]">{{ managerStatus.message }}</p>
      <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Podés examinar rutas, pero para guardar APIs y credenciales se necesita PostgreSQL en Gateway.</p>
    </div>

    <section v-if="!drawer && activePanel === 'apis'" class="overflow-hidden rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] p-4">
        <div>
          <h2 class="font-bold">Mis rutas</h2>
          <p class="text-xs text-[var(--dh-text-muted)]">Una API puede ser utilizada por diferentes API Keys autorizadas.</p>
        </div>
        <div class="w-full max-w-xs"><DhInput v-model="search" type="search" placeholder="Buscar API..." /></div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-[var(--dh-border)] text-xs uppercase text-[var(--dh-text-muted)]">
            <tr><th class="p-3">Nombre y ruta</th><th class="p-3">Módulo</th><th class="p-3">Método</th><th class="p-3">Estado</th><th class="p-3 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in filtered" :key="row.id" class="border-b border-[var(--dh-border)] last:border-0">
              <td class="p-3"><strong class="block">{{ row.name }}</strong><code class="text-xs text-[var(--dh-text-muted)]">{{ '/api/external/v1/' + row.slug }}</code></td>
              <td class="p-3 uppercase">{{ catalog.find(t => t.code === row.target)?.service || row.target }}</td>
              <td class="p-3"><span class="rounded-lg border border-[var(--dh-border)] px-2 py-1 font-mono text-xs font-bold">{{ catalog.find(t => t.code === row.target)?.method || '—' }}</span></td>
              <td class="p-3"><span class="text-xs font-semibold">{{ row.enabled ? 'Publicada' : 'Borrador' }}</span></td>
              <td class="p-3"><div class="flex justify-end gap-2">
                <DhButton variant="secondary" :icon="Pencil" size="sm" label="Administrar" @click="edit(row)" />
                <DhButton variant="ghost" :icon="Power" size="sm" :label="row.enabled ? 'Desactivar' : 'Publicar'" :disabled="saving" @click="toggle(row)" />
              </div></td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="5" class="p-10 text-center">
              <div class="mx-auto flex max-w-sm flex-col items-center gap-3 text-[var(--dh-text-muted)]">
                <Globe2 class="h-8 w-8 opacity-60" />
                <strong class="text-[var(--dh-text)]">{{ loading ? 'Cargando rutas...' : !endpointsLoaded ? 'No se pudieron cargar las APIs' : search ? 'No hay coincidencias' : 'Aún no hay APIs creadas' }}</strong>
                <span v-if="!loading && !endpointsLoaded" class="text-xs">Revisá el error de Gateway arriba y volvé a cargar el listado.</span>
                <span v-else-if="!loading && !search" class="text-xs">Creá una ruta para compartir funciones de Dhole con otro sistema.</span>
                <DhButton v-if="!loading && !endpointsLoaded" variant="secondary" :icon="RefreshCw" label="Reintentar carga" @click="load" />
                <DhButton v-if="!loading && endpointsLoaded && !search" :icon="Plus" label="Crear mi primera API" @click="create" />
              </div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </section>


    <section v-if="!drawer && activePanel === 'keys'" class="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div class="self-start space-y-5 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 sm:p-6">
        <div>
          <p class="text-xs font-bold uppercase tracking-widest text-[var(--dh-primary)]">Credenciales</p>
          <h2 class="mt-2 text-xl font-black">Crear API Key</h2>
          <p class="mt-2 text-sm leading-relaxed text-[var(--dh-text-muted)]">La clave pertenece a una aplicación externa. Después de crearla podrás vincularla con una o varias APIs, sin compartirla entre clientes.</p>
        </div>
        <DhInput v-model="keyLabel" label="Nombre de la aplicación" placeholder="Ej. Portal Galago · Producción" />
        <div>
          <p class="mb-2 text-xs font-bold uppercase text-[var(--dh-text-muted)]">Vigencia</p>
          <div class="flex flex-wrap gap-2">
            <button v-for="days in ['30','90','180','365']" :key="days" type="button"
              :aria-pressed="expiresDays === days" class="rounded-xl border px-3 py-2 text-sm font-semibold"
              :class="expiresDays === days ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10' : 'border-[var(--dh-border)]'"
              @click="expiresDays = days">{{ days }} días</button>
          </div>
        </div>
        <div>
          <p class="mb-2 text-xs font-bold uppercase text-[var(--dh-text-muted)]">Solicitudes por minuto</p>
          <div class="flex flex-wrap gap-2">
            <button v-for="quota in ['10','30','60','120']" :key="quota" type="button"
              :aria-pressed="maxPerMinute === quota" class="rounded-xl border px-3 py-2 text-sm font-semibold"
              :class="maxPerMinute === quota ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10' : 'border-[var(--dh-border)]'"
              @click="maxPerMinute = quota">{{ quota }}</button>
          </div>
        </div>
        <DhButton :icon="KeyRound" label="Generar API Key" :disabled="keyBusy || !keyLabel.trim() || managerStatus?.storageReady === false" :loading="keyBusy" @click="createStandaloneKey" />
        <p class="text-xs text-[var(--dh-text-muted)]">El secreto se muestra una sola vez. Las claves no vinculadas a ninguna API no tienen acceso.</p>
      </div>
      <div class="min-w-0 overflow-hidden rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] p-5 sm:p-6">
          <div>
            <h2 class="text-lg font-bold">Claves y APIs autorizadas</h2>
            <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Vinculá cada clave solamente a las rutas que su aplicación necesita.</p>
          </div>
          <DhButton size="sm" variant="secondary" :icon="RefreshCw" label="Actualizar" @click="loadRegistryKeys" />
        </div>
        <div v-if="!keyRegistry.length" class="p-9 text-center text-sm text-[var(--dh-text-muted)]">
          {{ !keyRegistryLoaded ? 'No se pudo confirmar el listado de claves. Revisá Gateway y reintentá.' : 'No hay claves registradas. Creá la primera desde el formulario.' }}
        </div>
        <div v-for="key in keyRegistry" :key="key.id" class="space-y-3 border-b border-[var(--dh-border)] p-5 last:border-b-0">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 class="font-bold">{{ key.label }}</h3>
              <p class="mt-1 font-mono text-xs text-[var(--dh-text-muted)]">{{ key.prefix }}…</p>
              <p class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ key.endpointIds?.length || 0 }} APIs vinculadas · {{ key.maxRequestsPerMinute }}/min · {{ key.active ? 'Activa' : 'Revocada' }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <DhButton v-if="key.active" variant="secondary" size="sm" label="Vincular APIs" @click="startKeyLinks(key)" />
              <DhButton v-if="key.active" variant="danger" size="sm" :icon="Trash2" label="Revocar" @click="confirmRevoke = key" />
            </div>
          </div>
          <div v-if="editingKeyId === key.id" class="space-y-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
            <DhMultiSelect v-model="keyEndpointIds" label="APIs autorizadas para esta clave"
              :options="linkableEndpoints" placeholder="Elegir APIs" search-placeholder="Buscar API..." />
            <p class="text-xs text-[var(--dh-text-muted)]">Podés seleccionar varias. Solo se podrán consumir cuando estén publicadas y tengan identidad técnica configurada.</p>
            <div class="flex flex-wrap gap-2">
              <DhButton label="Guardar vínculos" :disabled="keyBusy" :loading="keyBusy" @click="saveKeyLinks" />
              <DhButton variant="secondary" label="Cancelar" @click="editingKeyId = ''; keyEndpointIds = []" />
            </div>
          </div>
          <div v-else class="flex flex-wrap gap-1.5">
            <span v-for="id in key.endpointIds || []" :key="id" class="rounded-lg border border-[var(--dh-border)] px-2 py-1 text-xs">
              {{ endpoints.find(api => api.id === id)?.name || 'API no disponible' }}
            </span>
            <span v-if="!key.endpointIds?.length" class="text-xs text-[var(--dh-text-muted)]">Sin permisos asignados</span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="drawer" class="min-w-0 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4 shadow-[var(--dh-shadow-sm)] sm:p-6 lg:p-8">
      <div class="mx-auto flex w-full max-w-[1180px] flex-col gap-5 pb-2">
        <div class="flex flex-col gap-5 border-b border-[var(--dh-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div class="space-y-1">
            <button type="button" class="mb-3 flex items-center gap-2 text-xs font-bold text-[var(--dh-primary)] hover:underline" @click="closeDrawer"><ArrowLeft class="h-4 w-4" /> Volver al listado</button>
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dh-primary)]">DHOLE · API MANAGER</p>
            <h2 class="text-2xl font-black tracking-tight sm:text-3xl">{{ isNew ? 'Configurá una nueva API' : 'Administrá tu API' }}</h2>
            <p class="max-w-2xl text-sm leading-relaxed text-[var(--dh-text-muted)]">
              Elegí una operación de Dhole, definí los datos que compartirás y revisá la publicación.
            </p>
          </div>
          <span class="self-start rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-1.5 text-xs font-semibold text-[var(--dh-text-muted)]">
            Paso {{ step }} de 3
          </span>
        </div>

        <nav class="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Pasos para configurar la API">
          <button v-for="item in [{ n: 1, title: 'Operación', detail: 'Método y ruta' }, { n: 2, title: 'Ruta y datos', detail: 'Contrato público' }, { n: 3, title: 'Revisar', detail: 'Guardar y publicar' }]"
            :key="item.n" type="button" :disabled="item.n > step"
            :aria-current="step === item.n ? 'step' : undefined"
            class="flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition sm:p-4"
            :class="step === item.n ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10 shadow-sm' : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-muted)]'"
            @click="step = item.n">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-black"
              :class="step === item.n ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white' : 'border-[var(--dh-border)]'">
              <Check v-if="step > item.n" class="h-4 w-4" />
              <template v-else>{{ item.n }}</template>
            </span>
            <span class="min-w-0">
              <span class="block truncate text-xs font-bold sm:text-sm">{{ item.title }}</span>
              <span class="mt-0.5 hidden text-xs opacity-75 sm:block">{{ item.detail }}</span>
            </span>
          </button>
        </nav>

        <div v-if="error" role="alert" class="rounded-2xl border border-red-400/40 bg-red-500/5 p-4 text-sm text-red-500">{{ error }}</div>
        <div v-if="notice" role="status" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-sm">{{ notice }}</div>

        <template v-if="step === 1">
          <section class="rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-6">
            <div class="mb-5">
              <p class="text-xs font-bold uppercase tracking-[0.13em] text-[var(--dh-primary)]">01 · Tipo de operación</p>
              <h3 class="mt-1 text-xl font-bold">¿Qué necesitás que haga esta API?</h3>
              <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Seleccioná el método HTTP. Luego elegí el microservicio y su ruta.</p>
            </div>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <button v-for="option in METHODS" :key="option.value" type="button"
                :aria-pressed="method === option.value"
                class="relative flex min-h-[116px] flex-col rounded-2xl border p-4 text-left transition-colors hover:border-[var(--dh-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                :class="method === option.value ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10' : 'border-[var(--dh-border)] bg-[var(--dh-shell)]'"
                @click="chooseMethod(option.value)">
                <CheckCircle2 v-if="method === option.value" class="absolute right-3 top-3 h-5 w-5 text-[var(--dh-primary)]" />
                <span class="font-mono text-base font-black">{{ option.value }}</span>
                <span class="mt-3 text-sm font-bold">{{ option.label }}</span>
                <span class="mt-1 text-xs leading-snug text-[var(--dh-text-muted)]">{{ option.detail }}</span>
              </button>
            </div>
          </section>

          <div class="grid min-w-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <section class="min-w-0 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
              <div class="mb-4">
                <p class="text-xs font-bold uppercase tracking-[0.13em] text-[var(--dh-primary)]">02 · Microservicio</p>
                <h3 class="mt-1 text-lg font-bold">Seleccioná un módulo</h3>
                <p class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">Mostramos los servicios disponibles en Dhole.</p>
              </div>
              <DhInput v-model="serviceFilter" type="search" placeholder="Buscar módulo..." />
              <div class="mt-3 max-h-[400px] space-y-1.5 overflow-y-auto pr-1" role="group" aria-label="Microservicios disponibles">
                <button v-for="option in filteredServices" :key="option.value" type="button"
                  :aria-pressed="service === option.value"
                  class="flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors hover:border-[var(--dh-primary)]"
                  :class="service === option.value ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10 font-bold' : 'border-transparent hover:bg-[var(--dh-shell)]'"
                  @click="chooseService(option.value)">
                  <Database class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
                  <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
                  <Check v-if="service === option.value" class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
                </button>
                <p v-if="!filteredServices.length" class="px-2 py-5 text-center text-sm text-[var(--dh-text-muted)]">No hay módulos con ese nombre.</p>
              </div>
            </section>

            <section class="min-w-0 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p class="text-xs font-bold uppercase tracking-[0.13em] text-[var(--dh-primary)]">03 · Ruta interna</p>
                  <h3 class="mt-1 text-lg font-bold">Elegí el endpoint que vas a compartir</h3>
                  <p class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">Solo se publicará la operación seleccionada, nunca el microservicio completo.</p>
                </div>
                <DhButton variant="secondary" size="sm" :icon="RefreshCw" label="Examinar rutas" :loading="discoveryLoading" @click="discoverService(service)" />
              </div>

              <div class="mt-4 flex flex-col gap-3 border-b border-[var(--dh-border)] pb-4 sm:flex-row sm:items-center">
                <div class="min-w-0 flex-1"><DhInput v-model="routeSearch" type="search" placeholder="Buscar por nombre, URL o descripción..." /></div>
                <span class="shrink-0 rounded-full border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ operations.length }} rutas · {{ method }} · {{ service.toUpperCase() }}
                </span>
              </div>

              <div class="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1" role="group" aria-label="Rutas del microservicio">
                <button v-for="item in operations" :key="item.code" type="button"
                  :aria-pressed="draft.target === item.code"
                  class="flex w-full min-w-0 items-start gap-3 rounded-2xl border p-4 text-left transition-colors hover:border-[var(--dh-primary)]"
                  :class="draft.target === item.code ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10' : 'border-[var(--dh-border)] bg-[var(--dh-shell)]'"
                  @click="chooseTarget(item)">
                  <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                    :class="draft.target === item.code ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white' : 'border-[var(--dh-border)]'">
                    <Check v-if="draft.target === item.code" class="h-4 w-4" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-bold">{{ targetName(item) }}</span>
                    <code class="mt-1.5 block break-all text-xs leading-relaxed text-[var(--dh-text-muted)]">{{ item.method }} {{ item.path }}</code>
                    <span class="mt-1.5 block text-xs leading-relaxed text-[var(--dh-text-muted)]">{{ targetHelp(item) }}</span>
                  </span>
                  <span v-if="item.ready" class="hidden shrink-0 rounded-full bg-[var(--dh-primary)]/10 px-2 py-1 text-[10px] font-bold text-[var(--dh-primary)] sm:inline">Disponible</span>
                </button>
                <div v-if="!operations.length" class="rounded-2xl border border-dashed border-[var(--dh-border)] p-7 text-center">
                  <Search class="mx-auto h-6 w-6 text-[var(--dh-text-muted)]" />
                  <p class="mt-2 text-sm font-semibold">No se encontraron rutas</p>
                  <p class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">Probá otro método o buscá una ruta diferente. También podés agregar una ruta no documentada abajo.</p>
                </div>
              </div>

              <details class="group mt-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                  <span>Opciones avanzadas · Ruta no documentada</span>
                  <ChevronDown class="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div class="mt-3 space-y-3 border-t border-[var(--dh-border)] pt-3">
                  <p class="text-xs leading-relaxed text-[var(--dh-text-muted)]">{{ discoveryMessage || 'Si el microservicio no expone OpenAPI, podés registrar una ruta interna conocida como borrador. No se activa sin identidad técnica.' }}</p>
                  <div class="flex flex-col gap-2 sm:flex-row">
                    <div class="min-w-0 flex-1"><DhInput v-model="manualRoute" placeholder="/api/crm/accounts/{id:guid}" /></div>
                    <DhButton variant="secondary" size="sm" label="Usar ruta interna" @click="registerManualRoute" />
                  </div>
                </div>
              </details>
              <p v-if="discoveryMessage && operations.length" class="mt-3 text-xs leading-relaxed text-[var(--dh-text-muted)]" role="status">{{ discoveryMessage }}</p>
            </section>
          </div>
        </template>

        <template v-else-if="step === 2">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.13em] text-[var(--dh-primary)]">02 · Contrato público</p>
            <h3 class="mt-1 text-xl font-bold">Definí qué información puede compartir tu API</h3>
            <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Elegí los datos que recibirá y devolverá el sistema externo. Los obligatorios ya están incluidos.</p>
          </div>
          <section class="space-y-3 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-6">
            <h3 class="text-lg font-bold">Tu API</h3>
            <p class="text-sm text-[var(--dh-text-muted)]">Dhole asigna automáticamente el nombre y la dirección. No necesitás escribir rutas.</p>
            <div class="rounded-xl border border-[var(--dh-border)] p-4">
              <strong class="block">{{ draft.name }}</strong>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <span class="rounded-lg border border-[var(--dh-border)] px-2 py-1 font-mono text-xs font-bold">{{ method }}</span>
                <code class="min-w-0 flex-1 break-all text-xs">{{ externalUrl(draft) }}</code>
                <DhButton variant="ghost" size="sm" :icon="Copy" label="Copiar" @click="copy(externalUrl(draft))" />
              </div>
              <p v-if="selectedTarget?.path.includes('{id}')" class="mt-2 text-xs text-[var(--dh-text-muted)]">El tercero indicará el identificador del registro al llamar a la API.</p>
            </div>
          </section>

          <div v-if="!fieldCatalogLoaded" class="rounded-xl border border-amber-500/40 p-4 text-sm">
            El listado de campos aún no está disponible. Actualizá la página cuando termine la actualización de API Gateway.
          </div>

          <section v-else class="space-y-4 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-6">
            <div>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="font-bold">Request · Datos de entrada</h3>
                <span class="rounded-lg border border-[var(--dh-border)] px-2 py-1 text-xs">{{ draft.inputs.length }} de {{ inputCatalog.length }} campos</span>
              </div>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Los campos necesarios se incluyen automáticamente. Solo seleccioná los adicionales que querás permitir.</p>
            </div>
            <div v-if="draft.target.startsWith('config-catalog-')" class="rounded-xl border border-[var(--dh-border)] p-3 text-xs text-[var(--dh-text-muted)]">
              Los filtros son opcionales y se aplican a los metadatos reales de cada registro de Config. Para POL, POE y POD podés filtrar por <strong>CY</strong> (marítimo), <strong>SD</strong> (terrestre/puerta) o <strong>APT</strong> (aéreo), sin alterar el catálogo. Si no seleccionás filtros, la API devuelve todos los tipos.
            </div>
            <div v-if="draft.target === 'pricing-rate-request-create'" class="rounded-xl border border-[var(--dh-border)] p-3 text-xs text-[var(--dh-text-muted)]">
              Podés permitir que el tercero envíe el <strong>payload completo</strong> como en el JSON original, o seleccionar cada campo de <strong>formulario, contenedores y contextos</strong>. Al elegir campos individuales, Dhole construirá automáticamente el JSON anidado.
            </div>
            <div v-if="mandatoryInputs.length" class="rounded-xl border border-[var(--dh-border)] p-3">
              <p class="mb-2 text-xs font-bold uppercase text-[var(--dh-text-muted)]">Obligatorios · incluidos automáticamente</p>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="field in mandatoryInputs" :key="field.public"
                  class="rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-1.5 text-xs font-semibold">
                  {{ field.label }}
                </span>
              </div>
            </div>
            <div v-if="optionalInputOptions.length" class="flex flex-wrap gap-2">
              <DhButton variant="secondary" size="sm" label="Seleccionar todos" @click="selectAllInputs" />
              <DhButton variant="ghost" size="sm" label="Solo obligatorios" @click="clearOptionalInputs" />
            </div>
            <DhMultiSelect
              v-if="optionalInputOptions.length"
              v-model="selectedOptionalInputs"
              label="Datos adicionales que puede enviar el tercero"
              :options="optionalInputOptions"
              placeholder="Seleccionar campos opcionales"
              search-placeholder="Buscar un dato..."
            />
            <div v-if="draft.target.startsWith('route.')" class="space-y-3 rounded-xl border border-[var(--dh-border)] p-3">
              <h4 class="font-bold">Mapeo personalizado de entradas</h4>
              <p class="text-xs text-[var(--dh-text-muted)]">Definí qué nombre recibirá el tercero y dónde irá en el servicio: query.campo, body.campo o body para un objeto JSON completo. Los parámetros path.* se incluyen obligatoriamente.</p>
              <div class="grid gap-2 sm:grid-cols-2">
                <DhInput v-model="newInputPublic" placeholder="Nombre público (ej.: cliente)" />
                <DhInput v-model="newInputInternal" placeholder="Campo de origen (ej.: body.clientId)" />
              </div>
              <DhButton variant="secondary" size="sm" :icon="Plus" label="Agregar campo de entrada" @click="addDynamicField('input')" />
              <div v-for="(field, i) in draft.inputs" :key="field.public" class="flex items-center justify-between gap-2 rounded-lg border border-[var(--dh-border)] p-2 text-xs">
                <span class="break-all"><strong>{{ field.public }}</strong> → <code>{{ field.internal }}</code>{{ field.required ? ' · obligatorio' : '' }}</span>
                <DhButton v-if="!field.required" variant="ghost" size="sm" :icon="Trash2" label="Quitar" @click="removeDynamicField('input', i)" />
              </div>
            </div>
            <div v-if="nestedStructures.length" class="space-y-2">
              <p class="text-xs font-semibold uppercase text-[var(--dh-text-muted)]">Estructuras internas de los datos JSON</p>
              <details v-for="section in nestedStructures" :key="section.name" class="rounded-xl border border-[var(--dh-border)] p-3">
                <summary class="cursor-pointer text-sm font-semibold">
                  {{ section.label }} · {{ section.fields.length }} campos incluidos en el objeto
                </summary>
                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                  <div v-for="child in section.fields" :key="child.internal" class="rounded-lg bg-[var(--dh-input)] p-2 text-xs">
                    <strong class="block">{{ child.label }}</strong>
                    <span class="text-[var(--dh-text-muted)]">{{ child.type }}{{ child.required ? ' · Obligatorio en el elemento' : '' }}</span>
                  </div>
                </div>
              </details>
            </div>
            <section v-if="method !== 'GET'" class="space-y-3 rounded-xl border border-[var(--dh-border)] p-4">
              <h4 class="font-bold">Valores predeterminados de la API</h4>
              <p class="text-xs text-[var(--dh-text-muted)]">Los valores fijos se guardan en Gateway y no los puede cambiar quien consuma esta API. Seleccioná un cliente existente del CRM o configurá campos individuales.</p>
              <div v-if="draft.target === 'pricing-rate-request-create'" class="space-y-2 rounded-xl border border-[var(--dh-border)] p-3">
                <strong class="text-sm">Asignar cliente y ejecutivo desde CRM</strong>
                <div class="flex flex-wrap gap-2">
                  <div class="min-w-0 flex-1"><DhInput v-model="crmQuery" placeholder="Buscar cliente genérico del sitio web..." /></div>
                  <DhButton variant="secondary" label="Buscar CRM" :loading="crmLoading" @click="searchCrmAccounts" />
                </div>
                <div v-if="crmAccounts.length" class="max-h-48 overflow-y-auto rounded-lg border border-[var(--dh-border)]">
                  <button v-for="account in crmAccounts" :key="account.id" type="button"
                    class="block w-full border-b border-[var(--dh-border)] p-3 text-left text-xs hover:bg-[var(--dh-input)]"
                    :class="crmSelection === account.id ? 'font-bold text-[var(--dh-primary)]' : ''"
                    @click="useCrmAccount(account.id)">{{ account.displayName }}</button>
                </div>
                <p v-if="crmSelection" class="text-xs text-[var(--dh-primary)]">Cliente, vendedor y ejecutivo fijados en el contrato.</p>
              </div>
              <p v-if="defaultErrors" class="text-xs text-red-500">{{ defaultErrors }}</p>
              <div v-for="(value, internal) in draft.defaults ?? {}" :key="internal" class="flex items-center justify-between gap-2 rounded-lg border border-[var(--dh-border)] p-2 text-xs">
                <span class="break-all"><strong>{{ internal }}</strong>: {{ typeof value === 'string' ? value : JSON.stringify(value) }}</span>
                <DhButton size="sm" variant="ghost" :icon="Trash2" label="Quitar" @click="removeDefault(String(internal))" />
              </div>
              <details v-if="defaultCandidates.length">
                <summary class="cursor-pointer text-sm">Agregar un campo predeterminado ({{ defaultCandidates.length }})</summary>
                <div class="mt-2 grid gap-2">
                  <div v-for="field in defaultCandidates" :key="field.internal" class="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--dh-border)] p-2">
                    <span class="min-w-40 flex-1 text-xs">{{ field.label }} · {{ field.type }}</span>
                    <div class="min-w-44 flex-1"><DhInput :model-value="defaultDrafts[field.internal] ?? ''" @update:model-value="value => { defaultDrafts[field.internal] = String(value) }" :placeholder="field.type === 'JSON' ? 'JSON' : 'Valor fijo'" /></div>
                    <DhButton size="sm" variant="secondary" label="Fijar" @click="changeDefault(field, defaultDrafts[field.internal] ?? '')" />
                  </div>
                </div>
              </details>
            </section>
            <p v-if="draft.target === 'pricing-rate-request-create'" class="text-xs text-[var(--dh-text-muted)]">
              El contenido de «Datos de operación» cambia según la modalidad de transporte. Pricing lo recibe como JSON y valida las reglas de la solicitud.
            </p>
            <p v-if="!inputCatalog.length" class="text-xs text-[var(--dh-text-muted)]">
              Esta operación no necesita parámetros de entrada.
            </p>
          </section>

          <section v-if="fieldCatalogLoaded" class="space-y-3 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-6">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="font-bold">Response · Datos de salida</h3>
              <span class="rounded-lg border border-[var(--dh-border)] px-2 py-1 text-xs">{{ draft.outputs.length }} de {{ outputCatalog.length }} campos</span>
            </div>
            <p class="text-xs text-[var(--dh-text-muted)]">Seleccioná qué información devolverá la API. Solo aparecen datos disponibles para esta operación.</p>
            <div v-if="draft.target.startsWith('config-catalog-')" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-xs text-[var(--dh-text-muted)]">
              <strong class="block mb-1 text-[var(--dh-text)]">Metadatos de Config, sin perder información</strong>
              <span>«Metadatos completos» devuelve el objeto JSON original con todas sus propiedades, incluso las adicionales. También podés escoger campos individuales como <strong>Tipo de terminal (CY / SD / APT)</strong>, modalidad, país, IATA e ICAO. Los valores siempre se toman del registro; si una propiedad no existe, se omite en la respuesta.</span>
            </div>
            <div v-if="outputOptions.length" class="flex flex-wrap gap-2">
              <DhButton variant="secondary" size="sm" label="Seleccionar todos" @click="selectAllOutputs" />
              <DhButton variant="ghost" size="sm" label="Limpiar selección" @click="clearOutputs" />
            </div>
            <DhMultiSelect
              v-if="outputOptions.length"
              v-model="selectedOutputs"
              label="Campos de respuesta"
              :options="outputOptions"
              placeholder="Seleccionar campos de respuesta"
              search-placeholder="Buscar información..."
            />
            <p v-else class="text-xs text-[var(--dh-text-muted)]">
              Esta operación no devuelve un cuerpo de respuesta (HTTP 204).
            </p>
            <div v-if="draft.target.startsWith('route.')" class="space-y-3 rounded-xl border border-[var(--dh-border)] p-3">
              <h4 class="font-bold">Mapeo personalizado de respuestas</h4>
              <p class="text-xs text-[var(--dh-text-muted)]">Dhole devolverá solo los campos indicados. Podés elegir rutas anidadas como data.items o data.name.</p>
              <div class="grid gap-2 sm:grid-cols-2">
                <DhInput v-model="newOutputPublic" placeholder="Nombre público (ej.: nombre)" />
                <DhInput v-model="newOutputInternal" placeholder="Campo interno (ej.: data.name)" />
              </div>
              <DhButton variant="secondary" size="sm" :icon="Plus" label="Agregar campo de respuesta" @click="addDynamicField('output')" />
              <div v-for="(field, i) in draft.outputs" :key="field.public" class="flex items-center justify-between gap-2 rounded-lg border border-[var(--dh-border)] p-2 text-xs">
                <span class="break-all"><strong>{{ field.public }}</strong> ← <code>{{ field.internal }}</code></span>
                <DhButton variant="ghost" size="sm" :icon="Trash2" label="Quitar" @click="removeDynamicField('output', i)" />
              </div>
            </div>
            <p v-if="draft.target === 'pricing-rates-list'" class="text-xs text-[var(--dh-text-muted)]">
              La paginación (número de página, tamaño, total de registros) se incluye automáticamente. Los campos elegidos se aplican a cada tarifa de la lista.
            </p>
            <p v-if="method === 'GET' && !selectedOutputs.length" class="text-xs text-amber-500">
              Para consultar datos, seleccioná por lo menos un campo de respuesta.
            </p>
          </section>
        </template>

        <template v-else>
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.13em] text-[var(--dh-primary)]">03 · Confirmación</p>
            <h3 class="mt-1 text-xl font-bold">Revisá la configuración antes de guardarla</h3>
            <p class="mt-1 text-sm text-[var(--dh-text-muted)]">La API permanecerá como borrador hasta que la publiques con los permisos correspondientes.</p>
          </div>
          <section class="space-y-4 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-6">
            <h3 class="text-lg font-bold">Resumen de la API</h3>
            <div class="grid grid-cols-1 gap-4 rounded-2xl border border-[var(--dh-border)] p-4 text-sm sm:grid-cols-2">
              <div><span class="block text-xs text-[var(--dh-text-muted)]">Nombre</span><strong>{{ draft.name }}</strong></div>
              <div><span class="block text-xs text-[var(--dh-text-muted)]">Operación</span><strong>{{ method }} · {{ methodName(method) }}</strong></div>
              <div><span class="block text-xs text-[var(--dh-text-muted)]">Módulo</span><strong class="uppercase">{{ service }}</strong></div>
              <div class="sm:col-span-2"><span class="block text-xs text-[var(--dh-text-muted)]">Ruta interna elegida</span><code class="break-all text-xs">{{ selectedTarget?.path }}</code></div>
              <div><span class="block text-xs text-[var(--dh-text-muted)]">Estado</span><strong>{{ draft.enabled ? 'Publicada' : 'Borrador' }}</strong></div>
            </div>
            <div class="rounded-xl border border-[var(--dh-border)] p-3">
              <div class="flex items-center justify-between gap-2"><strong class="text-xs">Ejemplo de solicitud</strong><DhButton size="sm" variant="ghost" :icon="Copy" label="Copiar" @click="copy(example)" /></div>
              <pre class="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs">{{ example }}</pre>
            </div>
            <div class="flex items-start gap-2 rounded-xl border border-[var(--dh-border)] p-3 text-xs text-[var(--dh-text-muted)]">
              <ShieldCheck class="h-5 w-5 shrink-0" />
              <span>La API se guarda inicialmente como borrador. Para publicarla necesitás una identidad técnica limitada al cliente y a la operación seleccionada. Los campos de salida no sustituyen los permisos de acceso por cliente.</span>
            </div>
            <div v-if="!ready" class="rounded-xl border border-amber-500/50 p-3 text-xs">
              La conexión de esta operación todavía no está lista. Podés guardar tu API, pero un administrador debe habilitarla antes de compartirla.
            </div>
          </section>
          <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section class="self-start space-y-4 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 sm:p-6">
              <div>
                <h3 class="text-lg font-bold">Publicación</h3>
                <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Guardá primero el contrato. Las API Keys se administran por separado.</p>
              </div>
              <div v-if="!draft.id" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4 text-sm text-[var(--dh-text-muted)]">
                Esta API todavía no se guardó. Podés previsualizar una consulta GET antes de crear el borrador.
              </div>
              <template v-else>
                <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
                  <div>
                    <strong class="block">{{ draft.enabled ? 'API publicada' : 'API en borrador' }}</strong>
                    <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ ready ? 'La identidad técnica está disponible.' : 'La identidad técnica de Gateway todavía no está disponible.' }}</p>
                  </div>
                  <DhButton :icon="draft.enabled ? Power : CheckCircle2"
                    :label="draft.enabled ? 'Desactivar' : 'Publicar API'"
                    :disabled="saving || (!draft.enabled && !ready)" @click="toggle(draft)" />
                </div>
                <p v-if="!ready" class="rounded-xl border border-amber-500/40 p-3 text-xs">
                  Esta API aún no se puede publicar ni consumir externamente porque le falta una identidad técnica en Gateway. Podés probar su GET con los permisos de tu sesión.
                </p>
              </template>
              <div class="rounded-xl border border-[var(--dh-border)] p-4">
                <div class="flex items-start gap-3">
                  <KeyRound class="mt-0.5 h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
                  <div class="min-w-0 space-y-2">
                    <strong class="block text-sm">API Keys independientes</strong>
                    <p class="text-xs leading-relaxed text-[var(--dh-text-muted)]">Generá una clave por aplicación, vinculala a una o más APIs y revocala desde el panel de credenciales. No se crea una clave por cada ruta.</p>
                    <DhButton variant="secondary" size="sm" :icon="KeyRound" label="Administrar API Keys" @click="showKeysPanel" />
                  </div>
                </div>
              </div>
            </section>

            <section class="min-w-0 space-y-4 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 sm:p-6">
              <div>
                <p class="text-xs font-bold uppercase tracking-wider text-[var(--dh-primary)]">Consola de pruebas</p>
                <h3 class="mt-1 text-lg font-bold">Probá los datos que devuelve</h3>
                <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
                  {{ method === 'GET' ? 'Previsualizá con tu sesión sin publicar ni crear una API Key.' : 'Las operaciones que modifican datos requieren API publicada y API Key vinculada.' }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
                <span class="rounded-lg border border-[var(--dh-border)] px-2 py-1 font-mono text-xs font-bold">{{ method }}</span>
                <code class="min-w-0 flex-1 break-all text-xs">{{ externalUrl(draft) }}</code>
                <DhButton variant="ghost" size="sm" :icon="Copy" label="Copiar URL" @click="copy(externalUrl(draft))" />
              </div>
              <DhInput v-if="selectedTarget?.path.includes('{id}') && !draft.target.startsWith('route.')"
                v-model="testId" label="Identificador del registro" placeholder="ID necesario para la consulta" />
              <div class="space-y-2">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <p class="text-xs font-bold uppercase tracking-wide text-[var(--dh-text-muted)]">{{ method === 'GET' ? 'Parámetros GET (JSON)' : 'Datos de la solicitud (JSON)' }}</p>
                  <DhButton variant="ghost" size="sm" label="Cargar plantilla" @click="fillTestExample" />
                </div>
                <DhTextarea v-model="testPayload" :rows="6" placeholder="{}" />
                <p class="text-xs text-[var(--dh-text-muted)]">Utilizá los campos públicos seleccionados en el paso anterior.</p>
              </div>
              <div v-if="method === 'GET'" class="flex flex-wrap items-center gap-3">
                <DhButton :icon="ArrowRight" label="Previsualizar GET" :disabled="testRunning" :loading="testRunning" @click="previewApi" />
                <span class="text-xs text-[var(--dh-text-muted)]">Lectura real con tu sesión · no modifica datos</span>
              </div>
              <div v-if="draft.enabled" class="space-y-3 border-t border-[var(--dh-border)] pt-4">
                <DhInput v-model="testApiKey" type="password" label="API Key vinculada para probar la ruta pública" placeholder="dh_ext_..." />
                <p class="text-xs text-[var(--dh-text-muted)]">Para probar la API pública, pegá la clave que guardaste al generarla en API Keys.</p>
                <label v-if="method !== 'GET'" class="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-500/40 p-3 text-xs">
                  <input v-model="mutationConfirmed" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 accent-[var(--dh-primary)]" />
                  <span>Autorizo ejecutar {{ method }} sobre datos reales. Puede crear, modificar o eliminar registros.</span>
                </label>
                <DhButton variant="secondary" :icon="ArrowRight" label="Probar API pública con clave"
                  :disabled="testRunning || !testApiKey.trim()" :loading="testRunning" @click="runApiTest" />
              </div>
              <div v-if="testError" role="alert" class="rounded-xl border border-red-500/40 p-3 text-sm text-red-500">{{ testError }}</div>
              <div v-if="testResult" class="space-y-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4" role="status">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="font-mono text-sm font-bold" :class="testResult.ok ? 'text-[var(--dh-primary)]' : 'text-red-500'">
                    HTTP {{ testResult.status }} · {{ testResult.durationMs }} ms
                  </span>
                  <DhButton variant="ghost" size="sm" :icon="Copy" label="Copiar JSON" @click="copy(testResponse)" />
                </div>
                <pre class="max-h-[440px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 font-mono text-xs leading-relaxed">{{ testResponse }}</pre>
              </div>
            </section>
          </div>
        </template>

        <div class="sticky bottom-0 z-20 flex flex-col gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-[var(--dh-shadow-lg)] sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div class="min-w-0">
            <span class="block text-xs font-bold text-[var(--dh-text)]">Paso {{ step }} de 3</span>
            <span class="block max-w-[540px] truncate text-xs text-[var(--dh-text-muted)]">{{ selectedTarget ? targetName(selectedTarget) : 'Elegí una ruta para continuar' }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <DhButton variant="secondary" :icon="ArrowLeft" :label="step === 1 ? 'Cerrar' : 'Atrás'" @click="step === 1 ? closeDrawer() : step--" />
            <DhButton v-if="step === 1 || step === 2" :icon="ArrowRight" label="Continuar" :disabled="saving || (step === 1 && !selectedTarget)" @click="next" />
            <DhButton v-else :icon="Check" :label="isNew ? 'Guardar borrador' : 'Guardar cambios'" :loading="saving" :disabled="saving" @click="save" />
            <DhButton v-if="step === 3 && draft.id" variant="secondary" label="Cerrar" @click="closeDrawer" />
          </div>
        </div>
      </div>
    </section>

    <DhModal :open="secretModal" title="API Key generada" size="lg" @close="secretModal = false; issuedSecret = ''">
      <div class="space-y-3">
        <p class="text-sm">Esta es la clave para <strong>{{ issuedLabel }}</strong>. Guardala en un lugar seguro; no se volverá a mostrar.</p>
        <code class="block break-all rounded-xl bg-black/5 p-3 text-xs dark:bg-white/5">{{ issuedSecret }}</code>
        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" label="Cerrar" @click="secretModal = false; issuedSecret = ''" />
          <DhButton :icon="Copy" label="Copiar clave" @click="copy(issuedSecret)" />
        </div>
      </div>
    </DhModal>

    <DhModal :open="Boolean(confirmRevoke)" title="Revocar API Key" size="sm" @close="confirmRevoke = null">
      <div class="space-y-4">
        <p class="text-sm">¿Revocar la clave de <strong>{{ confirmRevoke?.label }}</strong>? El tercero perderá acceso inmediatamente.</p>
        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" label="Cancelar" @click="confirmRevoke = null" />
          <DhButton variant="danger" :icon="Trash2" label="Revocar clave" @click="revoke" />
        </div>
      </div>
    </DhModal>
  </main>
</template>

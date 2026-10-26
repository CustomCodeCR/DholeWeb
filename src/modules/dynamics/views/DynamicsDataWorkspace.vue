<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AlertTriangle, Database, RefreshCw, Search, ShieldCheck } from 'lucide-vue-next'
import { fetchClient } from '@/core/api/fetchConfig'
import { ApiError } from '@/core/api/apiErrorHandler'
import { useAuthStore } from '@/core/stores/authStore'
import { formatDynamicsReadCell } from '../utils/dynamicsReadFormatting'

type Section = 'catalog' | 'query' | 'crud' | 'security' | 'integrations'
type Connection = { code: string; id?: string }
type Choice = { value: number; labels: Record<string, string> }
type Column = {
  logicalName: string; type: string; canRead: boolean; canCreate: boolean
  canUpdate: boolean; isCalculated: boolean; labels: Record<string, string>
  choices: Choice[]; lookupTargets: string[]; requiredLevel?: string | null
}
type Relation = {
  schemaName: string; kind: string; referencedEntity: string | null
  referencingAttribute: string | null; referencingNavigation: string | null
}
type Table = {
  logicalName: string; entitySetName: string; primaryIdAttribute: string
  labels: Record<string, string>; columns: Column[]; relationships: Relation[]
  alternateKeys?: Array<{ logicalName: string; attributes: string[] }>
}
type Snapshot = { version: number; capturedAt: string; catalog: { tables: Table[] } }
type FieldPolicy = {
  entityName: string; fieldName: string; enabled: boolean
  canRead: boolean; canCreate: boolean; canUpdate: boolean
}
type Policies = {
  entities: Array<{ logicalName: string; enabled: boolean }>
  fields: FieldPolicy[]
}
type FieldDraft = { enabled: boolean; canRead: boolean; canCreate: boolean; canUpdate: boolean }
type Filter = { id: number; field: string; op: string; value: string }
type Query = {
  select: string[]; filter?: unknown; order?: Array<{ field: string; desc: boolean }>
  pageSize: number; count: boolean
}
type Saved = {
  id: string; name: string; entityName: string; enabled: boolean
  query: Query; parameters: Array<{ name: string; type: string; required: boolean }>
}
type Page = {
  items: Array<Record<string, unknown>>; nextCursor: string | null
  count: number | null; page: number; truncated: boolean; metadataVersion: number
}
type Detail = { item: Record<string, unknown>; eTag: string | null }
type WriteResult = {
  operationId: string; state: string; httpStatus: number | null
  recordId: string | null; eTag?: string | null
}
type Diagnostics = { environment: string; m2mConfigured: boolean; productionWritesApproved: boolean; productionDeletesApproved: boolean }
type DeletePolicy = { entity: string; enabled: boolean; minAgeDays: number }
type MetadataBulkFieldResult = {
  snapshotVersion: number; enabledFields: number; readFields: number;
  createFields: number; updateFields: number; includeWrite: boolean
}
type MetadataJob = {
  id: string; connectionId: string; kind: string; resourceKey: string
  status: 'pending' | 'running' | 'completed' | 'dead'; lastErrorCode: string | null
  attempts: number; maxAttempts: number; createdAt: string
}
type ApiOperation = 'saved' | 'search' | 'get' | 'create' | 'update' | 'delete' | 'upsert'
type ApiClient = { id: string; issuer: string; clientId: string; displayName: string; enabled: boolean }
type ApiGrant = { id: string; apiClientId: string; connectionId: string; entitySet: string; operation: string;
  allowedFields: string[]; maxRequestsPerMinute: number; enabled: boolean }
type IntegrationKeyInfo = {
  id: string; queryName: string | null; scope: 'all' | 'single' | 'selected'
  allowedQueries?: string[]; label: string; enabled: boolean; expiresAt: string
  maxRequestsPerMinute: number; createdAt: string; lastUsedAt: string | null
}
type IntegrationKeyIssued = { key: IntegrationKeyInfo; apiKey: string }

const props = defineProps<{ section: Section; connections: Connection[] }>()
const emit = defineEmits<{ navigate: [section: Section] }>()
const auth = useAuthStore()
const canSecurity = computed(() => auth.hasScope('dynamics.security.admin'))
const code = ref('')
const busy = ref(false)
const error = ref('')
const info = ref('')
const snapshot = ref<Snapshot | null>(null)
const policies = ref<Policies>({ entities: [], fields: [] })
const diff = ref<Record<string, unknown> | null>(null)
const metadataJobs = ref<Record<string, MetadataJob>>({})
const metadataJob = computed(() => Object.values(metadataJobs.value).find(j =>
  j.status === 'running' || j.status === 'pending') ?? null)
const tableJob = (name: string) => metadataJobs.value[name]
const monitoring = ref(false)
let monitorInterval: ReturnType<typeof setInterval> | null = null
const publicOrigin = ref((import.meta.env.VITE_API_URL || 'https://api.logisticacastrofallas.com').trim().replace(/\/+$/, ''))
const publicOperation = ref<ApiOperation>('saved')
const publicAuthMode = ref<'api-key' | 'oauth'>('api-key')
const integrationKeys = ref<IntegrationKeyInfo[]>([])
const integrationKeyForm = ref({ label: 'Pangolin', expiresInDays: 30, maxRequestsPerMinute: 60 })
const newKeyScope = ref<'all' | 'selected'>('all')
const newKeyQueries = ref<string[]>([])
const editingKeyId = ref('')
const editingKeyScope = ref<'all' | 'selected'>('all')
const editingKeyQueries = ref<string[]>([])
const enabledSavedQueries = computed(() => saved.value.filter(query => query.enabled))
const editingKey = computed(() => integrationKeys.value.find(key => key.id === editingKeyId.value))
const issuedIntegrationKey = ref<IntegrationKeyIssued | null>(null)
const publicSavedName = ref('')
const publicRecordId = ref('')
const publicKey = ref('')
const copied = ref(false)
const diagnostics = ref<Diagnostics | null>(null)
const schedule = ref({ enabled: false, intervalMinutes: 1440 })
const tableSearch = ref('')
const expanded = ref('')
const drafts = ref<Record<string, FieldDraft>>({})
const entity = ref('')
const columns = ref<string[]>([])
const filters = ref<Filter[]>([])
const join = ref<'and' | 'or'>('and')
const nextId = ref(0)
const orderField = ref('')
const descending = ref(false)
const pageSize = ref(25)
const count = ref(false)
const page = ref<Page | null>(null)
const lastQuery = ref<Query | null>(null)
const saved = ref<Saved[]>([])
const savedName = ref('')
const paramName = ref('valor')
const saveAsParameter = ref(false)
const queryStep = ref<1 | 2 | 3 | 4>(1)
const queryFieldSearch = ref('')
const queryNameVisible = ref(false)
const querySteps = ['Tabla', 'Columnas', 'Filtros', 'Revisar y ejecutar'] as const
const crudMode = ref<'create' | 'update' | 'delete'>('create')
const crudStep = ref<1 | 2 | 3 | 4>(1)
const crudFieldSearch = ref('')
const crudSteps = computed(() => [
  'Operación', crudMode.value === 'create' ? 'Tabla y campos' : 'Identificar registro',
  crudMode.value === 'delete' ? 'Revisar borrado' : 'Completar datos', 'Confirmar',
])
const recordId = ref('')
const loadedRecordId = ref('')
const etag = ref('')
const writeFields = ref<string[]>([])
const writeValues = ref<Record<string, string>>({})
const navByField = ref<Record<string, string>>({})
const confirmed = ref(false)
const deletePhrase = ref('')
const deleteReason = ref('')
const deletePolicy = ref<DeletePolicy | null>(null)
const writeResult = ref<WriteResult | null>(null)
const lockedWrite = ref(false)
const clients = ref<ApiClient[]>([])
const grants = ref<ApiGrant[]>([])
const clientForm = ref({ issuer: '', clientId: '', displayName: '', enabled: false })
const grantClient = ref('')
const grantOperation = ref<'read' | 'create' | 'update' | 'delete' | 'upsert'>('read')
const grantFields = ref<string[]>([])
const grantQuota = ref(60)
const grantEnabled = ref(true)

const tables = computed(() => snapshot.value?.catalog.tables ?? [])
const activeTable = computed(() => tables.value.find(t => t.logicalName === entity.value) ?? null)
const enabledTables = computed(() => tables.value.filter(t => entityEnabled(t.logicalName)))
const approvedFields = computed(() => activeTable.value?.columns.filter(f => fieldAllowed(f, 'read')) ?? [])
const writableFields = computed(() => activeTable.value?.columns.filter(f => fieldAllowed(f, crudMode.value === 'create' ? 'create' : 'update')) ?? [])
const matchedTables = computed(() => tables.value.filter(t => (
  t.logicalName + ' ' + label(t.labels)
).toLowerCase().includes(tableSearch.value.trim().toLowerCase())).slice(0, 200))
const canWrite = computed(() => canSecurity.value && diagnostics.value !== null && diagnostics.value.productionWritesApproved)
const canDelete = computed(() => canWrite.value && diagnostics.value?.productionDeletesApproved === true)
const visibleQueryFields = computed(() => approvedFields.value.filter(f =>
  (label(f.labels) + ' ' + f.logicalName).toLowerCase().includes(queryFieldSearch.value.trim().toLowerCase())))
const visibleWriteFields = computed(() => writableFields.value.filter(f =>
  (label(f.labels) + ' ' + f.logicalName).toLowerCase().includes(crudFieldSearch.value.trim().toLowerCase())))
const queryReady = computed(() => !!entity.value && columns.value.length > 0 &&
  columns.value.every(n => approvedFields.value.some(f => f.logicalName === n)))
const querySummary = computed(() => [
  (label(activeTable.value?.labels) || activeTable.value?.logicalName || 'Sin tabla'),
  columns.value.length + ' columnas',
  filters.value.length ? filters.value.length + ' condiciones (' + (join.value === 'and' ? 'todas' : 'cualquiera') + ')' : 'Sin condiciones',
  pageSize.value + ' registros por página',
])
const suggestedSavedName = computed(() => {
  const base = ('consulta_' + (entity.value || 'dataverse')).toLowerCase()
    .replace(/[^a-z0-9_]/g, '_').slice(0, 40)
  let suggestion = base
  for (let version = 2; saved.value.some(item => item.name === suggestion); version++) {
    const suffix = '_' + version
    suggestion = base.slice(0, 40 - suffix.length) + suffix
  }
  return suggestion
})
const queryPreview = computed(() => {
  try { return { valid: true, data: buildQuery(), error: '' } }
  catch (e) { return { valid: false, data: null, error: e instanceof Error ? e.message : 'Consulta incompleta.' } }
})
const savedQueryPreview = computed(() => {
  try { return { valid: true, data: buildQuery(true), error: '' } }
  catch (e) { return { valid: false, data: null, error: e instanceof Error ? e.message : 'Consulta incompleta.' } }
})
const crudPreview = computed(() => {
  if (crudMode.value === 'delete') return null
  try { return valuesToWrite() }
  catch (e) { return { aviso: e instanceof Error ? e.message : 'Campos incompletos.' } }
})
const crudSelectedCount = computed(() => writeFields.value.length)
const crudPreviewValid = computed(() => {
  if (crudMode.value === 'delete') return true
  try { valuesToWrite(); return true }
  catch { return false }
})
const canFinishWrite = computed(() =>
  canWrite.value && !busy.value && !lockedWrite.value && !!activeTable.value &&
  (crudMode.value === 'create' || (!!etag.value && validGuid(recordId.value) && recordId.value === loadedRecordId.value)) &&
  (crudMode.value === 'delete' || (writeFields.value.length > 0 && crudPreviewValid.value)) &&
  (crudMode.value !== 'delete' || (canDelete.value && !!deletePolicy.value?.enabled &&
    confirmed.value && deletePhrase.value === 'ELIMINAR' && deleteReason.value.trim().length >= 10)))
const publicEndpoint = computed(() => {
  const origin = publicOrigin.value.trim().replace(/\/+$/, '')
  const base = origin + '/api/dynamics-connector'
  const table = encodeURIComponent(entity.value || '{table}')
  const id = publicRecordId.value ? encodeURIComponent(publicRecordId.value) : '{record-guid}'
  if (publicAuthMode.value === 'api-key') {
    return base + '/keyed/saved-queries/' + (publicSavedName.value
      ? encodeURIComponent(publicSavedName.value) : '{query-name}') + '/execute'
  }
  if (publicOperation.value === 'saved')
    return base + '/saved-queries/' + (publicSavedName.value ? encodeURIComponent(publicSavedName.value) : '{query-name}') + '/execute'
  if (publicOperation.value === 'search') return base + '/records/' + table + '/search'
  if (publicOperation.value === 'get') {
    const fields = approvedFields.value.slice(0, 5).map(f => f.logicalName).join(',')
    return base + '/records/' + table + '/' + id + '?connectionCode=' +
      encodeURIComponent(code.value) + '&select=' + encodeURIComponent(fields || '{approved-fields}')
  }
  if (publicOperation.value === 'upsert') return base + '/records/' + table + '/by-key'
  if (publicOperation.value === 'create') return base + '/records/' + table
  return base + '/records/' + table + '/' + id
})
const publicReady = computed(() => {
  if (!validApiOrigin.value || !code.value) return false
  if (publicAuthMode.value === 'api-key' || publicOperation.value === 'saved')
    return !!publicSavedName.value && !!saved.value.find(q => q.name === publicSavedName.value && q.enabled)
  if (!activeTable.value || !entityEnabled(activeTable.value.logicalName)) return false
  if (publicOperation.value === 'get' || publicOperation.value === 'update' || publicOperation.value === 'delete')
    return validGuid(publicRecordId.value)
  if (publicOperation.value === 'upsert')
    return !!publicKey.value && !!activeTable.value.alternateKeys?.some(k => k.attributes.includes(publicKey.value))
  return true
})
const publicMethod = computed(() => publicAuthMode.value === 'api-key' ? 'POST' : ({
  saved: 'POST', search: 'POST', get: 'GET', create: 'POST', update: 'PATCH', delete: 'DELETE',
  upsert: 'PUT',
})[publicOperation.value])
const publicBody = computed(() => {
  if (publicAuthMode.value === 'api-key' || publicOperation.value === 'saved') {
    const selected = saved.value.find(s => s.name === publicSavedName.value)
    return { connectionCode: code.value, parameters: Object.fromEntries(
      (selected?.parameters ?? []).map(p => [p.name, '<' + p.type + '>']),
    ) }
  }
  if (publicOperation.value === 'search')
    return { connectionCode: code.value, query: lastQuery.value ?? {
      select: approvedFields.value.slice(0, 5).map(f => f.logicalName), pageSize: 25, count: false,
    } }
  if (publicOperation.value === 'get') return null
  if (publicOperation.value === 'delete')
    return { connectionCode: code.value, confirm: true, reason: 'Razón de eliminación (10 caracteres mínimo)' }
  if (publicOperation.value === 'upsert')
    return { connectionCode: code.value,
      keys: { [publicKey.value || '<clave-alternativa>']: '<valor>' },
      values: { '<campo-habilitado>': '<valor>' } }
  return { connectionCode: code.value, values: { '<campo-habilitado>': '<valor>' } }
})
const publicCurl = computed(() => {
  const headers = [publicAuthMode.value === 'api-key'
    ? "-H 'X-Dhole-Api-Key: <CLAVE_GENERADA_EN_DHOLE>'"
    : "-H 'Authorization: Bearer <ACCESS_TOKEN>'"]
  if (publicBody.value) headers.push("-H 'Content-Type: application/json'")
  if (publicAuthMode.value === 'oauth' && (publicOperation.value === 'create' || publicOperation.value === 'update' ||
      publicOperation.value === 'delete' || publicOperation.value === 'upsert'))
    headers.push("-H 'Idempotency-Key: replace-with-unique-operation-key'")
  if (publicAuthMode.value === 'oauth' && (publicOperation.value === 'update' || publicOperation.value === 'delete'))
    headers.push("-H 'If-Match: <ETAG_FROM_DATAVERSE>'")
  const body = publicBody.value ? " \\\n  --data '" + JSON.stringify(publicBody.value, null, 2).replaceAll("'", "'\\''") + "'" : ''
  return "curl -X " + publicMethod.value + " '" + publicEndpoint.value + "' \\\n  " + headers.join(" \\\n  ") + body
})

const publicScope = computed(() => 'dynamics.records.' +
  (publicOperation.value === 'saved' || publicOperation.value === 'search' ||
    publicOperation.value === 'get' ? 'read' : publicOperation.value))
const validApiOrigin = computed(() => {
  try {
    const url = new URL(publicOrigin.value.trim())
    return !url.username && !url.password && !url.search && !url.hash &&
      url.pathname === '/' && (url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  } catch { return false }
})
async function loadIntegrationKeys() {
  if (!code.value || !canSecurity.value) return
  integrationKeys.value = await api<IntegrationKeyInfo[]>(connectionPath('integration-keys'))
}
async function createIntegrationKey() {
  await run(async () => {
    if (!canSecurity.value || !code.value)
      throw new Error('Seleccioná una conexión y verificá el permiso de seguridad.')
    if (newKeyScope.value === 'selected' && newKeyQueries.value.length === 0)
      throw new Error('Seleccioná al menos una consulta habilitada.')
    const issued = await api<IntegrationKeyIssued>(connectionPath('integration-keys'), 'POST', {
      queryName: null,
      scope: newKeyScope.value,
      allowedQueries: newKeyScope.value === 'selected' ? newKeyQueries.value : [],
      label: integrationKeyForm.value.label.trim(),
      expiresInDays: integrationKeyForm.value.expiresInDays,
      maxRequestsPerMinute: integrationKeyForm.value.maxRequestsPerMinute,
    })
    issuedIntegrationKey.value = issued
    await loadIntegrationKeys()
    info.value = 'Clave generada para ' + (newKeyScope.value === 'all'
      ? 'todas las consultas habilitadas.' : newKeyQueries.value.length + ' consultas seleccionadas.')
      + ' Copiala ahora: solo se muestra una vez.'
  })
}
function editIntegrationKey(key: IntegrationKeyInfo) {
  editingKeyId.value = key.id
  editingKeyScope.value = key.scope === 'all' ? 'all' : 'selected'
  editingKeyQueries.value = key.scope === 'selected'
    ? (key.allowedQueries ?? []).filter(name => enabledSavedQueries.value.some(query => query.name === name))
    : key.scope === 'single' && key.queryName && enabledSavedQueries.value.some(query => query.name === key.queryName)
      ? [key.queryName] : []
}
async function updateIntegrationKeyAccess() {
  await run(async () => {
    if (!editingKeyId.value || !canSecurity.value)
      throw new Error('Seleccioná una API Key activa.')
    if (editingKeyScope.value === 'selected' && editingKeyQueries.value.length === 0)
      throw new Error('Seleccioná al menos una consulta habilitada.')
    await api(connectionPath('integration-keys/' + encodeURIComponent(editingKeyId.value) + '/access'),
      'PUT', { scope: editingKeyScope.value,
        allowedQueries: editingKeyScope.value === 'selected' ? editingKeyQueries.value : [] })
    await loadIntegrationKeys()
    editingKeyId.value = ''
    info.value = 'Permisos de la API Key actualizados sin cambiar su secreto.'
  })
}
async function revokeIntegrationKey(id: string) {
  await run(async () => {
    await api(connectionPath('integration-keys/' + encodeURIComponent(id)), 'DELETE')
    if (issuedIntegrationKey.value?.key.id === id) issuedIntegrationKey.value = null
    if (editingKeyId.value === id) editingKeyId.value = ''
    await loadIntegrationKeys()
    info.value = 'Clave revocada. Esa aplicación ya no puede utilizarla.'
  })
}
async function copyApi(value: string) {
  if (!validApiOrigin.value) {
    error.value = 'Usá el dominio público HTTPS del gateway (o localhost para desarrollo).'
    return
  }
  await navigator.clipboard.writeText(value)
  copied.value = true
  info.value = 'Copiado al portapapeles.'
}

const grantAllowedFields = computed(() => {
  if (!activeTable.value) return []
  if (grantOperation.value === 'delete') return [activeTable.value.primaryIdAttribute]
  if (grantOperation.value === 'upsert')
    return activeTable.value.columns.filter(f => fieldAllowed(f, 'create') && fieldAllowed(f, 'update')).map(f => f.logicalName)
  const operation: 'read' | 'create' | 'update' =
    grantOperation.value === 'create' ? 'create' : grantOperation.value === 'update' ? 'update' : 'read'
  return activeTable.value.columns.filter(f => fieldAllowed(f, operation)).map(f => f.logicalName)
})

function label(labels: Record<string, string> | undefined) {
  return labels?.['3082'] || labels?.['1033'] || Object.values(labels ?? {})[0] || ''
}
function formatReadCell(item: Record<string, unknown>, fieldName: string) {
  const choices = activeTable.value?.columns.find(field => field.logicalName === fieldName)?.choices ?? []
  return formatDynamicsReadCell(item, fieldName, choices)
}
function prefixed(path: string) {
  return '/api/dynamics-admin/' + path
}
function connectionPath(part: string) {
  return 'connections/' + encodeURIComponent(code.value) + '/' + part
}
async function api<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown, headers?: Record<string, string>): Promise<T> {
  if (!path || path.includes('..')) throw new Error('Ruta administrativa inválida.')
  return fetchClient<T>(prefixed(path), {
    method, ...(body === undefined ? {} : { body }), ...(headers ? { headers } : {}),
  })
}
async function run(action: () => Promise<void>) {
  if (busy.value) return
  busy.value = true; error.value = ''; info.value = ''
  try { await action() }
  catch (e) { error.value = e instanceof Error ? e.message : 'No se pudo completar la operación.' }
  finally { busy.value = false }
}
function entityEnabled(name: string) {
  return policies.value.entities.some(x => x.logicalName === name && x.enabled)
}
function fieldRule(entityName: string, fieldName: string) {
  return policies.value.fields.find(x => x.entityName === entityName && x.fieldName === fieldName)
}
function fieldAllowed(field: Column, op: 'read' | 'create' | 'update') {
  const rule = fieldRule(entity.value, field.logicalName)
  return !!rule?.enabled && !!rule[op === 'read' ? 'canRead' : op === 'create' ? 'canCreate' : 'canUpdate'] &&
    !!field[op === 'read' ? 'canRead' : op === 'create' ? 'canCreate' : 'canUpdate'] &&
    (op === 'read' || !field.isCalculated)
}
function resetRecord() {
  writeFields.value = []; writeValues.value = {}; navByField.value = {}
  recordId.value = ''; loadedRecordId.value = ''; etag.value = ''; writeResult.value = null; lockedWrite.value = false
  confirmed.value = false; deleteReason.value = ''; deletePhrase.value = ''
}
function resetQuery() {
  columns.value = approvedFields.value.slice(0, 5).map(f => f.logicalName)
  filters.value = []; page.value = null; lastQuery.value = null
  orderField.value = ''; descending.value = false
  queryStep.value = 1; queryFieldSearch.value = ''; queryNameVisible.value = false
  savedName.value = ''; paramName.value = 'valor'; saveAsParameter.value = false
}
function changeEntity() {
  resetQuery(); resetRecord()
  crudStep.value = 1; crudFieldSearch.value = ''
  void readDeletePolicy()
}
function changeCrudMode() { resetRecord(); crudStep.value = 1; crudFieldSearch.value = '' }
function chooseSuggestedFields() {
  columns.value = approvedFields.value.slice(0, 5).map(f => f.logicalName)
}
function chooseAllReadFields() {
  columns.value = approvedFields.value.slice(0, 30).map(f => f.logicalName)
}
function nextQueryStep() {
  error.value = ''
  if (queryStep.value === 1 && !activeTable.value) { error.value = 'Elegí una tabla habilitada.'; return }
  if (queryStep.value === 2 && !queryReady.value) { error.value = 'Seleccioná al menos una columna autorizada.'; return }
  if (queryStep.value === 3 && !queryPreview.value.valid && !savedQueryPreview.value.valid) {
    error.value = savedQueryPreview.value.error; return
  }
  if (queryStep.value < 4) queryStep.value = (queryStep.value + 1) as 1 | 2 | 3 | 4
}
function nextCrudStep() {
  error.value = ''
  if (!activeTable.value) { error.value = 'Elegí una tabla autorizada.'; return }
  if (crudStep.value === 2 && crudMode.value === 'create' && !writeFields.value.length) {
    error.value = 'Elegí al menos un campo con permiso de creación.'; return
  }
  if (crudStep.value === 2 && crudMode.value !== 'create' && (!etag.value || !validGuid(recordId.value) || recordId.value !== loadedRecordId.value)) {
    error.value = 'Primero cargá un registro válido para obtener su ETag.'; return
  }
  if (crudStep.value === 3 && crudMode.value !== 'delete' && !writeFields.value.length) {
    error.value = 'Elegí los campos que querés escribir.'; return
  }
  if (crudStep.value < 4) crudStep.value = (crudStep.value + 1) as 1 | 2 | 3 | 4
}
function addWriteField(name: string) {
  if (writableFields.value.some(f => f.logicalName === name) && !writeFields.value.includes(name))
    writeFields.value = [...writeFields.value, name]
}
function removeWriteField(name: string) {
  writeFields.value = writeFields.value.filter(n => n !== name)
  delete writeValues.value[name]
  delete navByField.value[name]
}

async function reload() {
  snapshot.value = null; policies.value = { entities: [], fields: [] }
  page.value = null; saved.value = []; diff.value = null
  if (!code.value) return
  const p = connectionPath('metadata')
  const [policy, snap, d, sched, diag] = await Promise.all([
    api<Policies>(p + '/policies'),
    api<Snapshot>(p).catch(e => {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }),
    api<Record<string, unknown>>(p + '/diff').catch(() => null),
    api<{ enabled: boolean; intervalMinutes: number }>(p + '/schedule'),
    api<Diagnostics>('console/diagnostics'),
  ])
  policies.value = policy
  snapshot.value = snap
  diff.value = d
  diagnostics.value = diag
  schedule.value = { enabled: sched.enabled, intervalMinutes: sched.intervalMinutes }
  drafts.value = {}
  for (const t of snap?.catalog.tables ?? []) for (const f of t.columns) {
    const p = fieldRule(t.logicalName, f.logicalName)
    drafts.value[t.logicalName + '.' + f.logicalName] = {
      enabled: !!p?.enabled, canRead: !!p?.canRead, canCreate: !!p?.canCreate, canUpdate: !!p?.canUpdate,
    }
  }
  if (!enabledTables.value.some(t => t.logicalName === entity.value))
    entity.value = enabledTables.value[0]?.logicalName ?? ''
  resetQuery(); resetRecord()
  if (entity.value) await readDeletePolicy()
  if (props.section === 'query' || props.section === 'integrations') await loadSaved()
  if ((props.section === 'security' || props.section === 'integrations') && canSecurity.value) await loadGrants()
  if (props.section === 'integrations' && canSecurity.value) await loadIntegrationKeys()
  if (props.section === 'catalog') await resumeMetadataJob()
}
async function refreshMetadata(targetTable: string | null = null) {
  await run(async () => {
    if (!canSecurity.value) throw new Error('Se requiere dynamics.security.admin para solicitar un refresco.')
    const table = targetTable ?? ''
    const active = (await api<MetadataJob[]>('operations/jobs?connectionCode=' +
      encodeURIComponent(code.value) + '&limit=100'))
      .find(j => j.kind === 'metadata_refresh' && j.resourceKey === table &&
        ['pending', 'running'].includes(j.status))
    const job = active ?? await api<MetadataJob>('operations/jobs/' + encodeURIComponent(code.value),
      'POST', { kind: 'metadata_refresh', entityName: targetTable,
        dedupeKey: 'metadata-ui-' + crypto.randomUUID().replaceAll('-', '') })
    metadataJobs.value[table] = job
    info.value = (active ? 'El trabajo ya está activo: ' : 'Se inició el descubrimiento de ') +
      (targetTable ? 'campos de ' + targetTable : 'las tablas') + '. Podés continuar usando Dhole.'
  })
}

const bulkTable = ref('')
// Bulk approval defaults to every Dataverse-authorized read/create/update capability.
const bulkIncludeWrite = ref(true)
const bulkConfirmed = ref(false)
const bulkPreview = computed(() => {
  const table = tables.value.find(t => t.logicalName === bulkTable.value)
  const fields = table?.columns ?? []
  return {
    total: fields.filter(f => f.canRead || (bulkIncludeWrite.value && !f.isCalculated &&
      (f.canCreate || f.canUpdate))).length,
    read: fields.filter(f => f.canRead).length,
    create: bulkIncludeWrite.value ? fields.filter(f => f.canCreate && !f.isCalculated).length : 0,
    update: bulkIncludeWrite.value ? fields.filter(f => f.canUpdate && !f.isCalculated).length : 0,
    writeRestricted: fields.filter(f => f.canRead &&
      (f.isCalculated || !f.canCreate || !f.canUpdate)).length,
  }
})

function readRestriction(field: Column): string {
  return field.canRead ? '' : 'Dataverse no permite consultar este atributo mediante la API.'
}

function writeRestriction(table: Table, field: Column, operation: 'create' | 'update'): string {
  const action = operation === 'create' ? 'crear' : 'editar'
  if (field.logicalName.startsWith('_') && field.logicalName.endsWith('_value')) {
    const logicalName = field.logicalName.slice(1, -'_value'.length)
    const base = table.columns.find(f => f.logicalName === logicalName)
    return base
      ? `Este identificador es una proyección OData de solo lectura. Para ${action} utilizá la relación real del atributo ${logicalName} mediante @odata.bind, cuando Dataverse permita la operación.`
      : 'Proyección OData de solo lectura. La relación se establece mediante su propiedad de navegación (@odata.bind).'
  }
  if (field.isCalculated)
    return 'Este atributo es calculado o administrado por Dataverse. No se puede escribir directamente; se debe modificar su campo de origen.'
  if (!field[operation === 'create' ? 'canCreate' : 'canUpdate'])
    return `Dataverse no permite ${action} este atributo (IsValidFor${operation === 'create' ? 'Create' : 'Update'} = false).`
  return ''
}
function openBulkApproval(table: Table) {
  bulkTable.value = bulkTable.value === table.logicalName ? '' : table.logicalName
  bulkIncludeWrite.value = true
  bulkConfirmed.value = false
  expanded.value = table.logicalName
}
async function enableBulkFields(table: Table) {
  await run(async () => {
    if (!canSecurity.value || !entityEnabled(table.logicalName) || !snapshot.value ||
        bulkTable.value !== table.logicalName || !bulkConfirmed.value)
      throw new Error('Habilitá la tabla y confirmá los permisos antes de continuar.')
    if (bulkPreview.value.total === 0)
      throw new Error('Esta tabla no contiene campos que se puedan habilitar.')
    const response = await api<MetadataBulkFieldResult>(
      connectionPath('metadata/entities/' + encodeURIComponent(table.logicalName) + '/fields/bulk-enable'),
      'PUT', {
        snapshotVersion: snapshot.value.version,
        includeWrite: bulkIncludeWrite.value,
        confirm: true,
      })
    await reload()
    bulkTable.value = ''
    bulkConfirmed.value = false
    info.value = 'Se habilitaron ' + response.enabledFields + ' campos para ' + table.logicalName +
      ': ' + response.readFields + ' de lectura, ' + response.createFields +
      ' de creación y ' + response.updateFields + ' de edición aprobados en esta operación.'
  })
}

function openTable(table: Table) {
  const closing = expanded.value === table.logicalName
  expanded.value = closing ? '' : table.logicalName
  if (!closing && table.columns.length === 0 && canSecurity.value &&
      !['pending', 'running'].includes(tableJob(table.logicalName)?.status ?? ''))
    void refreshMetadata(table.logicalName)
}
async function pollMetadataJob() {
  if (monitoring.value || !code.value ||
      !Object.values(metadataJobs.value).some(j => j.status === 'pending' || j.status === 'running'))
    return
  monitoring.value = true
  try {
    const items = await api<MetadataJob[]>('operations/jobs?connectionCode=' +
      encodeURIComponent(code.value) + '&limit=100')
    let completed = false
    for (const [key, oldJob] of Object.entries(metadataJobs.value)) {
      if (oldJob.status !== 'pending' && oldJob.status !== 'running') continue
      const next = items.find(j => j.id === oldJob.id)
      if (!next) continue
      metadataJobs.value[key] = next
      if (next.status === 'completed') completed = true
      if (next.status === 'dead') error.value =
        'No se pudieron descubrir los campos de ' + (key || 'el catálogo') + ' (' +
        (next.lastErrorCode ?? 'error del proveedor') + '). Podés volver a intentar.'
    }
    if (completed) await run(async () => {
      await reload()
      info.value = 'Metadatos actualizados. Abrí la tabla para revisar y habilitar sus campos.'
    })
  } catch {
    // An intermittent status request must not create a duplicate metadata job.
  } finally { monitoring.value = false }
}
async function resumeMetadataJob() {
  if (!code.value || !canSecurity.value) return
  const items = await api<MetadataJob[]>('operations/jobs?connectionCode=' +
    encodeURIComponent(code.value) + '&limit=100')
  const byTable: Record<string, MetadataJob> = {}
  for (const job of items) {
    if (job.kind !== 'metadata_refresh') continue
    if (byTable[job.resourceKey] === undefined) byTable[job.resourceKey] = job
  }
  metadataJobs.value = byTable
}
async function toggleEntity(t: Table) {
  await run(async () => {
    await api(connectionPath('metadata/entities/' + encodeURIComponent(t.logicalName) + '/enabled'),
      'PUT', { enabled: !entityEnabled(t.logicalName) })
    await reload(); info.value = 'Permiso de tabla actualizado.'
  })
}
async function saveField(t: Table, f: Column) {
  await run(async () => {
    const draft = drafts.value[t.logicalName + '.' + f.logicalName]
    if (!draft) return
    await api(connectionPath('metadata/entities/' + encodeURIComponent(t.logicalName) +
      '/fields/' + encodeURIComponent(f.logicalName) + '/policy'), 'PUT', {
      enabled: draft.enabled,
      canRead: draft.enabled && draft.canRead && f.canRead,
      canCreate: draft.enabled && draft.canCreate && f.canCreate && !f.isCalculated,
      canUpdate: draft.enabled && draft.canUpdate && f.canUpdate && !f.isCalculated,
    })
    await reload(); info.value = 'Permisos del campo guardados.'
  })
}
async function saveSchedule() {
  await run(async () => {
    await api(connectionPath('metadata/schedule'), 'PUT', schedule.value)
    info.value = 'Programación guardada.'
  })
}
function addFilter() {
  const first = approvedFields.value[0]
  if (first && filters.value.length < 10) filters.value.push({ id: ++nextId.value, field: first.logicalName, op: 'eq', value: '' })
}
function kind(f: Column): 'string' | 'guid' | 'integer' | 'decimal' | 'boolean' | 'datetime' {
  if (['Uniqueidentifier', 'Lookup', 'Customer', 'Owner'].includes(f.type)) return 'guid'
  if (['Integer', 'BigInt', 'Picklist', 'State', 'Status'].includes(f.type)) return 'integer'
  if (['Money', 'Decimal', 'Double'].includes(f.type)) return 'decimal'
  if (f.type === 'Boolean') return 'boolean'
  if (f.type === 'DateTime') return 'datetime'
  return 'string'
}
function parseValue(f: Column, raw: string): unknown {
  if (kind(f) === 'boolean') {
    if (raw !== 'true' && raw !== 'false') throw new Error('Seleccioná verdadero o falso para ' + f.logicalName)
    return raw === 'true'
  }
  if (kind(f) === 'integer' || kind(f) === 'decimal') {
    if (!raw.trim() || !Number.isFinite(Number(raw)) ||
      (kind(f) === 'integer' && !Number.isInteger(Number(raw))))
      throw new Error('Número inválido para ' + f.logicalName)
    return Number(raw)
  }
  if (kind(f) === 'guid' && !validGuid(raw)) throw new Error('GUID inválido para ' + f.logicalName)
  if (kind(f) === 'datetime') {
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) throw new Error('Fecha inválida para ' + f.logicalName)
    return date.toISOString()
  }
  return raw
}
function filterInputType(fieldName: string): 'text' | 'number' | 'datetime-local' {
  const field = approvedFields.value.find(f => f.logicalName === fieldName)
  if (!field) return 'text'
  const type = kind(field)
  return type === 'datetime' ? 'datetime-local' : type === 'integer' || type === 'decimal' ? 'number' : 'text'
}
function filterOperators(fieldName: string) {
  const field = approvedFields.value.find(f => f.logicalName === fieldName)
  const type = field ? kind(field) : 'string'
  return type === 'string'
    ? [{ value: 'eq', label: 'Es igual a' }, { value: 'ne', label: 'Es diferente de' },
       { value: 'contains', label: 'Contiene' }]
    : type === 'boolean' || type === 'guid'
      ? [{ value: 'eq', label: 'Es igual a' }, { value: 'ne', label: 'Es diferente de' }]
      : [{ value: 'eq', label: 'Es igual a' }, { value: 'ne', label: 'Es diferente de' },
         { value: 'gt', label: 'Es mayor que' }, { value: 'ge', label: 'Es mayor o igual que' },
         { value: 'lt', label: 'Es menor que' }, { value: 'le', label: 'Es menor o igual que' }]
}
function filterFieldChanged(f: Filter) {
  f.op = 'eq'; f.value = ''
}
function validGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
function buildQuery(forSaving = false): Query {
  if (!columns.value.length || columns.value.length > 30) throw new Error('Seleccioná de 1 a 30 columnas.')
  if (!columns.value.every(name => approvedFields.value.some(f => f.logicalName === name)))
    throw new Error('Hay campos no autorizados en la selección.')
  // The API supports at most 10 children in the single AND/OR group created by this UI.
  if (filters.value.length > 10) throw new Error('Se permiten hasta 10 condiciones por consulta.')
  if (forSaving && saveAsParameter.value && !filters.value.length)
    throw new Error('Para usar un parámetro, añadí al menos una condición.')
  const predicates = filters.value.map((row, index) => {
    const field = approvedFields.value.find(f => f.logicalName === row.field)
    if (!field) throw new Error('El filtro tiene un campo no autorizado.')
    if (row.op === 'contains' && kind(field) !== 'string') throw new Error('Contains requiere texto.')
    if (forSaving && saveAsParameter.value && index === 0) {
      const parameter = paramName.value.trim().toLowerCase()
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(parameter))
        throw new Error('El parámetro debe empezar con una letra y contener solo minúsculas, números o _.')
      return { field: row.field, op: row.op, parameter }
    }
    return { field: row.field, op: row.op, value: parseValue(field, row.value) }
  })
  return {
    select: columns.value.slice(),
    ...(predicates.length ? { filter: predicates.length === 1 ? predicates[0] : { join: join.value, children: predicates } } : {}),
    ...(orderField.value ? { order: [{ field: orderField.value, desc: descending.value }] } : {}),
    pageSize: pageSize.value, count: count.value,
  }
}

async function searchRecords(cursor?: string) {
  await run(async () => {
    if (!activeTable.value) throw new Error('Seleccioná una tabla habilitada.')
    const query = cursor ? null : buildQuery()
    const data = await api<Page>('console/records/' + encodeURIComponent(entity.value) + '/search', 'POST',
      cursor ? { connectionCode: code.value, cursor } : { connectionCode: code.value, query })
    page.value = data
    if (query) lastQuery.value = query
    info.value = 'Página ' + data.page + ' · ' + data.items.length + ' registros recuperados.'
  })
}
async function loadSaved() {
  if (!code.value) return
  saved.value = await api<Saved[]>(connectionPath('saved-queries'))
}
function applySaved(item: Saved) {
  if (!enabledTables.value.some(t => t.logicalName === item.entityName)) {
    error.value = 'La consulta usa una tabla que no está habilitada.'; return
  }
  entity.value = item.entityName; changeEntity()
  columns.value = item.query.select.filter(name => approvedFields.value.some(f => f.logicalName === name))
  orderField.value = item.query.order?.[0]?.field ?? ''
  descending.value = item.query.order?.[0]?.desc ?? false
  pageSize.value = item.query.pageSize ?? 25; count.value = !!item.query.count
  const predicate = item.query.filter as { field?: string; op?: string; value?: unknown; parameter?: string;
    join?: 'and' | 'or'; children?: Array<{ field: string; op: string; value?: unknown; parameter?: string }> } | undefined
  join.value = predicate?.join ?? 'and'
  const clauses = predicate?.children ?? (predicate?.field ? [predicate as { field: string; op: string; value?: unknown; parameter?: string }] : [])
  filters.value = clauses.map(f => ({ id: ++nextId.value, field: f.field, op: f.op,
    value: f.value === undefined ? '' : String(f.value) }))
  saveAsParameter.value = item.parameters.length > 0
  paramName.value = item.parameters[0]?.name ?? 'valor'
  queryNameVisible.value = true
  savedName.value = item.name
  queryStep.value = 3
  info.value = 'Consulta cargada. Ingresá los parámetros o filtros antes de ejecutar.'
  error.value = ''
}
async function saveQuery() {
  await run(async () => {
    // Saving must not require typing a name or a literal sample for a parameterized filter.
    const name = savedName.value.trim().toLowerCase() || suggestedSavedName.value
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(name))
      throw new Error('Nombre inválido: usá solo letras minúsculas, números y _.')
    const query = buildQuery(true)
    const first = filters.value[0]
    const field = approvedFields.value.find(f => f.logicalName === first?.field)
    const parameters = saveAsParameter.value && field
      ? [{ name: paramName.value.trim().toLowerCase(), type: kind(field), required: true }]
      : []
    const updating = saved.value.some(item => item.name === name)
    await api(connectionPath('saved-queries'), 'POST', {
      name, entityName: entity.value, query, parameters, enabled: false,
    })
    savedName.value = name
    if (parameters[0]) paramName.value = parameters[0].name
    await loadSaved()
    info.value = updating
      ? 'Consulta actualizada y deshabilitada por seguridad. Activala de nuevo para la API.'
      : 'Consulta guardada correctamente. Está deshabilitada hasta que decidás habilitarla para la API.'
  })
}

async function toggleSaved(item: Saved) {
  await run(async () => {
    if (!canSecurity.value) throw new Error('Se requiere Dynamics Seguridad.')
    await api(connectionPath('saved-queries/' + encodeURIComponent(item.name) + '/enabled'), 'PUT',
      { enabled: !item.enabled })
    await loadSaved(); info.value = 'Estado de la consulta actualizado.'
  })
}
function lookupRelations(f: Column) {
  return activeTable.value?.relationships.filter(r => r.kind === 'ManyToOneRelationships' &&
    r.referencingAttribute === f.logicalName && !!r.referencingNavigation) ?? []
}
function valuesToWrite(): Record<string, unknown> {
  if (!writeFields.value.length) throw new Error('Seleccioná los campos a escribir.')
  const body: Record<string, unknown> = {}
  for (const name of writeFields.value) {
    const f = writableFields.value.find(x => x.logicalName === name)
    if (!f) throw new Error('El campo ' + name + ' ya no tiene permiso.')
    const raw = writeValues.value[name] ?? ''
    if (['Lookup', 'Customer', 'Owner'].includes(f.type)) {
      const relation = lookupRelations(f).find(r => r.referencingNavigation === navByField.value[name])
      if (!relation?.referencingNavigation || !validGuid(raw)) throw new Error('Elegí una relación y un GUID válido para ' + name)
      body[relation.referencingNavigation + '@odata.bind'] = raw
    } else if (f.type === 'MultiSelectPicklist') {
      const choices = raw.split(',').map(x => Number(x.trim()))
      if (!raw.trim() || choices.some(x => !Number.isInteger(x))) throw new Error('Opciones inválidas para ' + name)
      body[name] = choices
    } else if (!raw.trim() && f.type !== 'Boolean') body[name] = null
    else body[name] = parseValue(f, raw)
  }
  return body
}
async function loadRecord() {
  await run(async () => {
    if (!validGuid(recordId.value) || !activeTable.value) throw new Error('GUID de registro inválido.')
    const permitted = approvedFields.value.slice(0, 30)
    if (!permitted.length) throw new Error('No hay campos legibles autorizados.')
    const response = await api<Detail>('console/records/' + encodeURIComponent(entity.value) + '/' +
      encodeURIComponent(recordId.value) + '?connectionCode=' + encodeURIComponent(code.value) +
      '&select=' + encodeURIComponent(permitted.map(f => f.logicalName).join(',')))
    etag.value = response.eTag ?? ''
    loadedRecordId.value = etag.value ? recordId.value : ''
    for (const f of writableFields.value) {
      const value = response.item[f.logicalName]
      if (value != null && !['Lookup', 'Customer', 'Owner'].includes(f.type))
        writeValues.value[f.logicalName] = String(value)
    }
    info.value = etag.value ? 'Registro encontrado. El control de versiones ETag está listo.' : 'Dataverse no devolvió ETag; no se permite modificarlo.'
    if (etag.value) crudStep.value = 3
  })
}
async function submitWrite() {
  if (lockedWrite.value || busy.value) return
  await run(async () => {
    if (!canWrite.value) throw new Error('La escritura está bloqueada en este entorno o falta permiso.')
    if (!activeTable.value) throw new Error('Seleccioná una tabla.')
    if (crudMode.value === 'delete' && !canDelete.value) throw new Error('Los borrados están bloqueados en este entorno.')
    const target = 'console/records/' + encodeURIComponent(entity.value)
    let path = target
    let method: 'POST' | 'PATCH' | 'DELETE' = 'POST'
    let body: unknown = { connectionCode: code.value, values: valuesToWrite() }
    if (crudMode.value !== 'create') {
      if (!validGuid(recordId.value) || !etag.value || recordId.value !== loadedRecordId.value) throw new Error('Cargá el registro para obtener el ETag antes de escribir.')
      path += '/' + encodeURIComponent(recordId.value)
      if (crudMode.value === 'update') method = 'PATCH'
      else {
        if (!confirmed.value || deletePhrase.value !== 'ELIMINAR' || deleteReason.value.trim().length < 10)
          throw new Error('Confirmá ELIMINAR e ingresá un motivo de al menos 10 caracteres.')
        method = 'DELETE'
        body = { connectionCode: code.value, confirm: true, reason: deleteReason.value.trim() }
      }
    }
    const key = 'dhole-ui-' + crypto.randomUUID().replaceAll('-', '')
    try {
      writeResult.value = await api<WriteResult>(path, method, body, {
        'Idempotency-Key': key,
        ...(method === 'POST' ? {} : { 'If-Match': etag.value }),
      })
    } catch (reason) {
      if (reason instanceof ApiError && reason.data && typeof reason.data === 'object') {
        const data = reason.data as Partial<WriteResult>
        if (typeof data.operationId === 'string' && typeof data.state === 'string') {
          writeResult.value = data as WriteResult
          if (data.state === 'ambiguous' || data.state === 'rejected') {
            lockedWrite.value = true
            info.value = 'Operación ' + data.operationId + ' · ' + data.state + '. Revisá auditoría antes de intentar otra escritura.'
            return
          }
        }
      }
      // Unknown transport outcome: never issue a new idempotency key automatically.
      lockedWrite.value = true
      throw reason
    }
    lockedWrite.value = true
    info.value = 'Operación ' + writeResult.value.operationId + ': ' + writeResult.value.state +
      '. Para otra acción reiniciá el formulario.'
  })
}
function newWrite() { resetRecord(); error.value = ''; info.value = '' }
async function readDeletePolicy() {
  deletePolicy.value = null
  if (!canSecurity.value || !entity.value || !code.value || !entityEnabled(entity.value)) return
  try {
    deletePolicy.value = await api<DeletePolicy>(
      connectionPath('delete-policies/' + encodeURIComponent(entity.value)))
  } catch { /* an unapproved entity has no deletion policy */ }
}
async function saveDeletePolicy() {
  await run(async () => {
    if (!canSecurity.value || !deletePolicy.value) throw new Error('Permiso de seguridad requerido.')
    await api(connectionPath('delete-policies/' + encodeURIComponent(entity.value)), 'PUT', {
      enabled: deletePolicy.value.enabled, minAgeDays: deletePolicy.value.minAgeDays,
    })
    await readDeletePolicy(); info.value = 'Política de borrado auditada y guardada.'
  })
}
async function loadGrants() {
  const [c, g] = await Promise.all([
    api<ApiClient[]>('clients'),
    api<ApiGrant[]>('grants'),
  ])
  clients.value = c; grants.value = g
  if (!clients.value.some(c => c.id === grantClient.value))
    grantClient.value = clients.value.find(c => c.enabled)?.id ?? ''
}
function editGrant(grant: ApiGrant) {
  const target = enabledTables.value.find(t => t.logicalName === grant.entitySet)
  if (!target) { error.value = 'La tabla de este grant no está habilitada.'; return }
  const operation = grant.operation as typeof grantOperation.value
  if (!['read','create','update','delete','upsert'].includes(operation)) {
    error.value = 'Esta operación debe editarse desde el administrador de API.'; return
  }
  entity.value = target.logicalName; changeEntity()
  grantClient.value = grant.apiClientId
  grantOperation.value = operation
  grantFields.value = grant.allowedFields.slice()
  grantQuota.value = grant.maxRequestsPerMinute
  grantEnabled.value = grant.enabled
}
async function registerClient() {
  await run(async () => {
    const x = clientForm.value
    if (!/^https:\/\//i.test(x.issuer) || !x.clientId.trim() || !x.displayName.trim())
      throw new Error('Indicá issuer HTTPS, ID del cliente OAuth y nombre.')
    await api('clients', 'POST', {
      issuer: x.issuer.trim(), clientId: x.clientId.trim(),
      displayName: x.displayName.trim(), enabled: x.enabled,
    })
    await loadGrants()
    clientForm.value = { issuer: '', clientId: '', displayName: '', enabled: false }
    info.value = 'Aplicación M2M registrada. Configurá sus grants antes de habilitar el acceso.'
  })
}
function editClient(client: ApiClient) {
  clientForm.value = {
    issuer: client.issuer, clientId: client.clientId,
    displayName: client.displayName, enabled: client.enabled,
  }
}
async function saveGrant() {
  await run(async () => {
    if (!canSecurity.value || !validGuid(grantClient.value) || !entity.value)
      throw new Error('Seleccioná una aplicación M2M y una entidad aprobada.')
    if (grantFields.value.length < 1 || grantFields.value.some(f => !grantAllowedFields.value.includes(f)))
      throw new Error('Seleccioná únicamente campos permitidos para la operación.')
    if (!Number.isInteger(grantQuota.value) || grantQuota.value < 1 || grantQuota.value > 600)
      throw new Error('La cuota permitida es de 1 a 600 solicitudes por minuto.')
    await api('grants','POST', {
      clientId: grantClient.value, connectionCode: code.value, entitySet: entity.value,
      operation: grantOperation.value, allowedFields: grantFields.value,
      maxRequestsPerMinute: grantQuota.value, enabled: grantEnabled.value,
    })
    await loadGrants(); info.value = 'Grant M2M guardado con auditoría.'
  })
}
watch(() => props.connections, list => {
  if (!list.some(c => c.code === code.value))
    code.value = list.find(c => c.code.toLowerCase() === 'principal')?.code ?? list[0]?.code ?? ''
}, { immediate: true, deep: true })
watch(code, () => {
  metadataJobs.value = {}
  issuedIntegrationKey.value = null
  integrationKeys.value = []
  editingKeyId.value = ''
  newKeyQueries.value = []
  if (code.value) void run(reload)
}, { immediate: true })
watch(() => props.section, section => {
  if (!code.value || busy.value) return
  if (section === 'query' || section === 'integrations') void run(async () => {
    await loadSaved()
    if (section === 'integrations' && canSecurity.value) {
      await loadGrants()
      await loadIntegrationKeys()
    }
  })
  if (section === 'security' && canSecurity.value) void run(async () => { await loadGrants(); await readDeletePolicy() })
  if (section === 'catalog' && canSecurity.value) void resumeMetadataJob()
})
onMounted(() => {
  monitorInterval = setInterval(() => { void pollMetadataJob() }, 4000)
})
onBeforeUnmount(() => { if (monitorInterval) clearInterval(monitorInterval) })
</script>

<template>
  <section class="dynamics-panel dynamics-data-panel">
    <div class="dynamics-panel-header">
      <div>
        <p class="dynamics-section-label">DYNAMICS 365 · DATAVERSE</p>
        <h2>{{ { catalog: 'Catálogo de Dataverse', query: 'Query Builder', crud: 'Editor de registros', security: 'Seguridad y políticas', integrations: 'Publicar API e integraciones' }[section] }}</h2>
        <p class="dynamics-subtitle">Los cambios quedan sujetos a metadatos, permisos y auditoría del conector.</p>
      </div>
      <button class="dynamics-outline-button" type="button" :disabled="busy || !code" @click="run(reload)">
        <RefreshCw :size="15" :class="{ 'animate-spin': busy }" /> Recargar
      </button>
    </div>
    <label class="dynamics-field dynamics-connection-select">
      <span>Conexión de Dataverse</span>
      <select v-model="code" :disabled="busy">
        <option value="">Seleccionar conexión</option>
        <option v-for="item in connections" :key="item.code" :value="item.code">{{ item.code }}</option>
      </select>
    </label>
    <p v-if="error" class="dynamics-feedback dynamics-feedback-error" role="alert">{{ error }}</p>
    <p v-if="info" class="dynamics-feedback dynamics-feedback-success" role="status">{{ info }}</p>
    <p v-if="busy" class="dynamics-subtitle" role="status">Procesando solicitud...</p>
    <div v-if="!code" class="dynamics-empty">Seleccioná una conexión para continuar.</div>
    <template v-else-if="section === 'catalog'">
      <div class="dynamics-tools">
        <button type="button" class="dynamics-primary-button"  :disabled="busy || ['pending','running'].includes(tableJob('')?.status ?? '') || !canSecurity" @click="refreshMetadata()"><RefreshCw :size="15" /> {{ ['pending','running'].includes(tableJob('')?.status ?? '') ? 'Actualizando índice' : 'Actualizar catálogo' }}</button>
        <span class="dynamics-subtitle">Snapshot {{ snapshot?.version ?? 'sin generar' }} · {{ snapshot?.capturedAt ? new Date(snapshot.capturedAt).toLocaleString('es-CR') : 'Pendiente de descubrimiento' }}</span>
      </div>
      <p v-if="metadataJob" class="dynamics-feedback" role="status">
        <RefreshCw :size="15" /> {{ metadataJob.resourceKey ? 'Tabla: ' + metadataJob.resourceKey : 'Índice de tablas' }} · {{ metadataJob.status === 'pending' ? 'En cola' : 'Consultando Dataverse' }} · intento {{ metadataJob.attempts }}/{{ metadataJob.maxAttempts }}. {{ metadataJob.lastErrorCode ? 'Último error: ' + metadataJob.lastErrorCode + '.' : '' }} Podés utilizar el resto del sistema.
      </p>
      <div class="dynamics-tools">
        <label class="dynamics-field"><span>Actualización automática (60–10080 minutos)</span><input v-model.number="schedule.intervalMinutes" type="number" min="60" max="10080"></label>
        <label class="dynamics-check"><input v-model="schedule.enabled" type="checkbox"> Programada</label>
        <button class="dynamics-outline-button" type="button" :disabled="busy" @click="saveSchedule">Guardar programación</button>
      </div>
      <details v-if="diff" class="dynamics-disclosure">
        <summary>Comparación de versiones (cambios de tablas y columnas)</summary>
        <pre class="dynamics-json">{{ JSON.stringify(diff, null, 2) }}</pre>
      </details>
      <div v-if="!snapshot" class="dynamics-empty"><Database :size="26" />Todavía no hay metadatos. Ejecutá «Actualizar catálogo».</div>
      <template v-else>
        <label class="dynamics-field"><span>Buscar tabla (se muestran hasta 200 resultados)</span><input v-model="tableSearch" placeholder="Ej.: quote, account, contact..."></label>
        <p class="dynamics-subtitle">Las tablas descubiertas permanecen deshabilitadas hasta aprobarlas. {{ tables.length }} tablas disponibles.</p>
        <article v-for="table in matchedTables" :key="table.logicalName" class="dynamics-data-card">
          <div class="dynamics-data-card-top">
            <div><strong>{{ label(table.labels) || table.logicalName }}</strong>
              <p class="dynamics-subtitle">{{ table.logicalName }} · {{ table.entitySetName }} · {{ table.columns.length ? table.columns.length + ' columnas · ' + table.relationships.length + ' relaciones' : 'Pendiente de descubrir campos' }}</p>
            </div>
            <div class="dynamics-actions">
              <button v-if="!table.columns.length" class="dynamics-outline-button" type="button"
                :disabled="busy || !canSecurity || ['pending','running'].includes(tableJob(table.logicalName)?.status ?? '')"
                @click="refreshMetadata(table.logicalName)">Descubrir campos</button>
              <button class="dynamics-outline-button" type="button" :disabled="busy || !table.columns.length" @click="toggleEntity(table)">{{ entityEnabled(table.logicalName) ? 'Deshabilitar' : 'Habilitar' }}</button>
              <button v-if="entityEnabled(table.logicalName) && table.columns.length"
                class="dynamics-outline-button" type="button" :disabled="busy || !canSecurity"
                @click="openBulkApproval(table)">Habilitar todos</button>
              <button class="dynamics-outline-button" type="button" @click="openTable(table)">{{ expanded===table.logicalName ? 'Cerrar' : 'Campos' }}</button>
            </div>
          </div>
          <p v-if="tableJob(table.logicalName)?.status === 'pending' || tableJob(table.logicalName)?.status === 'running'"
            class="dynamics-subtitle" role="status">
            Descubriendo campos de {{ table.logicalName }} · intento {{ tableJob(table.logicalName)?.attempts }}/{{ tableJob(table.logicalName)?.maxAttempts }}. No necesitás esperar en esta pantalla.
          </p>
          <p v-else-if="tableJob(table.logicalName)?.status === 'dead' && !table.columns.length"
            class="dynamics-feedback dynamics-feedback-error" role="alert">
            No se pudieron obtener los campos ({{ tableJob(table.logicalName)?.lastErrorCode ?? 'error del proveedor' }}).
            <button type="button" class="dynamics-outline-button" :disabled="busy" @click="refreshMetadata(table.logicalName)">Reintentar</button>
          </p>
          <div v-if="bulkTable === table.logicalName" class="dynamics-bulk-panel">
            <div class="dynamics-data-card-top">
              <div><strong>Habilitar campos de {{ label(table.labels) || table.logicalName }}</strong>
                <p class="dynamics-subtitle">Aplicá permisos a los campos descubiertos en una sola operación. No es necesario guardarlos uno por uno.</p>
              </div>
              <button type="button" class="dynamics-outline-button" @click="bulkTable=''; bulkConfirmed=false">Cancelar</button>
            </div>
            <div class="dynamics-bulk-options">
              <label class="dynamics-bulk-option" :class="{ selected: !bulkIncludeWrite }">
                <input v-model="bulkIncludeWrite" type="radio" :value="false" @change="bulkConfirmed=false">
                <span><strong>Solo lectura · Query Builder y SELECT</strong>
                  <small>Habilita para lectura todos los campos que Dataverse permite consultar. Conserva los permisos de escritura que ya estuvieran aprobados.</small></span>
              </label>
              <label class="dynamics-bulk-option" :class="{ selected: bulkIncludeWrite }">
                <input v-model="bulkIncludeWrite" type="radio" :value="true" @change="bulkConfirmed=false">
                <span><strong>Lectura, creación y edición · Todos los campos permitidos</strong>
                  <small>Habilita SELECT, CREATE y UPDATE únicamente donde Dataverse lo permita. Los campos calculados y las proyecciones de relaciones siguen siendo de solo lectura. No modifica registros.</small></span>
              </label>
            </div>
            <div class="dynamics-bulk-counts">
              <span><strong>{{ bulkPreview.total }}</strong> campos a habilitar</span>
              <span>{{ bulkPreview.read }} legibles</span>
              <span>{{ bulkPreview.create }} para crear</span>
              <span>{{ bulkPreview.update }} para editar</span>
              <span>{{ bulkPreview.writeRestricted }} con alguna restricción de escritura</span>
            </div>
            <p class="dynamics-subtitle">No es posible forzar escritura en campos del sistema, calculados o proyecciones de relaciones. En esos casos, utilizá el campo de origen o una propiedad de navegación (@odata.bind) admitida por Dataverse.</p>
            <p class="dynamics-subtitle">Estos permisos son exclusivos de la conexión {{ code }} y la tabla {{ table.logicalName }}. Las aplicaciones externas siguen necesitando un grant específico; los cambios reales en producción continúan sujetos a sus aprobaciones.</p>
            <label class="dynamics-check">
              <input v-model="bulkConfirmed" type="checkbox">
              Confirmo que quiero habilitar los permisos indicados para todos los campos elegibles de esta tabla.
            </label>
            <div class="dynamics-tools">
              <button type="button" class="dynamics-primary-button"
                :disabled="busy || !bulkConfirmed || !bulkPreview.total" @click="enableBulkFields(table)">
                Habilitar {{ bulkPreview.total }} campos
              </button>
              <span class="dynamics-subtitle">Versión de metadatos {{ snapshot?.version }} · con auditoría</span>
            </div>
          </div>
          <div v-if="expanded === table.logicalName" class="dynamics-scroll">
            <p v-if="!table.columns.length" class="dynamics-subtitle">
              {{ ['pending','running'].includes(tableJob(table.logicalName)?.status ?? '') ?
                'Consultando campos reales de Dataverse. Se mostrarán aquí al finalizar.' :
                'Esta tabla no tiene columnas descubiertas. Abrí Campos para solicitarlas automáticamente.' }}
            </p>
            <p v-else-if="!entityEnabled(table.logicalName)" class="dynamics-subtitle">Habilitá primero la tabla para administrar sus columnas.</p>
            <table class="dynamics-data-table">
              <thead><tr><th>Campo</th><th>Tipo</th><th>Habilitado</th><th>Leer</th><th>Crear</th><th>Editar</th><th></th></tr></thead>
              <tbody>
                <tr v-for="field in table.columns" :key="field.logicalName">
                  <td>
                    <strong>{{ label(field.labels) || field.logicalName }}</strong><small>{{ field.logicalName }}</small>
                    <small v-if="writeRestriction(table, field, 'create') || writeRestriction(table, field, 'update')"
                      class="dynamics-field-restriction"
                      :title="writeRestriction(table, field, 'create') || writeRestriction(table, field, 'update')">
                      {{ field.logicalName.startsWith('_') && field.logicalName.endsWith('_value')
                        ? 'Referencia: escribir mediante relación'
                        : field.isCalculated ? 'Calculado: solo lectura' : 'Escritura restringida (ver motivo)' }}
                    </small>
                  </td>
                  <td>{{ field.type }}
                    <small v-if="field.logicalName.startsWith('_') && field.logicalName.endsWith('_value')">Referencia de solo lectura</small>
                    <small v-else-if="field.isCalculated">Calculado o del sistema</small>
                    <small v-else-if="!field.canCreate || !field.canUpdate">Escritura limitada por Dataverse</small>
                  </td>
                  <template v-if="drafts[table.logicalName + '.' + field.logicalName]">
                    <td><input v-model="drafts[table.logicalName + '.' + field.logicalName]!.enabled" type="checkbox" :disabled="busy || !entityEnabled(table.logicalName)"></td>
                    <td><input v-model="drafts[table.logicalName + '.' + field.logicalName]!.canRead"
                      type="checkbox" :title="readRestriction(field) || 'Lectura permitida por Dataverse'"
                      :disabled="busy || !entityEnabled(table.logicalName) || !field.canRead"></td>
                    <td><input v-model="drafts[table.logicalName + '.' + field.logicalName]!.canCreate"
                      type="checkbox" :title="writeRestriction(table, field, 'create') || 'Creación permitida por Dataverse'"
                      :disabled="busy || !entityEnabled(table.logicalName) || !field.canCreate || field.isCalculated"></td>
                    <td><input v-model="drafts[table.logicalName + '.' + field.logicalName]!.canUpdate"
                      type="checkbox" :title="writeRestriction(table, field, 'update') || 'Edición permitida por Dataverse'"
                      :disabled="busy || !entityEnabled(table.logicalName) || !field.canUpdate || field.isCalculated"></td>
                  </template>
                  <td><button class="dynamics-outline-button" type="button" :disabled="busy || !entityEnabled(table.logicalName)" @click="saveField(table, field)">Guardar</button></td>
                </tr>
              </tbody>
            </table>
            <details class="dynamics-disclosure"><summary>Relaciones de {{ table.logicalName }}</summary>
              <ul><li v-for="relation in table.relationships" :key="relation.schemaName">{{ relation.kind }} · {{ relation.schemaName }} · {{ relation.referencedEntity }}</li></ul>
            </details>
          </div>
        </article>
      </template>
    </template>
    <template v-else-if="section === 'query'">
      <div v-if="!canSecurity" class="dynamics-feedback dynamics-feedback-error"><ShieldCheck :size="17" /> Para crear consultas necesitás el permiso dynamics.security.admin.</div>
      <template v-else>
        <nav class="dynamics-wizard-steps" aria-label="Pasos para crear la consulta">
          <button v-for="(name, index) in querySteps" :key="name" type="button"
            class="dynamics-wizard-step" :class="{ active: queryStep === index + 1, done: queryStep > index + 1 }"
            :disabled="index + 1 > queryStep" :aria-current="queryStep === index + 1 ? 'step' : undefined"
            @click="queryStep = (index + 1) as 1 | 2 | 3 | 4">
            <span class="dynamics-step-index">{{ index + 1 }}</span><span>{{ name }}</span>
          </button>
        </nav>
        <div v-if="queryStep === 1" class="dynamics-wizard-pane">
          <p class="dynamics-wizard-kicker">PASO 1 · ORIGEN DE DATOS</p>
          <h3>¿Qué información querés consultar?</h3>
          <p class="dynamics-subtitle">Elegí la tabla de Microsoft Dynamics. Solo aparecen tablas habilitadas por Seguridad.</p>
          <div v-if="!enabledTables.length" class="dynamics-empty-state">
            <Database :size="24" /><strong>No hay tablas habilitadas</strong>
            <p>Primero descubrí una tabla y aprobá sus campos de lectura en el Catálogo.</p>
            <button type="button" class="dynamics-outline-button" @click="emit('navigate', 'catalog')">Ir al catálogo</button>
          </div>
          <div v-else class="dynamics-form-grid">
            <label class="dynamics-field"><span>Tabla de Dataverse</span>
              <select v-model="entity" @change="changeEntity">
                <option v-for="t in enabledTables" :key="t.logicalName" :value="t.logicalName">{{ label(t.labels) || t.logicalName }} ({{ t.logicalName }})</option>
              </select>
            </label>
            <div class="dynamics-explainer">
              <strong>{{ label(activeTable?.labels) || activeTable?.logicalName || 'Seleccioná una tabla' }}</strong>
              <p>{{ approvedFields.length }} columnas aprobadas para lectura · conexión {{ code }}</p>
              <button v-if="!approvedFields.length" type="button" class="dynamics-outline-button" @click="emit('navigate', 'catalog')">Autorizar campos en Catálogo</button>
            </div>
          </div>
        </div>
        <div v-else-if="queryStep === 2" class="dynamics-wizard-pane">
          <p class="dynamics-wizard-kicker">PASO 2 · COLUMNAS</p>
          <h3>¿Qué datos querés ver?</h3>
          <p class="dynamics-subtitle">Marcá las columnas que aparecerán en el resultado (máximo 30). No necesitás saber sus nombres técnicos.</p>
          <div class="dynamics-tools">
            <label class="dynamics-field dynamics-search-field"><span>Buscar campos por nombre</span>
              <input v-model="queryFieldSearch" placeholder="Ej.: cliente, número, fecha…">
            </label>
            <button type="button" class="dynamics-outline-button" @click="chooseSuggestedFields">5 primeros</button>
            <button type="button" class="dynamics-outline-button" @click="chooseAllReadFields">Todos (máx. 30)</button>
            <button type="button" class="dynamics-outline-button" @click="columns = []">Limpiar selección</button>
          </div>
          <p class="dynamics-selection-count">{{ columns.length }} de 30 columnas seleccionadas</p>
          <div v-if="!approvedFields.length" class="dynamics-empty-state">
            <strong>Esta tabla todavía no tiene columnas aprobadas</strong>
            <p>Autorizá al menos un campo con permiso de lectura.</p>
            <button type="button" class="dynamics-outline-button" @click="emit('navigate', 'catalog')">Configurar permisos</button>
          </div>
          <div v-else class="dynamics-choice-list">
            <label v-for="f in visibleQueryFields" :key="f.logicalName" class="dynamics-choice-row">
              <input v-model="columns" type="checkbox" :value="f.logicalName"
                :disabled="!columns.includes(f.logicalName) && columns.length >= 30">
              <span><strong>{{ label(f.labels) || f.logicalName }}</strong>
                <small>{{ f.logicalName }} · {{ f.type }}</small></span>
            </label>
            <p v-if="!visibleQueryFields.length" class="dynamics-subtitle">Ningún campo coincide con la búsqueda.</p>
          </div>
        </div>
        <div v-else-if="queryStep === 3" class="dynamics-wizard-pane">
          <p class="dynamics-wizard-kicker">PASO 3 · CONDICIONES</p>
          <h3>Filtrá y ordená los resultados</h3>
          <p class="dynamics-subtitle">Los filtros son opcionales. Si no agregás ninguno, verás los primeros registros autorizados.</p>
          <div class="dynamics-data-card">
            <div class="dynamics-data-card-top">
              <strong>Mostrar registros que cumplan…</strong>
              <div class="dynamics-actions">
                <select v-model="join" aria-label="Combinar condiciones">
                  <option value="and">Todas las condiciones (Y)</option>
                  <option value="or">Alguna condición (O)</option>
                </select>
                <button type="button" class="dynamics-outline-button" :disabled="filters.length >= 10 || !approvedFields.length" @click="addFilter">+ Añadir condición</button>
              </div>
            </div>
            <div v-for="(filter, i) in filters" :key="filter.id" class="dynamics-friendly-filter">
              <label class="dynamics-field"><span>Campo {{ i + 1 }}</span>
                <select v-model="filter.field" @change="filterFieldChanged(filter)">
                  <option v-for="col in approvedFields" :key="col.logicalName" :value="col.logicalName">{{ label(col.labels) || col.logicalName }}</option>
                </select>
              </label>
              <label class="dynamics-field"><span>Comparación</span>
                <select v-model="filter.op">
                  <option v-for="operator in filterOperators(filter.field)" :key="operator.value" :value="operator.value">{{ operator.label }}</option>
                </select>
              </label>
              <label class="dynamics-field"><span>Valor</span>
                <select v-if="approvedFields.find(f => f.logicalName === filter.field)?.type === 'Boolean'" v-model="filter.value">
                  <option value="">Seleccionar</option><option value="true">Sí</option><option value="false">No</option>
                </select>
                <select v-else-if="approvedFields.find(f => f.logicalName === filter.field)?.choices.length" v-model="filter.value">
                  <option value="">Seleccionar</option>
                  <option v-for="choice in approvedFields.find(f => f.logicalName === filter.field)?.choices ?? []"
                    :key="choice.value" :value="String(choice.value)">{{ label(choice.labels) || choice.value }}</option>
                </select>
                <input v-else v-model="filter.value" :type="filterInputType(filter.field)"
                  :step="filterInputType(filter.field) === 'number' ? 'any' : undefined" placeholder="Escribí un valor">
              </label>
              <button type="button" class="dynamics-outline-button" @click="filters.splice(i, 1)">Quitar</button>
            </div>
            <p v-if="!filters.length" class="dynamics-subtitle">No hay condiciones; se usarán las columnas aprobadas seleccionadas.</p>
            <label v-if="filters.length" class="dynamics-check">
              <input v-model="saveAsParameter" type="checkbox">
              Usar el primer filtro como parámetro al guardar (no necesita un valor de prueba).
            </label>
          </div>
          <div class="dynamics-form-grid">
            <label class="dynamics-field"><span>Ordenar por (opcional)</span>
              <select v-model="orderField"><option value="">Orden predeterminado</option>
                <option v-for="f in approvedFields" :key="f.logicalName" :value="f.logicalName">{{ label(f.labels) || f.logicalName }}</option>
              </select>
            </label>
            <label class="dynamics-field"><span>Registros por página</span><input v-model.number="pageSize" type="number" min="1" max="100"></label>
          </div>
          <div class="dynamics-tools">
            <label class="dynamics-check"><input v-model="descending" type="checkbox" :disabled="!orderField"> Orden descendente</label>
            <label class="dynamics-check"><input v-model="count" type="checkbox"> Incluir total (puede tardar más)</label>
          </div>
        </div>
        <div v-else class="dynamics-wizard-pane">
          <p class="dynamics-wizard-kicker">PASO 4 · REVISIÓN</p>
          <h3>Tu consulta está lista para revisar</h3>
          <div class="dynamics-review-grid">
            <div v-for="item in querySummary" :key="item" class="dynamics-review-item">{{ item }}</div>
          </div>
          <div v-if="!queryPreview.valid && !savedQueryPreview.valid" class="dynamics-feedback dynamics-feedback-error" role="alert">{{ savedQueryPreview.error }}</div>
          <p v-else-if="!queryPreview.valid" class="dynamics-subtitle" role="status">
            Podés guardar esta consulta parametrizada sin valor de prueba. Para ejecutarla ahora, ingresá un valor en el primer filtro.
          </p>
          <details class="dynamics-disclosure">
            <summary>Ver consulta técnica (JSON)</summary>
            <pre class="dynamics-json">{{ JSON.stringify(queryPreview.valid ? queryPreview.data : savedQueryPreview.data, null, 2) }}</pre>
          </details>
          <div class="dynamics-data-card">
            <div class="dynamics-data-card-top"><div>
              <strong>Guardar para usar nuevamente o desde una API</strong>
              <p class="dynamics-subtitle">La consulta se guarda inactiva hasta que decidás habilitarla.</p>
            </div></div>
            <div class="dynamics-form-grid">
              <label class="dynamics-field"><span>Nombre de la consulta</span>
                <input v-model.trim="savedName" :placeholder="'Ejemplo: ' + suggestedSavedName" maxlength="40" autocomplete="off">
                <small class="dynamics-subtitle">Si lo dejás vacío, se guardará como <strong>{{ suggestedSavedName }}</strong>. Solo letras, números y _; se convertirá a minúsculas.</small>
              </label>
              <div class="dynamics-explainer">
                <label class="dynamics-check"><input v-model="saveAsParameter" type="checkbox"> Hacer variable el primer filtro</label>
                <p class="dynamics-subtitle">Útil si Pangolin u otra aplicación enviará un valor diferente en cada ejecución.</p>
              </div>
              <label v-if="saveAsParameter && filters.length" class="dynamics-field"><span>Nombre del parámetro</span>
                <input v-model.trim="paramName" placeholder="idtra" maxlength="40">
                <small class="dynamics-subtitle">Ejemplo: IDTRA se guardará como idtra para coincidir con la API.</small>
              </label>
            </div>
            <button type="button" class="dynamics-outline-button" :disabled="busy" @click="saveQuery">{{ busy ? 'Guardando…' : 'Guardar consulta' }}</button>
          </div>
          <div v-if="saved.length" class="dynamics-data-card">
            <strong>Mis consultas guardadas</strong>
            <div v-for="item in saved" :key="item.id" class="dynamics-saved-row">
              <div><strong>{{ item.name }}</strong><p class="dynamics-subtitle">{{ item.entityName }} · {{ item.enabled ? 'Habilitada para clientes con permiso' : 'Deshabilitada' }}</p></div>
              <div class="dynamics-actions"><button class="dynamics-outline-button" type="button" @click="applySaved(item)">Editar consulta</button>
                <button class="dynamics-outline-button" type="button" :disabled="busy" @click="toggleSaved(item)">{{ item.enabled ? 'Desactivar' : 'Activar' }}</button>
                <button v-if="item.enabled" type="button" class="dynamics-outline-button" @click="emit('navigate', 'integrations')">Ver URL API</button>
              </div>
            </div>
          </div>
        </div>
        <div class="dynamics-wizard-footer">
          <button v-if="queryStep > 1" type="button" class="dynamics-outline-button" @click="queryStep = (queryStep - 1) as 1 | 2 | 3 | 4">Anterior</button>
          <div class="dynamics-wizard-footer-right">
            <span class="dynamics-subtitle">Paso {{ queryStep }} de 4</span>
            <button v-if="queryStep < 4" type="button" class="dynamics-primary-button"
              :disabled="busy || (queryStep === 1 && !enabledTables.length)"
              @click="nextQueryStep">Siguiente</button>
            <button v-else type="button" class="dynamics-primary-button" :disabled="busy || !queryPreview.valid"
              @click="searchRecords()"><Search :size="15" /> Ejecutar consulta</button>
          </div>
        </div>
        <div v-if="page" class="dynamics-data-card">
          <div class="dynamics-data-card-top"><strong>Resultados · página {{ page.page }}</strong><span>{{ page.items.length }} registros · {{ page.count ?? 'total no calculado' }}</span></div>
          <p class="dynamics-subtitle">Las opciones se muestran por su nombre de Dynamics. Colocá el cursor sobre el valor para ver el código interno.</p>
          <div class="dynamics-scroll"><table class="dynamics-data-table">
            <thead><tr><th v-for="name in lastQuery?.select ?? []" :key="name">{{ label(activeTable?.columns.find(f => f.logicalName === name)?.labels) || name }}</th></tr></thead>
            <tbody><tr v-for="(item, idx) in page.items" :key="idx"><td v-for="name in lastQuery?.select ?? []" :key="name"><span :title="formatReadCell(item, name).raw ? 'Valor interno: ' + formatReadCell(item, name).raw : undefined">{{ formatReadCell(item, name).text }}</span></td></tr></tbody>
          </table></div>
          <p v-if="page.truncated" class="dynamics-subtitle">Límite de páginas alcanzado: resultados truncados.</p>
          <button v-if="page.nextCursor" class="dynamics-outline-button" type="button" :disabled="busy" @click="searchRecords(page.nextCursor ?? undefined)">Siguiente página</button>
        </div>
      </template>
    </template>
    <template v-else-if="section === 'crud'">
      <div class="dynamics-security-note"><AlertTriangle :size="17" />
        <span>{{ canWrite ? 'Este entorno permite operaciones autorizadas. Los cambios requieren validación y confirmación.' : 'Modo protegido: podés preparar y revisar una operación, pero las escrituras permanecerán bloqueadas hasta que exista aprobación válida.' }}</span>
      </div>
      <div v-if="!canSecurity" class="dynamics-feedback dynamics-feedback-error">Necesitás el permiso dynamics.security.admin para administrar registros.</div>
      <template v-else>
        <nav class="dynamics-wizard-steps" aria-label="Pasos para operar sobre registros">
          <button v-for="(name, index) in crudSteps" :key="name" type="button"
            class="dynamics-wizard-step" :class="{ active: crudStep === index + 1, done: crudStep > index + 1 }"
            :disabled="index + 1 > crudStep" :aria-current="crudStep === index + 1 ? 'step' : undefined"
            @click="crudStep = (index + 1) as 1 | 2 | 3 | 4">
            <span class="dynamics-step-index">{{ index + 1 }}</span><span>{{ name }}</span>
          </button>
        </nav>
        <div v-if="crudStep === 1" class="dynamics-wizard-pane">
          <p class="dynamics-wizard-kicker">PASO 1 · ¿QUÉ QUERÉS HACER?</p>
          <h3>Elegí una operación</h3>
          <div class="dynamics-operation-choices">
            <button type="button" class="dynamics-operation-choice" :class="{ selected: crudMode === 'create' }"
              @click="crudMode='create'; changeCrudMode()"><strong>Crear registro</strong><small>Agregar información nueva a Dataverse.</small></button>
            <button type="button" class="dynamics-operation-choice" :class="{ selected: crudMode === 'update' }"
              @click="crudMode='update'; changeCrudMode()"><strong>Modificar registro</strong><small>Buscar un registro y editar campos permitidos.</small></button>
            <button type="button" class="dynamics-operation-choice" :class="{ selected: crudMode === 'delete' }"
              @click="crudMode='delete'; changeCrudMode()"><strong>Eliminar registro</strong><small>Solo con permisos, política y confirmación especial.</small></button>
          </div>
          <div class="dynamics-form-grid">
            <label class="dynamics-field"><span>¿En qué tabla?</span>
              <select v-model="entity" @change="changeEntity">
                <option v-for="t in enabledTables" :key="t.logicalName" :value="t.logicalName">{{ label(t.labels) || t.logicalName }} ({{ t.logicalName }})</option>
              </select>
            </label>
            <div class="dynamics-explainer">
              <strong>{{ label(activeTable?.labels) || activeTable?.logicalName || 'Sin tabla aprobada' }}</strong>
              <p>{{ writableFields.length }} campos autorizados para {{ crudMode === 'create' ? 'creación' : 'edición' }}.</p>
              <button v-if="!enabledTables.length" type="button" class="dynamics-outline-button" @click="emit('navigate', 'catalog')">Ir al Catálogo</button>
            </div>
          </div>
        </div>
        <div v-else-if="crudStep === 2" class="dynamics-wizard-pane">
          <p class="dynamics-wizard-kicker">PASO 2 · {{ crudMode === 'create' ? 'CAMPOS' : 'BUSCAR REGISTRO' }}</p>
          <template v-if="crudMode !== 'create'">
            <h3>Identificá el registro {{ crudMode === 'update' ? 'a modificar' : 'a eliminar' }}</h3>
            <p class="dynamics-subtitle">Ingresá el identificador GUID de Dataverse. Lo cargaremos antes de permitir una modificación.</p>
            <div class="dynamics-form-grid">
              <label class="dynamics-field"><span>Identificador del registro (GUID)</span>
                <input v-model.trim="recordId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" spellcheck="false">
              </label>
              <div class="dynamics-explainer">
                <strong>Protección frente a cambios simultáneos</strong>
                <p>Comprobaremos la versión ETag antes de actualizar o borrar.</p>
              </div>
            </div>
            <button type="button" class="dynamics-primary-button" :disabled="busy || !validGuid(recordId)"
              @click="loadRecord">Buscar y cargar registro</button>
            <p v-if="etag && recordId === loadedRecordId" class="dynamics-feedback dynamics-feedback-success">Registro encontrado. ETag cargado; podés continuar.</p>
          </template>
          <template v-else>
            <h3>Elegí los campos que tendrá el nuevo registro</h3>
            <p class="dynamics-subtitle">Solo mostramos los campos que tu conexión permite crear. Seleccioná los que necesitás.</p>
            <div class="dynamics-tools">
              <label class="dynamics-field dynamics-search-field"><span>Buscar campo</span>
                <input v-model="crudFieldSearch" placeholder="Nombre, cliente, fecha…">
              </label>
            </div>
            <div v-if="!writableFields.length" class="dynamics-empty-state">
              <strong>No hay campos autorizados para crear</strong>
              <p>Los campos de esta tabla necesitan permisos de creación en el Catálogo.</p>
              <button type="button" class="dynamics-outline-button" @click="emit('navigate', 'catalog')">Autorizar campos</button>
            </div>
            <div v-else class="dynamics-choice-list">
              <label v-for="field in visibleWriteFields" :key="field.logicalName" class="dynamics-choice-row">
                <input v-model="writeFields" type="checkbox" :value="field.logicalName">
                <span><strong>{{ label(field.labels) || field.logicalName }}</strong>
                  <small>{{ field.logicalName }} · {{ field.type }}{{ field.requiredLevel?.includes('Required') ? ' · Obligatorio en Dataverse' : '' }}</small></span>
              </label>
            </div>
            <p class="dynamics-selection-count">{{ crudSelectedCount }} campos seleccionados</p>
          </template>
        </div>
        <div v-else-if="crudStep === 3" class="dynamics-wizard-pane">
          <p class="dynamics-wizard-kicker">PASO 3 · {{ crudMode === 'delete' ? 'ELIMINACIÓN' : 'DATOS' }}</p>
          <template v-if="crudMode === 'delete'">
            <h3>Revisá las consecuencias del borrado</h3>
            <div class="dynamics-feedback dynamics-feedback-error">
              Eliminar es irreversible. Debe estar habilitada la política de borrado y se debe confirmar explícitamente.
            </div>
            <p v-if="!deletePolicy?.enabled" class="dynamics-subtitle">La política de eliminación de esta tabla no está habilitada.</p>
            <label class="dynamics-check"><input v-model="confirmed" type="checkbox"> Confirmo que quiero eliminar este registro</label>
            <div class="dynamics-form-grid">
              <label class="dynamics-field"><span>Escribí ELIMINAR para confirmar</span><input v-model="deletePhrase" placeholder="ELIMINAR"></label>
              <label class="dynamics-field"><span>Motivo (mínimo 10 caracteres)</span>
                <textarea v-model="deleteReason" rows="3" placeholder="Explicá por qué es necesario eliminarlo"></textarea>
              </label>
            </div>
          </template>
          <template v-else>
            <h3>{{ crudMode === 'create' ? 'Completá los datos del nuevo registro' : 'Elegí qué campos querés cambiar' }}</h3>
            <p class="dynamics-subtitle">Solo se enviarán los campos seleccionados. Los valores vacíos se guardan como NULL cuando el campo lo permita.</p>
            <div v-if="crudMode === 'update'" class="dynamics-data-card">
              <label class="dynamics-field dynamics-search-field"><span>Agregar un campo</span>
                <input v-model="crudFieldSearch" placeholder="Buscar por nombre…">
              </label>
              <div class="dynamics-choice-list dynamics-choice-compact">
                <label v-for="field in visibleWriteFields" :key="field.logicalName" class="dynamics-choice-row">
                  <input v-model="writeFields" type="checkbox" :value="field.logicalName">
                  <span>{{ label(field.labels) || field.logicalName }}<small>{{ field.logicalName }}</small></span>
                </label>
              </div>
            </div>
            <div v-if="!writeFields.length" class="dynamics-empty-state">
              <strong>Seleccioná los campos que querés {{ crudMode === 'create' ? 'crear' : 'modificar' }}</strong>
              <p>{{ crudMode === 'create' ? 'Volvé al paso anterior para seleccionar los campos.' : 'Agregá al menos un campo autorizado arriba.' }}</p>
            </div>
            <div v-for="name in writeFields" :key="name" class="dynamics-write-field-card">
              <template v-if="writableFields.find(f => f.logicalName === name)">
                <div class="dynamics-data-card-top">
                  <div><strong>{{ label(writableFields.find(f => f.logicalName === name)?.labels) || name }}</strong>
                    <p class="dynamics-subtitle">{{ name }} · {{ writableFields.find(f => f.logicalName === name)?.type }}</p></div>
                  <button type="button" class="dynamics-outline-button" @click="removeWriteField(name)">Quitar campo</button>
                </div>
                <label class="dynamics-field"><span>Valor</span>
                  <select v-if="writableFields.find(f => f.logicalName === name)?.choices.length" v-model="writeValues[name]">
                    <option value="">Seleccionar</option>
                    <option v-for="option in writableFields.find(f => f.logicalName === name)?.choices" :key="option.value" :value="String(option.value)">{{ label(option.labels) || option.value }}</option>
                  </select>
                  <select v-else-if="writableFields.find(f => f.logicalName === name)?.type === 'Boolean'" v-model="writeValues[name]">
                    <option value="">Seleccionar</option><option value="true">Sí</option><option value="false">No</option>
                  </select>
                  <input v-else v-model="writeValues[name]"
                    :type="writableFields.find(f => f.logicalName === name)?.type === 'DateTime' ? 'datetime-local' :
                      ['Integer','BigInt','Money','Decimal','Double'].includes(writableFields.find(f => f.logicalName === name)?.type ?? '') ? 'number' : 'text'"
                    :step="['Money','Decimal','Double'].includes(writableFields.find(f => f.logicalName === name)?.type ?? '') ? 'any' : undefined"
                    :placeholder="['Lookup','Customer','Owner'].includes(writableFields.find(f => f.logicalName === name)?.type ?? '') ? 'GUID de referencia' : 'Ingresá el valor del campo'">
                </label>
                <label v-if="lookupRelations(writableFields.find(f => f.logicalName === name)!).length" class="dynamics-field">
                  <span>Relación de Dataverse</span>
                  <select v-model="navByField[name]"><option value="">Seleccionar relación</option>
                    <option v-for="relation in lookupRelations(writableFields.find(f => f.logicalName === name)!)" :key="relation.schemaName"
                      :value="relation.referencingNavigation ?? ''">{{ relation.referencingNavigation }} · {{ relation.referencedEntity }}</option>
                  </select>
                </label>
                <p v-else-if="['Lookup','Customer','Owner'].includes(writableFields.find(f => f.logicalName === name)?.type ?? '')"
                  class="dynamics-subtitle">Esta referencia necesita una relación autorizada del catálogo antes de poder escribirse.</p>
              </template>
            </div>
          </template>
        </div>
        <div v-else class="dynamics-wizard-pane">
          <p class="dynamics-wizard-kicker">PASO 4 · REVISIÓN FINAL</p>
          <h3>Confirmá tu operación antes de enviarla</h3>
          <div class="dynamics-review-grid">
            <div class="dynamics-review-item"><strong>Acción</strong>{{ crudMode === 'create' ? 'Crear' : crudMode === 'update' ? 'Modificar' : 'Eliminar' }}</div>
            <div class="dynamics-review-item"><strong>Tabla</strong>{{ label(activeTable?.labels) || entity }}</div>
            <div class="dynamics-review-item"><strong>Campos</strong>{{ crudMode === 'delete' ? 'Registro completo' : writeFields.length }}</div>
            <div v-if="crudMode !== 'create'" class="dynamics-review-item"><strong>Registro</strong>{{ recordId }}</div>
          </div>
          <details v-if="crudMode !== 'delete'" class="dynamics-disclosure" open>
            <summary>Datos que se enviarán</summary>
            <pre class="dynamics-json">{{ JSON.stringify(crudPreview, null, 2) }}</pre>
          </details>
          <div v-if="!canWrite || (crudMode === 'delete' && !canDelete)"
            class="dynamics-feedback dynamics-feedback-error" role="alert">
            Operación bloqueada por permisos o aprobaciones de producción. Podés revisar el formulario, pero no se enviará ningún cambio.
          </div>
          <div v-else-if="!canFinishWrite && !lockedWrite" class="dynamics-feedback dynamics-feedback-error">
            Revisá los campos, ETag y confirmaciones antes de ejecutar.
          </div>
          <button type="button" class="dynamics-primary-button" :disabled="!canFinishWrite" @click="submitWrite">
            {{ crudMode === 'create' ? 'Confirmar creación' : crudMode === 'update' ? 'Confirmar modificación' : 'Confirmar eliminación' }}
          </button>
        </div>
        <div class="dynamics-wizard-footer">
          <button v-if="crudStep > 1" type="button" class="dynamics-outline-button" :disabled="busy || lockedWrite"
            @click="crudStep = (crudStep - 1) as 1 | 2 | 3 | 4">Anterior</button>
          <div class="dynamics-wizard-footer-right">
            <span class="dynamics-subtitle">Paso {{ crudStep }} de 4</span>
            <button v-if="crudStep < 4" type="button" class="dynamics-primary-button" :disabled="busy || lockedWrite || !enabledTables.length"
              @click="nextCrudStep">Siguiente</button>
            <button v-else type="button" class="dynamics-outline-button" :disabled="busy" @click="newWrite(); crudStep=1">Nueva operación</button>
          </div>
        </div>
        <p v-if="lockedWrite" class="dynamics-subtitle">No se reenvía automáticamente la operación. Revisá su identificador en Auditoría si hay dudas sobre el resultado.</p>
        <pre v-if="writeResult" class="dynamics-json">{{ JSON.stringify(writeResult, null, 2) }}</pre>
      </template>
    </template>
    <template v-else-if="section === 'integrations'">
      <div class="dynamics-security-note"><ShieldCheck :size="18" />
        <span>Podés conectar Pangolin sin tokens OAuth usando una clave de API propia de Dhole. La clave se envía como cabecera HTTPS y permite ejecutar todas las consultas guardadas habilitadas de esta conexión. Tiene vencimiento, cuota y revocación propios; no permite consultas libres ni escrituras anónimas.</span>
      </div>
      <div class="dynamics-data-card">
        <strong>1. Elegí cómo conectar tu aplicación</strong>
        <div class="dynamics-bulk-options">
          <label class="dynamics-bulk-option" :class="{ selected: publicAuthMode === 'api-key' }">
            <input v-model="publicAuthMode" type="radio" value="api-key" @change="publicOperation='saved'">
            <span><strong>Clave de API de Dhole (recomendado para Pangolin)</strong>
              <small>Sin Microsoft Entra ni tokens de sesión. Generás una sola clave por aplicación para todas las consultas guardadas habilitadas de la conexión, con caducidad y límite de peticiones.</small></span>
          </label>
          <label class="dynamics-bulk-option" :class="{ selected: publicAuthMode === 'oauth' }">
            <input v-model="publicAuthMode" type="radio" value="oauth">
            <span><strong>OAuth2 de aplicación (avanzado)</strong>
              <small>Para quienes ya utilizan Microsoft Entra. Requiere el cliente M2M, audiencia, permisos y grants de operación y campos.</small></span>
          </label>
        </div>
        <div class="dynamics-form-grid">
          <label class="dynamics-field"><span>API Gateway de Dhole (no el sitio web)</span>
            <input :value="publicOrigin" readonly aria-label="URL base del gateway, tomada de la configuración de API">
            <small class="dynamics-subtitle">La dirección la establece VITE_API_URL del entorno. No se usan enlaces del frontend.</small></label>
          <label v-if="publicAuthMode === 'oauth'" class="dynamics-field"><span>Operación</span><select v-model="publicOperation">
            <option value="saved">Ejecutar consulta guardada</option>
            <option value="search">Consulta estructurada</option>
            <option value="get">Obtener registro por GUID</option>
            <option value="create">Crear registro</option>
            <option value="update">Actualizar registro</option>
            <option value="delete">Eliminar registro</option>
            <option value="upsert">UPSERT por clave alternativa</option>
          </select></label>
          <label v-if="publicAuthMode === 'api-key' || publicOperation === 'saved'" class="dynamics-field"><span>{{ publicAuthMode === 'api-key' ? 'Consulta para generar una URL de ejemplo (no asigna permisos)' : 'Consulta guardada' }}</span>
            <select v-model="publicSavedName"><option value="">Seleccionar consulta</option>
              <option v-for="item in saved" :key="item.id" :value="item.name">{{ item.name }} ({{ item.enabled ? 'habilitada' : 'deshabilitada' }})</option>
            </select>
            <small v-if="publicAuthMode === 'api-key'" class="dynamics-subtitle">Solo cambia la URL de ejemplo. La clave general funciona con cualquiera de las consultas habilitadas.</small>
          </label>
          <label v-else class="dynamics-field"><span>Tabla Dataverse</span><select v-model="entity" @change="changeEntity">
            <option v-for="item in enabledTables" :key="item.logicalName" :value="item.logicalName">{{ item.logicalName }}</option>
          </select></label>
          <label v-if="publicAuthMode === 'oauth' && ['get','update','delete'].includes(publicOperation)" class="dynamics-field"><span>GUID del registro o plantilla</span><input v-model.trim="publicRecordId" placeholder="{record-guid}"></label>
          <label v-if="publicAuthMode === 'oauth' && publicOperation === 'upsert'" class="dynamics-field"><span>Campo de clave alternativa</span>
            <select v-model="publicKey"><option value="">Elegir clave</option>
              <option v-for="key in activeTable?.alternateKeys ?? []" :key="key.logicalName" :value="key.attributes[0]">{{ key.logicalName }} · {{ key.attributes.join(', ') }}</option>
            </select>
          </label>
        </div>
        <p v-if="!validApiOrigin" class="dynamics-feedback dynamics-feedback-error">La URL del API Gateway está mal configurada. Revisá VITE_API_URL del despliegue.</p>
        <p v-if="publicAuthMode === 'oauth' && diagnostics && !diagnostics.m2mConfigured" class="dynamics-feedback dynamics-feedback-error" role="alert">
          El conector todavía no tiene habilitado OAuth2 M2M en este entorno: se requieren M2m:Authority y M2m:Audience en el backend antes de que una aplicación externa pueda autenticarse.
        </p>
        <p v-if="!publicReady" class="dynamics-subtitle">Elegí una consulta habilitada, una tabla autorizada y, cuando corresponda, un GUID o una clave alternativa para generar una URL lista para usar.</p>
        <p v-if="publicOperation === 'saved' && saved.find(s => s.name === publicSavedName)?.enabled === false" class="dynamics-feedback dynamics-feedback-error">
          Esta consulta está deshabilitada. Activala en Query Builder antes de consumirla desde una aplicación externa.
        </p>
      </div>
      <div v-if="publicAuthMode === 'api-key'" class="dynamics-data-card">
        <strong>2. Crear una clave para Pangolin u otra aplicación</strong>
        <p class="dynamics-subtitle">Elegí todas las consultas o marcá varias consultas específicas para una sola clave. También podés modificar los permisos de las claves existentes sin cambiar su secreto.</p>
        <div v-if="!canSecurity" class="dynamics-feedback dynamics-feedback-error">Se requiere el permiso dynamics.security.admin para generar claves.</div>
        <template v-else>
          <div class="dynamics-bulk-options">
            <label class="dynamics-bulk-option" :class="{ selected: newKeyScope === 'all' }">
              <input v-model="newKeyScope" type="radio" value="all">
              <span><strong>Todas las consultas habilitadas</strong>
                <small>Incluye las consultas nuevas que habilités posteriormente.</small></span>
            </label>
            <label class="dynamics-bulk-option" :class="{ selected: newKeyScope === 'selected' }">
              <input v-model="newKeyScope" type="radio" value="selected">
              <span><strong>Seleccionar varias consultas</strong>
                <small>La API Key funcionará únicamente con las consultas que marqué.</small></span>
            </label>
          </div>
          <div v-if="newKeyScope === 'selected'" class="dynamics-bulk-panel">
            <strong>Consultas permitidas para esta API Key</strong>
            <div class="dynamics-actions">
              <button class="dynamics-outline-button" type="button" @click="newKeyQueries=enabledSavedQueries.map(query => query.name)">Seleccionar todas</button>
              <button class="dynamics-outline-button" type="button" @click="newKeyQueries=[]">Limpiar</button>
            </div>
            <div class="dynamics-check-grid">
              <label v-for="query in enabledSavedQueries" :key="query.id" class="dynamics-check">
                <input v-model="newKeyQueries" type="checkbox" :value="query.name">{{ query.name }}
              </label>
            </div>
            <p v-if="!enabledSavedQueries.length" class="dynamics-subtitle">No hay consultas habilitadas. Activá las que necesités en Query Builder.</p>
          </div>
          <div class="dynamics-form-grid">
            <label class="dynamics-field"><span>Nombre de la aplicación</span>
              <input v-model.trim="integrationKeyForm.label" maxlength="120" placeholder="Pangolin"></label>
            <label class="dynamics-field"><span>Validez en días (1–90)</span>
              <input v-model.number="integrationKeyForm.expiresInDays" type="number" min="1" max="90"></label>
            <label class="dynamics-field"><span>Solicitudes por minuto (1–120)</span>
              <input v-model.number="integrationKeyForm.maxRequestsPerMinute" type="number" min="1" max="120"></label>
          </div>
          <button type="button" class="dynamics-primary-button"
            :disabled="busy || !code || !integrationKeyForm.label.trim() ||
              (newKeyScope === 'selected' && !newKeyQueries.length) ||
              integrationKeyForm.expiresInDays < 1 || integrationKeyForm.expiresInDays > 90 ||
              integrationKeyForm.maxRequestsPerMinute < 1 || integrationKeyForm.maxRequestsPerMinute > 120"
            @click="createIntegrationKey">Generar clave de API</button>
          <div v-if="issuedIntegrationKey" class="dynamics-bulk-panel" role="status">
            <strong>Clave recién generada · {{ issuedIntegrationKey.key.label }}</strong>
            <p class="dynamics-diff-note">Copiala ahora y guardala únicamente en las variables secretas del servidor de Pangolin. No volverá a mostrarse.</p>
            <code class="dynamics-api-url">{{ issuedIntegrationKey.apiKey }}</code>
            <div class="dynamics-tools">
              <button type="button" class="dynamics-primary-button"
                @click="copyApi(issuedIntegrationKey.apiKey)">Copiar clave</button>
              <button type="button" class="dynamics-outline-button" @click="issuedIntegrationKey=null">Ya guardé la clave · Ocultarla</button>
            </div>
          </div>
          <div v-if="integrationKeys.length" class="dynamics-data-card">
            <strong>API Keys existentes · administrá sus consultas sin generar otra clave</strong>
            <div v-for="key in integrationKeys" :key="key.id" class="dynamics-saved-row">
              <div><strong>{{ key.label }}</strong>
                <p class="dynamics-subtitle">{{ key.scope === 'all' ? 'Todas las consultas habilitadas'
                  : key.scope === 'selected' ? (key.allowedQueries?.length ?? 0) + ' consultas seleccionadas'
                  : 'Una consulta: ' + key.queryName }} · {{ key.enabled ? 'Habilitada' : 'Revocada' }} · vence {{ new Date(key.expiresAt).toLocaleDateString('es-CR') }}</p>
              </div>
              <div class="dynamics-actions">
                <button v-if="key.enabled && new Date(key.expiresAt).getTime() > Date.now()"
                  type="button" class="dynamics-outline-button" :disabled="busy"
                  @click="editIntegrationKey(key)">Administrar consultas</button>
                <button v-if="key.enabled" type="button" class="dynamics-outline-button"
                  :disabled="busy" @click="revokeIntegrationKey(key.id)">Revocar acceso</button>
              </div>
            </div>
            <div v-if="editingKey" class="dynamics-bulk-panel">
              <strong>Consultas permitidas · {{ editingKey.label }}</strong>
              <p class="dynamics-subtitle">La clave seguirá siendo la misma. El cambio se aplica a la conexión {{ code }} y queda auditado.</p>
              <div class="dynamics-bulk-options">
                <label class="dynamics-bulk-option" :class="{ selected: editingKeyScope === 'all' }">
                  <input v-model="editingKeyScope" type="radio" value="all">
                  <span><strong>Todas las consultas habilitadas</strong>
                    <small>Incluye las nuevas consultas habilitadas en el futuro.</small></span>
                </label>
                <label class="dynamics-bulk-option" :class="{ selected: editingKeyScope === 'selected' }">
                  <input v-model="editingKeyScope" type="radio" value="selected">
                  <span><strong>Solo las consultas que seleccione</strong>
                    <small>Elegí una o varias búsquedas autorizadas.</small></span>
                </label>
              </div>
              <div v-if="editingKeyScope === 'selected'">
                <div class="dynamics-actions">
                  <button class="dynamics-outline-button" type="button" @click="editingKeyQueries=enabledSavedQueries.map(query => query.name)">Seleccionar todas</button>
                  <button class="dynamics-outline-button" type="button" @click="editingKeyQueries=[]">Limpiar</button>
                </div>
                <div class="dynamics-check-grid">
                  <label v-for="query in enabledSavedQueries" :key="query.id" class="dynamics-check">
                    <input v-model="editingKeyQueries" type="checkbox" :value="query.name">{{ query.name }}
                  </label>
                </div>
                <p v-if="!enabledSavedQueries.length" class="dynamics-subtitle">No hay consultas habilitadas para seleccionar.</p>
              </div>
              <div class="dynamics-tools">
                <button type="button" class="dynamics-primary-button"
                  :disabled="busy || (editingKeyScope === 'selected' && !editingKeyQueries.length)"
                  @click="updateIntegrationKeyAccess">Guardar permisos de esta API Key</button>
                <button type="button" class="dynamics-outline-button" @click="editingKeyId=''">Cancelar</button>
              </div>
            </div>
          </div>
        </template>
      </div>
      <div class="dynamics-data-card">
        <strong>{{ publicAuthMode === 'api-key' ? '3. URL de consulta para Pangolin' : '2. URL de tu API' }}</strong>
        <div class="dynamics-tools"><span class="dynamics-api-method">{{ publicMethod }}</span>
          <code class="dynamics-api-url">{{ publicEndpoint }}</code>
          <button class="dynamics-outline-button" type="button" :disabled="!publicReady" @click="copyApi(publicEndpoint)">Copiar URL</button>
        </div>
        <p v-if="publicAuthMode === 'api-key'" class="dynamics-subtitle">La misma clave activa y no caducada se envía en <code>X-Dhole-Api-Key</code> para todas las consultas habilitadas o para las consultas seleccionadas en sus permisos; solo cambiás el nombre en la URL. Se aplican los permisos de lectura vigentes de Dataverse. No permite CREATE, UPDATE ni DELETE.</p>
        <p v-else class="dynamics-subtitle">Permiso OAuth requerido: <strong>{{ publicScope }}</strong>. Además se requiere cliente OAuth registrado, grant por conexión, tabla, operación y campos, y políticas de Dataverse. Para CREATE, UPDATE y DELETE, también las aprobaciones de producción.</p>
        <strong>Ejemplo de solicitud HTTP (sin credenciales reales)</strong>
        <pre class="dynamics-json">{{ publicCurl }}</pre>
        <div class="dynamics-tools"><button type="button" class="dynamics-primary-button" :disabled="!publicReady" @click="copyApi(publicCurl)">Copiar cURL</button>
          <span v-if="copied" class="dynamics-subtitle">{{ publicAuthMode === 'api-key' ? 'Ejemplo copiado · agregá tu clave API' : 'Ejemplo copiado · requiere token OAuth de aplicación' }}</span>
        </div>
      </div>
      <div class="dynamics-data-card">
        <strong>{{ publicAuthMode === 'api-key' ? '4. Consumir desde Pangolin' : '3. Consumir desde Pangolin u otra aplicación' }}</strong>
        <template v-if="publicAuthMode === 'api-key'">
          <p class="dynamics-subtitle">Desde el backend de Pangolin realizá una solicitud <strong>POST</strong> a la URL indicada, con <code>Content-Type: application/json</code> y <code>X-Dhole-Api-Key</code> en las cabeceras. El cuerpo debe contener <code>connectionCode</code> y <code>parameters</code>. Para otra búsqueda, conservá la misma clave y cambiá el nombre de la consulta en la URL. No necesitás acceder a Dhole ni a Microsoft Entra desde esa aplicación.</p>
          <p class="dynamics-subtitle">Nunca pongás la clave en la URL, en JavaScript del navegador ni en un repositorio. Si Pangolin es un proxy inverso, configurá un cliente/backend que envíe la cabecera a este gateway, sin redirigir a la página web.</p>
        </template>
        <template v-else>
        <p class="dynamics-subtitle"><strong>Si Pangolin es el sistema que consume los datos:</strong> configurá una llamada HTTP saliente a {{ publicOrigin }}. No lo apuntés a sistema.logisticacastrofallas.com y no abras el enlace como una página. El backend de Pangolin obtiene un token OAuth2 app-only de Microsoft Entra y lo envía con la cabecera Authorization: Bearer.</p>
        <p class="dynamics-subtitle"><strong>Configuración requerida:</strong> (1) crear una aplicación cliente en Entra y asignarle un rol de aplicación dynamics.records.read (u otra operación autorizada) sobre el recurso de API; (2) configurar el issuer y audience M2M del conector; (3) registrar el Client ID y su issuer en la sección Seguridad de Dhole; (4) crear un grant habilitado para conexión {{ code }}, tabla, operación y columnas; (5) consumir mediante HTTPS con JSON.</p>
        <p class="dynamics-subtitle"><strong>Si Pangolin solo funciona como proxy/túnel:</strong> conservá este gateway como destino; el proxy debe reenviar método, cuerpo y Authorization sin convertir la solicitud en una navegación del frontend. No coloqués secretos en la URL ni guardés el client secret en código del navegador.</p>
        </template>
        <div class="dynamics-actions">
          <button v-if="publicAuthMode === 'oauth'" type="button" class="dynamics-outline-button" @click="copyApi('Authorization: Bearer <ACCESS_TOKEN>')">Copiar cabecera OAuth</button>
          <button type="button" class="dynamics-outline-button" @click="run(loadSaved)">Recargar consultas</button>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="dynamics-security-note"><ShieldCheck :size="18" /><span>Los scopes dynamics.admin y dynamics.security.admin se asignan por usuario o rol en DholeAuth. Las políticas siguientes se aplican adicionalmente por conexión y tabla.</span></div>
      <div v-if="!canSecurity" class="dynamics-feedback dynamics-feedback-error">Requiere dynamics.security.admin.</div>
      <template v-else>
        <div class="dynamics-data-card">
          <strong>Política de eliminación (tabla seleccionada)</strong>
          <div class="dynamics-tools">
            <label class="dynamics-field"><span>Tabla</span><select v-model="entity" @change="readDeletePolicy"><option v-for="t in enabledTables" :key="t.logicalName" :value="t.logicalName">{{ t.logicalName }}</option></select></label>
            <label v-if="deletePolicy" class="dynamics-check"><input v-model="deletePolicy.enabled" type="checkbox"> Habilitar DELETE para esta tabla</label>
            <label v-if="deletePolicy" class="dynamics-field"><span>Edad mínima del registro (días)</span><input v-model.number="deletePolicy.minAgeDays" type="number" min="0" max="36500"></label>
            <button class="dynamics-outline-button" type="button" :disabled="busy || !deletePolicy" @click="saveDeletePolicy">Guardar política</button>
          </div>
          <p class="dynamics-subtitle">Una política habilitada no omite la aprobación de producción, los permisos del usuario ni el ETag.</p>
        </div>
        <div class="dynamics-data-card">
          <strong>Registrar o modificar cliente OAuth M2M</strong>
          <div class="dynamics-form-grid">
            <label class="dynamics-field"><span>Issuer de Microsoft Entra (HTTPS)</span><input v-model.trim="clientForm.issuer" placeholder="https://login.microsoftonline.com/tenant/v2.0"></label>
            <label class="dynamics-field"><span>Client ID de la aplicación</span><input v-model.trim="clientForm.clientId" placeholder="GUID del cliente OAuth"></label>
            <label class="dynamics-field"><span>Nombre de la aplicación</span><input v-model.trim="clientForm.displayName" placeholder="Integración de cotizaciones" maxlength="120"></label>
            <label class="dynamics-check"><input v-model="clientForm.enabled" type="checkbox"> Cliente habilitado</label>
          </div>
          <div class="dynamics-tools"><button class="dynamics-primary-button" type="button" :disabled="busy || !clientForm.clientId" @click="registerClient">Guardar cliente M2M</button>
            <button class="dynamics-outline-button" type="button" @click="clientForm={ issuer:'', clientId:'', displayName:'', enabled:false }">Limpiar</button></div>
          <p class="dynamics-subtitle">El issuer debe coincidir exactamente con el proveedor OAuth configurado en el conector. Las credenciales se administran en Microsoft Entra, no en el navegador.</p>
        </div>
        <div class="dynamics-data-card"><div class="dynamics-data-card-top"><strong>Aplicaciones M2M registradas</strong><button class="dynamics-outline-button" type="button" :disabled="busy" @click="run(loadGrants)">Actualizar</button></div>
          <p v-if="!clients.length" class="dynamics-subtitle">No hay aplicaciones M2M registradas. Registralas con el administrador del conector antes de asignar grants.</p>
          <div v-for="client in clients" :key="client.id" class="dynamics-saved-row">
            <div><strong>{{ client.displayName }}</strong><p class="dynamics-subtitle">{{ client.clientId }} · {{ client.enabled ? 'Habilitada' : 'Deshabilitada' }}</p></div>
            <button type="button" class="dynamics-outline-button" @click="editClient(client)">Editar</button>
          </div>
        </div>
        <div class="dynamics-data-card">
          <strong>Autorizar aplicación por entidad y operación</strong>
          <div class="dynamics-form-grid">
            <label class="dynamics-field"><span>Aplicación M2M</span><select v-model="grantClient">
              <option value="">Seleccioná aplicación</option>
              <option v-for="client in clients.filter(c => c.enabled)" :key="client.id" :value="client.id">{{ client.displayName }}</option>
            </select></label>
            <label class="dynamics-field"><span>Tabla</span><select v-model="entity" @change="changeEntity"><option v-for="t in enabledTables" :key="t.logicalName" :value="t.logicalName">{{ t.logicalName }}</option></select></label>
            <label class="dynamics-field"><span>Operación</span><select v-model="grantOperation" @change="grantFields=[]">
              <option value="read">SELECT</option><option value="create">CREATE</option><option value="update">UPDATE</option>
              <option value="upsert">UPSERT</option><option value="delete">DELETE</option>
            </select></label>
            <label class="dynamics-field"><span>Cuota (1 a 600/minuto)</span><input v-model.number="grantQuota" type="number" min="1" max="600"></label>
          </div>
          <strong class="dynamics-subtitle">Campos autorizados</strong>
          <div class="dynamics-check-grid"><label v-for="f in grantAllowedFields" :key="f" class="dynamics-check">
            <input v-model="grantFields" type="checkbox" :value="f">{{ f }}</label></div>
          <div class="dynamics-tools"><label class="dynamics-check"><input v-model="grantEnabled" type="checkbox"> Grant activo</label>
            <button class="dynamics-primary-button" type="button" :disabled="busy || !grantClient || !grantFields.length" @click="saveGrant">Guardar grant</button></div>
          <p class="dynamics-subtitle">Los grants M2M también requieren scopes OAuth válidos y no conceden permisos administrativos de DholeAuth.</p>
        </div>
        <div class="dynamics-data-card"><strong>Grants existentes</strong>
          <div v-for="grant in grants.filter(g => !connections.find(c => c.code === code)?.id || g.connectionId === connections.find(c => c.code === code)?.id)" :key="grant.id" class="dynamics-saved-row">
            <div><strong>{{ grant.entitySet }} · {{ grant.operation.toUpperCase() }}</strong>
              <p class="dynamics-subtitle">{{ grant.allowedFields.join(', ') }} · {{ grant.maxRequestsPerMinute }}/min · {{ grant.enabled ? 'Activo' : 'Inactivo' }}</p></div>
            <button class="dynamics-outline-button" type="button" @click="editGrant(grant)">Editar</button>
          </div>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>

/* Workspace styles are self-contained: scoped styles in the parent view
   do not reach nested controls in this component. */
.dynamics-panel{min-width:0;border:1px solid var(--dh-border);border-radius:22px;background:var(--dh-card);box-shadow:var(--dh-shadow-sm);padding:24px;color:var(--dh-text)}
.dynamics-panel-header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:20px;flex-wrap:wrap}
.dynamics-panel-header h2{font-size:19px;line-height:1.3;font-weight:850}
.dynamics-section-label{font-size:10px;letter-spacing:.07em;font-weight:800;color:var(--dh-primary);margin-bottom:5px}
.dynamics-subtitle{margin:7px 0;color:var(--dh-text-muted);font-size:12px;line-height:1.55}
.dynamics-field{display:flex;flex-direction:column;gap:7px;min-width:0}.dynamics-field>span{font-size:11px;font-weight:750;color:var(--dh-text-soft)}
.dynamics-field input{width:100%;height:42px;min-width:0;padding:9px 11px;outline:none;border:1px solid var(--dh-border-strong);border-radius:11px;color:var(--dh-text);background:var(--dh-input);font-size:12px}
.dynamics-field input:focus,.dynamics-field select:focus,.dynamics-field textarea:focus{outline:2px solid var(--dh-primary);outline-offset:1px}
.dynamics-primary-button,.dynamics-outline-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:9px 13px;border-radius:10px;font-size:11px;font-weight:750;white-space:nowrap}
.dynamics-primary-button{background:var(--dh-primary);color:white}.dynamics-outline-button{border:1px solid var(--dh-border-strong);background:var(--dh-surface);color:var(--dh-text)}
.dynamics-primary-button:disabled,.dynamics-outline-button:disabled{cursor:not-allowed;opacity:.5}
.dynamics-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.dynamics-feedback{display:flex;align-items:center;gap:9px;margin:12px 0;padding:12px 14px;border:1px solid var(--dh-border);border-radius:11px;font-size:12px;overflow-wrap:anywhere}
.dynamics-feedback-error{border-color:#ef4444;background:color-mix(in srgb,#ef4444 8%,var(--dh-card))}
.dynamics-feedback-success{border-color:#10b981;background:color-mix(in srgb,#10b981 8%,var(--dh-card))}
.dynamics-security-note{display:flex;gap:10px;padding:13px;margin:12px 0;border-radius:12px;border:1px solid var(--dh-border);color:var(--dh-text-soft);background:var(--dh-surface);font-size:12px}
.dynamics-security-note svg{flex:none}.dynamics-empty{display:flex;align-items:center;justify-content:center;gap:9px;border:1px dashed var(--dh-border-strong);border-radius:13px;background:var(--dh-surface);padding:25px;color:var(--dh-text-muted);font-size:12px;text-align:center}
.dynamics-json{max-width:100%;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid var(--dh-border);border-radius:11px;background:var(--dh-surface);padding:13px;color:var(--dh-text-soft);font-size:11px;line-height:1.55}

.dynamics-api-url{font-size:12px;overflow-wrap:anywhere;word-break:break-all;flex:1 1 400px}
.dynamics-api-method{font-size:11px;font-weight:800;color:var(--dh-primary);padding:9px 12px;background:var(--dh-surface-strong);border-radius:8px}
.dynamics-data-panel{min-height:390px}.dynamics-connection-select{max-width:460px;margin-bottom:19px}
.dynamics-field select,.dynamics-field textarea,.dynamics-filter-row select,.dynamics-filter-row input,.dynamics-tools select{
  background:var(--dh-input);color:var(--dh-text);border:1px solid var(--dh-border-strong);
  border-radius:10px;min-height:39px;padding:8px 11px;font-size:12px;min-width:0;width:100%}
.dynamics-field textarea{resize:vertical}.dynamics-data-card{padding:18px;margin-top:14px;border:1px solid var(--dh-border);border-radius:15px;background:var(--dh-surface);overflow-wrap:anywhere}
.dynamics-data-card-top,.dynamics-tools,.dynamics-saved-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.dynamics-data-card-top{margin-bottom:10px}.dynamics-tools{justify-content:flex-start;margin:14px 0}
.dynamics-tools>.dynamics-field{flex:1 1 175px;max-width:360px}.dynamics-check{display:inline-flex;align-items:center;gap:8px;color:var(--dh-text-soft);font-size:12px;line-height:1.45}
.dynamics-check-grid{display:flex;flex-wrap:wrap;gap:10px;padding:14px 0}.dynamics-check-grid>.dynamics-check{background:var(--dh-surface);border:1px solid var(--dh-border);padding:9px 12px;border-radius:10px}
.dynamics-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin:13px 0}
.dynamics-filter-row{display:grid;grid-template-columns:minmax(120px,2fr) minmax(80px,1fr) minmax(120px,2fr) auto;gap:9px;margin-top:9px;align-items:center}
.dynamics-scroll{overflow-x:auto;max-height:65vh}.dynamics-data-table{border-collapse:collapse;width:100%;min-width:680px;margin:10px 0;font-size:12px}
.dynamics-data-table th,.dynamics-data-table td{padding:11px;text-align:left;vertical-align:middle;border-bottom:1px solid var(--dh-border);max-width:340px;overflow-wrap:anywhere}
.dynamics-data-table th{color:var(--dh-text-soft);background:var(--dh-surface-strong);position:sticky;top:0}
.dynamics-data-table small{display:block;margin-top:3px;color:var(--dh-text-muted)}.dynamics-data-table input[type=checkbox]{cursor:pointer}
.dynamics-disclosure{margin:12px 0;padding:12px;border-radius:12px;border:1px solid var(--dh-border);font-size:12px}
.dynamics-disclosure summary{cursor:pointer;font-weight:700}.dynamics-saved-row{padding:12px 0;border-top:1px solid var(--dh-border)}
.dynamics-json{max-height:400px;overflow:auto}.dynamics-empty{min-height:130px}
.dynamics-wizard-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:18px 0 14px}
.dynamics-wizard-step{display:flex;align-items:center;gap:9px;border:1px solid var(--dh-border);border-radius:12px;background:var(--dh-surface);padding:12px;text-align:left;color:var(--dh-text-soft);font-size:12px;font-weight:750;min-width:0}
.dynamics-wizard-step:disabled{cursor:default;opacity:.65}.dynamics-wizard-step.active{border-color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 11%,var(--dh-surface));color:var(--dh-text)}
.dynamics-wizard-step.done{color:var(--dh-text);opacity:1}.dynamics-step-index{display:grid;place-items:center;flex-shrink:0;width:26px;height:26px;background:var(--dh-card);border:1px solid var(--dh-border-strong);border-radius:50%;font-weight:850}
.dynamics-wizard-step.active .dynamics-step-index{background:var(--dh-primary);border-color:var(--dh-primary);color:white}
.dynamics-wizard-pane{padding:22px;border:1px solid var(--dh-border);border-radius:16px;background:var(--dh-surface);min-height:215px}
.dynamics-wizard-pane h3{font-size:17px;font-weight:800;margin:4px 0 9px;color:var(--dh-text)}
.dynamics-wizard-kicker{font-size:10px;color:var(--dh-primary);font-weight:850;letter-spacing:.09em;margin:0 0 6px}
.dynamics-wizard-footer{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:17px;flex-wrap:wrap}
.dynamics-wizard-footer-right{display:flex;align-items:center;gap:12px;margin-left:auto}
.dynamics-empty-state{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:18px;margin:16px 0;border:1px dashed var(--dh-border-strong);border-radius:14px;color:var(--dh-text-soft);font-size:12px}
.dynamics-empty-state strong{font-size:14px;color:var(--dh-text)}.dynamics-empty-state p{margin:0}.dynamics-explainer{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px;border:1px solid var(--dh-border);border-radius:12px;padding:12px;color:var(--dh-text-soft);font-size:12px}
.dynamics-explainer strong{color:var(--dh-text);font-size:12px}.dynamics-explainer p{margin:0;line-height:1.6}
.dynamics-search-field{flex:1 1 260px;max-width:480px}.dynamics-selection-count{font-size:12px;font-weight:800;margin:13px 0;color:var(--dh-text-soft)}
.dynamics-choice-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:370px;overflow-y:auto;padding:4px 2px}
.dynamics-choice-row{display:flex;align-items:flex-start;gap:10px;cursor:pointer;border:1px solid var(--dh-border);border-radius:11px;padding:12px;min-width:0;color:var(--dh-text)}
.dynamics-choice-row:has(input:checked){border-color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 6%,var(--dh-surface))}
.dynamics-choice-row input{margin-top:3px;flex-shrink:0}.dynamics-choice-row span{min-width:0;font-size:12px}
.dynamics-choice-row strong{font-weight:750}.dynamics-choice-row small{display:block;color:var(--dh-text-muted);font-size:11px;margin-top:4px;overflow-wrap:anywhere}
.dynamics-choice-compact{max-height:220px;margin-top:12px}
.dynamics-friendly-filter{display:grid;grid-template-columns:minmax(125px,2fr) minmax(140px,1.5fr) minmax(130px,2fr) auto;gap:9px;margin-top:11px;align-items:end}
.dynamics-friendly-filter>.dynamics-outline-button{margin-bottom:1px}
.dynamics-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:15px 0}
.dynamics-review-item{padding:12px;border:1px solid var(--dh-border);border-radius:11px;font-size:12px;color:var(--dh-text-soft);overflow-wrap:anywhere}
.dynamics-review-item strong{display:block;color:var(--dh-text);font-size:10px;margin-bottom:7px}
.dynamics-operation-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0}
.dynamics-operation-choice{min-height:92px;display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:16px;border:1px solid var(--dh-border);border-radius:13px;text-align:left;background:var(--dh-card);color:var(--dh-text)}
.dynamics-operation-choice strong{font-size:13px;font-weight:800}.dynamics-operation-choice small{font-size:11px;line-height:1.5;color:var(--dh-text-muted)}
.dynamics-operation-choice.selected{border:1.5px solid var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 8%,var(--dh-card))}
.dynamics-bulk-panel{padding:17px;margin:12px 0;border:1px solid var(--dh-border-strong);border-radius:14px;background:var(--dh-card)}
.dynamics-bulk-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin:15px 0}
.dynamics-bulk-option{display:flex;gap:10px;padding:14px;border:1px solid var(--dh-border);border-radius:11px;cursor:pointer;line-height:1.5}
.dynamics-bulk-option.selected{border-color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 7%,var(--dh-card))}
.dynamics-bulk-option input{flex-shrink:0;margin-top:3px}.dynamics-bulk-option span{display:flex;flex-direction:column;gap:6px;font-size:12px}
.dynamics-bulk-option small{font-size:11px;color:var(--dh-text-muted)}
.dynamics-bulk-counts{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0;font-size:12px}
.dynamics-bulk-counts span{background:var(--dh-surface);border:1px solid var(--dh-border);border-radius:10px;padding:10px}
.dynamics-bulk-counts strong{font-size:14px}
@media(max-width:760px){.dynamics-bulk-options{grid-template-columns:1fr}}

.dynamics-write-field-card{border:1px solid var(--dh-border);border-radius:12px;background:var(--dh-card);padding:15px;margin:11px 0}
@media(max-width:850px){.dynamics-wizard-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.dynamics-friendly-filter{grid-template-columns:repeat(2,minmax(0,1fr))}.dynamics-operation-choices{grid-template-columns:1fr}}
@media(max-width:590px){.dynamics-wizard-steps,.dynamics-choice-list,.dynamics-review-grid,.dynamics-friendly-filter{grid-template-columns:1fr}.dynamics-wizard-pane{padding:15px}.dynamics-wizard-footer-right{width:100%;justify-content:space-between}.dynamics-wizard-step{font-size:11px}}

@media(max-width:760px){.dynamics-form-grid{grid-template-columns:1fr}.dynamics-filter-row{grid-template-columns:1fr 1fr}.dynamics-filter-row input{grid-column:1/-1}}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlertTriangle, Database, RefreshCw, Search, ShieldCheck } from 'lucide-vue-next'
import { fetchClient } from '@/core/api/fetchConfig'
import { ApiError } from '@/core/api/apiErrorHandler'
import { useAuthStore } from '@/core/stores/authStore'

type Section = 'catalog' | 'query' | 'crud' | 'security'
type Connection = { code: string }
type Choice = { value: number; labels: Record<string, string> }
type Column = {
  logicalName: string; type: string; canRead: boolean; canCreate: boolean
  canUpdate: boolean; isCalculated: boolean; labels: Record<string, string>
  choices: Choice[]; lookupTargets: string[]
}
type Relation = {
  schemaName: string; kind: string; referencedEntity: string | null
  referencingAttribute: string | null; referencingNavigation: string | null
}
type Table = {
  logicalName: string; entitySetName: string; primaryIdAttribute: string
  labels: Record<string, string>; columns: Column[]; relationships: Relation[]
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
type Diagnostics = { environment: string; productionWritesApproved: boolean; productionDeletesApproved: boolean }
type DeletePolicy = { entity: string; enabled: boolean; minAgeDays: number }
type ApiClient = { id: string; issuer: string; clientId: string; displayName: string; enabled: boolean }
type ApiGrant = { id: string; apiClientId: string; connectionId: string; entitySet: string; operation: string;
  allowedFields: string[]; maxRequestsPerMinute: number; enabled: boolean }

const props = defineProps<{ section: Section; connections: Connection[] }>()
const auth = useAuthStore()
const canSecurity = computed(() => auth.hasScope('dynamics.security.admin'))
const code = ref('')
const busy = ref(false)
const error = ref('')
const info = ref('')
const snapshot = ref<Snapshot | null>(null)
const policies = ref<Policies>({ entities: [], fields: [] })
const diff = ref<Record<string, unknown> | null>(null)
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
const paramName = ref('value')
const crudMode = ref<'create' | 'update' | 'delete'>('create')
const recordId = ref('')
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
const grantAllowedFields = computed(() => {
  if (!activeTable.value) return []
  if (grantOperation.value === 'delete') return [activeTable.value.primaryIdAttribute]
  if (grantOperation.value === 'upsert')
    return activeTable.value.columns.filter(f => fieldAllowed(f, 'create') && fieldAllowed(f, 'update')).map(f => f.logicalName)
  return activeTable.value.columns.filter(f => fieldAllowed(f, grantOperation.value)).map(f => f.logicalName)
})

function label(labels: Record<string, string> | undefined) {
  return labels?.['3082'] || labels?.['1033'] || Object.values(labels ?? {})[0] || ''
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
  recordId.value = ''; etag.value = ''; writeResult.value = null; lockedWrite.value = false
  confirmed.value = false; deleteReason.value = ''; deletePhrase.value = ''
}
function resetQuery() {
  columns.value = approvedFields.value.slice(0, 5).map(f => f.logicalName)
  filters.value = []; page.value = null; lastQuery.value = null
  orderField.value = ''; descending.value = false
}
function changeEntity() { resetQuery(); resetRecord(); void readDeletePolicy() }
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
  if (props.section === 'query') await loadSaved()
  if (props.section === 'security' && canSecurity.value) await loadGrants()
}
async function refreshMetadata() {
  await run(async () => {
    await api(connectionPath('metadata/refresh'), 'POST')
    await reload(); info.value = 'Catálogo actualizado. Revisá los cambios antes de habilitar campos.'
  })
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
  if (first && filters.value.length < 24) filters.value.push({ id: ++nextId.value, field: first.logicalName, op: 'eq', value: '' })
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
function validGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
function buildQuery(): Query {
  if (!columns.value.length || columns.value.length > 30) throw new Error('Seleccioná de 1 a 30 columnas.')
  if (!columns.value.every(name => approvedFields.value.some(f => f.logicalName === name)))
    throw new Error('Hay campos no autorizados en la selección.')
  const predicates = filters.value.map(row => {
    const field = approvedFields.value.find(f => f.logicalName === row.field)
    if (!field) throw new Error('El filtro tiene un campo no autorizado.')
    if (row.op === 'contains' && kind(field) !== 'string') throw new Error('Contains requiere texto.')
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
  info.value = 'Consulta cargada. Ingresá los parámetros o filtros antes de ejecutar.'
  error.value = ''
}
async function saveQuery() {
  await run(async () => {
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(savedName.value)) throw new Error('Nombre inválido: comenzá con una letra y usá hasta 40 caracteres.')
    const query = buildQuery()
    const clauses = filters.value
    const first = clauses[0]
    const field = approvedFields.value.find(f => f.logicalName === first?.field)
    const param = first && field ? [{
      name: paramName.value, type: kind(field), required: true,
    }] : []
    if (first && !/^[a-z][a-z0-9_]{0,39}$/.test(paramName.value)) throw new Error('Nombre de parámetro inválido.')
    if (first) {
      const predicate = { field: first.field, op: first.op, parameter: paramName.value }
      const more = clauses.slice(1).map(f => {
        const col = approvedFields.value.find(x => x.logicalName === f.field)!
        return { field: f.field, op: f.op, value: parseValue(col, f.value) }
      })
      query.filter = more.length ? { join: join.value, children: [predicate, ...more] } : predicate
    }
    await api(connectionPath('saved-queries'), 'POST', {
      name: savedName.value, entityName: entity.value, query, parameters: param, enabled: false,
    })
    await loadSaved()
    info.value = 'Consulta guardada deshabilitada. Activala expresamente para la API M2M.'
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
    for (const f of writableFields.value) {
      const value = response.item[f.logicalName]
      if (value != null && !['Lookup', 'Customer', 'Owner'].includes(f.type))
        writeValues.value[f.logicalName] = String(value)
    }
    info.value = etag.value ? 'Registro cargado con ETag para control de concurrencia.' : 'Dataverse no devolvió ETag; no se permite modificarlo.'
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
      if (!validGuid(recordId.value) || !etag.value) throw new Error('Cargá un registro con un ETag válido.')
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
watch(code, () => { void run(reload) })
watch(() => props.section, section => {
  if (!code.value || busy.value) return
  if (section === 'query') void run(async () => { await loadSaved() })
  if (section === 'security' && canSecurity.value) void run(async () => { await loadGrants(); await readDeletePolicy() })
})
</script>

<template>
  <section class="dynamics-panel dynamics-data-panel">
    <div class="dynamics-panel-header">
      <div>
        <p class="dynamics-section-label">DYNAMICS 365 · DATAVERSE</p>
        <h2>{{ { catalog: 'Catálogo de Dataverse', query: 'Query Builder', crud: 'Editor de registros', security: 'Seguridad y políticas' }[section] }}</h2>
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
        <button type="button" class="dynamics-primary-button" :disabled="busy" @click="refreshMetadata"><RefreshCw :size="15" /> Actualizar catálogo</button>
        <span class="dynamics-subtitle">Snapshot {{ snapshot?.version ?? 'sin generar' }} · {{ snapshot?.capturedAt ? new Date(snapshot.capturedAt).toLocaleString('es-CR') : 'Pendiente de descubrimiento' }}</span>
      </div>
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
              <p class="dynamics-subtitle">{{ table.logicalName }} · {{ table.entitySetName }} · {{ table.columns.length }} columnas · {{ table.relationships.length }} relaciones</p>
            </div>
            <div class="dynamics-actions">
              <button class="dynamics-outline-button" type="button" :disabled="busy" @click="toggleEntity(table)">{{ entityEnabled(table.logicalName) ? 'Deshabilitar' : 'Habilitar' }}</button>
              <button class="dynamics-outline-button" type="button" @click="expanded=expanded === table.logicalName ? '' : table.logicalName">{{ expanded===table.logicalName ? 'Cerrar' : 'Campos' }}</button>
            </div>
          </div>
          <div v-if="expanded === table.logicalName" class="dynamics-scroll">
            <p v-if="!entityEnabled(table.logicalName)" class="dynamics-subtitle">Habilitá primero la tabla para administrar sus columnas.</p>
            <table class="dynamics-data-table">
              <thead><tr><th>Campo</th><th>Tipo</th><th>Habilitado</th><th>Leer</th><th>Crear</th><th>Editar</th><th></th></tr></thead>
              <tbody>
                <tr v-for="field in table.columns" :key="field.logicalName">
                  <td><strong>{{ label(field.labels) || field.logicalName }}</strong><small>{{ field.logicalName }}</small></td>
                  <td>{{ field.type }}<small v-if="field.isCalculated">Calculado</small></td>
                  <template v-if="drafts[table.logicalName + '.' + field.logicalName]">
                    <td><input v-model="drafts[table.logicalName + '.' + field.logicalName]!.enabled" type="checkbox" :disabled="busy || !entityEnabled(table.logicalName)"></td>
                    <td><input v-model="drafts[table.logicalName + '.' + field.logicalName]!.canRead" type="checkbox" :disabled="busy || !entityEnabled(table.logicalName) || !field.canRead"></td>
                    <td><input v-model="drafts[table.logicalName + '.' + field.logicalName]!.canCreate" type="checkbox" :disabled="busy || !entityEnabled(table.logicalName) || !field.canCreate || field.isCalculated"></td>
                    <td><input v-model="drafts[table.logicalName + '.' + field.logicalName]!.canUpdate" type="checkbox" :disabled="busy || !entityEnabled(table.logicalName) || !field.canUpdate || field.isCalculated"></td>
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
      <div v-if="!canSecurity" class="dynamics-feedback dynamics-feedback-error"><ShieldCheck :size="17" /> Consultar registros requiere el scope dynamics.security.admin.</div>
      <template v-else>
        <p v-if="!enabledTables.length" class="dynamics-empty">Primero habilitá una tabla y columnas de lectura en Catálogo.</p>
        <template v-else>
          <div class="dynamics-form-grid">
            <label class="dynamics-field"><span>Tabla</span><select v-model="entity" @change="changeEntity"><option v-for="t in enabledTables" :key="t.logicalName" :value="t.logicalName">{{ label(t.labels) || t.logicalName }} ({{ t.logicalName }})</option></select></label>
            <label class="dynamics-field"><span>Registros por página</span><input v-model.number="pageSize" type="number" min="1" max="100"></label>
          </div>
          <p class="dynamics-subtitle">Seleccioná de 1 a 30 columnas aprobadas.</p>
          <div class="dynamics-check-grid">
            <label v-for="f in approvedFields" :key="f.logicalName" class="dynamics-check"><input v-model="columns" type="checkbox" :value="f.logicalName" :disabled="!columns.includes(f.logicalName) && columns.length >= 30">{{ label(f.labels) || f.logicalName }}</label>
          </div>
          <div class="dynamics-data-card">
            <div class="dynamics-data-card-top"><strong>Filtros estructurados</strong>
              <div class="dynamics-actions"><select v-model="join" aria-label="Combinar filtros"><option value="and">Y (AND)</option><option value="or">O (OR)</option></select>
                <button type="button" class="dynamics-outline-button" :disabled="filters.length>=24" @click="addFilter">+ Añadir filtro</button>
              </div>
            </div>
            <div v-for="(f, i) in filters" :key="f.id" class="dynamics-filter-row">
              <select v-model="f.field" :aria-label="'Campo de filtro '+(i+1)"><option v-for="col in approvedFields" :key="col.logicalName" :value="col.logicalName">{{ col.logicalName }}</option></select>
              <select v-model="f.op" :aria-label="'Operador '+(i+1)"><option v-for="op in ['eq','ne','gt','ge','lt','le','contains']" :key="op" :value="op">{{ op }}</option></select>
              <input v-model="f.value" :aria-label="'Valor '+(i+1)" placeholder="Valor a buscar">
              <button type="button" class="dynamics-outline-button" @click="filters.splice(i,1)">Quitar</button>
            </div>
            <p v-if="filters.length===0" class="dynamics-subtitle">Sin filtros: se mostrarán los primeros resultados autorizados.</p>
          </div>
          <div class="dynamics-tools">
            <label class="dynamics-field"><span>Ordenar por</span><select v-model="orderField"><option value="">Orden predeterminado</option><option v-for="f in approvedFields" :key="f.logicalName" :value="f.logicalName">{{ f.logicalName }}</option></select></label>
            <label class="dynamics-check"><input v-model="descending" type="checkbox" :disabled="!orderField"> Descendente</label>
            <label class="dynamics-check"><input v-model="count" type="checkbox"> Incluir total</label>
            <button type="button" class="dynamics-primary-button" :disabled="busy || !columns.length || !entity" @click="searchRecords()"><Search :size="15" /> Ejecutar consulta</button>
          </div>
          <div class="dynamics-data-card">
            <strong>Guardar consulta reutilizable</strong>
            <div class="dynamics-tools">
              <label class="dynamics-field"><span>Nombre</span><input v-model.trim="savedName" placeholder="cotizaciones_activas" maxlength="40"></label>
              <label class="dynamics-field"><span>Parámetro del primer filtro</span><input v-model.trim="paramName" maxlength="40" placeholder="valor"></label>
              <button type="button" class="dynamics-outline-button" :disabled="busy || !entity" @click="saveQuery">Guardar deshabilitada</button>
            </div>
            <p class="dynamics-subtitle">Las consultas se almacenan en PostgreSQL y requieren activación explícita para clientes M2M.</p>
            <div v-for="item in saved" :key="item.id" class="dynamics-saved-row">
              <div><strong>{{ item.name }}</strong><p class="dynamics-subtitle">{{ item.entityName }} · {{ item.enabled ? 'Activa' : 'Deshabilitada' }}</p></div>
              <div class="dynamics-actions"><button class="dynamics-outline-button" type="button" @click="applySaved(item)">Cargar</button><button class="dynamics-outline-button" type="button" :disabled="busy" @click="toggleSaved(item)">{{ item.enabled ? 'Desactivar' : 'Activar' }}</button></div>
            </div>
          </div>
          <div v-if="page" class="dynamics-data-card">
            <div class="dynamics-data-card-top"><strong>Resultados · página {{ page.page }}</strong><span>{{ page.items.length }} registros · {{ page.count ?? 'total no calculado' }}</span></div>
            <div class="dynamics-scroll"><table class="dynamics-data-table">
              <thead><tr><th v-for="name in lastQuery?.select ?? []" :key="name">{{ name }}</th></tr></thead>
              <tbody><tr v-for="(item, idx) in page.items" :key="idx"><td v-for="name in lastQuery?.select ?? []" :key="name">{{ typeof item[name] === 'object' ? JSON.stringify(item[name]) : (item[name] ?? '—') }}</td></tr></tbody>
            </table></div>
            <p v-if="page.truncated" class="dynamics-subtitle">Límite de páginas alcanzado: los resultados están truncados.</p>
            <button v-if="page.nextCursor" class="dynamics-outline-button" type="button" :disabled="busy" @click="searchRecords(page.nextCursor ?? undefined)">Siguiente página</button>
          </div>
        </template>
      </template>
    </template>
    <template v-else-if="section === 'crud'">
      <div class="dynamics-security-note"><AlertTriangle :size="17" />
        <span>{{ canWrite ? 'Escrituras autorizadas para este entorno. Todas requieren confirmación de Dataverse.' : 'CREATE, UPDATE y DELETE están bloqueados en este entorno o no se pudo verificar su aprobación.' }}</span>
      </div>
      <div v-if="!canSecurity" class="dynamics-feedback dynamics-feedback-error">Requiere dynamics.security.admin.</div>
      <template v-else>
        <div class="dynamics-form-grid">
          <label class="dynamics-field"><span>Tabla aprobada</span><select v-model="entity" @change="changeEntity"><option v-for="t in enabledTables" :key="t.logicalName" :value="t.logicalName">{{ t.logicalName }}</option></select></label>
          <label class="dynamics-field"><span>Operación</span><select v-model="crudMode" @change="resetRecord"><option value="create">CREATE · nuevo registro</option><option value="update">UPDATE · editar</option><option value="delete">DELETE · eliminar</option></select></label>
        </div>
        <div v-if="crudMode !== 'create'" class="dynamics-data-card">
          <div class="dynamics-tools">
            <label class="dynamics-field"><span>GUID del registro</span><input v-model.trim="recordId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></label>
            <button class="dynamics-outline-button" type="button" :disabled="busy || !recordId" @click="loadRecord">Cargar registro y ETag</button>
            <label class="dynamics-field"><span>ETag (solo lectura)</span><input :value="etag" readonly placeholder="Se obtiene de Dataverse"></label>
          </div>
        </div>
        <template v-if="crudMode !== 'delete'">
          <p class="dynamics-subtitle">Solo se muestran campos con permisos de {{ crudMode === 'create' ? 'creación' : 'edición' }}. Vacío significa NULL en campos opcionales.</p>
          <div class="dynamics-check-grid"><label v-for="f in writableFields" :key="f.logicalName" class="dynamics-check"><input v-model="writeFields" type="checkbox" :value="f.logicalName">{{ label(f.labels) || f.logicalName }}</label></div>
          <div v-for="name in writeFields" :key="name" class="dynamics-data-card">
            <template v-if="writableFields.find(f => f.logicalName === name)">
              <label class="dynamics-field">
                <span>{{ name }} ({{ writableFields.find(f => f.logicalName === name)?.type }})</span>
                <select v-if="writableFields.find(f => f.logicalName === name)?.choices.length" v-model="writeValues[name]">
                  <option value="">Seleccionar opción</option><option v-for="option in writableFields.find(f => f.logicalName === name)?.choices" :key="option.value" :value="String(option.value)">{{ label(option.labels) || option.value }}</option>
                </select>
                <select v-else-if="writableFields.find(f => f.logicalName === name)?.type === 'Boolean'" v-model="writeValues[name]"><option value="">Seleccionar</option><option value="true">Verdadero</option><option value="false">Falso</option></select>
                <input v-else v-model="writeValues[name]" :placeholder="['Lookup','Customer','Owner'].includes(writableFields.find(f => f.logicalName === name)?.type ?? '') ? 'GUID de referencia' : 'Valor del campo'">
              </label>
              <label v-if="lookupRelations(writableFields.find(f => f.logicalName === name)!).length" class="dynamics-field"><span>Relación de Dataverse</span>
                <select v-model="navByField[name]"><option value="">Seleccionar relación</option>
                  <option v-for="relation in lookupRelations(writableFields.find(f => f.logicalName === name)!)" :key="relation.schemaName" :value="relation.referencingNavigation ?? ''">{{ relation.referencingNavigation }} · {{ relation.referencedEntity }}</option>
                </select></label>
            </template>
          </div>
        </template>
        <div v-else class="dynamics-data-card">
          <p class="dynamics-subtitle">El borrado solo es posible con política habilitada, permiso específico, ETag y motivo. No se puede deshacer.</p>
          <p v-if="!deletePolicy?.enabled" class="dynamics-feedback dynamics-feedback-error">La política de borrado de esta tabla está deshabilitada.</p>
          <label class="dynamics-check"><input v-model="confirmed" type="checkbox"> Confirmo que el registro identificado será eliminado</label>
          <label class="dynamics-field"><span>Escribí ELIMINAR</span><input v-model="deletePhrase" placeholder="ELIMINAR"></label>
          <label class="dynamics-field"><span>Motivo (mínimo 10 caracteres)</span><textarea v-model="deleteReason" rows="3"></textarea></label>
        </div>
        <div class="dynamics-tools">
          <button class="dynamics-primary-button" type="button" :disabled="busy || lockedWrite || !canWrite || (crudMode==='delete' && (!canDelete || !deletePolicy?.enabled))" @click="submitWrite">Ejecutar {{ crudMode.toUpperCase() }}</button>
          <button class="dynamics-outline-button" type="button" :disabled="busy" @click="newWrite">Nueva operación</button>
        </div>
        <p v-if="lockedWrite" class="dynamics-subtitle">La operación quedó cerrada en esta pantalla para evitar reenvíos. Revisá su identificador y auditoría antes de cualquier nueva intención.</p>
        <pre v-if="writeResult" class="dynamics-json">{{ JSON.stringify(writeResult, null, 2) }}</pre>
      </template>
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
        <div class="dynamics-data-card"><div class="dynamics-data-card-top"><strong>Aplicaciones M2M registradas</strong><button class="dynamics-outline-button" type="button" :disabled="busy" @click="run(loadGrants)">Actualizar</button></div>
          <p v-if="!clients.length" class="dynamics-subtitle">No hay aplicaciones M2M registradas. Registralas con el administrador del conector antes de asignar grants.</p>
          <div v-for="client in clients" :key="client.id" class="dynamics-saved-row">
            <div><strong>{{ client.displayName }}</strong><p class="dynamics-subtitle">{{ client.clientId }} · {{ client.enabled ? 'Habilitada' : 'Deshabilitada' }}</p></div>
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
          <div v-for="grant in grants" :key="grant.id" class="dynamics-saved-row">
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
@media(max-width:760px){.dynamics-form-grid{grid-template-columns:1fr}.dynamics-filter-row{grid-template-columns:1fr 1fr}.dynamics-filter-row input{grid-column:1/-1}}
</style>

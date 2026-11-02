<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Database, FileJson2,
  Globe2, KeyRound, Pencil, Plus, Power, RefreshCw, ShieldCheck, Trash2,
} from 'lucide-vue-next'
import { fetchClient } from '@/core/api/fetchConfig'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhTextarea from '@/shared/components/atoms/DhTextarea.vue'
import DhCheckbox from '@/shared/components/atoms/DhCheckbox.vue'
import DhDrawer from '@/shared/components/organisms/DhDrawer.vue'
import DhModal from '@/shared/components/organisms/DhModal.vue'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
type Mapping = { public: string; internal: string; required: boolean }
type ApprovedTarget = {
  code: string; service: string; method: HttpMethod; path: string
  description: string; ready?: boolean
}
type PublishedEndpoint = {
  id: string; name: string; slug: string; target: string
  inputs: Mapping[]; outputs: Mapping[]; responseRoot: string | null; enabled: boolean
}
type KeyInfo = {
  id: string; label: string; prefix: string; active: boolean; expiresAt: string
  maxRequestsPerMinute: number; createdAt: string; lastUsedAt: string | null
}

const root = '/api/integrations/third-party'
const base = (import.meta.env.VITE_API_URL || 'https://api.logisticacastrofallas.com').replace(/\/+$/, '')
const endpoints = ref<PublishedEndpoint[]>([])
const catalog = ref<ApprovedTarget[]>([])
const keys = ref<KeyInfo[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const search = ref('')
const drawer = ref(false)
const step = ref(1)
const method = ref<HttpMethod>('GET')
const service = ref('pricing')
const jsonExample = ref('')
const advanced = ref(false)
const slugCustomized = ref(false)
const keyName = ref('')
const expiresDays = ref('90')
const maxPerMinute = ref('30')
const secretModal = ref(false)
const issuedSecret = ref('')
const issuedLabel = ref('')
const confirmRevoke = ref<KeyInfo | null>(null)

const METHODS: { value: HttpMethod; label: string; detail: string }[] = [
  { value: 'GET', label: 'Consultar', detail: 'Obtener información' },
  { value: 'POST', label: 'Crear', detail: 'Registrar información nueva' },
  { value: 'PUT', label: 'Actualizar', detail: 'Modificar un registro' },
  { value: 'DELETE', label: 'Eliminar', detail: 'Eliminar información' },
]
const blank = (): PublishedEndpoint => ({
  id: '', name: '', slug: '', target: '', inputs: [], outputs: [], responseRoot: null, enabled: false,
})
const draft = ref<PublishedEndpoint>(blank())
const isNew = computed(() => !draft.value.id)
const selectedTarget = computed(() => catalog.value.find(t => t.code === draft.value.target))
const ready = computed(() => selectedTarget.value?.ready === true)
const services = computed(() => [...new Set(catalog.value.map(t => t.service))].map(s => ({
  label: s.toUpperCase(), value: s,
})))
const operations = computed(() =>
  catalog.value.filter(t => t.service === service.value && t.method === method.value))
const filtered = computed(() => endpoints.value.filter(x =>
  [x.name, x.slug, x.target].join(' ').toLowerCase().includes(search.value.toLowerCase())))
const externalUrl = (x: PublishedEndpoint) => base + '/api/external/' + (x.slug || 'mi-api') +
  (catalog.value.find(t => t.code === x.target)?.path.includes('{id}') ? '/{id}' : '')
const example = computed(() => {
  if (!selectedTarget.value) return ''
  const target = selectedTarget.value
  const address = externalUrl(draft.value)
  const query = target.method === 'GET' && draft.value.inputs.length
    ? '?' + draft.value.inputs.map(f => encodeURIComponent(f.public) + '=valor').join('&')
    : ''
  const body = target.method !== 'GET' && draft.value.inputs.length
    ? ' \\\n  -H "Content-Type: application/json" \\\n  -d ' +
      "'" + JSON.stringify(Object.fromEntries(draft.value.inputs.map(f =>
        [f.public, f.public === 'ids' ? ['ID_DEL_REGISTRO'] : 'valor']))) + "'"
    : ''
  const idempotency = target.method === 'POST'
    ? ' \\\n  -H "Idempotency-Key: solicitud-unica-12345678"' : ''
  return 'curl -X ' + target.method + ' "' + address + query + '" \\\n' +
    '  -H "X-Api-Key: TU_API_KEY"' + idempotency + body
})

watch(() => draft.value.name, name => {
  if (!isNew.value || slugCustomized.value) return
  draft.value.slug = slugify(name)
})

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
}
function methodName(value: string) {
  return METHODS.find(m => m.value === value)?.label || value
}
function targetName(value: ApprovedTarget): string {
  if (value.code === 'pricing-usd-crc') return 'Tipo de cambio USD / CRC'
  if (value.code === 'pricing-rate-detail') return 'Consultar una tarifa por ID'
  if (value.code === 'pricing-rates-list') return 'Consultar listado de tarifas'
  if (value.code === 'pricing-rate-create') return 'Crear tarifa'
  if (value.code === 'pricing-rate-update') return 'Actualizar tarifa por ID'
  if (value.code === 'pricing-rate-delete') return 'Eliminar tarifas por ID'
  return value.description || 'Función del módulo'
}
function targetHelp(value: ApprovedTarget): string {
  switch (value.code) {
    case 'pricing-usd-crc': return 'Compartir el precio de compra y venta del dólar.'
    case 'pricing-rate-detail': return 'El tercero consulta una tarifa indicando su identificador.'
    case 'pricing-rates-list': return 'El tercero consulta una lista de tarifas disponibles para su acceso.'
    case 'pricing-rate-create': return 'El tercero envía los datos para registrar una nueva tarifa.'
    case 'pricing-rate-update': return 'El tercero envía cambios a una tarifa existente.'
    case 'pricing-rate-delete': return 'El tercero solicita eliminar tarifas por identificador.'
    default: return 'Compartir esta función con un sistema externo.'
  }
}
function initialOutputs(code: string): Mapping[] {
  if (code === 'pricing-usd-crc') return [
    { public: 'compra', internal: 'purchase', required: false },
    { public: 'venta', internal: 'sale', required: false },
    { public: 'fecha', internal: 'rateDate', required: false },
  ]
  if (code === 'pricing-rate-detail' || code === 'pricing-rates-list') return [
    { public: 'id', internal: 'id', required: false },
    { public: 'estado', internal: 'status', required: false },
  ]
  return []
}
function create() {
  draft.value = blank()
  service.value = catalog.value[0]?.service || 'pricing'
  method.value = 'GET'
  step.value = 1
  advanced.value = false
  slugCustomized.value = false
  jsonExample.value = ''
  keys.value = []
  keyName.value = ''
  error.value = ''
  notice.value = ''
  pickOnlyAvailableAction()
  drawer.value = true
}
function edit(row: PublishedEndpoint) {
  draft.value = structuredClone(row)
  const target = catalog.value.find(t => t.code === row.target)
  service.value = target?.service || 'pricing'
  method.value = target?.method || 'GET'
  step.value = 2
  advanced.value = false
  slugCustomized.value = true
  jsonExample.value = ''
  keys.value = []
  keyName.value = ''
  error.value = ''
  drawer.value = true
  void loadKeys(row.id)
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
  pickOnlyAvailableAction()
}
function chooseService(value: string | number) {
  if (service.value === String(value)) return
  service.value = String(value)
  draft.value.target = ''
  draft.value.inputs = []
  draft.value.outputs = []
  pickOnlyAvailableAction()
}
function renameField(kind: 'inputs' | 'outputs', index: number, value: string) {
  const field = draft.value[kind][index]
  if (!field) return
  if (!field.internal || field.internal === field.public) field.internal = value
  field.public = value
}
function chooseTarget(target: ApprovedTarget) {
  if (draft.value.target === target.code) return
  draft.value.target = target.code
  draft.value.inputs = target.code === 'pricing-rate-delete'
    ? [{ public: 'ids', internal: 'ids', required: true }] : []
  draft.value.outputs = initialOutputs(target.code)
  draft.value.responseRoot = null
  if (isNew.value && !draft.value.name) draft.value.name = targetName(target)
}
function validFields(fields: Mapping[]): boolean {
  return fields.every(f => /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(f.public)
    && /^[A-Za-z][A-Za-z0-9_.]{0,159}$/.test(f.internal)) &&
    new Set(fields.map(f => f.public)).size === fields.length
}
function addField(kind: 'inputs' | 'outputs') {
  draft.value[kind].push({ public: '', internal: '', required: false })
}
function removeField(kind: 'inputs' | 'outputs', i: number) { draft.value[kind].splice(i, 1) }
function importJson() {
  error.value = ''
  try {
    const parsed: unknown = JSON.parse(jsonExample.value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      error.value = 'Pegá un objeto JSON, por ejemplo {"clienteId":"...","monto":100}.'; return
    }
    const fields = Object.keys(parsed).map(key => ({ public: key, internal: key, required: false }))
    if (!fields.length || !validFields(fields) || fields.length > 64) {
      error.value = 'El JSON debe tener de 1 a 64 campos con nombres válidos.'; return
    }
    draft.value.inputs = fields
    notice.value = 'Campos detectados. Podés editarlos antes de guardar.'
  } catch { error.value = 'El ejemplo no es un JSON válido. Revisá las comillas y las llaves.' }
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
    if (!d.name.trim() || !/^[a-z][a-z0-9-]{2,63}$/.test(d.slug)) {
      error.value = 'Ingresá un nombre y una ruta de al menos 3 caracteres, con letras, números o guiones.'; return
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
  try {
    const [saved, targets] = await Promise.all([
      fetchClient<PublishedEndpoint[]>(root + '/endpoints', { method: 'GET' }),
      fetchClient<ApprovedTarget[]>(root + '/catalog', { method: 'GET' }),
    ])
    endpoints.value = saved
    catalog.value = targets
  } catch (e) { error.value = e instanceof Error ? e.message : 'No fue posible cargar las APIs.' }
  finally { loading.value = false }
}
async function loadKeys(id: string) {
  try { keys.value = await fetchClient<KeyInfo[]>(root + '/endpoints/' + encodeURIComponent(id) + '/keys', { method: 'GET' }) }
  catch (e) { error.value = e instanceof Error ? e.message : 'No fue posible cargar las claves.' }
}
async function save() {
  error.value = ''
  const d = draft.value
  if (!selectedTarget.value || !d.name.trim() || !/^[a-z][a-z0-9-]{2,63}$/.test(d.slug) ||
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
        body: { ...d, responseRoot: d.responseRoot || null },
      })
    draft.value = created
    await load()
    await loadKeys(created.id)
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
    if (updated && draft.value.id === row.id) draft.value = structuredClone(updated)
    notice.value = row.enabled ? 'API desactivada y claves revocadas.' : 'API publicada. Ya podés crear una clave.'
  } catch (e) { error.value = e instanceof Error ? e.message : 'No se pudo cambiar el estado.' }
  finally { saving.value = false }
}
async function issueKey() {
  error.value = ''
  if (!draft.value.id || !draft.value.enabled || !keyName.value.trim()) {
    error.value = 'Publicá la API e ingresá el nombre de la aplicación externa.'; return
  }
  const days = Number(expiresDays.value)
  const quota = Number(maxPerMinute.value)
  if (!Number.isInteger(days) || days < 1 || days > 365 || !Number.isInteger(quota) || quota < 1 || quota > 300) {
    error.value = 'Vigencia: 1 a 365 días. Solicitudes por minuto: 1 a 300.'; return
  }
  saving.value = true
  try {
    const issued = await fetchClient<{ id: string; apiKey: string }>(
      root + '/endpoints/' + encodeURIComponent(draft.value.id) + '/keys', {
        method: 'POST', body: { label: keyName.value.trim(), expiresInDays: days, maxRequestsPerMinute: quota },
      })
    issuedSecret.value = issued.apiKey
    issuedLabel.value = keyName.value
    keyName.value = ''
    secretModal.value = true
    await loadKeys(draft.value.id)
  } catch (e) { error.value = e instanceof Error ? e.message : 'No fue posible emitir la clave.' }
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
    await loadKeys(draft.value.id)
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
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Dhole · APIs</p>
        <h1 class="mt-1 text-2xl font-black">Rutas para terceros</h1>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Creá y administrá APIs GET, POST, PUT y DELETE con una dirección y clave propias.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <DhButton variant="secondary" :icon="RefreshCw" label="Actualizar" :loading="loading" @click="load" />
        <DhButton :icon="Plus" label="Crear API" @click="create" />
      </div>
    </header>

    <div v-if="error && !drawer" role="alert" class="rounded-xl border border-red-400/40 p-3 text-sm text-red-500">{{ error }}</div>
    <div v-if="notice && !drawer" role="status" class="rounded-xl border border-[var(--dh-border)] p-3 text-sm">{{ notice }}</div>

    <section class="overflow-hidden rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] p-4">
        <div>
          <h2 class="font-bold">Mis rutas</h2>
          <p class="text-xs text-[var(--dh-text-muted)]">Cada ruta tiene un método, un módulo y su propia API Key.</p>
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
              <td class="p-3"><strong class="block">{{ row.name }}</strong><code class="text-xs text-[var(--dh-text-muted)]">{{ '/api/external/' + row.slug }}</code></td>
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
                <strong class="text-[var(--dh-text)]">{{ loading ? 'Cargando rutas...' : 'Aún no hay APIs creadas' }}</strong>
                <span v-if="!loading" class="text-xs">Creá una ruta para compartir funciones de Dhole con otro sistema.</span>
                <DhButton v-if="!loading && !search" :icon="Plus" label="Crear mi primera API" @click="create" />
              </div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <DhDrawer :open="drawer" :title="isNew ? 'Nueva API' : 'Administrar · ' + draft.name" size="xl" @close="drawer = false">
      <div class="flex flex-col gap-5">
        <div class="grid grid-cols-3 gap-2">
          <button v-for="item in [{ n: 1, title: 'Operación' }, { n: 2, title: 'Ruta y datos' }, { n: 3, title: 'Revisar' }]"
            :key="item.n" type="button" class="rounded-xl border px-3 py-3 text-left text-xs transition"
            :class="step === item.n ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10 text-[var(--dh-text)]' : 'border-[var(--dh-border)] text-[var(--dh-text-muted)]'"
            :disabled="item.n > step" @click="step = item.n">
            <span class="block font-bold">{{ item.n }}. {{ item.title }}</span>
          </button>
        </div>

        <div v-if="error" role="alert" class="rounded-xl border border-red-400/40 p-3 text-sm text-red-500">{{ error }}</div>
        <div v-if="notice" role="status" class="rounded-xl border border-[var(--dh-border)] p-3 text-sm">{{ notice }}</div>

        <template v-if="step === 1">
          <section class="space-y-3">
            <div>
              <h3 class="font-bold">¿Qué querés hacer?</h3>
              <p class="text-xs text-[var(--dh-text-muted)]">Elegí el tipo de solicitud que podrá realizar el sistema externo.</p>
            </div>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button v-for="option in METHODS" :key="option.value" type="button"
                class="rounded-xl border p-3 text-left transition hover:border-[var(--dh-primary)]"
                :class="method === option.value ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10' : 'border-[var(--dh-border)]'"
                @click="chooseMethod(option.value)">
                <span class="block font-mono text-sm font-black">{{ option.value }}</span>
                <span class="mt-2 block text-sm font-semibold">{{ option.label }}</span>
                <span class="mt-1 block text-xs text-[var(--dh-text-muted)]">{{ option.detail }}</span>
              </button>
            </div>
          </section>
          <section class="space-y-3">
            <div class="space-y-2">
              <h3 class="text-xs font-bold uppercase tracking-wide text-[var(--dh-text-muted)]">¿En qué módulo de Dhole?</h3>
              <div class="flex flex-wrap gap-2">
                <button v-for="option in services" :key="option.value" type="button"
                  class="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:border-[var(--dh-primary)]"
                  :class="service === option.value ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10' : 'border-[var(--dh-border)]'"
                  @click="chooseService(option.value)">
                  <Database class="h-4 w-4" />{{ option.label }}
                </button>
              </div>
            </div>
            <div v-if="operations.length > 1">
              <h3 class="font-bold">¿Qué información querés compartir?</h3>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Elegí lo que necesita consultar el otro sistema. Dhole se ocupa de la conexión.</p>
            </div>
            <div v-if="operations.length > 1" class="grid gap-2">
              <button v-for="item in operations" :key="item.code" type="button"
                class="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:border-[var(--dh-primary)]"
                :class="draft.target === item.code ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10' : 'border-[var(--dh-border)]'"
                @click="chooseTarget(item)">
                <span class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--dh-border)]">
                  <Check v-if="draft.target === item.code" class="h-3.5 w-3.5" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block font-semibold">{{ targetName(item) }}</span>
                  <span class="mt-1 block text-xs text-[var(--dh-text-muted)]">{{ targetHelp(item) }}</span>
                </span>
              </button>
            </div>
            <div v-else-if="operations.length === 1" class="flex items-start gap-3 rounded-xl border border-[var(--dh-border)] p-4">
              <CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
              <div>
                <strong class="block">{{ targetName(operations[0]!) }}</strong>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ targetHelp(operations[0]!) }} No tenés que configurar nada técnico.</p>
              </div>
            </div>
            <div v-else class="rounded-xl border border-dashed border-[var(--dh-border)] p-5 text-sm text-[var(--dh-text-muted)]">
              Esta acción todavía no está disponible en el módulo seleccionado. Probá otra combinación.
            </div>
          </section>
        </template>

        <template v-else-if="step === 2">
          <section class="space-y-3">
            <div>
              <h3 class="font-bold">Nombre y dirección pública</h3>
              <p class="text-xs text-[var(--dh-text-muted)]">El nombre es para identificarla; la ruta es lo que utilizará el tercero.</p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <DhInput v-model="draft.name" label="Nombre de la API" placeholder="Consulta de tarifas" />
              <DhInput v-model="draft.slug" label="Ruta pública" placeholder="consulta-tarifas" @update:model-value="slugCustomized = true" />
            </div>
            <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
              <div class="mb-1 text-xs font-bold uppercase text-[var(--dh-text-muted)]">Así la llamará el tercero</div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-lg border border-[var(--dh-border)] px-2 py-1 font-mono text-xs font-bold">{{ method }}</span>
                <code class="min-w-0 flex-1 break-all text-xs">{{ externalUrl(draft) }}</code>
                <DhButton variant="ghost" size="sm" :icon="Copy" label="Copiar" @click="copy(externalUrl(draft))" />
              </div>
              <p v-if="selectedTarget?.path.includes('{id}')" class="mt-2 text-xs text-[var(--dh-text-muted)]">El valor {id} se reemplaza por el identificador real del registro.</p>
            </div>
            <button type="button" class="text-left text-xs font-semibold text-[var(--dh-primary)]" @click="advanced = !advanced">
              {{ advanced ? 'Ocultar configuración avanzada' : 'Mostrar configuración avanzada' }}
            </button>
          </section>
          <section class="space-y-3 border-t border-[var(--dh-border)] pt-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div><h3 class="font-bold">Datos que recibe</h3><p class="text-xs text-[var(--dh-text-muted)]">{{ method === 'GET' ? 'Filtros opcionales en la URL (query).' : 'Campos permitidos del cuerpo JSON.' }}</p></div>
              <DhButton variant="secondary" size="sm" :icon="Plus" label="Añadir campo" @click="addField('inputs')" />
            </div>
            <div v-if="method !== 'GET'" class="space-y-2 rounded-xl border border-[var(--dh-border)] p-3">
              <DhTextarea v-model="jsonExample" :rows="3" label="¿Ya tenés un JSON de ejemplo? (opcional)" placeholder='{"clienteId":"...","monto":100}' />
              <DhButton size="sm" variant="secondary" :icon="FileJson2" label="Generar campos desde JSON" :disabled="!jsonExample.trim()" @click="importJson" />
            </div>
            <div v-if="!draft.inputs.length" class="rounded-xl border border-dashed border-[var(--dh-border)] p-3 text-xs text-[var(--dh-text-muted)]">
              No hay campos definidos. {{ method === 'GET' ? 'Podés dejarlo así si no requiere filtros.' : 'Si la función requiere un cuerpo JSON, añadí sus campos o pegá un ejemplo.' }}
            </div>
            <div v-for="(field, i) in draft.inputs" :key="'in-' + i" class="grid items-end gap-2 rounded-xl border border-[var(--dh-border)] p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <DhInput :model-value="field.public" label="Dato que recibe" placeholder="clienteId" @update:model-value="renameField('inputs', i, String($event))" />
              <DhInput v-if="advanced" v-model="field.internal" label="Nombre dentro de Dhole" placeholder="clientId" />
              <DhCheckbox v-model="field.required" label="Requerido" />
              <DhButton variant="ghost" :icon="Trash2" size="sm" label="Quitar" @click="removeField('inputs', i)" />
            </div>
          </section>
          <section class="space-y-3 border-t border-[var(--dh-border)] pt-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div><h3 class="font-bold">Datos que devuelve</h3><p class="text-xs text-[var(--dh-text-muted)]">Elegí exactamente qué información puede ver el tercero.</p></div>
              <DhButton variant="secondary" size="sm" :icon="Plus" label="Añadir campo" @click="addField('outputs')" />
            </div>
            <div v-if="method !== 'GET' && !draft.outputs.length" class="rounded-xl border border-[var(--dh-border)] p-3 text-xs text-[var(--dh-text-muted)]">Opcional para {{ method }}. Si no agregás campos, la respuesta será un objeto vacío cuando el servicio devuelva JSON.</div>
            <div v-for="(field, i) in draft.outputs" :key="'out-' + i" class="grid items-end gap-2 rounded-xl border border-[var(--dh-border)] p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <DhInput :model-value="field.public" label="Dato que devuelve" placeholder="estado" @update:model-value="renameField('outputs', i, String($event))" />
              <DhInput v-if="advanced" v-model="field.internal" label="Nombre dentro de Dhole" placeholder="status" />
              <DhButton variant="ghost" :icon="Trash2" size="sm" label="Quitar" @click="removeField('outputs', i)" />
            </div>
            <div v-if="advanced" class="rounded-xl border border-[var(--dh-border)] p-3">
              <DhInput v-model="draft.responseRoot" label="Ubicación de los datos en el JSON (opcional)" placeholder="data.items" />
              <p class="mt-2 text-xs text-[var(--dh-text-muted)]">Usalo si la respuesta del servicio viene dentro de una propiedad, por ejemplo data o data.items.</p>
            </div>
          </section>
        </template>

        <template v-else>
          <section class="space-y-3">
            <h3 class="font-bold">Revisá tu ruta</h3>
            <div class="grid grid-cols-2 gap-3 rounded-xl border border-[var(--dh-border)] p-4 text-sm">
              <div><span class="block text-xs text-[var(--dh-text-muted)]">Nombre</span><strong>{{ draft.name }}</strong></div>
              <div><span class="block text-xs text-[var(--dh-text-muted)]">Operación</span><strong>{{ method }} · {{ methodName(method) }}</strong></div>
              <div><span class="block text-xs text-[var(--dh-text-muted)]">Módulo</span><strong class="uppercase">{{ service }}</strong></div>
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
          <section v-if="draft.id" class="space-y-4 border-t border-[var(--dh-border)] pt-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div><h3 class="font-bold">Publicación</h3><p class="text-xs text-[var(--dh-text-muted)]">Activá la ruta solo después de revisar sus permisos.</p></div>
              <DhButton :icon="draft.enabled ? Power : CheckCircle2" :label="draft.enabled ? 'Desactivar' : 'Publicar API'" :disabled="saving || (!draft.enabled && !ready)" @click="toggle(draft)" />
            </div>
            <template v-if="draft.enabled">
              <div class="border-t border-[var(--dh-border)] pt-4">
                <h3 class="flex items-center gap-2 font-bold"><KeyRound class="h-4 w-4" /> Acceso del tercero</h3>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Cada aplicación recibe su propia clave. Se mostrará una sola vez.</p>
                <div class="mt-3 grid gap-3 sm:grid-cols-3">
                  <DhInput v-model="keyName" label="Aplicación" placeholder="Portal externo" />
                  <DhInput v-model="expiresDays" label="Vigencia (días)" type="number" min="1" max="365" />
                  <DhInput v-model="maxPerMinute" label="Solicitudes/min" type="number" min="1" max="300" />
                </div>
                <DhButton class="mt-3" :icon="KeyRound" label="Generar API Key" :disabled="saving" :loading="saving" @click="issueKey" />
              </div>
              <div v-for="key in keys" :key="key.id" class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dh-border)] p-3">
                <div><strong class="block text-sm">{{ key.label }}</strong><code class="text-xs text-[var(--dh-text-muted)]">{{ key.prefix }}… · {{ key.maxRequestsPerMinute }}/min · {{ key.active ? 'Activa' : 'Revocada' }}</code></div>
                <DhButton v-if="key.active" size="sm" variant="danger" :icon="Trash2" label="Revocar" @click="confirmRevoke = key" />
              </div>
            </template>
          </section>
        </template>

        <div class="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t border-[var(--dh-border)] bg-[var(--dh-shell)] py-3">
          <DhButton variant="secondary" :icon="ArrowLeft" :label="step === 1 ? 'Cerrar' : 'Atrás'" @click="step === 1 ? drawer = false : step--" />
          <div class="flex flex-wrap gap-2">
            <DhButton v-if="step === 1 || step === 2" :icon="ArrowRight" label="Continuar" @click="next" />
            <DhButton v-else :icon="Check" :label="isNew ? 'Guardar borrador' : 'Guardar cambios'" :loading="saving" :disabled="saving" @click="save" />
            <DhButton v-if="step === 3 && draft.id" variant="secondary" label="Cerrar" @click="drawer = false" />
          </div>
        </div>
      </div>
    </DhDrawer>

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

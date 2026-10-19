<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/core/stores/authStore'
import { fetchClient } from '@/core/api/fetchConfig'

type Connection = {
  id: string
  code: string
  dataverseUrl: string
  tenantId: string
  clientId: string
  defaultCurrencyId: string | null
  updatedAt: string
}
type DataverseHealth = { connected: boolean; applicationUserId: string; canReadQuotes: boolean }
type Tab = 'connections' | 'operations' | 'audit'

const auth = useAuthStore()
const canAdmin = computed(() => auth.hasScope('dynamics.admin') || auth.hasScope('dynamics.security.admin'))
const canSecurity = computed(() => auth.hasScope('dynamics.security.admin'))
const connections = ref<Connection[]>([])
const activeTab = ref<Tab>('connections')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const testResults = reactive<Record<string, string>>({})
const diagnostics = ref<unknown>(null)
const records = ref<unknown>(null)
const selectedOperation = ref<'overview' | 'jobs' | 'audit'>('overview')
const form = reactive({
  code: '', dataverseUrl: '', tenantId: '', clientId: '', clientSecret: '', defaultCurrencyId: '',
})
const editing = ref(false)
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const secureHostPattern = /^https:\/\/[a-z0-9-]+\.crm[0-9]*\.dynamics\.com\/?$/i

async function request<T>(path: string, method: 'GET'|'POST'|'PUT'='GET', body?: unknown): Promise<T> {
  if (!canAdmin.value) throw new Error('No tenés el permiso dynamics.admin.')
  if (!path.startsWith('/api/dynamics-admin/')) throw new Error('Ruta inválida.')
  const options = method === 'GET' ? { method } : { method, ...(body === undefined ? {} : { body }) }
  return fetchClient<T>(path, options)
}
function readableError(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  return 'La operación no se pudo completar.'
}
function clearForm() {
  Object.assign(form, { code:'', dataverseUrl:'', tenantId:'', clientId:'', clientSecret:'', defaultCurrencyId:'' })
  editing.value = false
}
async function refreshConnections() {
  loading.value = true
  error.value = ''
  try {
    connections.value = await request<Connection[]>('/api/dynamics-admin/connections')
  } catch (reason) { error.value = readableError(reason) }
  finally { loading.value = false }
}
function edit(item: Connection) {
  editing.value = true
  Object.assign(form, {
    code: item.code, dataverseUrl: item.dataverseUrl, tenantId: item.tenantId,
    clientId: item.clientId, defaultCurrencyId: item.defaultCurrencyId || '', clientSecret: '',
  })
  activeTab.value = 'connections'
}
function validate() {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(form.code.trim())) throw new Error('El código debe contener letras, números, guiones o _.')
  if (!secureHostPattern.test(form.dataverseUrl.trim())) throw new Error('La URL debe ser HTTPS y pertenecer a tu organización crm.dynamics.com.')
  if (!guidPattern.test(form.tenantId.trim()) || !guidPattern.test(form.clientId.trim()))
    throw new Error('Tenant ID y Client ID deben ser GUID válidos de Microsoft.')
  if (form.defaultCurrencyId.trim() && !guidPattern.test(form.defaultCurrencyId.trim()))
    throw new Error('Default Currency ID debe ser un GUID válido o quedar vacío.')
  if (!form.clientSecret.trim()) throw new Error('Ingresá el valor real de Client Secret.')
}
async function save() {
  error.value = ''
  notice.value = ''
  try { validate() } catch(reason) { error.value = readableError(reason); return }
  saving.value = true
  try {
    await request('/api/dynamics-admin/connections', 'POST', {
      code: form.code.trim(),
      dataverseUrl: form.dataverseUrl.trim(),
      tenantId: form.tenantId.trim(),
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret,
      defaultCurrencyId: form.defaultCurrencyId.trim() || null,
    })
    // Never cache/echo secrets. The API encrypts the value at rest.
    clearForm()
    notice.value = 'La conexión se guardó en la base de Dynamics.'
    await refreshConnections()
  } catch(reason) { error.value = readableError(reason) }
  finally { form.clientSecret = ''; saving.value = false }
}
async function testConnection(code: string) {
  error.value = ''
  testResults[code] = 'Comprobando acceso a Dataverse...'
  try {
    const result = await request<DataverseHealth>('/api/dynamics-admin/connections/' + encodeURIComponent(code) + '/test', 'POST')
    testResults[code] = result.connected
      ? 'Conectado. Usuario: ' + result.applicationUserId + ' · Leer cotizaciones: ' + (result.canReadQuotes ? 'Sí' : 'No')
      : 'La aplicación no pudo conectar.'
  } catch(reason) { testResults[code] = 'Falló: ' + readableError(reason) }
}
async function rotateSecret(code: string) {
  // Secret is prompted just in time and never written to the DOM or logs.
  const secret = window.prompt('Nuevo Client Secret VALUE para ' + code + ' (evitá hacerlo en un equipo compartido):')
  if (secret === null) return
  if (!secret.trim()) { error.value = 'El secreto no puede estar vacío.'; return }
  saving.value = true
  error.value = ''
  try {
    await request('/api/dynamics-admin/connections/' + encodeURIComponent(code) + '/secret', 'PUT', {clientSecret: secret})
    notice.value = 'Se rotó el secreto de ' + code + '.'
  } catch(reason) { error.value = readableError(reason) }
  finally { saving.value = false }
}
async function loadOperational(kind: 'overview'|'jobs'|'audit') {
  error.value = ''
  selectedOperation.value = kind
  loading.value = true
  try {
    const path = kind === 'overview' ? '/api/dynamics-admin/console/overview'
      : '/api/dynamics-admin/console/' + kind + '?limit=25'
    const data = await request<unknown>(path)
    if (kind === 'overview') diagnostics.value = data
    else records.value = data
  } catch(reason) { error.value = readableError(reason) }
  finally { loading.value = false }
}
const output = computed(() => JSON.stringify(selectedOperation.value === 'overview' ? diagnostics.value : records.value, null, 2))
onMounted(() => { if (canAdmin.value) void refreshConnections() })
</script>

<template>
  <div class="space-y-6 pb-10">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-[var(--dh-text-primary,#142233)]">Dynamics 365</h1>
        <p class="mt-1 text-sm opacity-70">Administración de conexiones a Microsoft Dataverse desde DholeSystem.</p>
      </div>
      <span class="rounded-full border px-3 py-1 text-xs font-semibold">{{ canSecurity ? 'Administrador de seguridad' : 'Administrador Dynamics' }}</span>
    </div>

    <p v-if="!canAdmin" role="alert" class="rounded-lg border border-red-300 p-4 text-red-700">
      No tenés el scope dynamics.admin ni dynamics.security.admin.
    </p>
    <template v-else>
      <nav aria-label="Secciones de Dynamics" class="flex flex-wrap gap-2 border-b pb-3">
        <button v-for="tab in (['connections','operations','audit'] as Tab[])" :key="tab"
          type="button" :aria-current="activeTab===tab ? 'page' : undefined"
          class="rounded-md border px-4 py-2 text-sm font-medium"
          :class="activeTab===tab ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'"
          @click="activeTab=tab; if(tab!=='connections') loadOperational(tab==='audit' ? 'audit' : 'overview')">
          {{ tab==='connections' ? 'Conexiones' : tab==='operations' ? 'Operación' : 'Auditoría' }}
        </button>
      </nav>

      <div v-if="error" role="alert" class="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{{ error }}</div>
      <div v-if="notice" role="status" class="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">{{ notice }}</div>

      <template v-if="activeTab==='connections'">
        <section class="rounded-xl border p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Conexiones configuradas</h2>
            <button type="button" :disabled="loading" class="rounded-md border px-3 py-2 text-sm" @click="refreshConnections">
              {{ loading ? 'Cargando...' : 'Actualizar' }}
            </button>
          </div>
          <p v-if="!loading && !connections.length" class="mt-4 text-sm opacity-70">No hay conexiones registradas todavía.</p>
          <div class="mt-4 grid gap-3">
            <article v-for="item in connections" :key="item.id" class="rounded-lg border p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 class="font-semibold">{{ item.code }}</h3>
                  <p class="break-all text-sm opacity-75">{{ item.dataverseUrl }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="rounded border px-3 py-1.5 text-sm" @click="edit(item)">Editar</button>
                  <button type="button" class="rounded border px-3 py-1.5 text-sm" :disabled="saving" @click="rotateSecret(item.code)">Rotar secreto</button>
                  <button type="button" class="rounded bg-slate-800 px-3 py-1.5 text-sm text-white" @click="testConnection(item.code)">Probar conexión</button>
                </div>
              </div>
              <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt class="font-medium opacity-70">Tenant ID</dt><dd class="break-all">{{ item.tenantId }}</dd></div>
                <div><dt class="font-medium opacity-70">Client ID</dt><dd class="break-all">{{ item.clientId }}</dd></div>
                <div><dt class="font-medium opacity-70">Moneda predeterminada</dt><dd>{{ item.defaultCurrencyId || 'Sin asignar' }}</dd></div>
              </dl>
              <p v-if="testResults[item.code]" role="status" class="mt-3 rounded bg-slate-100 p-2 text-sm text-slate-900">{{ testResults[item.code] }}</p>
            </article>
          </div>
        </section>

        <section id="dynamics-connection-form" class="rounded-xl border p-5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-lg font-semibold">{{ editing ? 'Actualizar conexión' : 'Registrar conexión de Dataverse' }}</h2>
            <button v-if="editing" type="button" class="rounded border px-3 py-1.5 text-sm" @click="clearForm">Nueva conexión</button>
          </div>
          <p class="my-3 text-sm opacity-75">Los ID se guardan en dhole_dynamics_connector. El secreto se cifra y nunca se vuelve a mostrar.</p>
          <form class="grid gap-4 md:grid-cols-2" autocomplete="off" @submit.prevent="save">
            <label class="grid gap-1 text-sm">Código
              <input v-model="form.code" required maxlength="64" :readonly="editing" class="rounded-md border bg-transparent p-2" placeholder="principal">
            </label>
            <label class="grid gap-1 text-sm">URL de Dataverse
              <input v-model="form.dataverseUrl" type="url" required class="rounded-md border bg-transparent p-2" placeholder="https://empresa.crm.dynamics.com">
            </label>
            <label class="grid gap-1 text-sm">Tenant ID (Directory ID)
              <input v-model="form.tenantId" required class="rounded-md border bg-transparent p-2" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
            </label>
            <label class="grid gap-1 text-sm">Client ID (Application ID)
              <input v-model="form.clientId" required class="rounded-md border bg-transparent p-2" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
            </label>
            <label class="grid gap-1 text-sm">Client Secret VALUE
              <input v-model="form.clientSecret" type="password" required autocomplete="new-password" class="rounded-md border bg-transparent p-2" placeholder="Valor secreto, no Secret ID">
            </label>
            <label class="grid gap-1 text-sm">Default Currency ID (opcional)
              <input v-model="form.defaultCurrencyId" class="rounded-md border bg-transparent p-2" placeholder="GUID de moneda">
            </label>
            <div class="flex justify-end md:col-span-2">
              <button type="submit" :disabled="saving" class="rounded-md bg-slate-800 px-5 py-2.5 font-medium text-white disabled:opacity-50">
                {{ saving ? 'Guardando...' : 'Guardar conexión' }}
              </button>
            </div>
          </form>
        </section>
      </template>

      <section v-else class="rounded-xl border p-5">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded border px-3 py-2 text-sm" @click="loadOperational('overview')">Resumen</button>
          <button type="button" class="rounded border px-3 py-2 text-sm" @click="loadOperational('jobs')">Trabajos</button>
          <button type="button" class="rounded border px-3 py-2 text-sm" @click="loadOperational('audit')">Auditoría</button>
        </div>
        <p v-if="loading" class="mt-4 text-sm opacity-70">Cargando datos...</p>
        <pre v-else class="mt-4 max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{{ output || 'Sin datos disponibles.' }}</pre>
      </section>
    </template>
  </div>
</template>

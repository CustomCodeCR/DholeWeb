<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Activity, Database, CheckCircle2, RefreshCw, ShieldCheck, Link2, AlertCircle, Search, PenLine, LockKeyhole } from 'lucide-vue-next'
import DynamicsDataWorkspace from './DynamicsDataWorkspace.vue'
import { useAuthStore } from '@/core/stores/authStore'
import { fetchClient } from '@/core/api/fetchConfig'
import { ApiError, NetworkError } from '@/core/api/apiErrorHandler'

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
type Tab = 'connections' | 'catalog' | 'query' | 'crud' | 'security' | 'integrations' | 'operations' | 'audit'

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
const connectionTesting = reactive<Record<string, boolean>>({})
const diagnostics = ref<unknown>(null)
const records = ref<unknown>(null)
const selectedOperation = ref<'overview' | 'jobs' | 'audit'>('overview')
const form = reactive({
  code: '', dataverseUrl: '', tenantId: '', clientId: '', clientSecret: '', defaultCurrencyId: '',
})
const editing = ref(false)
const rotationCode = ref('')
const rotationSecret = ref('')
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
  connections.value = []
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
  if (connectionTesting[code]) return
  error.value = ''
  connectionTesting[code] = true
  testResults[code] = 'Comprobando la identidad de Microsoft y los permisos de lectura en Dataverse...'
  try {
    const result = await request<DataverseHealth>('/api/dynamics-admin/connections/' + encodeURIComponent(code) + '/test', 'POST')
    testResults[code] = result.connected
      ? 'Conectado. Usuario de aplicación: ' + result.applicationUserId
        + ' · Permiso para consultar cotizaciones: ' + (result.canReadQuotes ? 'Sí' : 'No')
      : 'Microsoft Dataverse no confirmó esta conexión.'
  } catch (reason) {
    const diagnostics = reason instanceof ApiError && typeof reason.data === 'object' && reason.data !== null
      ? reason.data as Record<string, unknown> : null
    const correlation = typeof diagnostics?.correlationId === 'string'
      ? ' · Diagnóstico: ' + diagnostics.correlationId : ''
    if (reason instanceof NetworkError) {
      testResults[code] = 'No se pudo leer la respuesta del API Gateway. '
        + 'Comprobá Estados de servicios → Dynamics 365 Connector e intentá nuevamente. '
        + 'Si continúa, revisá la solicitud POST en la pestaña Red del navegador.'
    } else {
      const status = reason instanceof ApiError && reason.status ? 'HTTP ' + reason.status + ': ' : ''
      testResults[code] = 'Falló: ' + status + readableError(reason) + correlation
    }
  } finally {
    connectionTesting[code] = false
  }
}
async function rotateSecret(code: string) {
  if (!rotationSecret.value.trim()) { error.value = 'El secreto no puede estar vacío.'; return }
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await request('/api/dynamics-admin/connections/' + encodeURIComponent(code) + '/secret', 'PUT', {clientSecret: rotationSecret.value})
    notice.value = 'El secreto se actualizó correctamente.'
    rotationCode.value = ''
  } catch(reason) { error.value = readableError(reason) }
  finally { rotationSecret.value = ''; saving.value = false }
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
  <main class="dynamics-page">
    <section class="dynamics-hero">
      <div class="dynamics-hero-icon"><Database :size="26" :stroke-width="1.75" /></div>
      <div class="dynamics-hero-copy">
        <p class="dynamics-eyebrow">INTEGRACIONES · MICROSOFT DATAVERSE</p>
        <h1>Dynamics 365</h1>
        <p>Administrá conexiones, verificá el acceso y consultá la actividad de la integración.</p>
      </div>
      <div class="dynamics-hero-status"><ShieldCheck :size="16" /> {{ canSecurity ? 'Administración de seguridad' : 'Administración' }}</div>
    </section>

    <section class="dynamics-quick-info" aria-label="Estado de integración">
      <div class="dynamics-mini-card">
        <span class="dynamics-mini-icon"><Link2 :size="18" /></span>
        <div><span class="dynamics-mini-caption">Conexiones configuradas</span>
          <strong>{{ error ? 'Sin verificar' : loading ? 'Consultando...' : connections.length }}</strong>
        </div>
      </div>
      <div class="dynamics-mini-card">
        <span class="dynamics-mini-icon"><ShieldCheck :size="18" /></span>
        <div><span class="dynamics-mini-caption">Acceso administrativo</span>
          <strong>{{ canAdmin ? 'Autorizado en Dhole' : 'No autorizado' }}</strong>
        </div>
      </div>
      <div class="dynamics-mini-card">
        <span class="dynamics-mini-icon"><Activity :size="18" /></span>
        <div><span class="dynamics-mini-caption">Modo de producción</span>
          <strong>Sujetas a permisos y aprobación</strong>
        </div>
      </div>
    </section>

    <section v-if="!canAdmin" class="dynamics-feedback dynamics-feedback-error" role="alert">
      <AlertCircle :size="20" /> Tu usuario necesita el scope dynamics.admin o dynamics.security.admin.
    </section>

    <template v-else>
      <div class="dynamics-workspace">
        <nav class="dynamics-nav" aria-label="Secciones de Dynamics">
          <button v-for="tab in (['connections','catalog','query','crud','integrations','security','operations','audit'] as Tab[])" :key="tab" v-show="tab!=='security' || canSecurity" type="button"
            class="dynamics-nav-button" :class="{ active: activeTab === tab }" :aria-current="activeTab === tab ? 'page' : undefined"
            @click="activeTab=tab; if (tab==='operations' || tab==='audit') loadOperational(tab==='audit' ? 'audit' : 'overview')">
            <Database v-if="tab==='connections'" :size="16" />
            <Search v-else-if="tab==='query'" :size="16" />
            <PenLine v-else-if="tab==='crud'" :size="16" />
            <Link2 v-else-if="tab==='integrations'" :size="16" />
            <LockKeyhole v-else-if="tab==='security'" :size="16" />
            <Activity v-else-if="tab==='operations'" :size="16" />
            <ShieldCheck v-else :size="16" />
            {{ { connections:'Conexiones', catalog:'Catálogo', query:'Query Builder', crud:'CRUD', integrations:'API / Integraciones', security:'Seguridad', operations:'Operación', audit:'Auditoría' }[tab] }}
          </button>
        </nav>

        <div v-if="error" class="dynamics-feedback dynamics-feedback-error" role="alert">
          <AlertCircle :size="19" />
          <span>{{ error }}</span>
          <button type="button" class="dynamics-text-action" @click="refreshConnections">Reintentar</button>
        </div>
        <div v-if="notice" class="dynamics-feedback dynamics-feedback-success" role="status">
          <CheckCircle2 :size="19" /> {{ notice }}
        </div>

        <template v-if="activeTab==='connections'">
          <div class="dynamics-layout">
            <section class="dynamics-panel dynamics-connections">
              <div class="dynamics-panel-header">
                <div>
                  <p class="dynamics-section-label">01 / CONEXIONES</p>
                  <h2>Organizaciones vinculadas</h2>
                  <p class="dynamics-subtitle">Aplicaciones registradas para acceder a Dataverse.</p>
                </div>
                <button type="button" class="dynamics-outline-button" :disabled="loading" @click="refreshConnections">
                  <RefreshCw :size="16" :class="{ 'animate-spin': loading }" /> Actualizar
                </button>
              </div>
              <div v-if="loading" class="dynamics-empty"><RefreshCw class="animate-spin" :size="24" /><strong>Consultando conexiones</strong><span>Estamos verificando las conexiones de Dynamics.</span></div>
              <div v-else-if="!error && !connections.length" class="dynamics-empty">
                <div class="dynamics-empty-icon"><Database :size="28" /></div>
                <strong>Todavía no hay conexiones</strong>
                <span>Registrá tu organización de Microsoft Dataverse en el formulario.</span>
              </div>
              <div v-if="connections.length" class="dynamics-connection-grid">
                <article v-for="item in connections" :key="item.id" class="dynamics-connection-card">
                  <div class="dynamics-connection-top">
                    <span class="dynamics-connection-avatar"><Database :size="19" /></span>
                    <div class="dynamics-connection-title"><strong>{{ item.code }}</strong><span>{{ item.dataverseUrl }}</span></div>
                  </div>
                  <dl class="dynamics-identifiers">
                    <div><dt>Tenant ID</dt><dd :title="item.tenantId">{{ item.tenantId }}</dd></div>
                    <div><dt>Client ID</dt><dd :title="item.clientId">{{ item.clientId }}</dd></div>
                    <div><dt>Moneda predeterminada</dt><dd>{{ item.defaultCurrencyId || 'Sin asignar' }}</dd></div>
                  </dl>
                  <p v-if="testResults[item.code]" class="dynamics-inline-message" role="status">{{ testResults[item.code] }}</p>
                  <form v-if="rotationCode===item.code" class="dynamics-rotation" autocomplete="off" @submit.prevent="rotateSecret(item.code)">
                    <label class="dynamics-field"><span>Nuevo Client Secret VALUE</span>
                      <input v-model="rotationSecret" type="password" autocomplete="new-password" required placeholder="Ingresar secreto nuevo">
                    </label>
                    <div class="dynamics-actions">
                      <button type="button" class="dynamics-outline-button" @click="rotationCode='';rotationSecret=''">Cancelar</button>
                      <button type="submit" class="dynamics-primary-button" :disabled="saving">Actualizar secreto</button>
                    </div>
                  </form>
                  <div v-else class="dynamics-actions">
                    <button type="button" class="dynamics-outline-button" @click="edit(item)">Editar</button>
                    <button type="button" class="dynamics-outline-button" @click="rotationCode=item.code;rotationSecret=''">Rotar secreto</button>
                    <button type="button" class="dynamics-primary-button" :disabled="connectionTesting[item.code]" @click="testConnection(item.code)">
                      {{ connectionTesting[item.code] ? 'Comprobando...' : 'Probar conexión' }}
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <section id="dynamics-connection-form" class="dynamics-panel dynamics-form-panel">
              <div class="dynamics-panel-header">
                <div><p class="dynamics-section-label">02 / CONFIGURACIÓN</p>
                  <h2>{{ editing ? 'Editar conexión' : 'Nueva conexión' }}</h2>
                  <p class="dynamics-subtitle">Credenciales de aplicación Microsoft Entra.</p>
                </div>
                <button v-if="editing" type="button" class="dynamics-outline-button" @click="clearForm">Cancelar edición</button>
              </div>
              <div class="dynamics-security-note"><ShieldCheck :size="18" />
                <span>Los ID se almacenan en PostgreSQL. El secreto se cifra y nunca se devuelve en las consultas.</span>
              </div>
              <form class="dynamics-form" autocomplete="off" @submit.prevent="save">
                <label class="dynamics-field"><span>Código de conexión <em>*</em></span>
                  <input v-model="form.code" required maxlength="64" :readonly="editing" placeholder="principal">
                </label>
                <label class="dynamics-field"><span>URL de Dataverse <em>*</em></span>
                  <input v-model="form.dataverseUrl" type="url" required placeholder="https://empresa.crm.dynamics.com">
                </label>
                <label class="dynamics-field"><span>Tenant ID <em>*</em> <small>(Directory ID)</small></span>
                  <input v-model="form.tenantId" required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" spellcheck="false">
                </label>
                <label class="dynamics-field"><span>Client ID <em>*</em> <small>(Application ID)</small></span>
                  <input v-model="form.clientId" required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" spellcheck="false">
                </label>
                <label class="dynamics-field"><span>Client Secret VALUE <em>*</em></span>
                  <input v-model="form.clientSecret" type="password" required autocomplete="new-password" placeholder="Valor del secreto (no Secret ID)">
                </label>
                <label class="dynamics-field"><span>Moneda predeterminada <small>(opcional)</small></span>
                  <input v-model="form.defaultCurrencyId" placeholder="GUID de moneda en Dataverse" spellcheck="false">
                </label>
                <button type="submit" :disabled="saving" class="dynamics-primary-button dynamics-submit">
                  {{ saving ? 'Guardando conexión...' : editing ? 'Actualizar conexión' : 'Guardar conexión' }}
                </button>
                <p class="dynamics-footnote">No se habilitan escrituras de negocio en Dynamics 365 al guardar una conexión.</p>
              </form>
            </section>
          </div>
        </template>

        <section v-else-if="activeTab==='operations' || activeTab==='audit'" class="dynamics-panel dynamics-operation-panel">
          <div class="dynamics-panel-header"><div>
            <p class="dynamics-section-label">MONITOREO</p>
            <h2>{{ activeTab==='audit' ? 'Auditoría de Dynamics' : 'Operación del conector' }}</h2>
            <p class="dynamics-subtitle">Consultá el estado de las operaciones y los registros de auditoría.</p>
          </div></div>
          <div class="dynamics-actions">
            <button v-if="activeTab!=='audit'" type="button" class="dynamics-outline-button" @click="loadOperational('overview')">Resumen</button>
            <button v-if="activeTab!=='audit'" type="button" class="dynamics-outline-button" @click="loadOperational('jobs')">Trabajos</button>
            <button type="button" class="dynamics-outline-button" @click="loadOperational('audit')">Auditoría</button>
          </div>
          <p v-if="loading" class="dynamics-subtitle">Consultando...</p>
          <pre v-else class="dynamics-json">{{ output || 'Todavía no hay información disponible.' }}</pre>
        </section>
        <DynamicsDataWorkspace v-else :section="activeTab as 'catalog' | 'query' | 'crud' | 'security' | 'integrations'" :connections="connections" @navigate="activeTab = $event" />
      </div>
    </template>
  </main>
</template>

<style scoped src="./dynamics.css"></style>

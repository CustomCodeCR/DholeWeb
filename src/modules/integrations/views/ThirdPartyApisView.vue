<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Copy, KeyRound, Plus, RefreshCw, Trash2, ShieldCheck, Globe2, Pencil, Power } from 'lucide-vue-next'
import { fetchClient } from '@/core/api/fetchConfig'
import DhDrawer from '@/shared/components/organisms/DhDrawer.vue'
import DhModal from '@/shared/components/organisms/DhModal.vue'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhSelect from '@/shared/components/atoms/DhSelect.vue'
import DhCheckbox from '@/shared/components/atoms/DhCheckbox.vue'

type Field = { public: string; internal: string; required: boolean }
type ApprovedTarget = { code: string; service: string; method: string; path: string; description: string }
type PublishedEndpoint = {
  id: string; name: string; slug: string; target: string; inputs: Field[]; outputs: Field[]
  responseRoot: string | null; enabled: boolean
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
const drawer = ref(false)
const secretModal = ref(false)
const issuedSecret = ref('')
const issuedLabel = ref('')
const search = ref('')
const keyName = ref('')
const expiresDays = ref('90')
const maxPerMinute = ref('30')
const blank = (): PublishedEndpoint => ({
  id: '', name: '', slug: '', target: '', inputs: [], outputs: [{ public: '', internal: '', required: false }],
  responseRoot: null, enabled: false,
})
const draft = ref<PublishedEndpoint>(blank())
const isNew = computed(() => !draft.value.id)
const selectedTarget = computed(() => catalog.value.find(t => t.code === draft.value.target))
const filtered = computed(() => endpoints.value.filter(x =>
  (x.name + ' ' + x.slug + ' ' + x.target).toLowerCase().includes(search.value.toLowerCase())))
const targetOptions = computed(() => catalog.value.map(t => ({
  value: t.code, label: t.service.toUpperCase() + ' · ' + t.method + ' ' + t.path,
})))
const url = (x: PublishedEndpoint) => base + '/api/external/' + x.slug +
  (catalog.value.find(t => t.code === x.target)?.path.includes('{id}') ? '/{id}' : '')
const example = computed(() => {
  const target = selectedTarget.value
  if (!target) return ''
  const query = target.method === 'GET'
    ? draft.value.inputs.map(x => x.public + '=valor').join('&') : ''
  const address = url(draft.value) + (query ? '?' + query : '')
  const body = draft.value.inputs.length && target.method !== 'GET'
    ? " \\\n  -H 'Content-Type: application/json' \\\n  -d '" +
      JSON.stringify(Object.fromEntries(draft.value.inputs.filter(x => x.public).map(x => [x.public, 'valor']))) + "'"
    : ''
  return "curl -X " + target.method + " '" + address + "' \\\n  -H 'X-Api-Key: TU_API_KEY'" + body
})

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
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No fue posible cargar las integraciones.'
  } finally { loading.value = false }
}
async function loadKeys(id: string) {
  try { keys.value = await fetchClient<KeyInfo[]>(root + '/endpoints/' + encodeURIComponent(id) + '/keys', { method: 'GET' }) }
  catch (e) { error.value = e instanceof Error ? e.message : 'No fue posible cargar las claves.' }
}
function create() {
  draft.value = blank()
  keys.value = []
  error.value = ''
  notice.value = ''
  drawer.value = true
}
function edit(row: PublishedEndpoint) {
  draft.value = structuredClone(row)
  keys.value = []
  error.value = ''
  notice.value = ''
  drawer.value = true
  void loadKeys(row.id)
}
function addField(kind: 'inputs' | 'outputs') {
  draft.value[kind].push({ public: '', internal: '', required: false })
}
function removeField(kind: 'inputs' | 'outputs', index: number) { draft.value[kind].splice(index, 1) }
function validFields(fields: Field[]) {
  return fields.every(x => /^[A-Za-z][\w]{0,79}$/.test(x.public) &&
    /^[A-Za-z][\w.]{0,159}$/.test(x.internal)) &&
    new Set(fields.map(x => x.public)).size === fields.length
}
async function save() {
  error.value = ''
  const d = draft.value
  if (!d.name.trim() || !/^[a-z][a-z0-9-]{2,63}$/.test(d.slug) || !d.target) {
    error.value = 'Ingresá un nombre, identificador válido y operación interna.'; return
  }
  if (!d.outputs.length || !validFields(d.outputs) || !validFields(d.inputs)) {
    error.value = 'Completá los campos de entrada y salida sin nombres duplicados.'; return
  }
  if (d.responseRoot && !/^[A-Za-z][\w.]*$/.test(d.responseRoot)) {
    error.value = 'La ruta raíz de respuesta no es válida.'; return
  }
  saving.value = true
  try {
    const created = await fetchClient<PublishedEndpoint>(root + '/endpoints' +
      (d.id ? '/' + encodeURIComponent(d.id) : ''), {
      method: d.id ? 'PUT' : 'POST',
      body: { ...d, responseRoot: d.responseRoot || null },
    })
    notice.value = 'Contrato guardado. Solo los publicados permiten generar claves.'
    await load()
    draft.value = created
    if (created.id) await loadKeys(created.id)
  } catch (e) { error.value = e instanceof Error ? e.message : 'No fue posible guardar.' }
  finally { saving.value = false }
}
async function toggle(row: PublishedEndpoint) {
  saving.value = true
  error.value = ''
  try {
    await fetchClient(root + '/endpoints/' + encodeURIComponent(row.id), {
      method: 'PUT', body: { ...row, enabled: !row.enabled },
    })
    notice.value = row.enabled ? 'Endpoint deshabilitado.' : 'Endpoint publicado.'
    await load()
    if (draft.value.id === row.id) {
      const updated = endpoints.value.find(x => x.id === row.id)
      if (updated) draft.value = structuredClone(updated)
    }
  } catch (e) { error.value = e instanceof Error ? e.message : 'No se pudo cambiar el estado.' }
  finally { saving.value = false }
}
async function issueKey() {
  error.value = ''
  if (!draft.value.id || !draft.value.enabled || !keyName.value.trim()) {
    error.value = 'Publicá la API y escribí el nombre de la aplicación.'; return
  }
  saving.value = true
  try {
    const issued = await fetchClient<{ id: string; apiKey: string }>(
      root + '/endpoints/' + encodeURIComponent(draft.value.id) + '/keys', {
        method: 'POST',
        body: {
          label: keyName.value.trim(), expiresInDays: Number(expiresDays.value),
          maxRequestsPerMinute: Number(maxPerMinute.value),
        },
      })
    issuedSecret.value = issued.apiKey
    issuedLabel.value = keyName.value
    keyName.value = ''
    secretModal.value = true
    await loadKeys(draft.value.id)
  } catch (e) { error.value = e instanceof Error ? e.message : 'No se pudo crear la clave.' }
  finally { saving.value = false }
}
async function revoke(key: KeyInfo) {
  if (!confirm('¿Revocar permanentemente la clave de ' + key.label + '?')) return
  error.value = ''
  try {
    await fetchClient(root + '/keys/' + encodeURIComponent(key.id), { method: 'DELETE' })
    notice.value = 'Clave revocada.'
    await loadKeys(draft.value.id)
  } catch (e) { error.value = e instanceof Error ? e.message : 'No se pudo revocar.' }
}
async function copy(value: string) {
  try { await navigator.clipboard.writeText(value); notice.value = 'Copiado al portapapeles.' }
  catch { notice.value = 'Copiá el texto manualmente.' }
}
onMounted(() => { void load() })
</script>

<template>
  <main class="mx-auto flex w-full max-w-[1480px] flex-col gap-5 p-4 text-[var(--dh-text)] lg:p-7">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Dhole · Integraciones</p>
        <h1 class="mt-1 text-2xl font-black">APIs para terceros</h1>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
          Publicá funciones de Pricing, CRM y otros módulos con campos y accesos independientes.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <DhButton variant="secondary" :icon="RefreshCw" label="Actualizar" :loading="loading" @click="load" />
        <DhButton :icon="Plus" label="Nueva API" @click="create" />
      </div>
    </header>

    <div v-if="error" role="alert" class="rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{{ error }}</div>
    <div v-if="notice" role="status" class="rounded-2xl border border-[var(--dh-border)] p-3 text-sm">{{ notice }}</div>

    <section class="rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-sm">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-base font-black">Endpoints publicados</h2>
        <div class="w-full max-w-sm"><DhInput v-model="search" placeholder="Buscar API, módulo u operación..." type="search" /></div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-[var(--dh-border)] text-xs uppercase tracking-wide text-[var(--dh-text-muted)]">
            <tr><th class="p-3">API</th><th class="p-3">Servicio</th><th class="p-3">Método</th><th class="p-3">Estado</th><th class="p-3 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in filtered" :key="row.id" class="border-b border-[var(--dh-border)] last:border-0">
              <td class="p-3"><strong class="block">{{ row.name }}</strong><code class="text-xs text-[var(--dh-text-muted)]">{{ '/api/external/' + row.slug }}</code></td>
              <td class="p-3">{{ catalog.find(t => t.code === row.target)?.service || row.target }}</td>
              <td class="p-3 font-mono font-semibold">{{ catalog.find(t => t.code === row.target)?.method || '—' }}</td>
              <td class="p-3"><span class="rounded-xl border border-[var(--dh-border)] px-2 py-1 text-xs font-semibold">{{ row.enabled ? 'Publicada' : 'Borrador / inactiva' }}</span></td>
              <td class="p-3"><div class="flex justify-end gap-2">
                <DhButton variant="secondary" :icon="Pencil" label="Configurar" size="sm" @click="edit(row)" />
                <DhButton variant="ghost" :icon="Power" :label="row.enabled ? 'Desactivar' : 'Publicar'" size="sm" :disabled="saving" @click="toggle(row)" />
              </div></td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="5" class="p-8 text-center text-[var(--dh-text-muted)]">
              {{ loading ? 'Cargando APIs...' : 'No hay APIs configuradas. Creá una para empezar.' }}
            </td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="rounded-3xl border border-[var(--dh-border)] p-4 text-sm text-[var(--dh-text-muted)]">
      <div class="flex items-start gap-3"><ShieldCheck class="mt-0.5 h-5 w-5 shrink-0" /><p>
        Las API keys solo autorizan la operación publicada. Los datos se filtran según los campos configurados y los permisos del usuario técnico interno.
        No se comparten las credenciales de Dynamics ni los JWT de usuarios.
      </p></div>
    </section>

    <DhDrawer :open="drawer" :title="isNew ? 'Crear API para terceros' : 'Configurar API · ' + draft.name" size="xl" @close="drawer = false">
      <div class="flex flex-col gap-6">
        <div class="grid gap-3 sm:grid-cols-2">
          <DhInput v-model="draft.name" label="Nombre de la API" placeholder="Consultar tarifa" />
          <DhInput v-model="draft.slug" label="Identificador público" placeholder="consultar-tarifa" />
          <div class="sm:col-span-2">
            <DhSelect v-model="draft.target" label="Endpoint interno aprobado" :options="targetOptions" placeholder="Seleccionar módulo y operación" />
            <p v-if="!catalog.length" class="mt-2 text-xs text-[var(--dh-text-muted)]">No existen rutas aprobadas. Un administrador técnico debe configurar el catálogo de endpoints internos del Gateway.</p>
            <p v-else-if="selectedTarget" class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ selectedTarget.description }}</p>
          </div>
        </div>

        <section class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div><h3 class="font-bold">Campos de entrada</h3><p class="text-xs text-[var(--dh-text-muted)]">GET usa query parameters; POST, PUT y DELETE reciben JSON.</p></div>
            <DhButton size="sm" variant="secondary" :icon="Plus" label="Agregar campo" @click="addField('inputs')" />
          </div>
          <div v-for="(field, i) in draft.inputs" :key="'input-' + i" class="grid items-end gap-2 rounded-2xl border border-[var(--dh-border)] p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
            <DhInput v-model="field.public" label="Nombre público" placeholder="cliente" />
            <DhInput v-model="field.internal" label="Campo interno" placeholder="clientId" />
            <DhCheckbox v-model="field.required" label="Obligatorio" />
            <DhButton variant="ghost" :icon="Trash2" label="Quitar" size="sm" @click="removeField('inputs', i)" />
          </div>
        </section>

        <section class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div><h3 class="font-bold">Campos de respuesta</h3><p class="text-xs text-[var(--dh-text-muted)]">Solo se devuelven los campos definidos aquí.</p></div>
            <DhButton size="sm" variant="secondary" :icon="Plus" label="Agregar campo" @click="addField('outputs')" />
          </div>
          <DhInput v-model="draft.responseRoot" label="Raíz de datos (opcional)" placeholder="data.items" />
          <div v-for="(field, i) in draft.outputs" :key="'output-' + i" class="grid items-end gap-2 rounded-2xl border border-[var(--dh-border)] p-3 sm:grid-cols-[1fr_1fr_auto]">
            <DhInput v-model="field.public" label="Nombre que recibe el tercero" placeholder="monto" />
            <DhInput v-model="field.internal" label="Campo del servicio" placeholder="totalSale" />
            <DhButton variant="ghost" :icon="Trash2" label="Quitar" size="sm" @click="removeField('outputs', i)" />
          </div>
        </section>

        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" label="Cerrar" @click="drawer = false" />
          <DhButton label="Guardar contrato" :disabled="saving" :loading="saving" @click="save" />
        </div>

        <section v-if="!isNew" class="flex flex-col gap-3 border-t border-[var(--dh-border)] pt-5">
          <h3 class="font-bold">Endpoint externo</h3>
          <div class="flex items-center gap-2 rounded-2xl border border-[var(--dh-border)] p-3">
            <Globe2 class="h-4 w-4 shrink-0" /><code class="min-w-0 flex-1 break-all text-xs">{{ url(draft) }}</code>
            <DhButton variant="ghost" :icon="Copy" label="Copiar" size="sm" @click="copy(url(draft))" />
          </div>
          <div v-if="example" class="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
            <div class="mb-2 flex justify-between gap-2"><strong class="text-xs">Ejemplo cURL</strong><DhButton variant="ghost" size="sm" :icon="Copy" label="Copiar" @click="copy(example)" /></div>
            <pre class="overflow-x-auto whitespace-pre-wrap break-all text-xs">{{ example }}</pre>
          </div>
        </section>

        <section v-if="draft.id" class="flex flex-col gap-4 border-t border-[var(--dh-border)] pt-5">
          <div><h3 class="flex items-center gap-2 font-bold"><KeyRound class="h-4 w-4" /> API keys</h3>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Cada clave pertenece únicamente a esta API. El secreto se muestra una sola vez.</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <DhInput v-model="keyName" label="Aplicación / tercero" placeholder="Portal externo" />
            <DhInput v-model="expiresDays" label="Vigencia (días)" type="number" min="1" max="365" />
            <DhInput v-model="maxPerMinute" label="Máx. solicitudes/minuto" type="number" min="1" max="300" />
          </div>
          <DhButton :icon="KeyRound" label="Generar API key" :disabled="!draft.enabled || saving" :loading="saving" @click="issueKey" />
          <div v-if="!draft.enabled" class="text-xs text-[var(--dh-text-muted)]">Primero guardá y publicá la API.</div>
          <div v-for="key in keys" :key="key.id" class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--dh-border)] p-3">
            <div><strong class="block text-sm">{{ key.label }}</strong><code class="text-xs text-[var(--dh-text-muted)]">{{ key.prefix }}… · {{ key.maxRequestsPerMinute }}/min · {{ key.active ? 'Activa' : 'Revocada' }}</code><p class="text-xs text-[var(--dh-text-muted)]">Vence {{ new Date(key.expiresAt).toLocaleDateString() }}</p></div>
            <DhButton v-if="key.active" :icon="Trash2" variant="danger" size="sm" label="Revocar" @click="revoke(key)" />
          </div>
        </section>
      </div>
    </DhDrawer>

    <DhModal :open="secretModal" title="Clave generada · Guardala ahora" size="lg" @close="secretModal = false; issuedSecret = ''">
      <div class="flex flex-col gap-4">
        <p class="text-sm">La clave de <strong>{{ issuedLabel }}</strong> se mostrará una sola vez. Compartila por un canal seguro.</p>
        <code class="break-all rounded-2xl bg-black/5 p-4 text-sm dark:bg-white/5">{{ issuedSecret }}</code>
        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" label="Cerrar" @click="secretModal = false; issuedSecret = ''" />
          <DhButton :icon="Copy" label="Copiar clave" @click="copy(issuedSecret)" />
        </div>
      </div>
    </DhModal>
  </main>
</template>

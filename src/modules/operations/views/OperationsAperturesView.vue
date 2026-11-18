<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/core/stores/authStore'
import { operationsApi, type ApertureRow, type OperationsAudit, type ValidationPair } from '../services/operationsApi'

const auth = useAuthStore()
const canCreate = computed(() => auth.hasScope('operations.case.create'))
const canAssign = computed(() => auth.hasScope('operations.aperture.validation.assign') && auth.hasScope('operations.team.manage'))
const canReview = computed(() => auth.hasScope('operations.aperture.validation.review'))
const canAudit = computed(() => auth.hasScope('operations.audit.read'))
const rows = ref<ApertureRow[]>([])
const total = ref(0)
const selectedId = ref('')
const selected = computed(() => rows.value.find(x => x.id === selectedId.value))
const pair = ref<ValidationPair | null>(null)
const audit = ref<OperationsAudit[]>([])
const error = ref('')
const message = ref('')
const busy = ref(false)
const comment = ref('')
const showCreate = ref(false)
const blankUser = '00000000-0000-0000-0000-000000000000'
const opening = ref({
  companyId: '', accountId: '', seriesCode: '',
  modalityCode: 'FCL', priority: 1, complexityPoints: 1,
})
function label(date: string) { return new Date(date).toLocaleString('es-CR') }
function short(id: string) { return id.slice(0, 8) }
function report(value: unknown) { error.value = value instanceof Error ? value.message : 'Ocurrió un error.' }
async function load() {
  error.value = ''
  try {
    const data = await operationsApi.apertures()
    rows.value = data.items
    total.value = data.total
    if (selectedId.value && !rows.value.some(x => x.id === selectedId.value)) selectedId.value = ''
    if (!selectedId.value && rows.value.length) selectedId.value = rows.value[0]?.id ?? ''
    await loadDetail()
  } catch (e) { report(e) }
}
async function choose(id: string) { selectedId.value = id; await loadDetail() }
async function loadDetail() {
  pair.value = null
  audit.value = []
  if (!selectedId.value) return
  try {
    pair.value = await operationsApi.validations(selectedId.value)
    if (canAudit.value) audit.value = await operationsApi.caseAudit(selectedId.value)
  } catch (e) { report(e) }
}
async function createOpening() {
  if (busy.value || !canCreate.value) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    const created = await operationsApi.createAperture({
      ...opening.value, executiveUserId: blankUser,
    })
    message.value = `Apertura ${created.idtra} creada. Queda pendiente su asignación a dos validadores.`
    showCreate.value = false
    await load()
    selectedId.value = created.id
    await loadDetail()
  } catch (e) { report(e) }
  finally { busy.value = false }
}
async function assign() {
  if (!selected.value || busy.value || !canAssign.value) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    await operationsApi.assign(selected.value.id)
    message.value = 'Se asignaron dos revisores distintos del pool disponible.'
    await load()
  } catch (e) { report(e) }
  finally { busy.value = false }
}
async function decide(id: string, decision: 'APPROVED' | 'REJECTED') {
  if (!selected.value || busy.value || !canReview.value) return
  if (decision === 'REJECTED' && !comment.value.trim()) {
    error.value = 'Indica el motivo para solicitar cambios.'; return
  }
  busy.value = true; error.value = ''; message.value = ''
  try {
    await operationsApi.decide(selected.value.id, id, decision, comment.value.trim())
    comment.value = ''
    message.value = decision === 'APPROVED'
      ? 'Validación registrada. La apertura se completa únicamente con las dos aprobaciones.'
      : 'Se solicitaron cambios y la Apertura quedó bloqueada hasta corregirse.'
    await load()
  } catch (e) { report(e) }
  finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 p-4 md:p-7">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div><p class="text-xs font-semibold uppercase tracking-[.18em] text-sky-600 dark:text-sky-400">Dhole Operations</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Aperturas</h1>
        <p class="mt-2 text-sm text-slate-500">Primer flujo operativo: asignación y validación independiente por dos colaboradores.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <router-link v-if="auth.hasScope('operations.team.manage')" to="/operations/teams" class="rounded-xl border px-4 py-2 text-sm dark:border-slate-700">Equipos</router-link>
        <button v-if="canCreate" class="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white" @click="showCreate = !showCreate">Nueva Apertura</button>
      </div>
    </header>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{{ error }}</p>
    <p v-if="message" role="status" class="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">{{ message }}</p>
    <section v-if="showCreate && canCreate" class="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
      <h2 class="mb-4 font-semibold">Apertura manual inicial</h2>
      <form class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" @submit.prevent="createOpening">
        <label class="text-sm">Empresa (UUID)
          <input v-model="opening.companyId" required pattern="[0-9a-fA-F-]{36}" class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900" /></label>
        <label class="text-sm">Cuenta CRM (UUID)
          <input v-model="opening.accountId" required pattern="[0-9a-fA-F-]{36}" class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900" /></label>
        <label class="text-sm">Serie IDTRA (5 dígitos)
          <input v-model="opening.seriesCode" required pattern="[0-9]{5}" maxlength="5" placeholder="00000" class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900" /></label>
        <label class="text-sm">Modalidad
          <select v-model="opening.modalityCode" class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900">
            <option value="FCL">FCL</option><option value="LCL">LCL</option><option value="FTL">FTL</option><option value="LTL">LTL</option><option value="AIR">Aéreo</option><option value="MULTIMODAL">Multimodal</option>
          </select></label>
        <label class="text-sm">Prioridad (1–5)
          <input v-model.number="opening.priority" required type="number" min="1" max="5" step="1" class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900" /></label>
        <label class="text-sm">Complejidad (puntos)
          <input v-model.number="opening.complexityPoints" required type="number" min="0.5" max="1000" step="0.5" class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900" /></label>
        <div class="sm:col-span-2 lg:col-span-3">
          <button :disabled="busy" class="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">Crear y enviar al pool</button>
          <p class="mt-2 text-xs text-slate-500">El vendedor se resuelve desde la cuenta CRM, no se puede suplantar. La asignación a dos usuarios se realiza en el siguiente paso.</p>
        </div>
      </form>
    </section>
    <div class="grid gap-5 lg:grid-cols-[minmax(270px,380px)_1fr]">
      <aside class="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <h2 class="font-semibold">Expedientes <span class="text-sm font-normal text-slate-500">({{ total }})</span></h2>
        <p v-if="!rows.length" class="py-4 text-sm text-slate-500">No hay Aperturas visibles con tus permisos.</p>
        <button v-for="entry in rows" :key="entry.id" @click="choose(entry.id)"
          class="mt-3 block w-full rounded-xl border p-3 text-left dark:border-slate-700"
          :class="selectedId === entry.id ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30' : 'border-slate-200'">
          <span class="block font-semibold">{{ entry.idtra }}</span>
          <span class="mt-1 block text-xs text-slate-500">{{ entry.modalityCode }} · {{ entry.status }}</span>
          <span class="mt-1 block text-xs text-slate-500">{{ label(entry.createdAtUtc) }}</span>
          <span class="mt-2 block text-xs">{{ entry.validators?.filter(v => v.status === 'APPROVED').length ?? 0 }} / 2 aprobaciones</span>
        </button>
      </aside>
      <section v-if="selected" class="space-y-5">
        <div class="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div><p class="text-xs text-slate-500">Expediente</p><h2 class="text-xl font-semibold">{{ selected.idtra }}</h2>
              <p class="mt-1 text-sm text-slate-500">{{ selected.modalityCode }} · {{ selected.status }}</p>
            </div>
            <button v-if="canAssign && pair?.validators.length === 0" :disabled="busy"
              class="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" @click="assign">
              Asignar dos validadores
            </button>
          </div>
          <p class="mt-4 text-sm text-slate-500">La aprobación de una sola persona no valida la Apertura. El sistema exige dos decisiones aprobatorias de usuarios diferentes.</p>
          <p v-if="!pair?.validators.length" class="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-100">Sin asignaciones. Se requiere un equipo activo con dos personas disponibles.</p>
          <div v-for="v in pair?.validators ?? []" :key="v.id" class="mt-4 rounded-xl border p-4 dark:border-slate-700">
            <div class="flex items-center justify-between gap-2">
              <strong>Revisor {{ v.slot }} · {{ short(v.userId) }}</strong>
              <span class="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{{ v.status }}</span>
            </div>
            <p v-if="v.reviewedAtUtc" class="mt-1 text-xs text-slate-500">{{ label(v.reviewedAtUtc) }}</p>
            <p v-if="v.comment" class="mt-2 text-sm">{{ v.comment }}</p>
            <template v-if="canReview && v.userId === auth.userId && v.status === 'PENDING' && pair?.stage.status === 'PENDING_VALIDATION'">
              <label class="mt-3 block text-sm">Observación
                <textarea v-model="comment" rows="2" maxlength="2000" class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900" placeholder="Obligatoria si solicitas cambios."></textarea>
              </label>
              <div class="mt-3 flex gap-2">
                <button :disabled="busy" class="rounded-xl bg-emerald-700 px-4 py-2 text-sm text-white" @click="decide(v.id, 'APPROVED')">Aprobar</button>
                <button :disabled="busy" class="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-700 dark:text-red-300" @click="decide(v.id, 'REJECTED')">Solicitar cambios</button>
              </div>
            </template>
          </div>
        </div>
        <div v-if="canAudit" class="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
          <h3 class="font-semibold">Audit log del expediente</h3>
          <p v-if="!audit.length" class="mt-3 text-sm text-slate-500">Sin eventos recientes.</p>
          <div v-for="event in audit" :key="event.eventId" class="border-b py-3 text-sm last:border-0 dark:border-slate-700">
            <p class="font-medium">{{ event.actionCode }}</p><p class="text-xs text-slate-500">{{ label(event.occurredAtUtc) }} · Actor {{ short(event.actorUserId) }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/core/stores/authStore'
import { operationsApi, type OperationsAudit, type OperationsTeam, type OperationsUser } from '../services/operationsApi'

const auth = useAuthStore()
const canManage = computed(() => auth.hasScope('operations.team.manage'))
const canAudit = computed(() => auth.hasScope('operations.audit.read'))
const teams = ref<OperationsTeam[]>([])
const users = ref<OperationsUser[]>([])
const selectedId = ref('')
const selected = computed(() => teams.value.find(t => t.id === selectedId.value))
const busy = ref(false)
const error = ref('')
const success = ref('')
const newName = ref('')
const companyId = ref('')
const department = ref<'APERTURAS' | 'COORDINACION_ORIGEN'>('APERTURAS')
const userSearch = ref('')
const memberId = ref('')
const capacity = ref(10)
const isSupervisor = ref(false)
const isAvailable = ref(true)
const history = ref<OperationsAudit[]>([])
const nameFor = (id: string) => users.value.find(u => u.id === id)?.displayName || id
const date = (value: string) => new Date(value).toLocaleString('es-CR')

function report(errorValue: unknown) {
  error.value = errorValue instanceof Error ? errorValue.message : 'No se pudo completar la operación.'
}
async function reload() {
  try {
    teams.value = await operationsApi.teams()
    if (!selectedId.value && teams.value.length) selectedId.value = teams.value[0]?.id ?? ''
    if (selectedId.value && !teams.value.some(t => t.id === selectedId.value))
      selectedId.value = teams.value[0]?.id ?? ''
    await loadAudit()
  } catch (e) { report(e) }
}
async function searchUsers() {
  if (!canManage.value) return
  try { users.value = (await operationsApi.users(userSearch.value)).items }
  catch (e) { report(e) }
}
async function loadAudit() {
  history.value = []
  if (selectedId.value && canAudit.value)
    try { history.value = await operationsApi.teamAudit(selectedId.value) }
    catch (e) { report(e) }
}
async function createTeam() {
  if (!canManage.value || busy.value) return
  error.value = ''; success.value = ''; busy.value = true
  try {
    const team = await operationsApi.createTeam({
      companyId: companyId.value.trim(), departmentCode: department.value, name: newName.value.trim(),
    })
    await reload()
    selectedId.value = team.id
    newName.value = ''
    success.value = 'Equipo creado. Agrega al menos dos validadores de Aperturas.'
    await loadAudit()
  } catch (e) { report(e) }
  finally { busy.value = false }
}
async function saveMember() {
  if (!selected.value || !memberId.value || busy.value || !canManage.value) return
  error.value = ''; success.value = ''; busy.value = true
  try {
    await operationsApi.saveMember(selected.value.id, {
      userId: memberId.value, capacityPoints: capacity.value,
      isSupervisor: isSupervisor.value, isAvailable: isAvailable.value,
    })
    success.value = 'Usuario asignado al equipo. Los permisos se administran en Auth.'
    await reload()
  } catch (e) { report(e) }
  finally { busy.value = false }
}
async function removeMember(userId: string) {
  if (!selected.value || !canManage.value || !window.confirm('¿Retirar este usuario del equipo?')) return
  try { await operationsApi.removeMember(selected.value.id, userId); await reload() }
  catch (e) { report(e) }
}
async function toggleTeam() {
  if (!selected.value || !canManage.value) return
  try { await operationsApi.setTeamActive(selected.value.id, !selected.value.isActive); await reload() }
  catch (e) { report(e) }
}
onMounted(async () => { await Promise.all([reload(), searchUsers()]) })
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 p-4 md:p-7">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.18em] text-sky-600 dark:text-sky-400">Dhole Operations</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Equipos y asignaciones</h1>
        <p class="mt-2 text-sm text-slate-500">Configura el pool operativo. Cada apertura requiere dos validadores diferentes.</p>
      </div>
      <router-link to="/operations/apertures" class="rounded-xl border px-4 py-2 text-sm dark:border-slate-700">Ir a Aperturas</router-link>
    </header>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{{ error }}</p>
    <p v-if="success" role="status" class="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{{ success }}</p>
    <section v-if="canManage" class="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
      <h2 class="mb-4 text-lg font-semibold">Crear equipo</h2>
      <form class="grid gap-3 md:grid-cols-[1fr_1fr_1.3fr_auto] md:items-end" @submit.prevent="createTeam">
        <label class="text-sm">Empresa (UUID)
          <input v-model="companyId" required pattern="[0-9a-fA-F-]{36}" placeholder="UUID de la empresa" class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900" />
        </label>
        <label class="text-sm">Departamento
          <select v-model="department" class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900">
            <option value="APERTURAS">Aperturas</option><option value="COORDINACION_ORIGEN">Coordinación Origen</option>
          </select>
        </label>
        <label class="text-sm">Nombre del equipo
          <input v-model="newName" required maxlength="150" placeholder="Ej. Equipo de Validación 1" class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900" />
        </label>
        <button :disabled="busy" class="rounded-xl bg-sky-700 px-4 py-2.5 font-medium text-white disabled:opacity-50">Crear equipo</button>
      </form>
    </section>
    <div class="grid gap-5 lg:grid-cols-[minmax(230px,300px)_1fr]">
      <aside class="space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <h2 class="pb-2 font-semibold">Equipos registrados</h2>
        <p v-if="!teams.length" class="text-sm text-slate-500">No existen equipos configurados.</p>
        <button v-for="team in teams" :key="team.id" type="button" @click="selectedId = team.id; loadAudit()"
          class="w-full rounded-xl border p-3 text-left transition dark:border-slate-700"
          :class="selectedId === team.id ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30' : 'border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'">
          <span class="block font-medium">{{ team.name }}</span>
          <span class="mt-1 block text-xs text-slate-500">{{ team.departmentCode }} · {{ team.members.length }} integrantes · {{ team.isActive ? 'Activo' : 'Inactivo' }}</span>
        </button>
      </aside>
      <div v-if="selected" class="space-y-5">
        <section class="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div><h2 class="text-lg font-semibold">{{ selected.name }}</h2>
              <p class="text-xs text-slate-500">Empresa {{ selected.companyId }} · {{ selected.departmentCode }}</p>
              <p v-if="selected.departmentCode === 'APERTURAS' && selected.members.filter(m => m.isAvailable).length < 2"
                class="mt-2 text-sm text-amber-600">Se requieren al menos dos integrantes disponibles para asignar una validación.</p>
            </div>
            <button v-if="canManage" class="rounded-xl border px-3 py-2 text-sm dark:border-slate-700" @click="toggleTeam">
              {{ selected.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </div>
          <div class="mt-5 overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b text-slate-500 dark:border-slate-700"><tr><th class="py-2">Usuario</th><th>Capacidad</th><th>Rol</th><th>Disponibilidad</th><th></th></tr></thead>
              <tbody><tr v-for="member in selected.members" :key="member.userId" class="border-b last:border-0 dark:border-slate-800">
                <td class="py-3 font-medium">{{ nameFor(member.userId) }}</td><td>{{ member.capacityPoints }} pts</td>
                <td>{{ member.isSupervisor ? 'Supervisor' : 'Operador' }}</td>
                <td>{{ member.isAvailable ? 'Disponible' : 'No disponible' }}</td>
                <td><button v-if="canManage" class="text-xs text-red-600 hover:underline" @click="removeMember(member.userId)">Retirar</button></td>
              </tr></tbody>
            </table>
            <p v-if="!selected.members.length" class="py-4 text-sm text-slate-500">Todavía no se han asignado usuarios.</p>
          </div>
        </section>
        <section v-if="canManage" class="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
          <h3 class="mb-4 font-semibold">Agregar o actualizar integrante</h3>
          <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input v-model="userSearch" placeholder="Buscar usuario activo de Auth…" class="rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900" />
            <button class="rounded-xl border px-4 py-2 dark:border-slate-700" @click="searchUsers">Buscar</button>
          </div>
          <form class="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_auto_auto_auto]" @submit.prevent="saveMember">
            <label class="text-sm">Usuario
              <select v-model="memberId" required class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900">
                <option value="">Seleccionar</option>
                <option v-for="u in users" :key="u.id" :value="u.id">{{ u.displayName }} ({{ u.userName }})</option>
              </select>
            </label>
            <label class="text-sm">Capacidad
              <input v-model.number="capacity" type="number" min="0.5" max="10000" step="0.5" required class="mt-1 w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-900" />
            </label>
            <label class="flex items-center gap-2 text-sm"><input v-model="isSupervisor" type="checkbox" /> Supervisor</label>
            <label class="flex items-center gap-2 text-sm"><input v-model="isAvailable" type="checkbox" /> Disponible</label>
            <button :disabled="busy || !memberId" class="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Guardar</button>
          </form>
          <p class="mt-3 text-xs text-slate-500">Auth verifica que el usuario esté activo, desbloqueado y sea interno. Los scopes se asignan desde Seguridad.</p>
        </section>
        <section v-if="canAudit" class="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
          <h3 class="font-semibold">Bitácora de cambios</h3>
          <p v-if="!history.length" class="mt-3 text-sm text-slate-500">Sin eventos registrados para este equipo.</p>
          <div v-for="entry in history" :key="entry.eventId" class="border-b py-3 text-sm last:border-0 dark:border-slate-700">
            <p class="font-medium">{{ entry.actionCode }}</p><p class="text-xs text-slate-500">{{ date(entry.occurredAtUtc) }} · Usuario {{ nameFor(entry.actorUserId) }}</p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

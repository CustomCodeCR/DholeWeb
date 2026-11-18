<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { UsersRound, Plus, RefreshCw, UserCheck, ShieldCheck, UserRoundPlus, Clock3, Layers3 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox, DhEmptyState, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhCard, DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { operationsApi, type OperationsAudit, type OperationsTeam, type OperationsUser, type OperationsMember } from '../services/operationsApi'

const auth = useAuthStore()
const canManage = computed(() => auth.hasScope('operations.team.manage'))
const canAudit = computed(() => auth.hasScope('operations.audit.read'))
const teams = ref<OperationsTeam[]>([])
const loading = ref(false)
const showCreate = ref(false)
const search = ref('')
const departmentFilter = ref('')
const departmentOptions = [ { label: 'Aperturas', value: 'APERTURAS' }, { label: 'Coordinación origen', value: 'COORDINACION_ORIGEN' } ]
const filterOptions = [{ label: 'Todos los departamentos', value: '' }, ...departmentOptions]
const teamColumns: DhTableColumn<OperationsTeam>[] = [
  { key: 'name', label: 'Equipo' }, { key: 'departmentCode', label: 'Departamento' },
  { key: 'members', label: 'Integrantes' }, { key: 'isActive', label: 'Estado' },
  { key: 'actions', label: '', align: 'right' },
]
const memberColumns: DhTableColumn<OperationsMember>[] = [
  { key: 'userId', label: 'Colaborador' }, { key: 'capacityPoints', label: 'Capacidad' },
  { key: 'isSupervisor', label: 'Rol' }, { key: 'isAvailable', label: 'Disponibilidad' },
  { key: 'actions', label: '', align: 'right' },
]
const filteredTeams = computed(() => teams.value.filter(team =>
  (!departmentFilter.value || team.departmentCode === departmentFilter.value) &&
  (!search.value.trim() || [team.name, team.departmentCode].some(v => v.toLowerCase().includes(search.value.trim().toLowerCase()))),
))
const activeTeams = computed(() => teams.value.filter(team => team.isActive).length)
const activeMembers = computed(() => new Set(teams.value.filter(team => team.isActive).flatMap(team => team.members.filter(member => member.isAvailable).map(member => member.userId))).size)
const userOptions = computed(() => users.value.map(user => ({ label: user.displayName + ' (' + user.userName + ')', value: user.id })))
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const validTeam = computed(() => uuidPattern.test(companyId.value.trim()) && newName.value.trim().length > 0 && newName.value.trim().length <= 150)
const memberRows = computed(() => selected.value?.members ?? [])
function departmentLabel(value: string) { return departmentOptions.find(option => option.value === value)?.label ?? value }

const users = ref<OperationsUser[]>([])
const selectedId = ref('')
const selected = computed(() => teams.value.find(t => t.id === selectedId.value))
const busy = ref(false)
const removingMemberId = ref('')
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
  loading.value = true
  error.value = ''
  try {
    teams.value = await operationsApi.teams()
    if (!selectedId.value && teams.value.length) selectedId.value = teams.value[0]?.id ?? ''
    if (selectedId.value && !teams.value.some(t => t.id === selectedId.value))
      selectedId.value = teams.value[0]?.id ?? ''
    await loadAudit()
  } catch (e) { report(e) }
  finally { loading.value = false }
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
  if (!canManage.value || busy.value || !validTeam.value) return
  error.value = ''; success.value = ''; busy.value = true
  try {
    const team = await operationsApi.createTeam({
      companyId: companyId.value.trim(), departmentCode: department.value, name: newName.value.trim(),
    })
    await reload()
    selectedId.value = team.id
    newName.value = ''
    showCreate.value = false
    success.value = 'Equipo creado. Agrega al menos dos validadores de Aperturas.'
    await loadAudit()
  } catch (e) { report(e) }
  finally { busy.value = false }
}
async function saveMember() {
  if (!selected.value || !memberId.value || busy.value || !canManage.value || !Number.isFinite(capacity.value) || capacity.value < 0.5 || capacity.value > 10000) return
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
  if (!selected.value || !canManage.value) return
  if (removingMemberId.value !== userId) {
    removingMemberId.value = userId
    return
  }
  try {
    await operationsApi.removeMember(selected.value.id, userId)
    removingMemberId.value = ''
    await reload()
  } catch (e) { report(e) }
}
async function toggleTeam() {
  if (!selected.value || !canManage.value) return
  try { await operationsApi.setTeamActive(selected.value.id, !selected.value.isActive); await reload() }
  catch (e) { report(e) }
}
onMounted(async () => { await Promise.all([reload(), searchUsers()]) })
</script>


<template>
  <div class="mx-auto w-full max-w-[1600px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <DhPageHeader title="Equipos y asignaciones" subtitle="Administra colaboradores, capacidades y disponibilidad del pool operativo." :icon="UsersRound" :hide-excel-export="false">
      <template #actions>
        <RouterLink to="/operations/apertures"><DhButton label="Ir a Aperturas" variant="secondary" :icon="Layers3" /></RouterLink>
        <DhButton label="Actualizar" variant="secondary" :icon="RefreshCw" :loading="loading" @click="reload" />
        <DhButton v-if="canManage" label="Nuevo equipo" :icon="Plus" @click="showCreate = true" />
      </template>
    </DhPageHeader>
    <div v-if="error" role="alert" class="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-300">{{ error }}</div>
    <div v-if="success" role="status" class="rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-700 dark:text-green-300">{{ success }}</div>
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">Equipos registrados</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ teams.length }}</p></div><UsersRound class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">Equipos activos</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ activeTeams }}</p></div><ShieldCheck class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">Colaboradores disponibles</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ activeMembers }}</p></div><UserCheck class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">En equipo seleccionado</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ selected?.members.length ?? 0 }}</p></div><UserRoundPlus class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
    </div>

    <DhCard title="Directorio de equipos" subtitle="Selecciona un equipo para administrar el personal y revisar la bitácora." :icon="UsersRound">
      <div class="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_260px]">
        <DhSearchInput v-model="search" placeholder="Buscar equipo o departamento..." />
        <DhSelect v-model="departmentFilter" :options="filterOptions" placeholder="" />
      </div>
      <DhDataTable :columns="teamColumns" :rows="filteredTeams" :loading="loading" empty-text="No hay equipos que coincidan con los filtros." @row-click="selectedId = $event.id; loadAudit()">
        <template #cell-name="{ row }"><strong class="text-[var(--dh-text)]">{{ row.name }}</strong></template>
        <template #cell-departmentCode="{ row }">{{ departmentLabel(row.departmentCode) }}</template>
        <template #cell-members="{ row }">{{ row.members.length }} integrantes</template>
        <template #cell-isActive="{ row }"><DhBadge :variant="row.isActive ? 'success' : 'neutral'">{{ row.isActive ? 'Activo' : 'Inactivo' }}</DhBadge></template>
        <template #cell-actions="{ row }"><DhButton :label="selectedId === row.id ? 'Seleccionado' : 'Gestionar'" variant="secondary" size="sm" @click="selectedId = row.id; loadAudit()" /></template>
      </DhDataTable>
    </DhCard>

    <div v-if="selected" class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <div class="space-y-4">
        <DhCard :title="selected.name" :subtitle="departmentLabel(selected.departmentCode)" :icon="ShieldCheck">
          <template #actions>
            <DhButton v-if="canManage" :label="selected.isActive ? 'Desactivar' : 'Activar'" variant="secondary" :loading="busy" @click="toggleTeam" />
          </template>
          <div class="flex flex-wrap items-center gap-2">
            <DhBadge :variant="selected.isActive ? 'success' : 'neutral'">{{ selected.isActive ? 'Activo' : 'Inactivo' }}</DhBadge>
            <DhBadge variant="primary">{{ selected.members.length }} integrantes</DhBadge>
            <DhBadge v-if="selected.departmentCode === 'APERTURAS' && selected.members.filter(member => member.isAvailable).length < 2" variant="warning">Faltan validadores disponibles</DhBadge>
          </div>
          <p class="mt-4 break-all text-xs text-[var(--dh-text-muted)]">Empresa: {{ selected.companyId }}</p>
          <div class="mt-5">
            <h3 class="mb-3 text-sm font-black text-[var(--dh-text)]">Colaboradores asignados</h3>
            <DhDataTable :columns="memberColumns" :rows="memberRows" empty-text="Este equipo todavía no tiene integrantes.">
              <template #cell-userId="{ row }"><strong class="text-[var(--dh-text)]">{{ nameFor(row.userId) }}</strong></template>
              <template #cell-capacityPoints="{ row }">{{ row.capacityPoints }} pts</template>
              <template #cell-isSupervisor="{ row }"><DhBadge :variant="row.isSupervisor ? 'primary' : 'neutral'">{{ row.isSupervisor ? 'Supervisor' : 'Operador' }}</DhBadge></template>
              <template #cell-isAvailable="{ row }"><DhBadge :variant="row.isAvailable ? 'success' : 'warning'">{{ row.isAvailable ? 'Disponible' : 'No disponible' }}</DhBadge></template>
              <template #cell-actions="{ row }">
                <div v-if="canManage" class="flex flex-wrap justify-end gap-2">
                  <DhButton :label="removingMemberId === row.userId ? 'Confirmar' : 'Retirar'" size="sm" variant="danger" @click="removeMember(row.userId)" />
                  <DhButton v-if="removingMemberId === row.userId" size="sm" label="Cancelar" variant="ghost" @click="removingMemberId = ''" />
                </div>
              </template>
            </DhDataTable>
          </div>
        </DhCard>
        <DhCard v-if="canManage" title="Agregar o actualizar colaborador" subtitle="Busca un usuario de Auth y configura su participación en este equipo." :icon="UserRoundPlus">
          <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <DhSearchInput v-model="userSearch" placeholder="Nombre o usuario en Auth..." @search="searchUsers" />
            <DhButton label="Buscar usuarios" variant="secondary" :icon="RefreshCw" @click="searchUsers" />
          </div>
          <form class="mt-4 space-y-4" @submit.prevent="saveMember">
            <div class="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(150px,1fr)]">
              <DhSelect v-model="memberId" label="Colaborador *" :options="userOptions" placeholder="Selecciona un usuario" />
              <DhInput :model-value="capacity" label="Capacidad de trabajo (puntos)" type="number" :min="0.5" :max="10000" :step="0.5" @update:model-value="capacity = Number($event)" />
            </div>
            <div class="flex flex-wrap gap-x-7 gap-y-3">
              <DhCheckbox v-model="isSupervisor" label="Supervisor" />
              <DhCheckbox v-model="isAvailable" label="Disponible para asignaciones" />
            </div>
            <p class="text-xs text-[var(--dh-text-muted)]">Auth valida que el usuario esté activo y sea interno. Sus scopes se administran desde Seguridad.</p>
            <DhButton type="submit" label="Guardar integrante" :icon="UserCheck" :loading="busy" :disabled="!memberId || !Number.isFinite(capacity) || capacity < 0.5 || capacity > 10000" />
          </form>
        </DhCard>
      </div>
      <DhCard v-if="canAudit" title="Audit log del equipo" subtitle="Registro de cambios de integrantes, roles y disponibilidad." :icon="Clock3">
        <DhEmptyState v-if="!history.length" :icon="Clock3" title="Sin eventos registrados" description="La bitácora se actualizará al gestionar este equipo." />
        <ol v-else class="space-y-3">
          <li v-for="event in history" :key="event.eventId" class="border-l-2 border-[var(--dh-primary)] py-1 pl-4">
            <p class="break-all text-sm font-bold text-[var(--dh-text)]">{{ event.actionCode }}</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ date(event.occurredAtUtc) }} · {{ nameFor(event.actorUserId) }}</p>
          </li>
        </ol>
      </DhCard>
    </div>
    <DhEmptyState v-else-if="!loading" :icon="UsersRound" title="Sin equipo seleccionado" description="Crea tu primer equipo para configurar los colaboradores y el pool de validación." :action-label="canManage ? 'Crear equipo' : undefined" @action="showCreate = true" />

    <DhModal :open="showCreate && canManage" title="Nuevo equipo operativo" size="lg" @close="showCreate = false">
      <form class="space-y-5" @submit.prevent="createTeam">
        <p class="text-sm text-[var(--dh-text-muted)]">Crea el equipo y después asigna manualmente sus colaboradores desde Auth. Las aperturas necesitan dos validadores diferentes.</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <DhInput v-model="companyId" label="Empresa · UUID *" placeholder="UUID de empresa" :error="companyId && !uuidPattern.test(companyId.trim()) ? 'Ingresa un UUID válido.' : undefined" />
          <DhSelect v-model="department" label="Departamento *" :options="departmentOptions" placeholder="" />
          <div class="sm:col-span-2"><DhInput v-model="newName" label="Nombre del equipo *" placeholder="Ej. Equipo de validación 1" :error="newName.length > 150 ? 'Máximo 150 caracteres.' : undefined" /></div>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <DhButton variant="secondary" label="Cancelar" @click="showCreate = false" />
          <DhButton type="submit" label="Crear equipo" :icon="Plus" :loading="busy" :disabled="!validTeam" />
        </div>
      </form>
    </DhModal>
  </div>
</template>

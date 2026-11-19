<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { UsersRound, RefreshCw, UserCheck, ShieldCheck, UserRoundPlus, Layers3, Pencil, UserMinus, SlidersHorizontal } from 'lucide-vue-next'
import OperationsAuditTimeline from '../components/OperationsAuditTimeline.vue'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhCard, DhSearchInput } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { operationsApi, type OperationsAudit, type OperationsTeam, type OperationsUser, type OperationsMember } from '../services/operationsApi'

const { t } = useI18n()
const auth = useAuthStore()
const canManage = computed(() => auth.hasScope('operations.team.manage'))
const canAudit = computed(() => auth.hasScope('operations.audit.read'))
const teams = ref<OperationsTeam[]>([])
const users = ref<OperationsUser[]>([])
const selectedId = ref('')
const selected = computed(() => teams.value.find(team => team.id === selectedId.value))
const departmentFilter = ref('')
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const success = ref('')
const history = ref<OperationsAudit[]>([])
const auditPeople = ref<OperationsUser[]>([])
const auditDisplayUsers = computed(() => [...users.value, ...auditPeople.value])
const userSearch = ref('')
const memberId = ref('')
const capacity = ref(10)
const isSupervisor = ref(false)
const isAvailable = ref(true)
const showAdvanced = ref(false)
const removingMemberId = ref('')

const departmentCodes = ['APERTURAS', 'COORDINACION_ORIGEN', 'DOCUMENTACION', 'TRANSITO', 'PANAMA', 'COSTA_RICA', 'FINANZAS']
const catalogKeys: Record<string, string> = {
  'Aperturas': 'aperture',
  'Origen · Estados Unidos': 'usa',
  'Origen · FCL internacional': 'fcl',
  'Origen · LCL y Aéreo internacional': 'lclAir',
  'Origen · Transporte terrestre': 'land',
  'Documentación': 'documents',
  'Tránsito': 'transit',
  'Operaciones Panamá': 'panama',
  'Operaciones Costa Rica': 'costaRica',
  'Finanzas': 'finance',
}
function teamName(team: OperationsTeam): string {
  return catalogKeys[team.name] ? t('operations.catalog.' + catalogKeys[team.name]) : team.name
}
function departmentName(code: string): string {
  return departmentCodes.includes(code) ? t('operations.departments.' + code) : code
}
function nameFor(id: string): string {
  const user = users.value.find(candidate => candidate.id === id)
  return user?.displayName || user?.userName || id.slice(0, 8)
}
function initials(id: string): string {
  return nameFor(id).split(/\s+/).map(part => part[0] ?? '').slice(0, 2).join('').toUpperCase()
}
function memberLabel(count: number): string {
  return t(count === 1 ? 'operations.memberOne' : 'operations.memberCount', { count })
}
const departments = computed(() => [
  { label: t('operations.allDepartments'), value: '' },
  ...departmentCodes.map(value => ({ label: departmentName(value), value })),
])
const filteredTeams = computed(() => teams.value.filter(team =>
  !departmentFilter.value || team.departmentCode === departmentFilter.value))
const teamOptions = computed(() => filteredTeams.value
  .map(team => ({
    value: team.id,
    label: teamName(team) + ' · ' + memberLabel(team.members.length),
  }))
  .sort((a, b) => a.label.localeCompare(b.label)))
const teamSelection = computed({
  get: () => selectedId.value,
  set: (value: string) => chooseTeam(value),
})
const activeTeams = computed(() => teams.value.filter(team => team.isActive).length)
const activeMembers = computed(() => new Set(teams.value.filter(team => team.isActive)
  .flatMap(team => team.members.filter(member => member.isAvailable).map(member => member.userId))).size)
const members = computed(() => [...(selected.value?.members ?? [])]
  .sort((a, b) => nameFor(a.userId).localeCompare(nameFor(b.userId))))
const options = computed(() => users.value
  .map(user => ({ label: user.displayName + ' (' + user.userName + ')', value: user.id }))
  .sort((a, b) => a.label.localeCompare(b.label)))
const selectedMember = computed(() => members.value.find(member => member.userId === memberId.value))
const availableReviewers = computed(() => selected.value?.members.filter(member => member.isAvailable).length ?? 0)

function fail(value: unknown) {
  error.value = value instanceof Error ? value.message : t('operations.saveError')
}
function clearForm() {
  memberId.value = ''
  capacity.value = 10
  isSupervisor.value = false
  isAvailable.value = true
  showAdvanced.value = false
}
async function reload() {
  loading.value = true
  try {
    teams.value = await operationsApi.teams()
    if (!selectedId.value || !teams.value.some(team => team.id === selectedId.value))
      selectedId.value = teams.value[0]?.id ?? ''
    await loadAudit()
  } catch (value) { fail(value) }
  finally { loading.value = false }
}
async function searchUsers() {
  if (!canManage.value) return
  try {
    const result = await operationsApi.users(userSearch.value)
    const byId = new Map(users.value.map(user => [user.id, user]))
    for (const user of result.items) byId.set(user.id, user)
    users.value = [...byId.values()]
  } catch (value) { fail(value) }
}
async function loadAudit() {
  const teamId = selectedId.value
  history.value = []
  auditPeople.value = []
  if (canAudit.value && teamId) {
    try {
      const events = await operationsApi.teamAudit(teamId)
      if (selectedId.value !== teamId) return
      history.value = events
      const ids = [...new Set(events.map(event => event.actorUserId))]
      const people = await operationsApi.auditActors(ids)
      if (selectedId.value === teamId) auditPeople.value = people.items
    } catch (value) { fail(value) }
  }
}
function chooseTeam(id: string) {
  selectedId.value = id
  removingMemberId.value = ''
  clearForm()
  void loadAudit()
}
function editMember(member: OperationsMember) {
  memberId.value = member.userId
  capacity.value = member.capacityPoints
  isSupervisor.value = member.isSupervisor
  isAvailable.value = member.isAvailable
  showAdvanced.value = true
}
async function saveMember() {
  if (!selected.value || !memberId.value || busy.value || !canManage.value ||
      !Number.isFinite(capacity.value) || capacity.value < 0.5 || capacity.value > 10000) return
  error.value = ''
  success.value = ''
  busy.value = true
  try {
    await operationsApi.saveMember(selected.value.id, {
      userId: memberId.value, capacityPoints: capacity.value,
      isSupervisor: isSupervisor.value, isAvailable: isAvailable.value,
    })
    await reload()
    clearForm()
    success.value = t('operations.assigned')
  } catch (value) { fail(value) }
  finally { busy.value = false }
}
async function removeMember(userId: string) {
  if (!selected.value || !canManage.value || busy.value) return
  if (removingMemberId.value !== userId) {
    removingMemberId.value = userId
    return
  }
  error.value = ''
  busy.value = true
  try {
    await operationsApi.removeMember(selected.value.id, userId)
    removingMemberId.value = ''
    if (memberId.value === userId) clearForm()
    await reload()
    success.value = t('operations.removed')
  } catch (value) { fail(value) }
  finally { busy.value = false }
}
async function toggleTeam() {
  if (!selected.value || !canManage.value || busy.value) return
  error.value = ''
  busy.value = true
  try {
    await operationsApi.setTeamActive(selected.value.id, !selected.value.isActive)
    await reload()
    success.value = t('operations.updated')
  } catch (value) { fail(value) }
  finally { busy.value = false }
}
async function initialize() {
  if (canManage.value) {
    try { await operationsApi.initializeTeams() }
    catch (value) { fail(value) }
  }
  await Promise.all([reload(), searchUsers()])
}
onMounted(initialize)
</script>

<template>
  <div class="mx-auto w-full max-w-[1600px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <DhPageHeader :title="t('operations.teamsTitle')" :subtitle="t('operations.teamsSubtitle')" :icon="UsersRound" :hide-excel-export="true">
      <template #actions>
        <RouterLink to="/operations/apertures"><DhButton :label="t('operations.goToApertures')" variant="secondary" :icon="Layers3" /></RouterLink>
        <DhButton :label="t('operations.refresh')" variant="secondary" :icon="RefreshCw" :loading="loading" @click="reload" />
      </template>
    </DhPageHeader>

    <div v-if="error" role="alert" class="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-300">{{ error }}</div>
    <div v-if="success" role="status" class="rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-700 dark:text-green-300">{{ success }}</div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <DhCard padding="sm"><p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('operations.totalTeams') }}</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ teams.length }}</p></DhCard>
      <DhCard padding="sm"><p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('operations.activeTeams') }}</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ activeTeams }}</p></DhCard>
      <DhCard padding="sm" class="col-span-2 lg:col-span-1"><p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('operations.availablePeople') }}</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ activeMembers }}</p></DhCard>
    </div>

    <div class="grid items-start gap-4 lg:grid-cols-[minmax(270px,0.9fr)_minmax(0,1.8fr)]">
      <DhCard :title="t('operations.teamsDirectory')" :subtitle="t('operations.teamsDirectoryHint')" :icon="UsersRound">
        <div class="space-y-3">
          <DhSelect v-model="departmentFilter" :label="t('operations.teamDepartmentFilter')" :options="departments" :placeholder="''" />
          <DhSelect v-model="teamSelection" :label="t('operations.selectTeam')" :options="teamOptions" :placeholder="t('operations.teamChoosePlaceholder')" :disabled="loading || !filteredTeams.length" />
          <p v-if="!loading && !teams.length" class="py-6 text-center text-sm text-[var(--dh-text-muted)]">{{ t('operations.teamEmptyHint') }}</p>
          <p v-else-if="!filteredTeams.length" class="py-6 text-center text-sm text-[var(--dh-text-muted)]">{{ t('operations.teamSearchEmpty') }}</p>
          <div v-else-if="selected" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
            <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ departmentName(selected.departmentCode) }}</p>
            <p class="mt-1 font-bold text-[var(--dh-text)]">{{ teamName(selected) }}</p>
            <div class="mt-3 flex items-center gap-2 text-xs text-[var(--dh-text-soft)]">
              <span class="h-2.5 w-2.5 rounded-full" :class="selected.isActive ? 'bg-emerald-500' : 'bg-gray-400'" />
              <span>{{ selected.isActive ? t('operations.active') : t('operations.inactive') }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ memberLabel(selected.members.length) }}</span>
            </div>
          </div>
        </div>
      </DhCard>

      <div v-if="selected" class="space-y-4">
        <DhCard :title="teamName(selected)" :subtitle="departmentName(selected.departmentCode)" :icon="ShieldCheck">
          <template #actions>
            <DhButton v-if="canManage" :label="selected.isActive ? t('operations.deactivate') : t('operations.activate')" variant="secondary" size="sm" :loading="busy" @click="toggleTeam" />
          </template>
          <div class="flex flex-wrap gap-2">
            <DhBadge :variant="selected.isActive ? 'success' : 'neutral'">{{ selected.isActive ? t('operations.active') : t('operations.inactive') }}</DhBadge>
            <DhBadge variant="primary">{{ memberLabel(selected.members.length) }}</DhBadge>
          </div>
          <p v-if="selected.departmentCode === 'APERTURAS' && availableReviewers < 2"
            class="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">
            {{ t('operations.missingReviewers') }}
          </p>
          <div class="mt-5 border-t border-[var(--dh-border)] pt-4">
            <h3 class="text-sm font-black text-[var(--dh-text)]">{{ t('operations.teamMembers') }}</h3>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ t('operations.teamMembersHint') }}</p>
            <p v-if="!members.length" class="py-7 text-center text-sm text-[var(--dh-text-muted)]">{{ t('operations.memberEmpty') }}</p>
            <div v-else class="mt-3 space-y-2">
              <div v-for="member in members" :key="member.userId" class="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dh-primary)]/15 text-xs font-black text-[var(--dh-primary)]">{{ initials(member.userId) }}</span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-bold text-[var(--dh-text)]">{{ nameFor(member.userId) }}</p>
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--dh-text-muted)]">
                    <span>{{ member.isSupervisor ? t('operations.supervisor') : t('operations.operator') }}</span>
                    <span>·</span><span>{{ member.isAvailable ? t('operations.available') : t('operations.unavailable') }}</span>
                  </div>
                </div>
                <div v-if="canManage" class="flex flex-wrap gap-1">
                  <DhButton size="sm" variant="secondary" :icon="Pencil" :label="t('operations.edit')" @click="editMember(member)" />
                  <DhButton size="sm" variant="danger" :icon="UserMinus" :label="removingMemberId === member.userId ? t('operations.confirmRemove') : t('operations.remove')" @click="removeMember(member.userId)" />
                  <DhButton v-if="removingMemberId === member.userId" size="sm" variant="ghost" :label="t('operations.cancel')" @click="removingMemberId = ''" />
                </div>
              </div>
            </div>
          </div>
        </DhCard>

        <DhCard v-if="canManage" :title="selectedMember ? t('operations.editMember') : t('operations.addMember')" :subtitle="t('operations.privatePermissions')" :icon="UserRoundPlus">
          <form class="space-y-4" @submit.prevent="saveMember">
            <p class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-xs text-[var(--dh-text-soft)]">{{ t('operations.eligibleRolesHint') }}</p>
            <div class="flex flex-wrap gap-2">
              <div class="min-w-0 flex-1"><DhSearchInput v-model="userSearch" :placeholder="t('operations.memberSearch')" @search="searchUsers" /></div>
              <DhButton size="sm" variant="secondary" :label="t('operations.searchPeople')" :icon="RefreshCw" @click="searchUsers" />
            </div>
            <DhSelect v-model="memberId" :label="t('operations.person')" :options="options" :placeholder="t('operations.personPlaceholder')" :disabled="!options.length" />
            <p v-if="!options.length" class="text-xs text-[var(--dh-text-muted)]">{{ t('operations.noEligibleUsers') }}</p>
            <div class="flex flex-wrap gap-x-8 gap-y-3">
              <DhCheckbox v-model="isSupervisor" :label="t('operations.supervisor')" />
              <DhCheckbox v-model="isAvailable" :label="t('operations.availableForWork')" />
            </div>
            <button type="button" class="flex items-center gap-2 text-xs font-bold text-[var(--dh-primary)]" :aria-expanded="showAdvanced" @click="showAdvanced = !showAdvanced">
              <SlidersHorizontal class="h-4 w-4" />
              {{ showAdvanced ? t('operations.hideAdvanced') : t('operations.advanced') }}
            </button>
            <div v-if="showAdvanced" class="rounded-xl border border-[var(--dh-border)] p-4">
              <DhInput :model-value="capacity" :label="t('operations.capacity')" type="number" :min="0.5" :max="10000" :step="0.5" @update:model-value="capacity = Number($event)" />
              <p class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ t('operations.capacityHelp') }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <DhButton type="submit" :label="selectedMember ? t('operations.updateMember') : t('operations.assign')" :icon="UserCheck" :loading="busy" :disabled="!memberId || !Number.isFinite(capacity) || capacity < 0.5 || capacity > 10000" />
              <DhButton v-if="memberId" variant="ghost" :label="t('operations.cancel')" @click="clearForm" />
            </div>
          </form>
        </DhCard>
        <DhCard v-if="canAudit" :title="t('operations.audit')" :subtitle="t('operations.auditHint')" :icon="Clock3">
          <OperationsAuditTimeline :events="history" :users="auditDisplayUsers" :empty-title="t('operations.noAudit')" />
        </DhCard>
      </div>
      <DhCard v-else :title="t('operations.selectTeam')" :subtitle="t('operations.selectTeamHint')" :icon="UsersRound" />
    </div>
  </div>
</template>

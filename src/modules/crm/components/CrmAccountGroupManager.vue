<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DhModal } from '@/shared/components/organisms'
import { DhButton } from '@/shared/components/atoms'
import { crmError, crmList, crmPath, crmRequest } from '../services/crmApi'

type Member = {
  id: string
  displayName: string
  legalName: string
  taxId: string
  parentAccountId: string | null
  rowVersion: number
}
type AccountGroup = { primaryId: string; members: Member[] }

const props = defineProps<{ accountId: string; canManage: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const group = ref<AccountGroup | null>(null)
const open = ref(false)
const query = ref('')
const candidates = ref<Member[]>([])
const selectedId = ref('')
const error = ref('')
const working = ref(false)
const searching = ref(false)
const removingId = ref('')
const members = computed(() => group.value?.members ?? [])
const memberIds = computed(() => new Set(members.value.map(member => member.id)))
const isGrouped = computed(() => members.value.length > 1 || (
  Boolean(group.value?.primaryId) && group.value?.primaryId !== props.accountId
))
const primary = computed(() => members.value.find(member => member.id === group.value?.primaryId))
const selected = computed(() => candidates.value.find(member => member.id === selectedId.value))

async function refresh() {
  if (!props.accountId) return
  try {
    group.value = await crmRequest<AccountGroup>(crmPath('accounts', props.accountId, 'group'))
  } catch (cause) {
    group.value = null
    error.value = crmError(cause)
  }
}
watch(() => props.accountId, () => {
  open.value = false
  candidates.value = []
  selectedId.value = ''
  error.value = ''
  void refresh()
}, { immediate: true })

async function searchAccounts() {
  if (!props.canManage) return
  searching.value = true
  error.value = ''
  try {
    const response = await crmList('accounts', { q: query.value.trim(), page: 1, pageSize: 100 })
    candidates.value = response.items
      .filter(item => !memberIds.value.has(String(item.id)) && !item.parentAccountId)
      .map(item => ({
        id: String(item.id),
        displayName: String(item.displayName ?? ''),
        legalName: String(item.legalName ?? ''),
        taxId: String(item.taxId ?? ''),
        parentAccountId: item.parentAccountId ? String(item.parentAccountId) : null,
        rowVersion: Number(item.rowVersion ?? 0),
      }))
    selectedId.value = ''
  } catch (cause) { error.value = crmError(cause) }
  finally { searching.value = false }
}

async function linkAccount() {
  if (!props.canManage || !selected.value || working.value) return
  working.value = true
  error.value = ''
  try {
    await crmRequest(crmPath('accounts', props.accountId, 'group/members'), 'POST', {
      memberAccountId: selected.value.id,
      expectedVersion: selected.value.rowVersion,
    })
    await refresh()
    candidates.value = candidates.value.filter(item => item.id !== selectedId.value)
    selectedId.value = ''
    emit('changed')
  } catch (cause) { error.value = crmError(cause) }
  finally { working.value = false }
}

async function unlinkAccount(member: Member) {
  if (!props.canManage || member.id === group.value?.primaryId || working.value) return
  if (removingId.value !== member.id) {
    removingId.value = member.id
    return
  }
  working.value = true
  error.value = ''
  try {
    await crmRequest(crmPath('accounts', props.accountId,
      'group/members/' + encodeURIComponent(member.id)) +
      '?expectedVersion=' + encodeURIComponent(String(member.rowVersion)), 'DELETE')
    removingId.value = ''
    await refresh()
    emit('changed')
  } catch (cause) { error.value = crmError(cause) }
  finally { working.value = false }
}
function showManager() {
  open.value = true
  query.value = ''
  error.value = ''
  removingId.value = ''
  void searchAccounts()
}
</script>

<template>
  <section class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3" data-crm-account-group>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-extrabold">Grupo de cuentas</h2>
        <p class="text-xs text-[var(--dh-text-muted)]">
          {{ isGrouped ? members.length + ' cuentas comparten actividad, análisis, procedimientos, tarifas y cotizaciones.' :
            'Esta cuenta es independiente. Podés vincular otras cuentas sin fusionar sus datos fiscales.' }}
        </p>
      </div>
      <DhButton v-if="canManage" label="Agrupar cuentas" variant="secondary" size="sm" @click="showManager" />
    </div>
    <div v-if="isGrouped" class="mt-3 flex flex-wrap gap-2">
      <RouterLink v-for="member in members" :key="member.id"
        :to="'/crm/accounts/' + encodeURIComponent(member.id)"
        class="rounded-lg border border-[var(--dh-border)] px-3 py-1.5 text-xs font-semibold hover:text-[var(--dh-primary)]">
        {{ member.id === group?.primaryId ? 'Principal · ' : 'Vinculada · ' }}
        {{ member.displayName || member.legalName }}
        <span v-if="member.id === accountId">(actual)</span>
      </RouterLink>
    </div>
    <p v-if="isGrouped && !primary" class="mt-2 text-xs text-amber-600">
      La cuenta principal no está visible para este usuario. Solo se muestran registros autorizados.
    </p>
    <DhModal :open="open" title="Agrupar cuentas comerciales" size="lg" @close="!working && (open = false)">
      <div class="space-y-4 p-2">
        <p class="text-sm text-[var(--dh-text-muted)]">
          Elegí cuentas existentes para vincularlas. Cada una conserva su razón social,
          identificación, contactos, dirección, crédito y vendedor.
        </p>
        <div v-if="members.length" class="space-y-2">
          <div v-for="member in members" :key="member.id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dh-border)] p-3">
            <div>
              <p class="text-sm font-bold">{{ member.displayName || member.legalName }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">
                {{ member.taxId || 'Sin identificación' }} ·
                {{ member.id === group?.primaryId ? 'Cuenta principal' : 'Cuenta vinculada' }}
              </p>
            </div>
            <DhButton v-if="canManage && member.id !== group?.primaryId"
              :label="removingId === member.id ? 'Confirmar desvincular' : 'Desvincular'"
              :disabled="working" variant="secondary" size="sm" @click="unlinkAccount(member)" />
          </div>
        </div>
        <form v-if="canManage" class="flex flex-wrap gap-2" @submit.prevent="searchAccounts">
          <input v-model="query" type="search" aria-label="Buscar cuentas para agrupar"
            placeholder="Buscar razón social, nombre o cédula..."
            class="min-w-[220px] flex-1 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm" />
          <DhButton type="submit" label="Buscar cuentas" variant="secondary" :loading="searching" />
        </form>
        <div v-if="canManage && candidates.length" class="space-y-2">
          <label class="block text-sm font-semibold" for="crm-group-candidate">Cuenta para vincular</label>
          <select id="crm-group-candidate" v-model="selectedId"
            class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm">
            <option value="">Seleccioná una cuenta</option>
            <option v-for="member in candidates" :key="member.id" :value="member.id">
              {{ member.displayName || member.legalName }} · {{ member.taxId }}
            </option>
          </select>
          <DhButton label="Vincular cuenta" :disabled="!selected || working" :loading="working" @click="linkAccount" />
        </div>
        <p v-else-if="canManage && !searching" class="text-xs text-[var(--dh-text-muted)]">
          No se encontraron cuentas independientes para vincular.
        </p>
        <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
        <div class="flex justify-end"><DhButton label="Cerrar" variant="secondary" :disabled="working" @click="open = false" /></div>
      </div>
    </DhModal>
  </section>
</template>

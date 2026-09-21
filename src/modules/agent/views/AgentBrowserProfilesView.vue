<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, Globe2, LogIn, Plus, RefreshCw } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import type { BrowserProfileDto } from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import AgentStatusBadge from '@/modules/agent/components/AgentStatusBadge.vue'
import { useAgentFormatting } from '@/modules/agent/composables/useAgentFormatting'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

const { t } = useI18n()
const store = useAgentStore()
const toastStore = useToastStore()
const permissions = useAgentPermissions()
const { formatDate } = useAgentFormatting()

const createOpen = ref(false)
const detailOpen = ref(false)
const saving = ref(false)
const authenticatingId = ref<string | null>(null)
const selectedProfile = ref<BrowserProfileDto | null>(null)

const form = reactive({
  providerId: '',
  credentialId: '',
  name: '',
  profileKey: '',
  storagePath: '',
})

const columns: DhTableColumn<BrowserProfileDto>[] = [
  { key: 'name', label: t('agent.fields.name') },
  { key: 'providerId', label: t('agent.fields.provider') },
  { key: 'credentialId', label: t('agent.fields.credential') },
  { key: 'profileKey', label: t('agent.fields.profileKey') },
  { key: 'status', label: t('agent.fields.status') },
  { key: 'lastLoginAt', label: t('agent.fields.lastLogin') },
  { key: 'lastUsedAt', label: t('agent.fields.lastUse') },
  { key: 'sessionExpiresAt', label: t('agent.fields.expires') },
  { key: 'isActive', label: t('agent.fields.active'), align: 'center' },
  { key: 'actions', label: t('common.actions'), align: 'right' },
]

const providerOptions = computed(() =>
  store.activeProviders.map((provider) => ({
    value: provider.id,
    label: `${provider.name} · ${provider.code}`,
  })),
)

const credentialOptions = computed(() =>
  store.credentials
    .filter((credential) => credential.providerId === form.providerId && credential.isActive)
    .map((credential) => ({ value: credential.id, label: credential.name })),
)

watch(
  () => form.providerId,
  () => {
    if (!credentialOptions.value.some((item) => item.value === form.credentialId)) {
      form.credentialId = credentialOptions.value[0]?.value ?? ''
    }
  },
)

function providerName(id: string) {
  return store.providers.find((provider) => provider.id === id)?.name ?? id
}

function credentialName(id: string) {
  return store.credentials.find((credential) => credential.id === id)?.name ?? id
}

function statusVariant(status: string): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'Authenticated' || status === 'Ready') return 'success'
  if (status === 'Authenticating') return 'primary'
  if (status === 'LoginRequired' || status === 'Expired') return 'warning'
  if (status === 'Blocked' || status === 'Error') return 'danger'
  return 'neutral'
}

function resetForm() {
  form.providerId = store.activeProviders[0]?.id ?? ''
  form.credentialId =
    store.credentials.find(
      (credential) => credential.providerId === form.providerId && credential.isActive,
    )?.id ?? ''
  form.name = ''
  form.profileKey = ''
  form.storagePath = ''
}

function openCreate() {
  resetForm()
  createOpen.value = true
}

async function createProfile() {
  if (saving.value) return

  try {
    if (!form.providerId) throw new Error(t('agent.validation.required', { field: t('agent.fields.provider') }))
    if (!form.credentialId) throw new Error(t('agent.validation.required', { field: t('agent.fields.credential') }))
    if (!form.name.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.name') }))
    if (!form.profileKey.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.profileKey') }))
    if (!form.storagePath.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.storagePath') }))

    saving.value = true
    await AgentService.createBrowserProfile({
      providerId: form.providerId,
      credentialId: form.credentialId,
      name: form.name.trim(),
      profileKey: form.profileKey.trim(),
      storagePath: form.storagePath.trim(),
    })

    toastStore.success(t('agent.messages.profileCreated'))
    createOpen.value = false
    await store.loadBrowserProfiles()
  } catch (error) {
    if (error instanceof Error && !('status' in error)) {
      toastStore.warning(t('agent.review.profile'), error.message)
    } else {
      toastStore.backendError(error, t('agent.errors.createProfile'))
    }
  } finally {
    saving.value = false
  }
}

async function authenticate(row: BrowserProfileDto) {
  if (authenticatingId.value) return

  try {
    authenticatingId.value = row.id
    await AgentService.authenticateBrowserProfile(row.id)
    toastStore.success(t('agent.messages.authRequested'), row.name)
    await store.loadBrowserProfiles()
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.authenticateProfile'))
  } finally {
    authenticatingId.value = null
  }
}

async function viewDetail(row: BrowserProfileDto) {
  try {
    selectedProfile.value = await AgentService.getBrowserProfile(row.id)
    detailOpen.value = true
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.loadProfile'))
  }
}

async function refresh() {
  try {
    await Promise.all([
      store.loadProviders(),
      store.loadCredentials(),
      store.loadBrowserProfiles(),
    ])
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.loadProfiles'))
  }
}

onMounted(refresh)
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader
      :title="t('agent.browserProfiles.title')"
      :subtitle="t('agent.browserProfiles.subtitle')"
      :icon="Globe2"
    >
      <template #actions>
        <DhButton
          :label="t('agent.actions.refresh')"
          :icon="RefreshCw"
          variant="secondary"
          :loading="store.loading"
          @click="refresh"
        />
        <DhButton
          v-if="permissions.canAuthenticateBrowserProfiles.value"
          :label="t('agent.browserProfiles.createAction')"
          :icon="Plus"
          @click="openCreate"
        />
      </template>
    </DhPageHeader>

    <DhDataTable
      :columns="columns"
      :rows="store.browserProfiles"
      :loading="store.loading"
      :empty-text="t('agent.browserProfiles.empty')"
    >
      <template #cell-providerId="{ row }">{{ providerName(row.providerId) }}</template>
      <template #cell-credentialId="{ row }">{{ credentialName(row.credentialId) }}</template>
      <template #cell-status="{ row }">
        <DhBadge :label="t(`agent.browserStatus.${row.status}`)" :variant="statusVariant(row.status)" />
      </template>
      <template #cell-lastLoginAt="{ row }">{{ formatDate(row.lastLoginAt) }}</template>
      <template #cell-lastUsedAt="{ row }">{{ formatDate(row.lastUsedAt) }}</template>
      <template #cell-sessionExpiresAt="{ row }">{{ formatDate(row.sessionExpiresAt) }}</template>
      <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>
      <template #cell-actions="{ row }">
        <div class="flex flex-wrap justify-end gap-2" @click.stop>
          <DhButton
            :label="t('agent.actions.viewDetails')"
            :icon="Eye"
            variant="ghost"
            size="sm"
            @click="viewDetail(row)"
          />
          <DhButton
            v-if="permissions.canAuthenticateBrowserProfiles.value"
            :label="t('agent.actions.authenticate')"
            :icon="LogIn"
            variant="secondary"
            size="sm"
            :loading="authenticatingId === row.id"
            :disabled="Boolean(authenticatingId) && authenticatingId !== row.id"
            @click="authenticate(row)"
          />
        </div>
      </template>
    </DhDataTable>

    <DhModal :open="createOpen" :title="t('agent.browserProfiles.createTitle')" size="lg" @close="createOpen = false">
      <form class="grid gap-4" @submit.prevent="createProfile">
        <div class="grid gap-4 md:grid-cols-2">
          <DhSelect
            v-model="form.providerId"
            :label="t('agent.fields.provider')"
            :options="providerOptions"
            :disabled="saving"
          />
          <DhSelect
            v-model="form.credentialId"
            :label="t('agent.fields.credential')"
            :options="credentialOptions"
            :disabled="saving || !form.providerId"
          />
          <DhInput v-model="form.name" :label="t('agent.fields.name')" :disabled="saving" />
          <DhInput v-model="form.profileKey" :label="t('agent.fields.profileKey')" :disabled="saving" />
          <div class="md:col-span-2">
            <DhInput
              v-model="form.storagePath"
              :label="t('agent.fields.storagePath')"
              placeholder="/data/browser-profiles/maersk"
              :disabled="saving"
            />
          </div>
        </div>

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DhButton :label="t('agent.actions.cancel')" variant="secondary" :disabled="saving" @click="createOpen = false" />
          <DhButton type="submit" :label="t('agent.browserProfiles.createAction')" :loading="saving" />
        </div>
      </form>
    </DhModal>

    <DhModal :open="detailOpen" :title="t('agent.browserProfiles.detailTitle')" size="lg" @close="detailOpen = false">
      <dl v-if="selectedProfile" class="grid gap-3 sm:grid-cols-2">
        <div v-for="item in [
          ['ID', selectedProfile.id],
          ['Nombre', selectedProfile.name],
          ['Provider', providerName(selectedProfile.providerId)],
          ['Credential', credentialName(selectedProfile.credentialId)],
          ['Profile Key', selectedProfile.profileKey],
          ['Storage Path', selectedProfile.storagePath],
          ['Estado', selectedProfile.status],
          ['Último login', formatDate(selectedProfile.lastLoginAt)],
          ['Último uso', formatDate(selectedProfile.lastUsedAt)],
          ['Expira', formatDate(selectedProfile.sessionExpiresAt)],
        ]" :key="String(item[0])" class="min-w-0 rounded-[18px] border border-[var(--dh-border)] p-3">
          <dt class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ item[0] }}</dt>
          <dd class="mt-1 break-all text-sm font-bold text-[var(--dh-text)]">{{ item[1] || '—' }}</dd>
        </div>
      </dl>
    </DhModal>
  </div>
</template>

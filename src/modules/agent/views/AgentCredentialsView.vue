<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KeyRound, Pencil, Plus, Power, RefreshCw } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhConfirmDialog, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import type { AgentCredentialDto } from '@/core/interfaces/agent'
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

const modalOpen = ref(false)
const confirmOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const pendingToggle = ref<AgentCredentialDto | null>(null)

const form = reactive({
  providerId: '',
  name: '',
  usernameSecretKey: '',
  passwordSecretKey: '',
  additionalSecretsJson: '',
})

const columns: DhTableColumn<AgentCredentialDto>[] = [
  { key: 'name', label: t('agent.fields.name') },
  { key: 'providerId', label: t('agent.fields.provider') },
  { key: 'isActive', label: t('agent.fields.status'), align: 'center' },
  { key: 'createdAtUtc', label: t('agent.fields.created') },
  { key: 'updatedAtUtc', label: t('agent.fields.updatedAt') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
]

const providerOptions = computed(() =>
  store.providers.map((provider) => ({
    value: provider.id,
    label: `${provider.name} · ${provider.code}`,
  })),
)

function providerName(id: string) {
  return store.providers.find((provider) => provider.id === id)?.name ?? id
}

function resetForm() {
  editingId.value = null
  form.providerId = store.activeProviders[0]?.id ?? ''
  form.name = ''
  form.usernameSecretKey = ''
  form.passwordSecretKey = ''
  form.additionalSecretsJson = ''
}

function openCreate() {
  resetForm()
  modalOpen.value = true
}

function openEdit(row: AgentCredentialDto) {
  editingId.value = row.id
  form.providerId = row.providerId
  form.name = row.name
  // El DTO deliberadamente no expone referencias de secretos previamente guardadas.
  // Para actualizar se solicitan nuevamente las keys, nunca el valor real del secreto.
  form.usernameSecretKey = ''
  form.passwordSecretKey = ''
  form.additionalSecretsJson = ''
  modalOpen.value = true
}

function validateAdditionalSecrets() {
  const value = form.additionalSecretsJson.trim()
  if (!value) return null

  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(t('agent.validation.objectJson', { field: t('agent.fields.additionalSecretsJson') }))
    }
    return value
  } catch (error) {
    if (error instanceof Error && error.message === t('agent.validation.objectJson', { field: t('agent.fields.additionalSecretsJson') })) {
      throw error
    }
    throw new Error(t('agent.validation.validJson', { field: t('agent.fields.additionalSecretsJson') }))
  }
}

async function save() {
  if (saving.value) return

  try {
    if (!form.providerId) throw new Error(t('agent.validation.required', { field: t('agent.fields.provider') }))
    if (!form.name.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.name') }))
    if (!form.usernameSecretKey.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.usernameSecretKey') }))
    if (!form.passwordSecretKey.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.passwordSecretKey') }))

    const additionalSecretsJson = validateAdditionalSecrets()
    saving.value = true

    if (editingId.value) {
      await AgentService.updateCredential(editingId.value, {
        name: form.name.trim(),
        usernameSecretKey: form.usernameSecretKey.trim(),
        passwordSecretKey: form.passwordSecretKey.trim(),
        additionalSecretsJson,
      })
      toastStore.success(t('agent.messages.credentialUpdated'))
    } else {
      await AgentService.createCredential({
        providerId: form.providerId,
        name: form.name.trim(),
        usernameSecretKey: form.usernameSecretKey.trim(),
        passwordSecretKey: form.passwordSecretKey.trim(),
        additionalSecretsJson,
      })
      toastStore.success(t('agent.messages.credentialCreated'))
    }

    modalOpen.value = false
    await store.loadCredentials()
  } catch (error) {
    if (error instanceof Error && !('status' in error)) {
      toastStore.warning('Revise la credencial', error.message)
    } else {
      toastStore.backendError(error, t('agent.errors.saveCredential'))
    }
  } finally {
    saving.value = false
  }
}

function askToggle(row: AgentCredentialDto) {
  pendingToggle.value = row
  confirmOpen.value = true
}

async function confirmToggle() {
  const row = pendingToggle.value
  if (!row) return

  await AgentService.setCredentialActive(row.id, !row.isActive)
  toastStore.success(row.isActive ? 'Credencial desactivada' : 'Credencial activada')
  confirmOpen.value = false
  pendingToggle.value = null
  await store.loadCredentials()
}

async function refresh() {
  try {
    await Promise.all([store.loadProviders(), store.loadCredentials()])
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.loadCredentials'))
  }
}

onMounted(refresh)
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader
      :title="t('agent.credentials.title')"
      :subtitle="t('agent.credentials.subtitle')"
      :icon="KeyRound"
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
          v-if="permissions.canManageCredentials.value"
          :label="t('agent.actions.create')"
          :icon="Plus"
          @click="openCreate"
        />
      </template>
    </DhPageHeader>

    <DhDataTable
      :columns="columns"
      :rows="store.credentials"
      :loading="store.loading"
      :empty-text="t('agent.credentials.empty')"
    >
      <template #cell-providerId="{ row }">{{ providerName(row.providerId) }}</template>
      <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>
      <template #cell-createdAtUtc="{ row }">{{ formatDate(row.createdAtUtc) }}</template>
      <template #cell-updatedAtUtc="{ row }">{{ formatDate(row.updatedAtUtc) }}</template>
      <template #cell-actions="{ row }">
        <div class="flex flex-wrap justify-end gap-2" @click.stop>
          <DhButton
            v-if="permissions.canManageCredentials.value"
            :label="t('agent.actions.edit')"
            :icon="Pencil"
            variant="secondary"
            size="sm"
            @click="openEdit(row)"
          />
          <DhButton
            v-if="permissions.canManageCredentials.value"
            :label="row.isActive ? t('agent.actions.deactivate') : t('agent.actions.activate')"
            :icon="Power"
            :variant="row.isActive ? 'danger' : 'secondary'"
            size="sm"
            @click="askToggle(row)"
          />
        </div>
      </template>
    </DhDataTable>

    <DhModal :open="modalOpen" :title="editingId ? t('agent.credentials.editTitle') : t('agent.credentials.createTitle')" size="lg" @close="modalOpen = false">
      <form class="grid gap-4" @submit.prevent="save">
        <section class="rounded-[20px] border border-[var(--dh-border)] bg-black/[0.025] p-4 text-sm font-semibold leading-6 text-[var(--dh-text-muted)] dark:bg-white/[0.04]">
          {{ t('agent.credentials.secretNotice') }}
          <span v-if="editingId" class="mt-2 block">
            {{ t('agent.credentials.editSecretNotice') }}
          </span>
        </section>

        <div class="grid gap-4 md:grid-cols-2">
          <DhSelect
            v-model="form.providerId"
            :label="t('agent.fields.provider')"
            :options="providerOptions"
            :disabled="saving || Boolean(editingId)"
          />
          <DhInput v-model="form.name" :label="t('agent.fields.name')" :disabled="saving" />
          <DhInput
            v-model="form.usernameSecretKey"
            :label="t('agent.fields.usernameSecretKey')"
            placeholder="secret/path/username"
            :disabled="saving"
          />
          <DhInput
            v-model="form.passwordSecretKey"
            :label="t('agent.fields.passwordSecretKey')"
            placeholder="secret/path/password"
            :disabled="saving"
          />
        </div>

        <DhTextarea
          v-model="form.additionalSecretsJson"
          :label="t('agent.fields.additionalSecretsJson')"
          :rows="7"
          :disabled="saving"
          placeholder='{"totpSecretKey":"secret/path/totp"}'
        />

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DhButton :label="t('agent.actions.cancel')" variant="secondary" :disabled="saving" @click="modalOpen = false" />
          <DhButton
            type="submit"
            :label="editingId ? t('agent.actions.saveChanges') : t('agent.credentials.createTitle')"
            :loading="saving"
          />
        </div>
      </form>
    </DhModal>

    <DhModal :open="confirmOpen" :title="t('agent.providers.confirmState')" size="sm" @close="confirmOpen = false">
      <DhConfirmDialog
        v-if="pendingToggle"
        :title="pendingToggle.isActive ? 'Desactivar credencial' : 'Activar credencial'"
        :message="`¿Desea ${pendingToggle.isActive ? 'desactivar' : 'activar'} ${pendingToggle.name}?`"
        :danger="pendingToggle.isActive"
        :on-confirm="confirmToggle"
        @cancel="confirmOpen = false"
      />
    </DhModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
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
  { key: 'name', label: 'Nombre' },
  { key: 'providerId', label: 'Provider' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'createdAtUtc', label: 'Creada' },
  { key: 'updatedAtUtc', label: 'Actualizada' },
  { key: 'actions', label: 'Acciones', align: 'right' },
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
      throw new Error('AdditionalSecretsJson debe ser un objeto JSON.')
    }
    return value
  } catch (error) {
    if (error instanceof Error && error.message === 'AdditionalSecretsJson debe ser un objeto JSON.') {
      throw error
    }
    throw new Error('AdditionalSecretsJson debe contener JSON válido.')
  }
}

async function save() {
  if (saving.value) return

  try {
    if (!form.providerId) throw new Error('Provider es obligatorio.')
    if (!form.name.trim()) throw new Error('Name es obligatorio.')
    if (!form.usernameSecretKey.trim()) throw new Error('UsernameSecretKey es obligatorio.')
    if (!form.passwordSecretKey.trim()) throw new Error('PasswordSecretKey es obligatorio.')

    const additionalSecretsJson = validateAdditionalSecrets()
    saving.value = true

    if (editingId.value) {
      await AgentService.updateCredential(editingId.value, {
        name: form.name.trim(),
        usernameSecretKey: form.usernameSecretKey.trim(),
        passwordSecretKey: form.passwordSecretKey.trim(),
        additionalSecretsJson,
      })
      toastStore.success('Credencial actualizada')
    } else {
      await AgentService.createCredential({
        providerId: form.providerId,
        name: form.name.trim(),
        usernameSecretKey: form.usernameSecretKey.trim(),
        passwordSecretKey: form.passwordSecretKey.trim(),
        additionalSecretsJson,
      })
      toastStore.success('Credencial creada')
    }

    modalOpen.value = false
    await store.loadCredentials()
  } catch (error) {
    if (error instanceof Error && !('status' in error)) {
      toastStore.warning('Revise la credencial', error.message)
    } else {
      toastStore.backendError(error, 'No se pudo guardar la credencial.')
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
    toastStore.backendError(error, 'No se pudieron cargar las credenciales.')
  }
}

onMounted(refresh)
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader
      title="Credenciales"
      subtitle="Referencias de secretos utilizadas por DholeAgentService. Nunca se guardan contraseñas reales en el frontend."
      :icon="KeyRound"
    >
      <template #actions>
        <DhButton
          label="Actualizar"
          :icon="RefreshCw"
          variant="secondary"
          :loading="store.loading"
          @click="refresh"
        />
        <DhButton
          v-if="permissions.canManageCredentials.value"
          label="Crear"
          :icon="Plus"
          @click="openCreate"
        />
      </template>
    </DhPageHeader>

    <DhDataTable
      :columns="columns"
      :rows="store.credentials"
      :loading="store.loading"
      empty-text="No hay referencias de credenciales configuradas."
    >
      <template #cell-providerId="{ row }">{{ providerName(row.providerId) }}</template>
      <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>
      <template #cell-createdAtUtc="{ row }">{{ formatDate(row.createdAtUtc) }}</template>
      <template #cell-updatedAtUtc="{ row }">{{ formatDate(row.updatedAtUtc) }}</template>
      <template #cell-actions="{ row }">
        <div class="flex flex-wrap justify-end gap-2" @click.stop>
          <DhButton
            v-if="permissions.canManageCredentials.value"
            label="Editar"
            :icon="Pencil"
            variant="secondary"
            size="sm"
            @click="openEdit(row)"
          />
          <DhButton
            v-if="permissions.canManageCredentials.value"
            :label="row.isActive ? 'Desactivar' : 'Activar'"
            :icon="Power"
            :variant="row.isActive ? 'danger' : 'secondary'"
            size="sm"
            @click="askToggle(row)"
          />
        </div>
      </template>
    </DhDataTable>

    <DhModal :open="modalOpen" :title="editingId ? 'Editar credencial' : 'Nueva credencial'" size="lg" @close="modalOpen = false">
      <form class="grid gap-4" @submit.prevent="save">
        <section class="rounded-[20px] border border-[var(--dh-border)] bg-black/[0.025] p-4 text-sm font-semibold leading-6 text-[var(--dh-text-muted)] dark:bg-white/[0.04]">
          Ingrese únicamente nombres o rutas de secretos administrados por infraestructura. No ingrese usuarios, contraseñas, JWT, cookies ni Bearer tokens reales.
          <span v-if="editingId" class="mt-2 block">
            El backend no devuelve las referencias anteriores; para actualizar debe indicar nuevamente las keys.
          </span>
        </section>

        <div class="grid gap-4 md:grid-cols-2">
          <DhSelect
            v-model="form.providerId"
            label="Provider"
            :options="providerOptions"
            :disabled="saving || Boolean(editingId)"
          />
          <DhInput v-model="form.name" label="Name" :disabled="saving" />
          <DhInput
            v-model="form.usernameSecretKey"
            label="UsernameSecretKey"
            placeholder="secret/path/username"
            :disabled="saving"
          />
          <DhInput
            v-model="form.passwordSecretKey"
            label="PasswordSecretKey"
            placeholder="secret/path/password"
            :disabled="saving"
          />
        </div>

        <DhTextarea
          v-model="form.additionalSecretsJson"
          label="AdditionalSecretsJson"
          :rows="7"
          :disabled="saving"
          placeholder='{"totpSecretKey":"secret/path/totp"}'
        />

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DhButton label="Cancelar" variant="secondary" :disabled="saving" @click="modalOpen = false" />
          <DhButton
            type="submit"
            :label="editingId ? 'Guardar cambios' : 'Crear credencial'"
            :loading="saving"
          />
        </div>
      </form>
    </DhModal>

    <DhModal :open="confirmOpen" title="Confirmar cambio de estado" size="sm" @close="confirmOpen = false">
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

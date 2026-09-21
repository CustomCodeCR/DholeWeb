<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Pencil, Plus, Power, RefreshCw, Ship } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhSwitch, DhTextarea } from '@/shared/components/atoms'
import { DhConfirmDialog, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import {
  AGENT_EXECUTION_STRATEGIES,
  AGENT_PROVIDER_TYPES,
  type AgentExecutionStrategy,
  type AgentProviderDto,
  type AgentProviderType,
} from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import AgentProviderBadge from '@/modules/agent/components/AgentProviderBadge.vue'
import AgentStatusBadge from '@/modules/agent/components/AgentStatusBadge.vue'
import { useAgentFormatting } from '@/modules/agent/composables/useAgentFormatting'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

const router = useRouter()
const store = useAgentStore()
const toastStore = useToastStore()
const permissions = useAgentPermissions()
const { formatDate } = useAgentFormatting()

const modalOpen = ref(false)
const confirmOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const pendingToggle = ref<AgentProviderDto | null>(null)

const form = reactive({
  code: '',
  name: '',
  providerType: 'GenericWeb' as AgentProviderType,
  baseUrl: '',
  defaultExecutionStrategy: 'Hermes' as AgentExecutionStrategy,
  metadataJson: '',
  isSystem: false,
})

const columns: DhTableColumn<AgentProviderDto>[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'code', label: 'Código' },
  { key: 'providerType', label: 'Tipo' },
  { key: 'baseUrl', label: 'Base URL' },
  { key: 'defaultExecutionStrategy', label: 'Estrategia' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'isSystem', label: 'Sistema', align: 'center' },
  { key: 'updatedAtUtc', label: 'Actualizado' },
  { key: 'actions', label: 'Acciones', align: 'right' },
]

const providerTypeOptions = AGENT_PROVIDER_TYPES.map((value) => ({
  value,
  label:
    value === 'Msc'
      ? 'MSC'
      : value === 'Pil'
        ? 'PIL'
        : value === 'CmaCgm'
          ? 'CMA CGM'
          : value === 'HapagLloyd'
            ? 'Hapag-Lloyd'
            : value === 'GenericWeb'
              ? 'Web genérica'
              : value,
}))

const strategyOptions = AGENT_EXECUTION_STRATEGIES.map((value) => ({ value, label: value }))

const title = computed(() => (editingId.value ? 'Editar provider' : 'Nuevo provider'))

function resetForm() {
  editingId.value = null
  form.code = ''
  form.name = ''
  form.providerType = 'GenericWeb'
  form.baseUrl = ''
  form.defaultExecutionStrategy = 'Hermes'
  form.metadataJson = ''
  form.isSystem = false
}

function validateJson(value: string, label: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    JSON.parse(trimmed)
    return trimmed
  } catch {
    throw new Error(`${label} debe contener JSON válido.`)
  }
}

function openCreate() {
  resetForm()
  modalOpen.value = true
}

async function openEdit(row: AgentProviderDto) {
  try {
    const provider = await AgentService.getProvider(row.id)
    editingId.value = provider.id
    form.code = provider.code
    form.name = provider.name
    form.providerType = provider.providerType
    form.baseUrl = provider.baseUrl ?? ''
    form.defaultExecutionStrategy = provider.defaultExecutionStrategy
    form.metadataJson = provider.metadataJson ?? ''
    form.isSystem = provider.isSystem
    modalOpen.value = true
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el provider.')
  }
}

async function save() {
  if (saving.value) return

  try {
    if (!form.code.trim()) throw new Error('Code es obligatorio.')
    if (!form.name.trim()) throw new Error('Name es obligatorio.')
    if (!form.providerType) throw new Error('Provider Type es obligatorio.')
    if (!form.defaultExecutionStrategy) throw new Error('Execution Strategy es obligatorio.')

    const metadataJson = validateJson(form.metadataJson, 'MetadataJson')
    saving.value = true

    if (editingId.value) {
      await AgentService.updateProvider(editingId.value, {
        name: form.name.trim(),
        providerType: form.providerType,
        baseUrl: form.baseUrl.trim() || null,
        defaultExecutionStrategy: form.defaultExecutionStrategy,
        metadataJson,
      })
      toastStore.success('Provider actualizado')
    } else {
      await AgentService.createProvider({
        code: form.code.trim(),
        name: form.name.trim(),
        providerType: form.providerType,
        baseUrl: form.baseUrl.trim() || null,
        defaultExecutionStrategy: form.defaultExecutionStrategy,
        metadataJson,
        isSystem: form.isSystem,
      })
      toastStore.success('Provider creado')
    }

    modalOpen.value = false
    await store.loadProviders()
  } catch (error) {
    if (error instanceof Error && !('status' in error)) {
      toastStore.warning('Revise el provider', error.message)
    } else {
      toastStore.backendError(error, 'No se pudo guardar el provider.')
    }
  } finally {
    saving.value = false
  }
}

function askToggle(row: AgentProviderDto) {
  pendingToggle.value = row
  confirmOpen.value = true
}

async function confirmToggle() {
  const row = pendingToggle.value
  if (!row) return

  await AgentService.setProviderActive(row.id, !row.isActive)
  toastStore.success(row.isActive ? 'Provider desactivado' : 'Provider activado')
  confirmOpen.value = false
  pendingToggle.value = null
  await store.loadProviders()
}

onMounted(async () => {
  try {
    await store.loadProviders()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los providers.')
  }
})
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader title="Proveedores" subtitle="Providers genéricos para Maersk y futuras navieras." :icon="Ship">
      <template #actions>
        <DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" :loading="store.loading" @click="store.loadProviders()" />
        <DhButton v-if="permissions.canManageProviders.value" label="Crear" :icon="Plus" @click="openCreate" />
      </template>
    </DhPageHeader>

    <DhDataTable :columns="columns" :rows="store.providers" :loading="store.loading" empty-text="No hay providers configurados.">
      <template #cell-providerType="{ row }"><AgentProviderBadge :provider-type="row.providerType" /></template>
      <template #cell-baseUrl="{ row }"><span class="break-all">{{ row.baseUrl || '—' }}</span></template>
      <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>
      <template #cell-isSystem="{ row }">{{ row.isSystem ? 'Sí' : 'No' }}</template>
      <template #cell-updatedAtUtc="{ row }">{{ formatDate(row.updatedAtUtc ?? row.createdAtUtc) }}</template>
      <template #cell-actions="{ row }">
        <div class="flex flex-wrap justify-end gap-2" @click.stop>
          <DhButton label="Definiciones" variant="ghost" size="sm" @click="router.push({ path: '/agents/definitions', query: { providerId: row.id } })" />
          <DhButton v-if="permissions.canManageProviders.value" label="Editar" :icon="Pencil" variant="secondary" size="sm" @click="openEdit(row)" />
          <DhButton
            v-if="permissions.canManageProviders.value"
            :label="row.isActive ? 'Desactivar' : 'Activar'"
            :icon="Power"
            :variant="row.isActive ? 'danger' : 'secondary'"
            size="sm"
            @click="askToggle(row)"
          />
        </div>
      </template>
    </DhDataTable>

    <DhModal :open="modalOpen" :title="title" size="lg" @close="modalOpen = false">
      <form class="grid gap-4" @submit.prevent="save">
        <div class="grid gap-4 md:grid-cols-2">
          <DhInput v-model="form.code" label="Code" :disabled="saving || Boolean(editingId)" />
          <DhInput v-model="form.name" label="Name" :disabled="saving" />
          <DhSelect v-model="form.providerType" label="Provider Type" :options="providerTypeOptions" :disabled="saving" />
          <DhSelect v-model="form.defaultExecutionStrategy" label="Execution Strategy" :options="strategyOptions" :disabled="saving" />
          <div class="md:col-span-2">
            <DhInput v-model="form.baseUrl" label="Base URL" placeholder="https://..." :disabled="saving" />
          </div>
        </div>
        <DhTextarea v-model="form.metadataJson" label="MetadataJson" :rows="6" :disabled="saving" placeholder="{ }" />
        <DhSwitch v-if="!editingId" v-model="form.isSystem" label="Provider de sistema" description="Solo se envía al crear el provider." :disabled="saving" />
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DhButton label="Cancelar" variant="secondary" :disabled="saving" @click="modalOpen = false" />
          <DhButton type="submit" :label="editingId ? 'Guardar cambios' : 'Crear provider'" :loading="saving" />
        </div>
      </form>
    </DhModal>

    <DhModal :open="confirmOpen" title="Confirmar cambio de estado" size="sm" @close="confirmOpen = false">
      <DhConfirmDialog
        v-if="pendingToggle"
        :title="pendingToggle.isActive ? 'Desactivar provider' : 'Activar provider'"
        :message="`¿Desea ${pendingToggle.isActive ? 'desactivar' : 'activar'} ${pendingToggle.name}?`"
        :danger="pendingToggle.isActive"
        :confirm-label="pendingToggle.isActive ? 'Desactivar' : 'Activar'"
        :on-confirm="confirmToggle"
        @cancel="confirmOpen = false"
      />
    </DhModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Bot, KeyRound, Pencil, Power, RefreshCw } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhCard, DhConfirmDialog, DhTabs, type DhTabItem } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import type {
  AgentEndpointCaptureDto,
  AgentExtractionEquipmentDto,
  AgentExtractionFieldDto,
  AgentExtractionRouteDto,
} from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import AgentCaptureRuleForm from '@/modules/agent/components/captures/AgentCaptureRuleForm.vue'
import AgentCaptureRulesTable from '@/modules/agent/components/captures/AgentCaptureRulesTable.vue'
import AgentEquipmentForm from '@/modules/agent/components/equipment/AgentEquipmentForm.vue'
import AgentEquipmentTable from '@/modules/agent/components/equipment/AgentEquipmentTable.vue'
import AgentExtractionFieldForm from '@/modules/agent/components/fields/AgentExtractionFieldForm.vue'
import AgentExtractionFieldsTable from '@/modules/agent/components/fields/AgentExtractionFieldsTable.vue'
import AgentProfileStatus from '@/modules/agent/components/profiles/AgentProfileStatus.vue'
import AgentProfileSummary from '@/modules/agent/components/profiles/AgentProfileSummary.vue'
import AgentPromptPreview from '@/modules/agent/components/prompt/AgentPromptPreview.vue'
import AgentRouteForm from '@/modules/agent/components/routes/AgentRouteForm.vue'
import AgentRoutesTable from '@/modules/agent/components/routes/AgentRoutesTable.vue'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

type ProfileTab = 'summary' | 'routes' | 'equipment' | 'captures' | 'fields' | 'hermes'
type EditorKind = 'route' | 'equipment' | 'capture' | 'field'

const route = useRoute()
const router = useRouter()
const store = useAgentStore()
const toastStore = useToastStore()
const permissions = useAgentPermissions()

const profileId = computed(() => String(route.params.id ?? ''))
const profile = computed(() => store.selectedProfile)
const activeTab = ref<ProfileTab>('summary')
const editor = ref<EditorKind | null>(null)
const selectedRoute = ref<AgentExtractionRouteDto | null>(null)
const selectedEquipment = ref<AgentExtractionEquipmentDto | null>(null)
const selectedCapture = ref<AgentEndpointCaptureDto | null>(null)
const selectedField = ref<AgentExtractionFieldDto | null>(null)
const deleteTarget = ref<{ kind: EditorKind; id: string; label: string } | null>(null)
const deleting = ref(false)
const toggling = ref(false)

const tabs: DhTabItem[] = [
  { key: 'summary', label: 'Resumen' },
  { key: 'routes', label: 'Rutas' },
  { key: 'equipment', label: 'Equipos' },
  { key: 'captures', label: 'Endpoints' },
  { key: 'fields', label: 'Datos a extraer' },
  { key: 'hermes', label: 'Hermes' },
]

const provider = computed(() =>
  store.providers.find((item) => item.id === profile.value?.providerId),
)

const credential = computed(() =>
  store.credentials.find((item) => item.id === profile.value?.credentialId),
)

async function refresh() {
  if (!profileId.value) return
  try {
    await Promise.all([
      store.loadProfile(profileId.value),
      store.providers.length ? Promise.resolve(store.providers) : store.loadProviders(),
      store.credentials.length ? Promise.resolve(store.credentials) : store.loadCredentials(),
    ])
    await store.loadProfileConfiguration(profileId.value)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el perfil de extracción.')
  }
}

function openRoute(row: AgentExtractionRouteDto | null = null) {
  selectedRoute.value = row
  editor.value = 'route'
}

function openEquipment(row: AgentExtractionEquipmentDto | null = null) {
  selectedEquipment.value = row
  editor.value = 'equipment'
}

function openCapture(row: AgentEndpointCaptureDto | null = null) {
  selectedCapture.value = row
  editor.value = 'capture'
}

function openField(row: AgentExtractionFieldDto | null = null) {
  selectedField.value = row
  editor.value = 'field'
}

function closeEditor() {
  editor.value = null
  selectedRoute.value = null
  selectedEquipment.value = null
  selectedCapture.value = null
  selectedField.value = null
}

async function editorSaved() {
  const kind = editor.value
  closeEditor()
  if (kind === 'route') await store.loadRoutes(profileId.value)
  if (kind === 'equipment') await store.loadEquipment(profileId.value)
  if (kind === 'capture') await store.loadCaptures(profileId.value)
  if (kind === 'field') await store.loadFields(profileId.value)
}

function askDelete(kind: EditorKind, id: string, label: string) {
  deleteTarget.value = { kind, id, label }
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target || deleting.value) return

  try {
    deleting.value = true
    if (target.kind === 'route') await AgentService.routes.delete(profileId.value, target.id)
    if (target.kind === 'equipment') await AgentService.equipment.delete(profileId.value, target.id)
    if (target.kind === 'capture') await AgentService.captures.delete(profileId.value, target.id)
    if (target.kind === 'field') await AgentService.fields.delete(profileId.value, target.id)
    toastStore.success('Configuración eliminada.')
    deleteTarget.value = null
    await store.loadProfileConfiguration(profileId.value)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar la configuración.')
  } finally {
    deleting.value = false
  }
}

async function toggleProfile() {
  if (!profile.value || toggling.value) return
  try {
    toggling.value = true
    await AgentService.profiles.setActive(profile.value.id, !profile.value.isActive)
    await store.loadProfile(profile.value.id)
    toastStore.success(profile.value.isActive ? 'Perfil activado.' : 'Perfil desactivado.')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar el estado del perfil.')
  } finally {
    toggling.value = false
  }
}

onMounted(refresh)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      :title="profile?.name || 'Perfil de extracción'"
      :subtitle="profile?.description || 'Configure todo lo que Dhole Agent necesita para extraer datos de la naviera.'"
      :icon="Bot"
    >
      <template #actions>
        <DhButton label="Volver" :icon="ArrowLeft" variant="ghost" @click="router.push('/agents/profiles')" />
        <DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" :loading="store.loading" @click="refresh" />
        <DhButton
          v-if="profile && permissions.canManageProviders.value"
          label="Editar"
          :icon="Pencil"
          variant="secondary"
          @click="router.push(`/agents/profiles/${profile.id}/edit`)"
        />
        <DhButton
          v-if="profile && permissions.canManageProviders.value"
          :label="profile.isActive ? 'Desactivar' : 'Activar'"
          :icon="Power"
          :variant="profile.isActive ? 'danger' : 'secondary'"
          :loading="toggling"
          @click="toggleProfile"
        />
      </template>
    </DhPageHeader>

    <template v-if="profile">
      <div class="flex flex-wrap items-center gap-3">
        <AgentProfileStatus :active="profile.isActive" />
        <span class="rounded-full border border-[var(--dh-border)] px-3 py-1.5 text-xs font-black text-[var(--dh-text-muted)]">
          {{ provider?.name || profile.providerId }}
        </span>
        <span class="rounded-full border border-[var(--dh-border)] px-3 py-1.5 text-xs font-black text-[var(--dh-text-muted)]">
          {{ profile.executionStrategy }}
        </span>
      </div>

      <DhTabs v-model="activeTab" :items="tabs" />

      <div v-if="activeTab === 'summary'" class="grid gap-5">
        <AgentProfileSummary
          :routes="store.routes.length"
          :equipment="store.equipment.length"
          :captures="store.captures.length"
          :fields="store.fields.length"
        />

        <DhCard title="Configuración principal">
          <dl class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <dt class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Naviera / provider</dt>
              <dd class="mt-1 font-bold text-[var(--dh-text)]">{{ provider ? `${provider.name} · ${provider.code}` : profile.providerId }}</dd>
            </div>
            <div>
              <dt class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Credencial</dt>
              <dd class="mt-1 font-bold text-[var(--dh-text)]">{{ credential ? `${credential.name} · ${credential.usernameMasked}` : 'Sin credencial' }}</dd>
            </div>
            <div>
              <dt class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Parser</dt>
              <dd class="mt-1 font-bold text-[var(--dh-text)]">{{ profile.parserKey || 'Automático' }}</dd>
            </div>
            <div>
              <dt class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">URL base</dt>
              <dd class="mt-1 break-all font-bold text-[var(--dh-text)]">{{ profile.baseUrl || '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Login URL</dt>
              <dd class="mt-1 break-all font-bold text-[var(--dh-text)]">{{ profile.loginUrl || '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Search URL</dt>
              <dd class="mt-1 break-all font-bold text-[var(--dh-text)]">{{ profile.searchUrl || '—' }}</dd>
            </div>
          </dl>
        </DhCard>

        <DhCard title="¿Qué falta para dejarlo listo?">
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-[18px] border border-[var(--dh-border)] p-4">
              <p class="font-black text-[var(--dh-text)]">1. Credencial</p>
              <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ profile.credentialId ? 'Vinculada' : 'Pendiente' }}</p>
            </div>
            <div class="rounded-[18px] border border-[var(--dh-border)] p-4">
              <p class="font-black text-[var(--dh-text)]">2. Rutas</p>
              <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ store.activeRoutes.length }} activa(s)</p>
            </div>
            <div class="rounded-[18px] border border-[var(--dh-border)] p-4">
              <p class="font-black text-[var(--dh-text)]">3. Equipos</p>
              <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ store.activeEquipment.length }} activo(s)</p>
            </div>
            <div class="rounded-[18px] border border-[var(--dh-border)] p-4">
              <p class="font-black text-[var(--dh-text)]">4. Datos</p>
              <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ store.activeFields.length }} campo(s)</p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <DhButton
              v-if="permissions.canManageCredentials.value"
              label="Administrar credenciales"
              :icon="KeyRound"
              variant="secondary"
              @click="router.push('/agents/credentials')"
            />
          </div>
        </DhCard>
      </div>

      <DhCard v-else-if="activeTab === 'routes'" title="Rutas a extraer" subtitle="Defina POL, POE y POD que el agente debe consultar.">
        <AgentRoutesTable
          :rows="store.routes"
          :loading="store.loading"
          :can-manage="permissions.canManageRoutes.value"
          @create="openRoute()"
          @edit="openRoute"
          @delete="(row) => askDelete('route', row.id, row.name || `${row.polName} → ${row.podName}`)"
        />
      </DhCard>

      <DhCard v-else-if="activeTab === 'equipment'" title="Equipos / contenedores" subtitle="Configure tipos de equipo, cantidad y peso por defecto.">
        <AgentEquipmentTable
          :rows="store.equipment"
          :loading="store.loading"
          :can-manage="permissions.canManageEquipment.value"
          @create="openEquipment()"
          @edit="openEquipment"
          @delete="(row) => askDelete('equipment', row.id, row.name)"
        />
      </DhCard>

      <DhCard v-else-if="activeTab === 'captures'" title="Endpoints a observar" subtitle="Indique las URLs o patrones de red que contienen la información útil.">
        <AgentCaptureRulesTable
          :rows="store.captures"
          :loading="store.loading"
          :can-manage="permissions.canManageCaptureRules.value"
          @create="openCapture()"
          @edit="openCapture"
          @delete="(row) => askDelete('capture', row.id, row.name)"
        />
      </DhCard>

      <DhCard v-else-if="activeTab === 'fields'" title="Datos que interesa guardar" subtitle="Defina exactamente los campos que debe conservar cada extracción.">
        <AgentExtractionFieldsTable
          :rows="store.fields"
          :loading="store.loading"
          :can-manage="permissions.canManageExtractionFields.value"
          @create="openField()"
          @edit="openField"
          @delete="(row) => askDelete('field', row.id, row.label)"
        />
      </DhCard>

      <DhCard v-else-if="activeTab === 'hermes'" title="Hermes" subtitle="Revise el prompt guardado y genere la vista previa real con rutas, equipos, campos y endpoints.">
        <pre class="dh-scrollbar mb-5 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4 text-xs leading-6 text-[var(--dh-text)]">{{ profile.promptTemplate }}</pre>
        <AgentPromptPreview v-if="permissions.canManagePrompts.value" :profile-id="profile.id" />
        <p v-else class="text-sm font-semibold text-[var(--dh-text-muted)]">
          Necesita el permiso de prompts de Agent para generar la vista previa.
        </p>
      </DhCard>
    </template>

    <DhCard v-else>
      <p class="py-10 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
        Cargando perfil...
      </p>
    </DhCard>

    <DhModal :open="editor === 'route'" :title="selectedRoute ? 'Editar ruta' : 'Agregar ruta'" size="lg" @close="closeEditor">
      <AgentRouteForm
        :profile-id="profileId"
        :route="selectedRoute"
        @saved="editorSaved"
        @cancel="closeEditor"
      />
    </DhModal>

    <DhModal :open="editor === 'equipment'" :title="selectedEquipment ? 'Editar equipo' : 'Agregar equipo'" size="lg" @close="closeEditor">
      <AgentEquipmentForm
        :profile-id="profileId"
        :equipment="selectedEquipment"
        @saved="editorSaved"
        @cancel="closeEditor"
      />
    </DhModal>

    <DhModal :open="editor === 'capture'" :title="selectedCapture ? 'Editar / probar endpoint' : 'Agregar endpoint'" size="xl" @close="closeEditor">
      <AgentCaptureRuleForm
        :profile-id="profileId"
        :capture="selectedCapture"
        @saved="editorSaved"
        @cancel="closeEditor"
      />
    </DhModal>

    <DhModal :open="editor === 'field'" :title="selectedField ? 'Editar campo' : 'Agregar campo'" size="lg" @close="closeEditor">
      <AgentExtractionFieldForm
        :profile-id="profileId"
        :field="selectedField"
        @saved="editorSaved"
        @cancel="closeEditor"
      />
    </DhModal>

    <DhModal :open="Boolean(deleteTarget)" title="Eliminar configuración" size="sm" @close="deleteTarget = null">
      <DhConfirmDialog
        v-if="deleteTarget"
        title="Eliminar configuración"
        :message="`¿Desea eliminar “${deleteTarget.label}”? Esta acción solo afecta este perfil de extracción.`"
        confirm-label="Eliminar"
        danger
        :on-confirm="confirmDelete"
        @cancel="deleteTarget = null"
      />
    </DhModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, Globe2, LogIn, Plus, RefreshCw, ShieldCheck, Wrench } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { DhBadge, DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import type { BrowserProfileDto } from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import AgentStatusBadge from '@/modules/agent/components/AgentStatusBadge.vue'
import { belongsToMaerskGeneration } from '@/modules/agent/utils/maerskGenerationProfileFilter'
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
const verifyingProfileId = ref<string | null>(null)
const verificationExecutionId = ref<string | null>(null)
const verificationGeneration = ref<string | null>(null)
const verificationNoVncPort = ref<number | null>(null)
const verificationProviderId = ref<string | null>(null)
const verificationViewer = ref<{ generation: string; url: string; internalPort: number } | null>(null)
const viewerLoading = ref(false)
const repairingId = ref<string | null>(null)
const repairProfile = ref<BrowserProfileDto | null>(null)
const selectedProfile = ref<BrowserProfileDto | null>(null)

interface GenerationBrowserAuth {
  generation: string
  status: 'Requested' | 'Preparing' | 'Ready' | 'Finishing' | 'Verified' | 'Failed' | 'Expired'
  diagnosticCode?: string | null
  accountName?: string | null
  accountUsername?: string | null
  accountVerifiedAtUtc?: string | null
}
const generationSessions = ref<GenerationBrowserAuth[]>([])
const generationSessionsAvailable = ref(true)
const activeGeneration = ref<string | null>(null)
const activeGenerationSession = computed(() => generationSessions.value.find(
  entry => entry.generation === activeGeneration.value) ?? null)
// Only future standbys remain visible; retired generations are excluded.
const historicGenerationSessions = computed(() => {
  const current = Number(activeGeneration.value?.replace(/^prod/, '') || '0')
  return generationSessions.value.filter(entry =>
    Number(entry.generation.replace(/^prod/, '') || '0') > current)
})
async function loadActiveGeneration() {
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/agents/runtime-generations/',
      headers: { Accept: 'application/json' },
    })
    activeGeneration.value = unwrapApiResponse<{ activeGeneration: string }>(response as never).activeGeneration
  } catch {
    activeGeneration.value = null
  }
}
const hubInspectionAttempts = new Map<string, number>()
let standbyPollTimer: ReturnType<typeof setInterval> | null = null
const standbyAuthLabels: Record<GenerationBrowserAuth['status'], string> = {
  Requested: 'Solicitud recibida',
  Preparing: 'Preparando navegador',
  Ready: 'Navegador preparado — falta comprobar Hub',
  Finishing: 'Finalizando verificación',
  Verified: 'Hub de Maersk verificado',
  Failed: 'Error durante la preparación',
  Expired: 'Autorización vencida',
}

async function loadGenerationSessions() {
  if (!permissions.canViewBrowserProfiles.value) return
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/agents/runtime-generations/authentication/',
      headers: { Accept: 'application/json' },
    })
    generationSessions.value = unwrapApiResponse<GenerationBrowserAuth[]>(response as never)
      .filter((entry) => /^prod(?:[2-9]|[1-9][0-9]{1,2})$/.test(entry.generation))
    generationSessionsAvailable.value = true
    // The browser sessions page must work without having to visit the
    // Orchestrator. Only an API-approved Ready standby session is eligible.
    if (permissions.canAuthenticateBrowserProfiles.value && !document.hidden) {
      const now = Date.now()
      const candidate = generationSessions.value.find(entry =>
        entry.status === 'Ready' && !entry.accountVerifiedAtUtc &&
        now - (hubInspectionAttempts.get(entry.generation) ?? 0) >= 180_000)
      if (candidate) {
        hubInspectionAttempts.set(candidate.generation, now)
        void callEndpoint<unknown>({
          method: 'POST',
          path: '/api/agents/runtime-generations/authentication/{{generation}}/inspect',
          headers: { Accept: 'application/json' },
        }, { params: { generation: candidate.generation } }).catch(() => undefined)
      }
    }
  } catch {
    generationSessionsAvailable.value = false
  }
}

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

function isMaerskProfile(row: BrowserProfileDto): boolean {
  return store.providers.some(
    (provider) => provider.id === row.providerId && provider.code.toUpperCase() === 'MAERSK',
  )
}

// Defence in depth: the Agent API may be upgraded later than the web client.
 // Never present a legacy prod1 row as a live prod2 browser session.
 const visibleBrowserProfiles = computed(() => store.browserProfiles.filter(profile =>
   !isMaerskProfile(profile) ||
   belongsToMaerskGeneration(profile.profileKey, activeGeneration.value),
 ))
 
 function statusVariant(status: string): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'Authenticated' || status === 'Ready') return 'success'
  if (status === 'Authenticating') return 'primary'
  if (status === 'LoginRequired' || status === 'Expired' || status === 'ResetRequested') return 'warning'
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
    if (isMaerskProfile(row)) {
      // Merely setting LoginRequired does not launch Chromium. This dedicated
      // The API queues a manual authentication-only job in the registered
      // profile of the active generation. Retired generations are never reused.
      const verification = await AgentService.maerskOperations.verifyOriginalSession(
        row.providerId, row.credentialId,
      )
      if (!verification.verificationOnly || !verification.executionId) {
        throw new Error(t('agent.browserProfiles.verifyFailed'))
      }
      verifyingProfileId.value = row.id
      verificationExecutionId.value = verification.executionId
      verificationGeneration.value = verification.activeGeneration
      verificationNoVncPort.value = verification.noVncPort
      verificationProviderId.value = row.providerId
      verificationViewer.value = null
      toastStore.success(t('agent.browserProfiles.verifyQueued'), row.name)
    } else {
      await AgentService.authenticateBrowserProfile(row.id)
      toastStore.success(t('agent.messages.authRequested'), row.name)
    }
    await store.loadBrowserProfiles()
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.authenticateProfile'))
  } finally {
    authenticatingId.value = null
  }
}

async function openVerificationViewer() {
  if (!verificationProviderId.value || !verificationExecutionId.value ||
      !verificationGeneration.value || viewerLoading.value) return
  viewerLoading.value = true
  try {
    const access = await AgentService.maerskOperations.openActiveViewer(
      verificationProviderId.value, verificationExecutionId.value,
    )
    if (access.generation !== verificationGeneration.value ||
        (activeGeneration.value && access.generation !== activeGeneration.value))
      throw new Error('La generación activa cambió. Iniciá una nueva verificación.')

    const base = new URL(String(import.meta.env.VITE_API_URL || window.location.origin), window.location.origin)
    const destination = new URL(access.url, base)
    if (destination.origin !== base.origin ||
        !destination.pathname.startsWith('/api/agents/runtime-generations/authentication/' +
          access.generation + '/viewer/'))
      throw new Error('La dirección del visor no es válida.')
    verificationViewer.value = {
      generation: access.generation, url: destination.href, internalPort: access.internalPort,
    }
  } catch (error) {
    toastStore.backendError(error, 'No se pudo abrir noVNC de la generación activa.')
  } finally {
    viewerLoading.value = false
  }
}

function canRepair(row: BrowserProfileDto) {
  return row.status === 'Expired' || row.status === 'Error'
}

function requestRepair(row: BrowserProfileDto) {
  if (!canRepair(row) || repairingId.value) return
  repairProfile.value = row
}

async function confirmRepair() {
  const row = repairProfile.value
  if (!row || !canRepair(row) || repairingId.value) return

  try {
    repairingId.value = row.id
    await AgentService.browserProfiles.repairSession(row.id)
    toastStore.success(t('agent.messages.repairRequested'), row.name)
    repairProfile.value = null
    await store.loadBrowserProfiles()
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.repairProfile'))
  } finally {
    repairingId.value = null
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
      loadGenerationSessions(),
      loadActiveGeneration(),
    ])
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.loadProfiles'))
  }
}

onMounted(() => {
  void refresh()
  standbyPollTimer = setInterval(() => {
    if (!document.hidden) void loadGenerationSessions()
  }, 30_000)
})
onUnmounted(() => {
  if (standbyPollTimer) clearInterval(standbyPollTimer)
})
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

    <p class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-surface)] px-4 py-3 text-sm leading-relaxed text-[var(--dh-text-muted)]">
      {{ t('agent.browserProfiles.help') }}
    </p>

    <section
      v-if="verificationExecutionId"
      class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-surface)] px-4 py-3 text-sm leading-relaxed"
      role="status"
    >
      <p class="font-bold text-[var(--dh-text)]">{{ t('agent.browserProfiles.manualSessionTitle') }}</p>
      <p class="mt-1 text-[var(--dh-text-muted)]">
        {{ t('agent.browserProfiles.manualSessionGuide') }}
        Generación: <strong>{{ verificationGeneration }}</strong>.
        Puerto interno noVNC: <strong>{{ verificationNoVncPort ?? 'No disponible' }}</strong>.
        No está publicado en el host; el acceso se realiza mediante el visor protegido de Dhole.
      </p>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <DhButton
          :label="'Abrir noVNC de ' + (verificationGeneration ?? 'la generación activa')"
          variant="secondary" :loading="viewerLoading" :disabled="viewerLoading"
          @click="openVerificationViewer"
        />
        <RouterLink
          :to="`/agents/executions/${verificationExecutionId}`"
          class="font-semibold text-[var(--dh-primary)] underline"
        >{{ t('agent.browserProfiles.viewVerification') }}</RouterLink>
      </div>
    </section>

    <section v-if="permissions.canViewBrowserProfiles.value"
      class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="flex items-center gap-2 text-base font-bold"><ShieldCheck class="h-5 w-5" />
            Sesiones independientes de Maersk
          </h2>
          <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
            Generación activa: <strong>{{ activeGeneration ?? 'No confirmada' }}</strong>.
            Cada generación tiene almacenamiento Chromium aislado. La tabla inferior
            muestra únicamente los perfiles pertenecientes a la generación activa.
          </p>
        </div>
        <RouterLink to="/agents/generations"
          class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-sm font-semibold text-[var(--dh-primary)]">
          Administrar autenticaciones
        </RouterLink>
      </div>
      <p v-if="!generationSessionsAvailable" class="mt-3 text-sm text-[var(--dh-text-muted)]">
        El estado de las sesiones independientes no está disponible por el momento.
      </p>
      <p v-else-if="!generationSessions.length" class="mt-3 text-sm text-[var(--dh-text-muted)]">
        No hay verificaciones independientes registradas. Consultá «Orquestador de entornos».
      </p>
      <p v-if="activeGeneration && !activeGenerationSession" class="mt-3 text-sm text-amber-500">
        {{ activeGeneration }} no tiene un comprobante de autenticación independiente en el registro.
        Esto no demuestra que el navegador esté autenticado.
      </p>
      <h3 v-if="activeGenerationSession" class="mt-4 text-sm font-semibold">
        Sesión de la generación activa: {{ activeGeneration }}
      </h3>
      <div v-for="entry in activeGenerationSession ? [activeGenerationSession] : []"
        :key="entry.generation"
        class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--dh-border)] p-3">
        <div>
          <p class="font-bold">{{ entry.generation }} · Maersk</p>
          <p class="text-sm text-[var(--dh-text-muted)]">
            {{ entry.accountVerifiedAtUtc
              ? (entry.status === 'Verified' ? 'Hub verificado previamente' : 'Hub verificado — pendiente de finalizar')
              : (standbyAuthLabels[entry.status] ?? 'Estado desconocido') }}
          </p>
          <p v-if="entry.accountVerifiedAtUtc" class="text-xs text-[var(--dh-text-muted)]">
            Última verificación: {{ entry.accountVerifiedAtUtc }}. No garantiza que la sesión siga abierta ahora.
          </p>
          <p v-else class="text-xs text-[var(--dh-text-muted)]">
            Entrá al Hub en el navegador independiente. Dhole registrará automáticamente el acceso; podés comprobarlo desde el Orquestador.
          </p>
          <p v-if="entry.diagnosticCode" class="text-xs text-[var(--dh-text-muted)]">
            {{ entry.diagnosticCode === 'standby_hub_not_authenticated'
              ? 'El Hub de Maersk aún no se ha podido verificar. Ingresá al Hub completo y comprobalo desde el Orquestador.'
              : 'La última verificación requiere atención. Consulta el Orquestador.' }}
          </p>
        </div>
        <RouterLink to="/agents/generations"
          class="text-sm font-semibold text-[var(--dh-primary)] underline">
          Abrir autenticación de {{ entry.generation }}
        </RouterLink>
      </div>
      <h3 v-if="historicGenerationSessions.length" class="mt-5 text-sm font-semibold">
        Autenticaciones de próximas generaciones
      </h3>
      <div v-for="entry in historicGenerationSessions" :key="entry.generation"
        class="mt-2 rounded-lg border border-[var(--dh-border)] p-3 opacity-75">
        <p class="font-semibold">{{ entry.generation }} — {{ entry.status }}</p>
        <p class="text-xs text-[var(--dh-text-muted)]">
          Es una generación preparada que todavía no es la activa.
        </p>
      </div>
      <p class="mt-3 text-xs text-[var(--dh-text-muted)]">
        Para abrir el navegador de la generación activa utilizá «Orquestador de entornos».
        Las sesiones y los datos de generaciones retiradas no se reutilizan.
      </p>
    </section>

    <section class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4">
      <h2 class="font-bold">Perfiles de {{ activeGeneration ?? 'la generación activa' }}</h2>
      <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
        Solo se muestran los perfiles que corresponden al Worker activo.
        Los perfiles retirados no afectan la autenticación de esta generación.
      </p>
    </section>
    <DhDataTable
      :columns="columns"
      :rows="visibleBrowserProfiles"
      :loading="store.loading"
      :empty-text="activeGeneration ? 'No hay perfiles de navegador registrados para ' + activeGeneration : 'No se pudo comprobar la generación activa'"
    >
      <template #cell-name="{ row }">
        <div>
          {{ row.name }}
        </div>
      </template>
      <template #cell-providerId="{ row }">{{ providerName(row.providerId) }}</template>
      <template #cell-credentialId="{ row }">{{ credentialName(row.credentialId) }}</template>
      <template #cell-status="{ row }">
        <div class="flex min-w-0 flex-col items-start gap-1.5">
          <DhBadge :label="t(`agent.browserStatus.${row.status}`)" :variant="statusVariant(row.status)" />
          <span v-if="row.status === 'Blocked'" class="max-w-[260px] text-xs leading-relaxed text-[var(--dh-text-muted)]">
            {{ t('agent.browserProfiles.blockedHelp') }}
          </span>
          <span v-if="row.status === 'ResetRequested'" class="max-w-[260px] text-xs leading-relaxed text-[var(--dh-text-muted)]">
            {{ t('agent.browserProfiles.pendingHelp') }}
          </span>
        </div>
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
            :label="isMaerskProfile(row) ? t('agent.browserProfiles.verifyStart') : t('agent.actions.authenticate')"
            :icon="LogIn"
            variant="secondary"
            size="sm"
            :loading="authenticatingId === row.id"
            :disabled="Boolean(authenticatingId) || row.status === 'ResetRequested'"
            @click="authenticate(row)"
          />
          <RouterLink
            v-if="verifyingProfileId === row.id && verificationExecutionId"
            :to="`/agents/executions/${verificationExecutionId}`"
            class="inline-flex min-h-9 items-center text-xs font-semibold text-[var(--dh-primary)] underline"
          >
            {{ t('agent.browserProfiles.viewVerification') }}
          </RouterLink>
          <DhButton
            v-if="permissions.canAuthenticateBrowserProfiles.value && canRepair(row)"
            :label="t('agent.browserProfiles.repairAction')"
            :icon="Wrench"
            variant="secondary"
            size="sm"
            :disabled="Boolean(repairingId) || Boolean(authenticatingId)"
            @click="requestRepair(row)"
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

    <DhModal :open="Boolean(repairProfile)" :title="t('agent.browserProfiles.repairTitle')" size="md" @close="repairProfile = null">
      <div class="grid gap-4">
        <p class="text-sm leading-relaxed text-[var(--dh-text)]">
          {{ t('agent.browserProfiles.repairConfirm', { name: repairProfile?.name ?? '' }) }}
        </p>
        <p class="text-sm leading-relaxed text-[var(--dh-text-muted)]">
          {{ t('agent.browserProfiles.repairDescription') }}
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <DhButton
            :label="t('agent.actions.cancel')"
            variant="secondary"
            :disabled="Boolean(repairingId)"
            @click="repairProfile = null"
          />
          <DhButton
            :label="t('agent.browserProfiles.repairAction')"
            :icon="Wrench"
            :loading="Boolean(repairingId)"
            @click="confirmRepair"
          />
        </div>
      </div>
    </DhModal>

    <DhModal :open="detailOpen" :title="t('agent.browserProfiles.detailTitle')" size="lg" @close="detailOpen = false">
      <dl v-if="selectedProfile" class="grid gap-3 sm:grid-cols-2">
        <div v-for="item in [
          ['ID', selectedProfile.id],
          [t('agent.fields.name'), selectedProfile.name],
          [t('agent.fields.provider'), providerName(selectedProfile.providerId)],
          [t('agent.fields.credential'), credentialName(selectedProfile.credentialId)],
          [t('agent.fields.profileKey'), selectedProfile.profileKey],
          [t('agent.fields.storagePath'), selectedProfile.storagePath],
          [t('agent.fields.status'), t(`agent.browserStatus.${selectedProfile.status}`)],
          [t('agent.fields.lastLogin'), formatDate(selectedProfile.lastLoginAt)],
          [t('agent.fields.lastUse'), formatDate(selectedProfile.lastUsedAt)],
          [t('agent.fields.expires'), formatDate(selectedProfile.sessionExpiresAt)],
        ]" :key="String(item[0])" class="min-w-0 rounded-[18px] border border-[var(--dh-border)] p-3">
          <dt class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ item[0] }}</dt>
          <dd class="mt-1 break-all text-sm font-bold text-[var(--dh-text)]">{{ item[1] || '—' }}</dd>
        </div>
      </dl>
    </DhModal>
    <div v-if="verificationViewer" class="fixed inset-0 z-[100] flex flex-col bg-[var(--dh-surface)]">
      <div class="flex items-center justify-between gap-4 border-b border-[var(--dh-border)] p-3">
        <div class="text-sm font-semibold">
          Maersk · {{ verificationViewer.generation }} · noVNC puerto interno {{ verificationViewer.internalPort }}
          <p class="text-xs font-normal text-[var(--dh-text-muted)]">
            Ventana autorizada de verificación de la sesión activa; no libera automáticamente el breaker.
          </p>
        </div>
        <DhButton label="Cerrar visor" variant="secondary" @click="verificationViewer = null" />
      </div>
      <iframe :src="verificationViewer.url" title="noVNC del Worker Maersk activo"
        class="min-h-0 w-full flex-1 border-0" />
    </div>
  </div>
</template>

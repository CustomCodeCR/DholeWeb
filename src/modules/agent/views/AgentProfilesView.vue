<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bot, Eye, Pencil, Plus, Power, RefreshCw } from 'lucide-vue-next'
import { DhButton, DhEmptyState, DhInput } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import AgentProfileCard from '@/modules/agent/components/profiles/AgentProfileCard.vue'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

const router = useRouter()
const store = useAgentStore()
const permissions = useAgentPermissions()
const toastStore = useToastStore()
const search = ref('')
const togglingId = ref<string | null>(null)

const filteredProfiles = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return store.extractionProfiles

  return store.extractionProfiles.filter((profile) => {
    const provider = store.providers.find((item) => item.id === profile.providerId)
    return [
      profile.name,
      profile.description,
      profile.baseUrl,
      profile.loginUrl,
      profile.searchUrl,
      provider?.name,
      provider?.code,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
})

function providerName(providerId: string) {
  const provider = store.providers.find((item) => item.id === providerId)
  return provider ? `${provider.name} · ${provider.code}` : providerId
}

function credentialName(credentialId: string | null) {
  if (!credentialId) return 'Sin credencial'
  const credential = store.credentials.find((item) => item.id === credentialId)
  return credential ? `${credential.name} · ${credential.usernameMasked}` : 'Credencial vinculada'
}

async function refresh() {
  try {
    const tasks: Promise<unknown>[] = [store.loadProfiles(), store.loadProviders()]
    if (permissions.canViewCredentials.value) tasks.push(store.loadCredentials())
    await Promise.all(tasks)
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los perfiles de extracción.')
  }
}

async function toggleActive(profileId: string, isActive: boolean) {
  if (togglingId.value) return
  try {
    togglingId.value = profileId
    await AgentService.profiles.setActive(profileId, !isActive)
    toastStore.success(isActive ? 'Perfil desactivado.' : 'Perfil activado.')
    await store.loadProfiles()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar el estado del perfil.')
  } finally {
    togglingId.value = null
  }
}

onMounted(refresh)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Perfiles de extracción"
      subtitle="Configure la naviera, credenciales, rutas, equipos, endpoints y datos que Dhole Agent debe extraer."
      :icon="Bot"
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
          v-if="permissions.canManageProviders.value"
          label="Nuevo perfil"
          :icon="Plus"
          @click="router.push('/agents/profiles/new')"
        />
      </template>
    </DhPageHeader>

    <DhInput
      v-model="search"
      label="Buscar"
      placeholder="Naviera, perfil, URL..."
    />

    <div v-if="filteredProfiles.length" class="grid gap-4 xl:grid-cols-2">
      <AgentProfileCard
        v-for="profile in filteredProfiles"
        :key="profile.id"
        :name="profile.name"
        :description="profile.description"
        :active="profile.isActive"
      >
        <dl class="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Naviera</dt>
            <dd class="mt-1 font-bold text-[var(--dh-text)]">{{ providerName(profile.providerId) }}</dd>
          </div>
          <div>
            <dt class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Credencial</dt>
            <dd class="mt-1 font-bold text-[var(--dh-text)]">{{ credentialName(profile.credentialId) }}</dd>
          </div>
          <div>
            <dt class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Motor</dt>
            <dd class="mt-1 font-bold text-[var(--dh-text)]">{{ profile.executionStrategy }}</dd>
          </div>
          <div>
            <dt class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">URL de búsqueda</dt>
            <dd class="mt-1 break-all font-bold text-[var(--dh-text)]">{{ profile.searchUrl || profile.baseUrl || '—' }}</dd>
          </div>
        </dl>

        <template #actions>
          <DhButton
            label="Abrir"
            :icon="Eye"
            variant="secondary"
            size="sm"
            @click="router.push(`/agents/profiles/${profile.id}`)"
          />
          <DhButton
            v-if="permissions.canManageProviders.value"
            label="Editar"
            :icon="Pencil"
            variant="secondary"
            size="sm"
            @click="router.push(`/agents/profiles/${profile.id}/edit`)"
          />
          <DhButton
            v-if="permissions.canManageProviders.value"
            :label="profile.isActive ? 'Desactivar' : 'Activar'"
            :icon="Power"
            :variant="profile.isActive ? 'danger' : 'secondary'"
            size="sm"
            :loading="togglingId === profile.id"
            @click="toggleActive(profile.id, profile.isActive)"
          />
        </template>
      </AgentProfileCard>
    </div>

    <DhEmptyState
      v-else-if="!store.loading"
      title="No hay perfiles de extracción"
      description="Cree el primer perfil para definir naviera, accesos, rutas, equipos, endpoints y campos de extracción."
      :icon="Bot"
      :action-label="permissions.canManageProviders.value ? 'Crear perfil' : undefined"
      @action="router.push('/agents/profiles/new')"
    />
  </section>
</template>

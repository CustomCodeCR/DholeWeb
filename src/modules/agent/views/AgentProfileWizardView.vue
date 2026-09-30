<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Settings2 } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhCard } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import type { AgentExtractionProfileDto } from '@/core/interfaces/agent'
import { useToastStore } from '@/core/stores/toastStore'
import AgentExtractionProfileForm from '@/modules/agent/components/profiles/AgentExtractionProfileForm.vue'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

const route = useRoute()
const router = useRouter()
const store = useAgentStore()
const toastStore = useToastStore()

const editing = computed(() => Boolean(route.params.id))
const profileId = computed(() => String(route.params.id ?? ''))
const profile = ref<AgentExtractionProfileDto | null>(null)
const loading = ref(false)

async function load() {
  if (!editing.value || !profileId.value) return

  try {
    loading.value = true
    profile.value = await store.loadProfile(profileId.value)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el perfil de extracción.')
  } finally {
    loading.value = false
  }
}

function saved(id: string) {
  router.push(`/agents/profiles/${id}`)
}

onMounted(load)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      :title="editing ? 'Editar perfil de extracción' : 'Nuevo perfil de extracción'"
      subtitle="Defina la naviera, acceso, URLs y prompt base. Después podrá configurar rutas, equipos, endpoints y campos."
      :icon="Settings2"
    >
      <template #actions>
        <DhButton
          label="Volver"
          :icon="ArrowLeft"
          variant="ghost"
          @click="router.push(editing ? `/agents/profiles/${profileId}` : '/agents/profiles')"
        />
      </template>
    </DhPageHeader>

    <DhCard
      :title="editing ? 'Configuración general' : 'Crear perfil'"
      subtitle="El provider queda fijo después de crear el perfil para evitar mezclar credenciales y datos entre navieras."
    >
      <p
        v-if="loading"
        class="py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]"
      >
        Cargando perfil...
      </p>

      <AgentExtractionProfileForm
        v-else-if="!editing || profile"
        :profile="profile"
        @saved="saved"
        @cancel="router.push(editing ? `/agents/profiles/${profileId}` : '/agents/profiles')"
      />
    </DhCard>
  </section>
</template>

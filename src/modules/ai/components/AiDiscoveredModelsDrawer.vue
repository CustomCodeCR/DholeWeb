<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2, Plus } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import type {
  AiConnectionSummaryDto,
  DiscoveredAiModelDto,
} from '@/core/interfaces/ai'
import AiModelFormDrawer from '@/modules/ai/components/AiModelFormDrawer.vue'

const props = defineProps<{
  connection: AiConnectionSummaryDto
  discovered: DiscoveredAiModelDto[]
  connections: AiConnectionSummaryDto[]
  onSaved?: () => Promise<void> | void
}>()

const drawerStore = useDrawerStore()
const registeredCount = computed(() => props.discovered.filter((model) => model.isRegistered).length)

function register(model: DiscoveredAiModelDto) {
  drawerStore.open({
    title: `Registrar ${model.name}`,
    component: AiModelFormDrawer,
    size: 'lg',
    props: {
      discovered: model,
      defaultConnectionId: props.connection.id,
      connections: props.connections,
      onSaved: props.onSaved,
    },
  })
}
</script>

<template>
  <div class="space-y-5">
    <section class="grid gap-4 md:grid-cols-3">
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Conexión</p>
        <p class="mt-2 font-black text-[var(--dh-text)]">{{ connection.name }}</p>
      </article>
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Detectados</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ discovered.length }}</p>
      </article>
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Registrados</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ registeredCount }}</p>
      </article>
    </section>

    <div class="space-y-3">
      <article
        v-for="model in discovered"
        :key="model.externalModelId"
        class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="font-black text-[var(--dh-text)]">{{ model.name }}</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ model.externalModelId }}</p>
          </div>
          <DhBadge
            :label="model.isRegistered ? 'Registrado' : 'Nuevo'"
            :variant="model.isRegistered ? 'success' : 'primary'"
          />
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <span v-for="capability in model.capabilities" :key="capability" class="rounded-full bg-black/5 px-3 py-1 text-xs font-black text-[var(--dh-text-soft)] dark:bg-white/10">
            {{ capability }}
          </span>
        </div>
        <div class="mt-4 flex items-center justify-between gap-3">
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
            Contexto: {{ model.contextWindow ?? '—' }} · Salida: {{ model.maximumOutputTokens ?? '—' }}
          </p>
          <DhButton
            v-if="!model.isRegistered"
            label="Registrar"
            :icon="Plus"
            size="sm"
            @click="register(model)"
          />
          <span v-else class="inline-flex items-center gap-2 text-xs font-black text-green-600 dark:text-green-300">
            <CheckCircle2 class="h-4 w-4" /> Disponible
          </span>
        </div>
      </article>
      <p v-if="!discovered.length" class="py-10 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
        El proveedor no devolvió modelos disponibles.
      </p>
    </div>
  </div>
</template>

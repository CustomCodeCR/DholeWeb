<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Check, ClipboardCheck, FileCheck2, Inbox, Route } from 'lucide-vue-next'

export type PricingWorkflowStep = 'inbox' | 'review' | 'decision' | 'rates'

const props = withDefaults(
  defineProps<{
    current: PricingWorkflowStep
    compact?: boolean
  }>(),
  { compact: false },
)

const router = useRouter()

const steps = [
  {
    id: 'inbox' as const,
    number: 1,
    title: 'Recibir y extraer',
    description: 'Revise correos y archivos detectados.',
    shortDescription: 'Correos y archivos',
    path: '/pricing/email-imports',
    icon: Inbox,
  },
  {
    id: 'review' as const,
    number: 2,
    title: 'Corregir y aprobar',
    description: 'Complete catálogos, rutas, montos y vigencia.',
    shortDescription: 'Revisión pendiente',
    path: '/pricing/imports?status=Pending',
    icon: ClipboardCheck,
  },
  {
    id: 'decision' as const,
    number: 3,
    title: 'Seleccionar alternativa',
    description: 'Compare rutas y elija la opción comercial.',
    shortDescription: 'Decisión comercial',
    path: '/pricing',
    icon: Route,
  },
  {
    id: 'rates' as const,
    number: 4,
    title: 'Usar tarifa oficial',
    description: 'Consulte y gestione las tarifas finales.',
    shortDescription: 'Tarifas oficiales',
    path: '/pricing/rates',
    icon: FileCheck2,
  },
]

const currentIndex = computed(() => steps.findIndex((step) => step.id === props.current))

function stateFor(index: number) {
  if (index < currentIndex.value) return 'done'
  if (index === currentIndex.value) return 'active'
  return 'next'
}

function open(path: string) {
  router.push(path)
}
</script>

<template>
  <section
    class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-sm"
    aria-label="Flujo de Pricing"
  >
    <div class="mb-4 flex items-center justify-between gap-4">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.15em] text-[var(--dh-primary)]">
          Flujo de trabajo
        </p>
        <p v-if="!compact" class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          Siga los pasos de izquierda a derecha. Puede volver a cualquier etapa sin perder los datos.
        </p>
      </div>
      <span
        class="hidden rounded-full border border-[var(--dh-border)] px-3 py-1 text-xs font-black text-[var(--dh-text-muted)] sm:inline-flex"
      >
        Paso {{ currentIndex + 1 }} de {{ steps.length }}
      </span>
    </div>

    <div class="grid gap-2 lg:grid-cols-4">
      <button
        v-for="(step, index) in steps"
        :key="step.id"
        type="button"
        class="group relative flex min-h-[88px] items-center gap-3 rounded-[22px] border p-3 text-left transition"
        :class="{
          'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.10)] shadow-sm': stateFor(index) === 'active',
          'border-emerald-500/25 bg-emerald-500/8': stateFor(index) === 'done',
          'border-[var(--dh-border)] bg-black/[0.015] hover:border-[rgb(var(--dh-primary-rgb)/0.35)] hover:bg-[rgb(var(--dh-primary-rgb)/0.04)] dark:bg-white/[0.025]': stateFor(index) === 'next',
        }"
        @click="open(step.path)"
      >
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] font-black"
          :class="{
            'bg-[var(--dh-primary)] text-white': stateFor(index) === 'active',
            'bg-emerald-500 text-white': stateFor(index) === 'done',
            'bg-[var(--dh-card)] text-[var(--dh-text-muted)]': stateFor(index) === 'next',
          }"
        >
          <Check v-if="stateFor(index) === 'done'" class="h-5 w-5" />
          <component :is="step.icon" v-else class="h-5 w-5" />
        </span>
        <span class="min-w-0">
          <span class="block text-[11px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            Paso {{ step.number }}
          </span>
          <span class="mt-0.5 block font-black text-[var(--dh-text)]">{{ step.title }}</span>
          <span class="mt-0.5 block text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            {{ compact ? step.shortDescription : step.description }}
          </span>
        </span>
      </button>
    </div>
  </section>
</template>

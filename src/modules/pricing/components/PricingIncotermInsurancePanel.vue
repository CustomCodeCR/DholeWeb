<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next'
import { DhSelect } from '@/shared/components/atoms'

interface SelectOption {
  label: string
  value: string
}

const props = withDefaults(
  defineProps<{
    incotermId: string
    incotermOptions: SelectOption[]
    insuranceEnabled: boolean
    cargoValue: number
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  'update:incotermId': [value: string]
  'update:insuranceEnabled': [value: boolean]
  'update:cargoValue': [value: number]
}>()
</script>

<template>
  <section class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
    <div class="mb-4 flex items-center gap-3">
      <span class="grid h-9 w-9 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.11)] text-[var(--dh-primary)]">
        <ShieldCheck class="h-5 w-5" />
      </span>
      <div>
        <h3 class="text-sm font-black text-[var(--dh-text)]">Incoterms</h3>
        <p class="mt-0.5 text-xs font-semibold text-[var(--dh-text-muted)]">
          La misma configuración comercial se aplica a FCL y LCL.
        </p>
      </div>
    </div>

    <DhSelect
      :model-value="props.incotermId"
      label="Incoterm"
      placeholder="Seleccione Incoterm"
      :options="props.incotermOptions"
      :disabled="props.disabled"
      @update:model-value="(value) => emit('update:incotermId', String(value ?? ''))"
    />
    <p class="mt-2 text-xs font-semibold leading-relaxed text-[var(--dh-text-muted)]">
      Define responsabilidades de comprador y vendedor sobre origen, flete y destino.
    </p>
  </section>
</template>

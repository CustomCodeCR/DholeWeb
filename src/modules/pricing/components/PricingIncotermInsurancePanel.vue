<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next'
import { DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'

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

function updateCargoValue(value: string | number | null | undefined) {
  const parsed = Number(value)
  emit('update:cargoValue', Number.isFinite(parsed) && parsed >= 0 ? parsed : 0)
}
</script>

<template>
  <section class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
    <div class="mb-4 flex items-center gap-3">
      <span class="grid h-9 w-9 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.11)] text-[var(--dh-primary)]">
        <ShieldCheck class="h-5 w-5" />
      </span>
      <div>
        <h3 class="text-sm font-black text-[var(--dh-text)]">Incoterms y Póliza</h3>
        <p class="mt-0.5 text-xs font-semibold text-[var(--dh-text-muted)]">
          La misma configuración comercial se aplica a FCL y LCL.
        </p>
      </div>
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <div>
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
      </div>

      <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-bg)]/55 p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-sm font-black text-[var(--dh-text)]">Póliza de seguro</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              Seguro opcional calculado sobre el valor declarado de la carga.
            </p>
          </div>
          <DhCheckbox
            :model-value="props.insuranceEnabled"
            label="Aplicar póliza"
            :disabled="props.disabled"
            @update:model-value="(value) => emit('update:insuranceEnabled', Boolean(value))"
          />
        </div>

        <div class="mt-4">
          <DhInput
            :model-value="props.cargoValue"
            type="number"
            min="0"
            step="0.01"
            label="Valor carga (USD)"
            placeholder="0.00"
            :disabled="props.disabled || !props.insuranceEnabled"
            @update:model-value="updateCargoValue"
          />
        </div>

        <div v-if="props.insuranceEnabled" class="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.07] px-3 py-2 text-[11px] font-semibold text-[var(--dh-text-muted)]">
          Venta: 0,65% del valor de la carga (mínimo USD 95). Costo: 0,20% (mínimo USD 35).
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileCheck2 } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import type { RateDto } from '@/core/interfaces/pricing'

const props = defineProps<{
  rate: RateDto
  onSaved?: () => void | Promise<void>
}>()
const modal = useModalStore()
const toast = useToastStore()
const idtraNumber = ref('')
const saving = ref(false)
const valid = computed(() => {
  const value = idtraNumber.value.trim()
  return value.length > 0 && value.length <= 100
})

async function save() {
  if (saving.value || !valid.value) return
  if (props.rate.status !== 'AcceptedByClient' || props.rate.idtraNumber?.trim()) {
    toast.warning('No se puede asignar el IDTRA', 'La tarifa debe estar aceptada y sin un IDTRA registrado.')
    return
  }
  saving.value = true
  try {
    await PricingService.assignRateIdtra(props.rate.id, idtraNumber.value.trim())
    toast.success('IDTRA registrado', 'La sincronización de esta cotización con Dynamics quedó en cola.')
    modal.close()
    await props.onSaved?.()
  } catch (error) {
    toast.backendError(error, 'No se pudo asignar el IDTRA a la cotización.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <div class="flex items-start gap-3 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <FileCheck2 class="mt-1 h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
      <div>
        <p class="text-sm font-black text-[var(--dh-text)]">{{ rate.quoNumber || rate.rateCode }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          Esta cotización ya fue aceptada. Solo se registrará su IDTRA; no se modifican costos,
          venta, condiciones ni revisión. Al guardarlo se encolará la creación de la Quote en Dynamics.
        </p>
      </div>
    </div>
    <DhInput
      v-model="idtraNumber"
      label="Número IDTRA"
      placeholder="Ej. IDTRA-2026-00125"
      :maxlength="100"
      autocomplete="off"
      required
      autofocus
    />
    <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
      Sin IDTRA no se enviará la cotización a Dynamics.
    </p>
    <div class="flex justify-end gap-2">
      <DhButton type="button" label="Cancelar" variant="secondary" :disabled="saving" @click="modal.close()" />
      <DhButton type="submit" label="Guardar IDTRA" :disabled="!valid || saving" :loading="saving" />
    </div>
  </form>
</template>

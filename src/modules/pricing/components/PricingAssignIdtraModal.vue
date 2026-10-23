<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileCheck2 } from 'lucide-vue-next'
import { DhButton, DhTextarea } from '@/shared/components/atoms'
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
const idtraCsv = ref(props.rate.idtraNumber ?? '')
const otherReferences = ref(props.rate.otherReferences ?? '')
const saving = ref(false)

const identifiers = computed(() => {
  const seen = new Set<string>()
  return idtraCsv.value.split(',')
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLocaleUpperCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
})
const normalizedIdtraCsv = computed(() => identifiers.value.join(', '))
const idtraError = computed(() => {
  if (!identifiers.value.length) return 'Indique al menos un IDTRA.'
  if (identifiers.value.length > 30) return 'Máximo 30 IDTRA por cotización.'
  if (identifiers.value.some((value) => value.length > 100 || value.includes(';')))
    return 'Cada IDTRA debe tener hasta 100 caracteres y no usar punto y coma.'
  if (normalizedIdtraCsv.value.length > 2000) return 'La lista no puede superar los 2000 caracteres.'
  return ''
})
const referenceError = computed(() =>
  otherReferences.value.length > 2000 ? 'Máximo 2000 caracteres.' : '',
)
const valid = computed(() => !idtraError.value && !referenceError.value)

async function save() {
  if (saving.value || !valid.value) return
  if (props.rate.status !== 'AcceptedByClient' || props.rate.idtraNumber?.trim()) {
    toast.warning('No se puede asignar el IDTRA', 'La tarifa debe estar aceptada y sin un IDTRA registrado.')
    return
  }
  saving.value = true
  try {
    await PricingService.assignRateIdtra(props.rate.id, normalizedIdtraCsv.value, otherReferences.value.trim())
    toast.success('IDTRA registrados', 'Se guardaron los IDTRA separados por comas y las referencias internas. La integración de Dynamics quedó en cola.')
    modal.close()
    await props.onSaved?.()
  } catch (error) {
    toast.backendError(error, 'No se pudieron registrar los IDTRA de esta cotización.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <div class="flex items-start gap-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <FileCheck2 class="mt-1 h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
      <div>
        <p class="text-sm font-black text-[var(--dh-text)]">{{ rate.quoNumber || rate.rateCode }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          Esta cotización ya fue aceptada. Registrar sus IDTRA no modifica costos, ventas,
          condiciones ni revisiones. Los IDTRA se asociarán con la Quote en Dynamics según
          los campos disponibles en la integración.
        </p>
      </div>
    </div>

    <div class="space-y-2">
      <DhTextarea
        v-model="idtraCsv"
        label="Números IDTRA (separados por comas)"
        placeholder="IDTRA-2026-00125, IDTRA-2026-00126, IDTRA-2026-00127"
        :rows="3"
        :error="idtraError || undefined"
      />
      <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
        Introduzca los IDTRA como CSV, separados por comas. Se omiten duplicados y espacios sobrantes.
      </p>
      <div v-if="identifiers.length" class="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
        <span v-for="idtra in identifiers" :key="idtra" class="rounded-lg border border-[rgb(var(--dh-primary-rgb)/0.25)] bg-[rgb(var(--dh-primary-rgb)/0.07)] px-2.5 py-1 text-xs font-bold text-[var(--dh-text)]">
          {{ idtra }}
        </span>
      </div>
      <p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ identifiers.length }} IDTRA detectado{{ identifiers.length === 1 ? '' : 's' }}</p>
    </div>

    <div class="space-y-2">
      <DhTextarea
        v-model="otherReferences"
        label="Otras referencias (opcional)"
        placeholder="BL, HBL, número de contenedor, referencia interna, PO..."
        :rows="2"
        :error="referenceError || undefined"
      />
      <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
        Uso exclusivo de Dhole. Estas referencias se guardan aparte y no se envían ni se utilizan para resolver IDs en Dynamics.
      </p>
    </div>

    <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
      Sin al menos un IDTRA no se enviará la cotización a Dynamics.
    </p>
    <div class="flex justify-end gap-2">
      <DhButton type="button" label="Cancelar" variant="secondary" :disabled="saving" @click="modal.close()" />
      <DhButton type="submit" label="Guardar IDTRA" :disabled="!valid || saving" :loading="saving" />
    </div>
  </form>
</template>

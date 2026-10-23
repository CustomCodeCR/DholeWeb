<script setup lang="ts">
import { reactive } from 'vue'
import { CircleCheck, FileCheck2 } from 'lucide-vue-next'
import { DhButton, DhTextarea } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import type { RateDto } from '@/core/interfaces/pricing'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  rate: RateDto
  onSaved?: () => void | Promise<void>
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const form = reactive({
  idtraNumber: props.rate.idtraNumber?.trim() ?? '',
  otherReferences: props.rate.otherReferences?.trim() ?? '',
  saving: false,
})

async function submit() {
  const idtras = [...new Set(form.idtraNumber.split(',').map(x => x.trim()).filter(Boolean))]
  const idtraNumber = idtras.join(', ')
  if (idtras.length > 30 || idtraNumber.length > 2000 || idtras.some(id => id.length > 100 || id.includes(';')) || form.otherReferences.length > 2000) {
    toastStore.warning('Referencias inválidas', 'Máximo 30 IDTRA separados por comas, 100 caracteres por IDTRA y 2000 para otras referencias.')
    return
  }
  if (
    props.rate.rateType === 'Tariff'
    && String(props.rate.clientName ?? '').toLocaleUpperCase().includes('TARIFARIO')
  ) {
    toastStore.warning(
      'El tarifario maestro no se acepta',
      'Use “Aplicar a cliente” para crear una QUO del cliente. La aceptación se registra después sobre esa nueva QUO.',
    )
    return
  }

  try {
    form.saving = true
    await PricingService.setRateStatus(props.rate.id, {
      status: 'AcceptedByClient',
      idtraNumber: idtraNumber || null,
      otherReferences: form.otherReferences.trim(),
    })
    toastStore.success('Tarifa aceptada por el cliente', idtraNumber ? `IDTRA ${idtraNumber} registrado.` : 'El IDTRA puede asignarse posteriormente.')
    modalStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aceptar la tarifa.')
  } finally {
    form.saving = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div class="rounded-[24px] border border-emerald-500/25 bg-emerald-500/10 p-4">
      <div class="flex items-start gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
          <CircleCheck class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-sm font-black text-[var(--dh-text)]">Confirmar aceptación del cliente</p>
          <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            Esta acción corresponde a una QUO específica del cliente. La tarifa pasará a Aceptada y podrá registrar el IDTRA ahora o posteriormente.
          </p>
        </div>
      </div>
    </div>

    <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="mb-4 flex items-center gap-2 text-xs font-black text-[var(--dh-primary)]">
        <FileCheck2 class="h-4 w-4" />
        {{ rate.quoNumber || rate.rateCode }}
      </div>
      <DhTextarea
        v-model="form.idtraNumber"
        label="IDTRA separados por comas (opcional)"
        placeholder="IDTRA-2026-00125, IDTRA-2026-00126"
        :rows="2"
      />
      <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
        Ingrese los números separados por comas. La lista se guarda para la integración con Dynamics.
      </p>
      <div class="mt-4">
        <DhTextarea
          v-model="form.otherReferences"
          label="Otras referencias internas (opcional)"
          placeholder="BL, HBL, contenedor, PO u otras referencias"
          :rows="2"
        />
        <p class="mt-2 text-xs text-[var(--dh-text-muted)]">Estas referencias no se sincronizan con Dynamics.</p>
      </div>
    </div>

    <div class="flex justify-end gap-2">
      <DhButton
        type="button"
        label="Cancelar"
        variant="secondary"
        :disabled="form.saving"
        @click="modalStore.close()"
      />
      <DhButton
        type="submit"
        label="Aceptar tarifa"
        :loading="form.saving"
      />
    </div>
  </form>
</template>

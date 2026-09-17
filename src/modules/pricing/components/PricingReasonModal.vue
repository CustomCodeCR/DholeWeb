<script setup lang="ts">
import { computed, reactive } from 'vue'
import { AlertTriangle, CheckCircle2 } from 'lucide-vue-next'
import { DhButton, DhTextarea } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  target: 'import' | 'margin' | 'client'
  id?: string
  ids?: string[]
  onSaved?: () => void | Promise<void>
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const form = reactive({
  reason: '',
  correctValue: '',
  confirmedAgainstSource: false,
  reasonCodes: [] as string[],
  submitted: false,
  saving: false,
})

const rejectionReasons = [
  { code: 'incorrect_pol', label: 'POL incorrecto' },
  { code: 'incorrect_poe', label: 'POE incorrecto' },
  { code: 'incorrect_carrier', label: 'Naviera incorrecta' },
  { code: 'incorrect_container_type', label: 'Tipo de contenedor incorrecto' },
  { code: 'incorrect_freight', label: 'Flete incorrecto' },
  { code: 'incorrect_currency', label: 'Moneda incorrecta' },
  { code: 'incorrect_validity', label: 'Vigencia incorrecta' },
  { code: 'incorrect_etd', label: 'ETD incorrecto' },
  { code: 'incorrect_commodity', label: 'Commodity incorrecto' },
  { code: 'missing_rates', label: 'Faltan tarifas' },
  { code: 'hallucinated_information', label: 'Inventó información' },
  { code: 'other', label: 'Otro' },
] as const

const importIds = computed(() => [...new Set((props.ids ?? []).filter(Boolean))])
const isBatchImport = computed(() => props.target === 'import' && importIds.value.length > 0)
const isImportFeedback = computed(() => props.target === 'import')
const hasOtherReason = computed(() => form.reasonCodes.includes('other'))

function toggleReason(code: string, checked: boolean) {
  if (checked && !form.reasonCodes.includes(code)) form.reasonCodes.push(code)
  if (!checked) form.reasonCodes = form.reasonCodes.filter((item) => item !== code)
}

function onReasonChange(code: string, event: Event) {
  toggleReason(code, (event.target as HTMLInputElement | null)?.checked ?? false)
}

function buildImportFeedbackReason() {
  return JSON.stringify({
    confirmedAgainstSource: form.confirmedAgainstSource,
    reasonCodes: form.reasonCodes,
    comment: form.reason.trim() || null,
    correctValue: form.correctValue.trim() || null,
  })
}

async function submit() {
  form.submitted = true

  if (isImportFeedback.value) {
    if (!form.confirmedAgainstSource || form.reasonCodes.length === 0) return
    if (hasOtherReason.value && !form.reason.trim()) return
  } else if (!form.reason.trim()) {
    return
  }

  try {
    form.saving = true

    if (props.target === 'import') {
      const payload = { reason: buildImportFeedbackReason() }
      if (isBatchImport.value) {
        await PricingService.rejectImportRates(importIds.value, payload)
      } else if (props.id) {
        await PricingService.rejectImportRate(props.id, payload)
      } else {
        throw new Error('No se indicó ninguna tarifa importada para rechazar.')
      }
    } else if (props.target === 'client' && props.id) {
      await PricingService.setRateStatus(props.id, {
        status: 'RejectedByClient',
        reason: form.reason.trim(),
      })
    } else if (props.id) {
      await PricingService.rejectRateMargin(props.id, { reason: form.reason.trim() })
    } else {
      throw new Error('No se indicó la aprobación de margen que se desea rechazar.')
    }

    toastStore.success(
      props.target === 'import'
        ? isBatchImport.value
          ? `${importIds.value.length} importaciones rechazadas y enviadas como feedback a IA`
          : 'Importación rechazada y feedback guardado para IA'
        : props.target === 'client'
          ? 'Tarifa no aceptada por el cliente'
          : 'Margen rechazado',
    )
    modalStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo completar el rechazo.')
  } finally {
    form.saving = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div
      class="flex items-start gap-3 rounded-[22px] bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200"
    >
      <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p class="text-sm font-semibold">
          <template v-if="isImportFeedback">
            Revise la tarifa contra el correo o archivo original. El motivo y la corrección se usarán
            como feedback supervisado para que Qwen evite repetir este error.
          </template>
          <template v-else>
            Indique un motivo claro. Esta información queda disponible para auditoría y seguimiento
            operativo.
          </template>
        </p>
        <p v-if="isBatchImport" class="mt-2 text-xs font-black">
          El mismo feedback se aplicará a {{ importIds.length }} tarifas importadas.
        </p>
      </div>
    </div>

    <template v-if="isImportFeedback">
      <div class="space-y-3">
        <p class="text-sm font-black text-slate-700 dark:text-slate-200">¿Qué extrajo mal la IA?</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <label
            v-for="item in rejectionReasons"
            :key="item.code"
            class="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
          >
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300"
              :checked="form.reasonCodes.includes(item.code)"
              @change="onReasonChange(item.code, $event)"
            />
            <span>{{ item.label }}</span>
          </label>
        </div>
        <p v-if="form.submitted && form.reasonCodes.length === 0" class="text-xs font-bold text-red-500">
          Seleccione al menos un motivo para enseñar a la IA qué debe corregir.
        </p>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-bold text-slate-700 dark:text-slate-200">Valor correcto (opcional)</label>
        <input
          v-model="form.correctValue"
          type="text"
          class="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary-500 dark:border-white/10"
          placeholder="Ej.: 40HC = USD 1,850"
        />
      </div>

      <DhTextarea
        v-model="form.reason"
        label="Explicación para la IA"
        :rows="4"
        placeholder="Ej.: tomó el valor de 20DV y lo asignó a 40HC. Cada equipo debe conservar el monto de su columna."
        :error="
          form.submitted && hasOtherReason && !form.reason.trim()
            ? 'Explique el motivo cuando selecciona Otro.'
            : undefined
        "
      />

      <label
        class="flex cursor-pointer items-start gap-3 rounded-[18px] border border-emerald-500/30 bg-emerald-500/5 p-4"
      >
        <input
          v-model="form.confirmedAgainstSource"
          type="checkbox"
          class="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span class="flex gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          Confirmo que revisé esta tarifa contra el correo, PDF, Excel o fuente original.
        </span>
      </label>
      <p
        v-if="form.submitted && !form.confirmedAgainstSource"
        class="text-xs font-bold text-red-500"
      >
        Debe confirmar la revisión contra la fuente antes de rechazarla.
      </p>
    </template>

    <DhTextarea
      v-else
      v-model="form.reason"
      label="Motivo"
      :rows="4"
      placeholder="Explique por qué se rechaza..."
      :error="form.submitted && !form.reason.trim() ? 'El motivo es obligatorio.' : undefined"
    />

    <div class="flex justify-end gap-2">
      <DhButton
        label="Cancelar"
        variant="secondary"
        :disabled="form.saving"
        @click="modalStore.close()"
      />
      <DhButton label="Rechazar" variant="danger" type="submit" :loading="form.saving" />
    </div>
  </form>
</template>

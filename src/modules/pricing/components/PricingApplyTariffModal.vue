<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { FilePlus2, UserRoundPlus } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import type { RateDto } from '@/core/interfaces/pricing'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import PricingCrmClientSelect from '@/modules/pricing/components/PricingCrmClientSelect.vue'
import { crmError, crmPath, crmRequest } from '@/modules/crm/services/crmApi'

interface CrmClientOption {
  kind?: 'account' | 'lead'
  id: string
  displayName: string
  legalName: string
  executiveUserId: string
  isCastroFallasExecutive: boolean
  executiveName: string
}
interface CrmClientPage {
  items: CrmClientOption[]
  total: number
  page: number
  pageSize: number
}
const props = defineProps<{
  rate: RateDto
  onApplied?: (rateId: string) => void | Promise<void>
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const selectedClientId = ref('')
const selectedClient = ref<CrmClientOption | null>(null)
const form = reactive({ submitted: false, saving: false })
const ownerName = computed(() => selectedClient.value?.isCastroFallasExecutive
  ? 'Castro Fallas'
  : selectedClient.value?.executiveName?.trim() ?? '')

function selectClient(client: CrmClientOption | null) {
  selectedClient.value = client
}

async function submit() {
  if (form.saving) return
  form.submitted = true
  if (!selectedClientId.value || !selectedClient.value
      || selectedClientId.value !== selectedClient.value.id) return
  if (
    props.rate.rateType !== 'Tariff'
    || !String(props.rate.clientName ?? '').toLocaleUpperCase().includes('TARIFARIO')
  ) {
    toastStore.warning('Acción no disponible',
      'Aplicar a cliente solo está disponible para tarifarios maestros.')
    return
  }

  try {
    form.saving = true
    // Re-read CRM immediately before creating the quote: names, seller and
    // visibility can change after the user opens the modal.
    const params = new URLSearchParams({
      mode: 'create', selectedClientId: selectedClientId.value, pageSize: '1',
    })
    const page = await crmRequest<CrmClientPage>(crmPath('pricing-client-options') + '?' + params)
    const client = page.items.find(item =>
      item.id.toLowerCase() === selectedClientId.value.toLowerCase())
    if (!client || (client.kind !== 'account' && client.kind !== 'lead')) {
      selectedClient.value = null
      toastStore.warning('Cliente no disponible',
        'La cuenta o prospecto ya no está disponible en CRM. Seleccione un registro vigente.')
      return
    }
    const executiveName = client.isCastroFallasExecutive
      ? 'Castro Fallas' : client.executiveName?.trim()
    if (!executiveName || executiveName === 'Vendedor no disponible') {
      toastStore.warning('Responsable no disponible',
        'El cliente debe tener un ejecutivo comercial válido asignado en CRM.')
      return
    }

    const appliedRateId = await PricingService.duplicateRate(props.rate.id, {
      validFrom: props.rate.validFrom.slice(0, 10),
      validTo: props.rate.validTo.slice(0, 10),
      applyTariff: true,
      clientName: client.displayName,
      executiveName,
      clientAccountId: client.kind === 'account' ? client.id : null,
      clientLeadId: client.kind === 'lead' ? client.id : null,
      idtraNumber: null,
    })

    const appliedRate = await PricingService.getRate(appliedRateId)
    toastStore.success(
      'QUO creada para el cliente',
      `${appliedRate.quoNumber || appliedRate.rateCode} quedó abierta para ${client.displayName}. El tarifario ${props.rate.quoNumber || props.rate.rateCode} permanece disponible.`,
    )
    modalStore.close()
    await props.onApplied?.(appliedRateId)
  } catch (error) {
    toastStore.backendError(error,
      'No se pudo aplicar el tarifario. Compruebe la cuenta y sus permisos en CRM: ' + crmError(error))
  } finally {
    form.saving = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <section class="rounded-[24px] border border-[rgb(var(--dh-primary-rgb)/0.24)] bg-[rgb(var(--dh-primary-rgb)/0.06)] p-4">
      <div class="flex items-start gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]">
          <UserRoundPlus class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-sm font-black text-[var(--dh-text)]">Aplicar tarifario a un cliente</p>
          <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            Se creará una nueva QUO abierta copiando exactamente esta revisión: flete, cargos, recargos, vigencia y condiciones. El tarifario maestro no cambia y podrá volver a utilizarse.
          </p>
        </div>
      </div>
    </section>

    <section class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="mb-4 flex items-center gap-2 text-xs font-black text-[var(--dh-primary)]">
        <FilePlus2 class="h-4 w-4" />
        {{ rate.quoNumber || rate.rateCode }} · TARIFARIO MAESTRO
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <PricingCrmClientSelect
          v-model="selectedClientId"
          mode="create"
          :disabled="form.saving"
          :error="form.submitted && !selectedClientId ? 'Seleccione una cuenta o prospecto de CRM.' : ''"
          @selected="selectClient"
        />
        <DhInput
          :model-value="ownerName"
          label="Ejecutivo comercial (asignado en CRM)"
          placeholder="Seleccione primero una cuenta o prospecto"
          disabled
        />
      </div>

      <p class="mt-3 text-[11px] font-semibold leading-5 text-[var(--dh-text-muted)]">
        La QUO quedará vinculada a la cuenta o prospecto seleccionado y aparecerá en su historial comercial. El ejecutivo se obtiene de CRM, no se escribe manualmente.
      </p>
      <p class="mt-2 text-[11px] font-semibold leading-5 text-[var(--dh-text-muted)]">
        La nueva QUO quedará en estado Abierta. Después podrá marcarse Enviada y, únicamente sobre esa QUO del cliente, registrar Aceptada o Rechazada.
      </p>
    </section>

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
        label="Crear QUO para cliente"
        :icon="UserRoundPlus"
        :disabled="!selectedClientId || !selectedClient"
        :loading="form.saving"
      />
    </div>
  </form>
</template>

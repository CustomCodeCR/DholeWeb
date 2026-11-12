<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { BookOpen, FilePlus2, ShieldCheck, UserRoundPlus } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
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
  <form class="min-w-0 space-y-6" @submit.prevent="submit">
    <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4 sm:p-5">
      <div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--dh-primary-rgb)/0.25)] bg-[rgb(var(--dh-primary-rgb)/0.1)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--dh-primary)]">
          <BookOpen class="h-3.5 w-3.5" /> Tarifario maestro
        </span>
        <span class="rounded-full border border-[var(--dh-border)] bg-[var(--dh-card-solid)] px-3 py-1 text-xs font-semibold text-[var(--dh-text-soft)]">
          Nueva QUO · Abierta
        </span>
      </div>

      <div class="mt-4 flex min-w-0 items-start gap-3">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]">
          <FilePlus2 class="h-5 w-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Cotización de origen</p>
          <p class="mt-1 break-words text-lg font-extrabold text-[var(--dh-text)]">{{ rate.quoNumber || rate.rateCode }}</p>
          <p class="mt-1 break-words text-sm leading-5 text-[var(--dh-text-soft)]">
            {{ [rate.polName, rate.poeName, rate.podName].filter(Boolean).join(' → ') || 'Ruta de transporte registrada' }}
          </p>
        </div>
      </div>
      <p class="mt-4 border-t border-[var(--dh-border)] pt-3 text-xs leading-5 text-[var(--dh-text-soft)]">
        Se copiarán los fletes, cargos, condiciones y vigencia de esta revisión. El maestro permanecerá disponible para otros clientes.
      </p>
    </section>

    <section class="min-w-0 space-y-4">
      <div class="flex items-start gap-3">
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-sm font-extrabold text-[var(--dh-primary)]">1</span>
        <div class="min-w-0">
          <h3 class="text-base font-extrabold text-[var(--dh-text)]">Seleccionar cliente</h3>
          <p class="mt-1 text-sm leading-5 text-[var(--dh-text-soft)]">
            Elegí una cuenta o prospecto del CRM. El responsable se asignará automáticamente.
          </p>
        </div>
      </div>

      <div class="min-w-0 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-3 sm:p-4">
        <PricingCrmClientSelect
          v-model="selectedClientId"
          mode="create"
          :inline-results="true"
          :disabled="form.saving"
          :error="form.submitted && !selectedClientId ? 'Seleccione una cuenta o prospecto de CRM.' : ''"
          @selected="selectClient"
        />
      </div>

      <div class="flex min-w-0 items-start gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card-solid)] p-4" aria-live="polite">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.1)] text-[var(--dh-primary)]">
          <ShieldCheck class="h-5 w-5" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs font-bold uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Ejecutivo comercial · CRM</p>
            <span v-if="selectedClient" class="rounded-full bg-[rgb(var(--dh-primary-rgb)/0.09)] px-2 py-1 text-[11px] font-bold text-[var(--dh-primary)]">
              Validado al guardar
            </span>
          </div>
          <p class="mt-1.5 break-words text-sm font-bold text-[var(--dh-text)]">
            {{ ownerName || 'Seleccioná un cliente para ver su responsable' }}
          </p>
          <p class="mt-1 text-xs leading-5 text-[var(--dh-text-soft)]">Se obtiene de CRM y no se puede cambiar desde el tarifario.</p>
        </div>
      </div>
    </section>

    <div class="border-t border-[var(--dh-border)] pt-5">
      <p class="mb-4 flex items-start gap-2 text-xs leading-5 text-[var(--dh-text-soft)]">
        <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
        La nueva QUO aparecerá en el historial del cliente. La aceptación o el rechazo se registrarán solo sobre esa QUO, sin alterar el maestro.
      </p>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <DhButton type="button" label="Cancelar" variant="secondary" :disabled="form.saving" @click="modalStore.close()" />
        <DhButton type="submit" label="Crear QUO para cliente" :icon="UserRoundPlus"
          :disabled="!selectedClientId || !selectedClient" :loading="form.saving" />
      </div>
    </div>
  </form>
</template>

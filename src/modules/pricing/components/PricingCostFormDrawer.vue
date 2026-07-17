<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue'
import { BadgeDollarSign, Info, Save } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhButton, DhCheckbox, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PricingService } from '@/core/services/pricingService'
import type {
  CostDetailType,
  CostDto,
  CostPortRole,
  CostType,
  CreateCostRequest,
} from '@/core/interfaces/pricing'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { formatMoney } from '@/modules/pricing/utils/pricingFormat'

const props = defineProps<{ cost?: CostDto; onSaved?: () => void | Promise<void> }>()
const { locale, t } = useI18n()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

const form = reactive({
  name: props.cost?.name ?? '',
  costType: (props.cost?.costType ?? 'Fixed') as CostType,
  costDetailType: (props.cost?.costDetailType ?? 'DestinationCharge') as CostDetailType,
  associationType: (props.cost?.agentId ? 'Agent' : props.cost?.carrierId ? 'Carrier' : 'None') as
    | 'None'
    | 'Agent'
    | 'Carrier',
  carrierId: props.cost?.carrierId ?? '',
  agentId: props.cost?.agentId ?? '',
  portId: props.cost?.portId ?? '',
  portRole: (props.cost?.portRole ?? '') as CostPortRole | '',
  currencyId: props.cost?.currencyId ?? '',
  costAmount: String(props.cost?.costAmount ?? ''),
  saleAmount: String(props.cost?.saleAmount ?? ''),
  isAccountant:
    props.cost?.isAccountant ||
    props.cost?.costDetailType === 'Freight' ||
    props.cost?.costDetailType === 'InlandTransport' ||
    false,
  notes: props.cost?.notes ?? '',
  saving: false,
  submitted: false,
})

const isAgentCost = computed(() => form.associationType === 'Agent')
const isCarrierCost = computed(() => form.associationType === 'Carrier')
const isFreightPerContainer = computed(() =>
  ['Freight', 'InlandTransport'].includes(form.costDetailType),
)
const utility = computed(() => Number(form.saleAmount || 0) - Number(form.costAmount || 0))
const portOptions = computed(() => {
  if (form.portRole === 'Pol') return catalogs.polOptions.value
  if (form.portRole === 'Poe') return catalogs.poeOptions.value
  if (form.portRole === 'Pod') return catalogs.podOptions.value
  return [
    ...catalogs.polOptions.value,
    ...catalogs.poeOptions.value,
    ...catalogs.podOptions.value,
  ].filter(
    (option, index, values) => values.findIndex((item) => item.value === option.value) === index,
  )
})

const costTypeOptions = [
  { label: 'Fijo automático', value: 'Fixed' },
  { label: 'Opcional', value: 'Optional' },
  { label: 'Variable', value: 'Variable' },
]

const detailTypeOptions: Array<{ label: string; value: CostDetailType }> = [
  { label: 'Flete internacional', value: 'Freight' },
  { label: 'Costo de agente', value: 'AgentCharge' },
  { label: 'Cargo en origen', value: 'OriginCharge' },
  { label: 'Cargo en destino', value: 'DestinationCharge' },
  { label: 'Cargo portuario', value: 'PortCharge' },
  { label: 'Aduana', value: 'CustomsCharge' },
  { label: 'Transporte interno', value: 'InlandTransport' },
  { label: 'Documentación', value: 'Documentation' },
  { label: 'Seguro', value: 'Insurance' },
  { label: 'Otro', value: 'Other' },
]

const portRoleOptions = [
  { label: 'Cualquier punto', value: 'Any' },
  { label: 'POL · Puerto de origen', value: 'Pol' },
  { label: 'POE · Puerto de entrada', value: 'Poe' },
  { label: 'POD · Destino final', value: 'Pod' },
]

const associationTypeOptions = [
  { label: 'Sin asociación', value: 'None' },
  { label: 'Naviera', value: 'Carrier' },
  { label: 'Agente', value: 'Agent' },
]

function fieldError(value: string, message: string) {
  return form.submitted && !value ? message : undefined
}

function selected<T extends { id: string }>(items: T[], id: string) {
  return items.find((item) => item.id === id)
}

watch(
  () => form.associationType,
  (associationType) => {
    if (associationType === 'Agent') {
      form.carrierId = ''
      form.costDetailType = 'AgentCharge'
      form.saleAmount = '0'
      return
    }

    form.agentId = ''
    if (associationType === 'None') form.carrierId = ''
    if (form.costDetailType === 'AgentCharge') form.costDetailType = 'DestinationCharge'
  },
)

watch(
  () => form.costDetailType,
  () => {
    if (isFreightPerContainer.value) form.isAccountant = true
  },
  { immediate: true },
)

watch(
  () => form.portRole,
  () => {
    if (!portOptions.value.some((option) => option.value === form.portId)) form.portId = ''
  },
)

async function submit() {
  form.submitted = true
  const carrier = selected(catalogs.carriers.value, form.carrierId)
  const agent = selected(catalogs.agents.value, form.agentId)
  const port = selected(
    [...catalogs.polPorts.value, ...catalogs.poePorts.value, ...catalogs.podPorts.value],
    form.portId,
  )
  const currency = selected(catalogs.currencies.value, form.currencyId)

  if (
    !form.name.trim() ||
    !currency ||
    (isAgentCost.value && !agent) ||
    (isCarrierCost.value && !carrier) ||
    Number(form.costAmount) < 0 ||
    Number(form.saleAmount) < 0
  )
    return

  const payload: CreateCostRequest = {
    name: form.name.trim(),
    costType: form.costType,
    costDetailType: form.costDetailType,
    carrierId: carrier?.id ?? null,
    carrierName: carrier?.name ?? null,
    carrierCode: carrier?.code ?? null,
    agentId: agent?.id ?? null,
    agentName: agent?.name ?? null,
    agentCode: agent?.code ?? null,
    portId: port?.id ?? null,
    portName: port?.name ?? null,
    portCode: port?.code ?? null,
    portRole: port ? form.portRole || null : null,
    currencyId: currency.id,
    currencyName: currency.name,
    currencyCode: currency.code,
    costAmount: Number(form.costAmount),
    saleAmount: isAgentCost.value ? 0 : Number(form.saleAmount),
    notes: form.notes.trim() || null,
    isAccountant: isFreightPerContainer.value || form.isAccountant,
  }

  try {
    form.saving = true
    if (props.cost) await PricingService.updateCost(props.cost.id, payload)
    else await PricingService.createCost(payload)
    toastStore.success(
      props.cost ? 'Costo actualizado' : 'Costo creado',
      'La matriz de costos quedó actualizada.',
    )
    drawerStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(
      error,
      props.cost ? 'No se pudo actualizar el costo.' : 'No se pudo crear el costo.',
    )
  } finally {
    form.saving = false
  }
}

onMounted(catalogs.loadAll)
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-5 flex items-start gap-3">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] dh-bg-primary-soft text-[var(--dh-primary)]"
        >
          <BadgeDollarSign class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-black text-[var(--dh-text)]">Identificación del costo</h3>
          <p class="mt-1 text-sm font-medium text-[var(--dh-text-muted)]">
            Defina cómo se aplicará este rubro al construir una tarifa.
          </p>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <DhInput
          v-model="form.name"
          label="Nombre"
          placeholder="THC, handling, BL..."
          :error="fieldError(form.name, 'Indique un nombre.')"
        />
        <DhSelect v-model="form.costType" label="Aplicación" :options="costTypeOptions" />
        <DhSelect v-model="form.costDetailType" label="Rubro" :options="detailTypeOptions" />
        <DhSelect
          v-model="form.portRole"
          label="Punto de aplicación"
          placeholder="Sin puerto específico"
          :options="[{ label: 'Sin puerto específico', value: '' }, ...portRoleOptions]"
        />
      </div>
    </section>

    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <h3 class="font-black text-[var(--dh-text)]">Relaciones operativas</h3>
      <p class="mb-5 mt-1 text-sm font-medium text-[var(--dh-text-muted)]">
        Los selects guardan el identificador y su snapshot para conservar el histórico.
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <DhSelect
          v-model="form.associationType"
          label="Costo asociado a"
          :options="associationTypeOptions"
        />
        <DhSelect
          v-if="isAgentCost"
          v-model="form.agentId"
          label="Agente"
          placeholder="Seleccione agente"
          :options="catalogs.agentOptions.value"
          :error="fieldError(form.agentId, 'Seleccione el agente.')"
        />
        <DhSelect
          v-else-if="isCarrierCost"
          v-model="form.carrierId"
          label="Naviera"
          placeholder="Seleccione naviera"
          :options="catalogs.carrierOptions.value"
          :error="fieldError(form.carrierId, 'Seleccione la naviera.')"
        />
        <DhSelect
          v-model="form.portId"
          label="Puerto"
          placeholder="Seleccione puerto"
          :options="[{ label: 'Sin puerto específico', value: '' }, ...portOptions]"
        />
        <DhSelect
          v-model="form.currencyId"
          label="Moneda"
          placeholder="Seleccione moneda"
          :options="catalogs.currencyOptions.value"
          :error="fieldError(form.currencyId, 'Seleccione la moneda.')"
        />
      </div>

      <div
        class="mt-4 flex items-start gap-2 rounded-2xl bg-blue-500/10 p-3 text-sm font-semibold text-blue-700 dark:text-blue-300"
      >
        <Info class="mt-0.5 h-4 w-4 shrink-0" />
        <p v-if="form.costType === 'Fixed'">
          El costo se agregará automáticamente cuando coincidan las relaciones configuradas.
          Puede ser global, solo por puerto, solo por naviera/agente o combinar ambas condiciones.
        </p>
        <p v-else-if="form.costType === 'Optional'">
          Este rubro aparecerá en el selector múltiple al construir o editar una tarifa.
        </p>
        <p v-else>Este rubro queda disponible como plantilla ajustable para la cotización.</p>
      </div>
    </section>

    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="grid gap-4 md:grid-cols-2">
        <DhInput
          v-model="form.costAmount"
          type="number"
          label="Costo"
          placeholder="0.00"
          :error="
            form.submitted && Number(form.costAmount) < 0
              ? 'El costo no puede ser negativo.'
              : undefined
          "
        />
        <DhInput
          v-model="form.saleAmount"
          type="number"
          label="Venta"
          placeholder="0.00"
          :disabled="isAgentCost"
          :error="
            form.submitted && Number(form.saleAmount) < 0
              ? 'La venta no puede ser negativa.'
              : undefined
          "
        />
      </div>
      <div
        class="mt-4 flex items-center justify-between rounded-2xl bg-black/[0.035] px-4 py-3 dark:bg-white/[0.05]"
      >
        <span class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
          >Utilidad del rubro</span
        >
        <span
          class="font-black"
          :class="utility >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'"
          >{{
            formatMoney(
              utility,
              catalogs.findById(catalogs.currencies.value, form.currencyId)?.code || 'USD',
              locale === 'en' ? 'en-US' : 'es-CR',
            )
          }}</span
        >
      </div>
      <div class="mt-4 rounded-2xl border border-[var(--dh-border)] p-4">
        <DhCheckbox
          v-model="form.isAccountant"
          label="Costo contable por contenedor"
          :disabled="isFreightPerContainer"
        />
        <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
          <template v-if="isFreightPerContainer">
            El flete marítimo y terrestre siempre multiplica costo y venta por la cantidad de
            contenedores.
          </template>
          <template v-else>
            Al activarlo, el costo y la venta de este rubro se multiplican por la cantidad de
            contenedores indicada al crear o editar la tarifa.
          </template>
        </p>
      </div>
      <p v-if="isAgentCost" class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
        Los costos asociados a un agente no generan venta; el sistema fija la venta en cero.
      </p>
      <div class="mt-4">
        <DhTextarea
          v-model="form.notes"
          label="Notas"
          placeholder="Condiciones, alcance o evidencia del costo..."
        />
      </div>
    </section>

    <div
      class="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--dh-border)] bg-[var(--dh-shell-strong)] py-4 backdrop-blur-xl"
    >
      <DhButton
        label="Cancelar"
        variant="secondary"
        :disabled="form.saving"
        @click="drawerStore.close()"
      />
      <DhButton
        :label="props.cost ? t('common.save') : 'Crear costo'"
        :icon="Save"
        type="submit"
        :loading="form.saving"
      />
    </div>
  </form>
</template>

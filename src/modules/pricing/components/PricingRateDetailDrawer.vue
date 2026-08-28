<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  FolderOpen,
  Printer,
  RefreshCw,
  Route,
  Send as SendIcon,
  ShieldCheck,
  XCircle,
} from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import { EmailExtractionService } from '@/core/services/emailExtractionService'
import type { ImportRateDto, RateDetailDto, RateDto, SetRateStatusRequest } from '@/core/interfaces/pricing'
import PricingRateFormDrawer from './PricingRateFormDrawer.vue'
import PricingReasonModal from './PricingReasonModal.vue'
import PricingDuplicateRateModal from './PricingDuplicateRateModal.vue'
import PricingEmailSourceModal from './PricingEmailSourceModal.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import {
  detailGroup,
  formatDate,
  formatMoney,
  marginTone,
  rateDisplayName,
  routeLabel,
  statusTone,
} from '@/modules/pricing/utils/pricingFormat'
import { commercialTermKey } from '@/modules/pricing/services/pricingCommercialRules'
import { sourceTitle } from '@/modules/pricing/utils/pricingSourceTrace'

const props = defineProps<{ rate: RateDto; onSaved?: () => void | Promise<void> }>()
const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const current = ref<RateDto>(props.rate)
const displayCurrent = computed(() => catalogs.resolveRateLabels(current.value))
const currentDisplayName = computed(() => rateDisplayName(displayCurrent.value))

function splitTerms(value?: string | null) {
  return String(value ?? '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
}

const exclusiveTerms = computed(() => {
  const includes = splitTerms(current.value.includes)
  const includeKeys = new Set(includes.map(commercialTermKey))
  const subjectTo = splitTerms(current.value.subjectTo)
    .filter((item) => !includeKeys.has(commercialTermKey(item)))
  const subjectKeys = new Set(subjectTo.map(commercialTermKey))
  const excludes = splitTerms(current.value.excludes)
    .filter((item) => {
      const key = commercialTermKey(item)
      return !includeKeys.has(key) && !subjectKeys.has(key)
    })
  return {
    includes: includes.join('\n') || '—',
    subjectTo: subjectTo.join('\n') || '—',
    excludes: excludes.join('\n') || '—',
  }
})

function containerSummary(rate: RateDto) {
  if (rate.shipmentMode === 'Lcl' || rate.shipmentMode === 'Ltl') {
    return `${rate.shipmentMode.toUpperCase()} · ${Number(rate.chargeableQuantity || 0).toFixed(3)} CBM`
  }
  if (rate.shipmentMode === 'Ftl') return `${rate.containerQuantity} × FTL`
  const allocations = rate.containers?.filter((item) => item.quantity > 0) ?? []
  if (allocations.length === 0) return `${rate.containerQuantity} × ${rate.containerTypeName}`
  return allocations.map((item) => `${item.quantity} × ${item.containerTypeName}`).join(' + ')
}
const loading = ref(false)
const printing = ref(false)
const costNotesById = ref<Record<string, string>>({})
const sourceImportRate = ref<ImportRateDto | null>(null)
const sourceEmail = ref<Awaited<ReturnType<typeof EmailExtractionService.getPricingImportSource>> | null>(null)
const sourceLabel = computed(() => sourceImportRate.value ? sourceTitle(sourceImportRate.value, sourceEmail.value) : '')

const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.update))
const canDuplicate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create))
const canApprove = computed(() => authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin))
const groups = computed(() => {
  const byGroup = (key: ReturnType<typeof detailGroup>) =>
    current.value.rateDetails.filter((detail) => detailGroup(detail.costDetailType) === key)
  return [
    { key: 'agent', title: 'Costos de agente', subtitle: 'Sin venta', rows: byGroup('agent') },
    {
      key: 'freight',
      title: 'Flete internacional',
      subtitle: 'Costo y venta marítima',
      rows: byGroup('freight'),
    },
    {
      key: 'destination',
      title: 'Costos de destino',
      subtitle: 'POE, POD y transporte interno',
      rows: byGroup('destination'),
    },
    { key: 'other', title: 'Otros rubros', subtitle: 'Cargos adicionales', rows: byGroup('other') },
  ]
})

function statusLabel(status: string) {
  return (
    (
      {
        PendingApproval: 'Abierta',
        ApprovedByManagement: 'Abierta',
        RejectedByManagement: 'Abierta',
        Open: 'Abierta',
        Sent: 'Enviada',
        RequestedByClient: 'Abierta',
        AcceptedByClient: 'Aceptada',
        RejectedByClient: 'No aceptada',
        Closed: 'No aceptada',
        Expired: 'Vencida',
      } as Record<string, string>
    )[status] ?? status
  )
}

async function loadSourceTrace() {
  sourceImportRate.value = null
  sourceEmail.value = null
  const importRateId = current.value.sourceImportFclRateId?.trim()
  if (!importRateId) return

  try {
    const importRate = await PricingService.getImportRate(importRateId)
    sourceImportRate.value = importRate
    try {
      sourceEmail.value = await EmailExtractionService.getPricingImportSource(importRate.importBatchId)
    } catch {
      // Para importaciones históricas se conserva el fallback de RawData.
    }
  } catch {
    // El detalle oficial sigue disponible aun si la fuente histórica ya no existe.
  }
}

function openRateSource() {
  const source = sourceImportRate.value
  if (!source) return
  modalStore.open({
    title: `Correo / fuente de la tarifa · ${sourceLabel.value || 'Fuente de la tarifa'}`,
    component: PricingEmailSourceModal,
    size: 'xl',
    props: { batchId: source.importBatchId },
  })
}

async function reload() {
  try {
    loading.value = true
    current.value = await PricingService.getRate(current.value.id)
    await loadMissingCostNotes(current.value.rateDetails)
    await loadSourceTrace()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo actualizar el detalle de la tarifa.')
  } finally {
    loading.value = false
  }
}

function resolvedDetailNotes(detail: RateDetailDto) {
  return detail.notes?.trim() || (detail.costId ? costNotesById.value[detail.costId] : '') || ''
}

async function loadMissingCostNotes(details: RateDetailDto[]) {
  const missingCostIds = new Set(
    details
      .filter(
        (detail) => detail.costId && !detail.notes?.trim() && !costNotesById.value[detail.costId],
      )
      .map((detail) => detail.costId!),
  )

  if (!missingCostIds.size) return

  try {
    const costs = await PricingService.selectCosts({ isActive: true })
    const next = { ...costNotesById.value }

    for (const cost of costs) {
      if (!missingCostIds.has(cost.id)) continue
      const notes = cost.notes?.trim()
      if (notes) next[cost.id] = notes
    }

    costNotesById.value = next
  } catch {
    // La tarifa se mantiene visible aunque no se puedan recuperar notas maestras.
  }
}

function edit() {
  drawerStore.open({
    title: 'Editar tarifa',
    component: PricingRateFormDrawer,
    size: 'full',
    props: {
      rate: current.value,
      onSaved: async () => {
        await props.onSaved?.()
      },
    },
  })
}

function duplicate() {
  modalStore.open({
    title: 'Duplicar tarifa',
    component: PricingDuplicateRateModal,
    props: { rate: current.value, onSaved: props.onSaved },
  })
}

function reject() {
  modalStore.open({
    title: 'Rechazar autorización de margen',
    component: PricingReasonModal,
    props: {
      target: 'margin',
      id: current.value.id,
      onSaved: async () => {
        await reload()
        await props.onSaved?.()
      },
    },
  })
}

async function approve() {
  try {
    await PricingService.approveRateMargin(current.value.id)
    toastStore.success(
      'Margen aprobado',
      'La tarifa quedó aprobada por gerencia. Ahora debe ponerse en abierta.',
    )
    await reload()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aprobar el margen.')
  }
}

function rejectByClient() {
  modalStore.open({
    title: 'Registrar no aceptación del cliente',
    component: PricingReasonModal,
    props: {
      target: 'client',
      id: current.value.id,
      onSaved: async () => {
        await reload()
        await props.onSaved?.()
      },
    },
  })
}

async function setCommercialStatus(status: SetRateStatusRequest['status']) {
  if (status === 'AcceptedByClient' && !current.value.idtraNumber?.trim()) {
    toastStore.warning('IDTRA requerido', 'Registre el IDTRA en Editar antes de marcar la tarifa como Aceptada.')
    edit()
    return
  }
  try {
    await PricingService.setRateStatus(current.value.id, { status })
    toastStore.success(
      'Estado actualizado',
      `La tarifa quedó ${statusLabel(status).toLowerCase()}.`,
    )
    await reload()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo actualizar el estado comercial de la tarifa.')
  }
}

async function printRate() {
  if (printing.value) return

  try {
    printing.value = true
    const fileName =
      currentDisplayName.value || current.value.quoNumber || current.value.rateCode || 'cotizacion'

    await PricingService.downloadRateDocument(current.value.id, fileName, {
      templateCode: 'pricing-fcl-client-quote',
      format: 'pdf',
    })

    toastStore.success(
      'Cotización generada',
      'La tarifa se descargó usando la plantilla configurada en Reports.',
    )
  } catch (error) {
    toastStore.backendError(
      error,
      'No se pudo generar la cotización. Verifique que la plantilla pricing-fcl-client-quote esté activa.',
    )
  } finally {
    printing.value = false
  }
}

onMounted(async () => {
  await catalogs.loadAll()
  await reload()
})
</script>

<template>
  <div class="space-y-6">
    <section
      class="dh-liquid overflow-hidden rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5"
    >
      <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <DhBadge :label="statusLabel(current.status)" :variant="statusTone(current.status)" />
            <DhBadge
              v-if="current.sourceImportFclRateId"
              label="Desde importación"
              variant="primary"
            />
          </div>
          <div class="mt-4 flex items-center gap-3">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-[20px] dh-bg-primary-soft text-[var(--dh-primary)]"
            >
              <Route class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-2xl font-black tracking-tight text-[var(--dh-text)]">
                {{ currentDisplayName }}
              </h2>
              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
                {{ routeLabel(displayCurrent) }}
              </p>
              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
                {{ displayCurrent.carrierName }} · {{ containerSummary(displayCurrent) }} ·
                {{ displayCurrent.incotermName || displayCurrent.incotermCode || 'Sin Incoterm' }} ·
                {{ displayCurrent.agentName }}
              </p>
              <p
                class="mt-1 text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-primary)]"
              >
                {{ current.rateCode }}
                <span v-if="current.idtraNumber"> · IDTRA {{ current.idtraNumber }}</span>
                <span v-if="current.quoNumber"> · QUO {{ current.quoNumber }}</span>
              </p>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <DhButton
            label="Imprimir"
            :icon="Printer"
            variant="secondary"
            size="sm"
            :loading="printing"
            :disabled="printing"
            @click="printRate"
          />
          <DhButton
            v-if="canDuplicate"
            label="Duplicar"
            :icon="Copy"
            variant="secondary"
            size="sm"
            @click="duplicate"
          />
          <DhButton
            v-if="canUpdate && !['Closed', 'Expired'].includes(current.status)"
            label="Editar"
            :icon="Edit3"
            size="sm"
            @click="edit"
          />
          <DhButton
            v-if="canUpdate && current.status === 'ApprovedByManagement'"
            label="Poner en abierta"
            :icon="FolderOpen"
            size="sm"
            @click="setCommercialStatus('Open')"
          />
          <DhButton
            v-if="canUpdate && current.status === 'Open'"
            label="Marcar enviada"
            :icon="SendIcon"
            variant="secondary"
            size="sm"
            @click="setCommercialStatus('Sent')"
          />
          <DhButton
            v-if="canUpdate && ['Sent', 'RequestedByClient'].includes(current.status)"
            label="Aceptada por cliente"
            :icon="CheckCircle2"
            size="sm"
            @click="setCommercialStatus('AcceptedByClient')"
          />
          <DhButton
            v-if="canUpdate && ['Sent', 'RequestedByClient'].includes(current.status)"
            label="Rechazada por cliente"
            :icon="XCircle"
            variant="danger"
            size="sm"
            @click="rejectByClient"
          />
          <button
            type="button"
            class="rounded-2xl p-2.5 text-[var(--dh-text-muted)] hover:bg-[var(--dh-card-hover)]"
            :disabled="loading"
            @click="reload"
          >
            <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />
          </button>
        </div>
      </div>
    </section>

    <section
      v-if="current.status === 'PendingApproval'"
      class="rounded-[26px] border border-amber-500/20 bg-amber-500/10 p-5"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3 text-amber-900 dark:text-amber-100">
          <ShieldCheck class="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 class="font-black">Autorización requerida</h3>
            <p class="mt-1 text-sm font-semibold opacity-80">
              El margen está por debajo del 12% esperado.
            </p>
          </div>
        </div>
        <div v-if="canApprove" class="flex gap-2">
          <DhButton
            label="Rechazar"
            :icon="XCircle"
            variant="secondary"
            size="sm"
            @click="reject"
          /><DhButton label="Aprobar margen" :icon="CheckCircle2" size="sm" @click="approve" />
        </div>
      </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
          Costo total
        </p>
        <p class="mt-2 text-xl font-black">
          {{ formatMoney(current.totalCostAmount, displayCurrent.currencyName) }}
        </p>
      </div>
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
          Venta total
        </p>
        <p class="mt-2 text-xl font-black">
          {{ formatMoney(current.totalSaleAmount, displayCurrent.currencyName) }}
        </p>
      </div>
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
          Utilidad general
        </p>
        <p
          class="mt-2 text-xl font-black"
          :class="
            current.totalUtilityAmount >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-500'
          "
        >
          {{ formatMoney(current.totalUtilityAmount, displayCurrent.currencyName) }}
        </p>
      </div>
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
          Margen actual / esperado
        </p>
        <div class="mt-2 flex items-center gap-2">
          <p class="text-xl font-black">{{ current.marginPercentage.toFixed(2) }}% / 12%</p>
          <DhBadge
            :label="current.marginPercentage >= 12 ? 'En objetivo' : 'Bajo'"
            :variant="marginTone(current.marginPercentage)"
          />
        </div>
      </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-[22px] bg-black/[0.035] p-4 dark:bg-white/[0.05]">
        <p class="text-xs font-bold text-[var(--dh-text-muted)]">POL</p>
        <p class="mt-1 font-black">{{ displayCurrent.polName }}</p>
      </div>
      <div class="rounded-[22px] bg-black/[0.035] p-4 dark:bg-white/[0.05]">
        <p class="text-xs font-bold text-[var(--dh-text-muted)]">POE</p>
        <p class="mt-1 font-black">{{ displayCurrent.poeName }}</p>
      </div>
      <div class="rounded-[22px] bg-black/[0.035] p-4 dark:bg-white/[0.05]">
        <p class="text-xs font-bold text-[var(--dh-text-muted)]">POD</p>
        <p class="mt-1 font-black">{{ displayCurrent.podName }}</p>
      </div>
      <div class="rounded-[22px] bg-black/[0.035] p-4 dark:bg-white/[0.05]">
        <p class="text-xs font-bold text-[var(--dh-text-muted)]">Vigencia · Días libres</p>
        <p class="mt-1 font-black">
          {{ formatDate(current.validFrom) }} – {{ formatDate(current.validTo) }} ·
          {{ current.freeDays }}
        </p>
      </div>
    </section>

    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
            Cliente
          </p>
          <p class="mt-1 font-black">{{ current.clientName || '—' }}</p>
        </div>
        <div>
          <p class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
            Contenedores
          </p>
          <p class="mt-1 font-black">{{ containerSummary(displayCurrent) }}</p>
        </div>
        <div>
          <p class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
            Tiempo de tránsito
          </p>
          <p class="mt-1 font-black">
            {{ current.transitTime || '—' }}
          </p>
        </div>
        <div>
          <p class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
            Tipo de tarifa · Estado
          </p>
          <p class="mt-1 font-black">
            {{ current.rateType === 'Spot' ? 'SPOT' : 'TARIFARIO' }} ·
            {{ statusLabel(current.status) }}
          </p>
        </div>
      </div>
      <div class="mt-5 grid gap-4 lg:grid-cols-3">
        <div class="rounded-[20px] bg-black/[0.035] p-4 dark:bg-white/[0.05]">
          <p class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
            Tarifa incluye
          </p>
          <p class="mt-2 whitespace-pre-line text-sm font-semibold">
            {{ exclusiveTerms.includes }}
          </p>
        </div>
        <div class="rounded-[20px] bg-black/[0.035] p-4 dark:bg-white/[0.05]">
          <p class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
            Sujeto a
          </p>
          <p class="mt-2 whitespace-pre-line text-sm font-semibold">
            {{ exclusiveTerms.subjectTo }}
          </p>
        </div>
        <div class="rounded-[20px] bg-black/[0.035] p-4 dark:bg-white/[0.05]">
          <p class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
            No incluye
          </p>
          <p class="mt-2 whitespace-pre-line text-sm font-semibold">
            {{ exclusiveTerms.excludes }}
          </p>
        </div>
      </div>
    </section>

    <section
      v-for="group in groups"
      :key="group.key"
      class="overflow-hidden rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)]"
    >
      <header
        class="flex items-center justify-between bg-black/[0.035] px-5 py-4 dark:bg-white/[0.05]"
      >
        <div>
          <h3 class="font-black text-[var(--dh-text)]">{{ group.title }}</h3>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ group.subtitle }}</p>
          <button
            v-if="group.key === 'freight' && sourceImportRate"
            type="button"
            class="mt-2 inline-flex max-w-full items-center gap-2 text-left text-xs font-black text-[var(--dh-primary)] hover:underline"
            @click="openRateSource"
          >
            <ExternalLink class="h-3.5 w-3.5 shrink-0" />
            <span class="break-words">Fuente: {{ sourceLabel }}</span>
          </button>
        </div>
        <DhBadge :label="String(group.rows.length)" variant="neutral" />
      </header>
      <div v-if="group.rows.length" class="overflow-x-auto">
        <table class="w-full min-w-[680px] text-sm">
          <thead>
            <tr class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
              <th class="px-5 py-3 text-left">Concepto</th>
              <th class="px-5 py-3 text-left">Aplicación</th>
              <th class="px-5 py-3 text-right">Cantidad</th>
              <th class="px-5 py-3 text-right">Costo</th>
              <th class="px-5 py-3 text-right">Venta</th>
              <th class="px-5 py-3 text-right">Utilidad</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="detail in group.rows"
              :key="detail.id"
              class="border-t border-[var(--dh-border)]"
            >
              <td class="px-5 py-4">
                <p class="font-black text-[var(--dh-text)]">{{ detail.name }}</p>
                <p
                  v-if="resolvedDetailNotes(detail)"
                  class="mt-1 max-w-xl whitespace-pre-line text-xs font-medium text-[var(--dh-text-muted)]"
                >
                  <span class="font-black text-[var(--dh-text-soft)]">Nota operativa:</span>
                  {{ resolvedDetailNotes(detail) }}
                </p>
              </td>
              <td class="px-5 py-4">
                <DhBadge
                  :label="detail.costType"
                  :variant="
                    detail.costType === 'Fixed'
                      ? 'neutral'
                      : detail.costType === 'Optional'
                        ? 'primary'
                        : 'warning'
                  "
                />
              </td>
              <td class="px-5 py-4 text-right font-bold">
                {{ Math.max(1, detail.quantity || 1) }}
              </td>
              <td class="px-5 py-4 text-right font-bold">
                {{
                  formatMoney(
                    detail.costAmount * Math.max(1, detail.quantity || 1),
                    detail.currencyName,
                  )
                }}
              </td>
              <td class="px-5 py-4 text-right font-bold">
                {{
                  formatMoney(
                    detail.saleAmount * Math.max(1, detail.quantity || 1),
                    detail.currencyName,
                  )
                }}
              </td>
              <td
                class="px-5 py-4 text-right font-black"
                :class="
                  detail.utilityAmount >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500'
                "
              >
                {{ formatMoney(detail.utilityAmount, detail.currencyName) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="px-5 py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
        Sin rubros en esta sección.
      </p>
    </section>
  </div>
</template>

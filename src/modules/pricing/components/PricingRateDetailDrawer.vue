<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Archive,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
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
import { UsersService } from '@/core/services/usersService'
import type { RateDetailDto, RateDto, SetRateStatusRequest } from '@/core/interfaces/pricing'
import PricingRateFormDrawer from './PricingRateFormDrawer.vue'
import PricingReasonModal from './PricingReasonModal.vue'
import PricingDuplicateRateModal from './PricingDuplicateRateModal.vue'
import PricingCloseRateModal from './PricingCloseRateModal.vue'
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
const closedByDisplay = ref<string | null>(null)

const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.update))
const canDuplicate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create))
const canApprove = computed(() => authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin))
const canCloseCurrent = computed(
  () =>
    canUpdate.value &&
    [
      'PendingApproval',
      'ApprovedByManagement',
      'RejectedByManagement',
      'Open',
      'Sent',
      'RequestedByClient',
    ].includes(current.value.status),
)

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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function firstText(...values: Array<string | null | undefined>) {
  return (
    values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? null
  )
}

async function resolveClosedByUser() {
  const closedByValue = firstText(current.value.closedBy)
  const explicitName = firstText(
    current.value.closedByDisplayName,
    current.value.closedByUserName,
    closedByValue && !isUuid(closedByValue) ? closedByValue : null,
  )
  if (explicitName) {
    closedByDisplay.value = explicitName
    return
  }

  const rawUser = firstText(
    current.value.closedByUserId,
    closedByValue && isUuid(closedByValue) ? closedByValue : null,
  )
  if (!rawUser) {
    closedByDisplay.value = null
    return
  }

  if (!isUuid(rawUser)) {
    closedByDisplay.value = rawUser
    return
  }

  const currentUserIds = [authStore.userId, authStore.sessionUserId]
    .map((value) => value?.toLowerCase())
    .filter(Boolean)

  if (currentUserIds.includes(rawUser.toLowerCase())) {
    closedByDisplay.value =
      authStore.userDisplayName || authStore.username || authStore.email || 'Usuario actual'
    return
  }

  try {
    let result = await UsersService.browsePaged({
      pageNumber: 1,
      pageSize: 25,
      search: rawUser,
    })
    let user = result.items.find((item) => item.id.toLowerCase() === rawUser.toLowerCase())

    if (!user) {
      result = await UsersService.browsePaged({ pageNumber: 1, pageSize: 500 })
      user = result.items.find((item) => item.id.toLowerCase() === rawUser.toLowerCase())
    }

    closedByDisplay.value = user ? user.displayName || user.userName : 'Usuario no disponible'
  } catch {
    closedByDisplay.value = 'Usuario no disponible'
  }
}

function statusLabel(status: string) {
  return (
    (
      {
        PendingApproval: 'Pendiente de autorización',
        ApprovedByManagement: 'Aprobada por gerencia',
        RejectedByManagement: 'Rechazada por gerencia',
        Open: 'Abierta',
        Sent: 'Enviada',
        RequestedByClient: 'Solicitada por el cliente',
        AcceptedByClient: 'Aceptada por el cliente',
        RejectedByClient: 'Rechazada por el cliente',
        Closed: 'Cerrada',
        Expired: 'Vencida',
      } as Record<string, string>
    )[status] ?? status
  )
}

async function reload() {
  try {
    loading.value = true
    current.value = await PricingService.getRate(current.value.id)
    await loadMissingCostNotes(current.value.rateDetails)
    await resolveClosedByUser()
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

function closeRate() {
  modalStore.open({
    title: 'Cerrar tarifa',
    component: PricingCloseRateModal,
    props: {
      rateId: current.value.id,
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

async function setCommercialStatus(status: SetRateStatusRequest['status']) {
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
            v-if="canUpdate && current.status === 'Sent'"
            label="Solicitada por cliente"
            :icon="Clock"
            variant="secondary"
            size="sm"
            @click="setCommercialStatus('RequestedByClient')"
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
            @click="setCommercialStatus('RejectedByClient')"
          />
          <DhButton
            v-if="canCloseCurrent"
            label="Cerrar tarifa"
            :icon="Archive"
            variant="danger"
            size="sm"
            @click="closeRate"
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
      v-if="current.status === 'RequestedByClient'"
      class="rounded-[26px] border border-sky-500/20 bg-sky-500/10 p-5"
    >
      <div class="flex items-start gap-3 text-sky-900 dark:text-sky-100">
        <Clock class="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h3 class="font-black">Solicitada por el cliente</h3>
          <p class="mt-1 text-sm font-semibold opacity-80">
            El cliente solicitó la tarifa para analizarla, pero todavía no la aceptó ni la rechazó.
            Este estado no se contabiliza como una decisión del cliente.
          </p>
        </div>
      </div>
    </section>

    <section
      v-if="current.status === 'Closed'"
      class="rounded-[26px] border border-slate-500/20 bg-slate-500/10 p-5"
    >
      <div class="flex items-start gap-3 text-slate-900 dark:text-slate-100">
        <Archive class="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h3 class="font-black">Tarifa cerrada</h3>
          <p class="mt-1 text-sm font-semibold opacity-80">
            {{ current.closedReason || 'No se registró un motivo de cierre.' }}
          </p>
          <p v-if="current.closedAtUtc" class="mt-2 text-xs font-bold opacity-65">
            Cerrada el {{ formatDate(current.closedAtUtc) }}
            <span v-if="closedByDisplay"> · Cerrada por: {{ closedByDisplay }}</span>
          </p>
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

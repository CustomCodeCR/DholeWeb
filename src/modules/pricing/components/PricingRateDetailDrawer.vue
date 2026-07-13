<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  CheckCircle2,
  Copy,
  Edit3,
  Printer,
  RefreshCw,
  Route,
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
import type { RateDetailDto, RateDto } from '@/core/interfaces/pricing'
import PricingRateFormDrawer from './PricingRateFormDrawer.vue'
import PricingReasonModal from './PricingReasonModal.vue'
import PricingDuplicateRateModal from './PricingDuplicateRateModal.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import {
  detailGroup,
  formatDate,
  formatMoney,
  marginTone,
  routeLabel,
  statusTone,
} from '@/modules/pricing/utils/pricingFormat'

const props = defineProps<{ rate: RateDto; onSaved?: () => void | Promise<void> }>()
const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const current = ref<RateDto>(props.rate)
const displayCurrent = computed(() => catalogs.resolveRateLabels(current.value))
const loading = ref(false)

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
        Approved: 'Aprobada',
        PendingApproval: 'Pendiente de autorización',
        Rejected: 'Rechazada',
        Draft: 'Borrador',
        Send: 'Enviada',
      } as Record<string, string>
    )[status] ?? status
  )
}

async function reload() {
  try {
    loading.value = true
    current.value = await PricingService.getRate(current.value.id)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo actualizar el detalle de la tarifa.')
  } finally {
    loading.value = false
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
    toastStore.success('Margen aprobado', 'La tarifa quedó aprobada y lista para uso operativo.')
    await reload()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aprobar el margen.')
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function printRate() {
  const rate = displayCurrent.value
  const rows = rate.rateDetails
    .filter((detail) => detail.saleAmount > 0 || detail.costDetailType === 'AgentCharge')
    .map(
      (detail) => `
      <tr>
        <td>${escapeHtml(detail.name)}</td>
        <td>${escapeHtml(detail.costDetailType)}</td>
        <td class="number">${escapeHtml(formatMoney(detail.costAmount, detail.currencyName))}</td>
        <td class="number">${escapeHtml(formatMoney(detail.saleAmount, detail.currencyName))}</td>
      </tr>`,
    )
    .join('')

  const win = window.open('', '_blank', 'width=1000,height=760')
  if (!win) {
    toastStore.warning(
      'Impresión bloqueada',
      'Permita ventanas emergentes para generar la cotización rápida.',
    )
    return
  }
  win.opener = null

  win.document
    .write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tarifa ${escapeHtml(rate.id.slice(0, 8))}</title><style>
    *{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#171717;margin:0;padding:38px;background:#fff}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #fc2800;padding-bottom:22px}.brand{font-size:28px;font-weight:900}.brand span{color:#fc2800}.muted{color:#737373;font-size:12px}.route{margin:26px 0;padding:22px;border-radius:18px;background:#f5f5f5}.route h1{margin:0 0 8px;font-size:24px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.card{border:1px solid #e5e5e5;border-radius:14px;padding:14px}.card small{display:block;color:#737373;text-transform:uppercase;font-weight:800;letter-spacing:.08em}.card strong{display:block;margin-top:6px;font-size:17px}table{width:100%;border-collapse:collapse;margin-top:22px}th{background:#171717;color:white;text-align:left;padding:12px;font-size:11px;text-transform:uppercase;letter-spacing:.08em}td{padding:12px;border-bottom:1px solid #e5e5e5;font-size:13px}.number{text-align:right}.totals{margin:24px 0 0 auto;width:380px;border-top:3px solid #171717}.total-row{display:flex;justify-content:space-between;padding:9px 0;font-weight:700}.total-row.primary{font-size:18px;color:#fc2800}.footer{margin-top:34px;padding-top:18px;border-top:1px solid #e5e5e5;color:#737373;font-size:11px}@media print{body{padding:20px}.no-print{display:none}}
  </style></head><body>
    <div class="header"><div><div class="brand">Dhole <span>Pricing</span></div><div class="muted">Resumen de tarifa FCL</div></div><div class="muted">Emitida: ${escapeHtml(new Date().toLocaleDateString('es-CR'))}<br>ID: ${escapeHtml(rate.id)}</div></div>
    <section class="route"><h1>${escapeHtml(routeLabel(rate))}</h1><div>${escapeHtml(rate.carrierName)} · ${escapeHtml(rate.containerTypeName)} · Agente: ${escapeHtml(rate.agentName)}</div></section>
    <div class="grid"><div class="card"><small>Vigencia</small><strong>${escapeHtml(formatDate(rate.validFrom))} – ${escapeHtml(formatDate(rate.validTo))}</strong></div><div class="card"><small>Días libres</small><strong>${escapeHtml(rate.freeDays)}</strong></div><div class="card"><small>Margen actual</small><strong>${escapeHtml(rate.marginPercentage.toFixed(2))}%</strong></div><div class="card"><small>Estado</small><strong>${escapeHtml(statusLabel(rate.status))}</strong></div></div>
    <table><thead><tr><th>Concepto</th><th>Rubro</th><th class="number">Costo</th><th class="number">Venta</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals"><div class="total-row"><span>Costo total</span><span>${escapeHtml(formatMoney(rate.totalCostAmount, rate.currencyName))}</span></div><div class="total-row primary"><span>Venta total</span><span>${escapeHtml(formatMoney(rate.totalSaleAmount, rate.currencyName))}</span></div><div class="total-row"><span>Utilidad general</span><span>${escapeHtml(formatMoney(rate.totalUtilityAmount, rate.currencyName))}</span></div></div>
    <div class="footer">Tarifa sujeta a vigencia, espacio, disponibilidad y condiciones operativas de origen y destino.</div>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
  </body></html>`)
  win.document.close()
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
                {{ routeLabel(displayCurrent) }}
              </h2>
              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
                {{ displayCurrent.carrierName }} · {{ displayCurrent.containerTypeName }} ·
                {{ displayCurrent.agentName }}
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
          <DhButton v-if="canUpdate" label="Editar" :icon="Edit3" size="sm" @click="edit" />
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
                  v-if="detail.notes"
                  class="mt-0.5 max-w-sm truncate text-xs font-medium text-[var(--dh-text-muted)]"
                >
                  {{ detail.notes }}
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
                {{ formatMoney(detail.costAmount, detail.currencyName) }}
              </td>
              <td class="px-5 py-4 text-right font-bold">
                {{ formatMoney(detail.saleAmount, detail.currencyName) }}
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

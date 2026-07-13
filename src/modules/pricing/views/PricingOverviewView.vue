<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  FileSpreadsheet,
  Plus,
  ReceiptText,
  RefreshCw,
  Ship,
  TrendingUp,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import type { RateDto } from '@/core/interfaces/pricing'
import PricingRateFormDrawer from '@/modules/pricing/components/PricingRateFormDrawer.vue'
import PricingUploadDrawer from '@/modules/pricing/components/PricingUploadDrawer.vue'
import PricingCostFormDrawer from '@/modules/pricing/components/PricingCostFormDrawer.vue'
import PricingRateDetailDrawer from '@/modules/pricing/components/PricingRateDetailDrawer.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { formatMoney, routeLabel, statusTone } from '@/modules/pricing/utils/pricingFormat'

const router = useRouter()
const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const loading = ref(false)
const recentPending = ref<RateDto[]>([])
const metrics = reactive({ rates: 0, pendingApproval: 0, imports: 0, activeCosts: 0 })

const canViewRates = computed(() => authStore.hasScope(PRICING_SCOPES.rates.view))
const canViewImports = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.view))
const canViewCosts = computed(() => authStore.hasScope(PRICING_SCOPES.costs.view))
const canCreateRate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create))
const canUpload = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.create))
const canCreateCost = computed(() => authStore.hasScope(PRICING_SCOPES.costs.create))

async function load() {
  try {
    loading.value = true
    const [rates, pending, imports, costs] = await Promise.all([
      canViewRates.value ? PricingService.browseRates({ pageNumber: 1, pageSize: 1 }) : null,
      canViewRates.value
        ? PricingService.browseRates({ pageNumber: 1, pageSize: 5, requiredApproval: true })
        : null,
      canViewImports.value
        ? PricingService.browseImportRates({ pageNumber: 1, pageSize: 1, status: 'Pending' })
        : null,
      canViewCosts.value
        ? PricingService.browseCosts({ pageNumber: 1, pageSize: 1, isActive: true })
        : null,
    ])
    metrics.rates = rates?.totalCount ?? 0
    metrics.pendingApproval = pending?.totalCount ?? 0
    metrics.imports = imports?.totalCount ?? 0
    metrics.activeCosts = costs?.totalCount ?? 0
    recentPending.value = pending?.items ?? []
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el resumen de Pricing.')
  } finally {
    loading.value = false
  }
}

function openCreateRate() {
  drawerStore.open({
    title: 'Crear tarifa manual',
    component: PricingRateFormDrawer,
    size: 'full',
    props: { onSaved: load },
  })
}
function openUpload() {
  drawerStore.open({
    title: 'Importar tarifario',
    component: PricingUploadDrawer,
    size: 'lg',
    props: { onSaved: load },
  })
}
function openCost() {
  drawerStore.open({
    title: 'Nuevo costo',
    component: PricingCostFormDrawer,
    size: 'lg',
    props: { onSaved: load },
  })
}
function openRate(rate: RateDto) {
  const displayRate = catalogs.resolveRateLabels(rate)
  drawerStore.open({
    title: `Tarifa · ${routeLabel(displayRate)}`,
    component: PricingRateDetailDrawer,
    size: 'xl',
    props: { rate, onSaved: load },
  })
}

onMounted(async () => {
  await catalogs.loadAll()
  await load()
})
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Pricing"
      subtitle="Centro operativo para importaciones, costos, tarifas y control de margen."
      :icon="TrendingUp"
    >
      <template #actions
        ><DhButton
          label="Actualizar"
          :icon="RefreshCw"
          variant="secondary"
          :loading="loading"
          @click="load"
      /></template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid overflow-hidden rounded-[34px] p-6 md:p-8">
      <div class="grid gap-7 xl:grid-cols-[1.35fr_1fr] xl:items-center">
        <div>
          <DhBadge label="Pricing FCL" variant="primary" />
          <h2
            class="mt-4 max-w-2xl text-3xl font-black tracking-tight text-[var(--dh-text)] md:text-4xl"
          >
            De la tarifa importada a una decisión rentable y lista para operar.
          </h2>
          <p class="mt-3 max-w-2xl text-base font-semibold leading-7 text-[var(--dh-text-muted)]">
            El nuevo flujo aplica costos fijos automáticamente, permite seleccionar opcionales,
            calcula utilidad general y controla el margen esperado del 12%.
          </p>
          <div class="mt-6 flex flex-wrap gap-2">
            <DhButton
              v-if="canCreateRate"
              label="Crear tarifa manual"
              :icon="Plus"
              @click="openCreateRate"
            />
            <DhButton
              v-if="canUpload"
              label="Importar tarifario"
              :icon="FileSpreadsheet"
              variant="secondary"
              @click="openUpload"
            />
            <DhButton
              v-if="canCreateCost"
              label="Nuevo costo"
              :icon="BadgeDollarSign"
              variant="secondary"
              @click="openCost"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
            <ReceiptText class="h-5 w-5 text-[var(--dh-primary)]" />
            <p class="mt-5 text-3xl font-black">{{ metrics.rates }}</p>
            <p
              class="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
            >
              Tarifas oficiales
            </p>
          </div>
          <div class="rounded-[26px] border border-amber-500/20 bg-amber-500/10 p-5">
            <AlertTriangle class="h-5 w-5 text-amber-600" />
            <p class="mt-5 text-3xl font-black">{{ metrics.pendingApproval }}</p>
            <p
              class="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
            >
              Margen por aprobar
            </p>
          </div>
          <div class="rounded-[26px] border border-blue-500/20 bg-blue-500/10 p-5">
            <FileSpreadsheet class="h-5 w-5 text-blue-600" />
            <p class="mt-5 text-3xl font-black">{{ metrics.imports }}</p>
            <p
              class="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
            >
              Importaciones pendientes
            </p>
          </div>
          <div class="rounded-[26px] border border-emerald-500/20 bg-emerald-500/10 p-5">
            <BadgeDollarSign class="h-5 w-5 text-emerald-600" />
            <p class="mt-5 text-3xl font-black">{{ metrics.activeCosts }}</p>
            <p
              class="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
            >
              Costos activos
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-3">
      <button
        v-if="canViewImports"
        type="button"
        class="dh-card-hover rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 text-left"
        @click="router.push('/pricing/imports')"
      >
        <div class="flex items-center justify-between">
          <span
            class="flex h-12 w-12 items-center justify-center rounded-[20px] bg-blue-500/10 text-blue-600"
            ><FileSpreadsheet class="h-5 w-5" /></span
          ><ArrowRight class="h-5 w-5 text-[var(--dh-text-muted)]" />
        </div>
        <h3 class="mt-5 text-lg font-black">Tarifas importadas</h3>
        <p class="mt-1 text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">
          Revise extracción, estado y conversión a tarifa oficial.
        </p>
      </button>
      <button
        v-if="canViewRates"
        type="button"
        class="dh-card-hover rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 text-left"
        @click="router.push('/pricing/rates')"
      >
        <div class="flex items-center justify-between">
          <span
            class="flex h-12 w-12 items-center justify-center rounded-[20px] dh-bg-primary-soft text-[var(--dh-primary)]"
            ><Ship class="h-5 w-5" /></span
          ><ArrowRight class="h-5 w-5 text-[var(--dh-text-muted)]" />
        </div>
        <h3 class="mt-5 text-lg font-black">Tarifas oficiales</h3>
        <p class="mt-1 text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">
          Controle ruta, venta, utilidad general, margen y aprobación.
        </p>
      </button>
      <button
        v-if="canViewCosts"
        type="button"
        class="dh-card-hover rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 text-left"
        @click="router.push('/pricing/costs')"
      >
        <div class="flex items-center justify-between">
          <span
            class="flex h-12 w-12 items-center justify-center rounded-[20px] bg-emerald-500/10 text-emerald-600"
            ><BadgeDollarSign class="h-5 w-5" /></span
          ><ArrowRight class="h-5 w-5 text-[var(--dh-text-muted)]" />
        </div>
        <h3 class="mt-5 text-lg font-black">Matriz de costos</h3>
        <p class="mt-1 text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">
          Administre fijos automáticos, opcionales y variables.
        </p>
      </button>
    </section>

    <section
      v-if="canViewRates"
      class="rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5"
    >
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-black">Atención requerida</h2>
          <p class="text-sm font-semibold text-[var(--dh-text-muted)]">
            Tarifas recientes con margen inferior al 12%.
          </p>
        </div>
        <DhButton
          label="Ver tarifas"
          variant="ghost"
          size="sm"
          @click="router.push('/pricing/rates')"
        />
      </div>
      <div v-if="recentPending.length" class="mt-4 divide-y divide-[var(--dh-border)]">
        <button
          v-for="rate in recentPending"
          :key="rate.id"
          type="button"
          class="flex w-full items-center justify-between gap-4 py-4 text-left"
          @click="openRate(rate)"
        >
          <div>
            <p class="font-black">{{ routeLabel(catalogs.resolveRateLabels(rate)) }}</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ catalogs.resolveRateLabels(rate).carrierName }} · {{ catalogs.resolveRateLabels(rate).agentName }} ·
              {{ formatMoney(rate.totalSaleAmount, catalogs.resolveRateLabels(rate).currencyName) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <DhBadge :label="`${rate.marginPercentage.toFixed(2)}%`" variant="warning" /><DhBadge
              label="Pendiente"
              :variant="statusTone(rate.status)"
            />
          </div>
        </button>
      </div>
      <p
        v-else
        class="mt-4 rounded-[22px] bg-emerald-500/10 px-4 py-6 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300"
      >
        No hay aprobaciones de margen pendientes.
      </p>
    </section>
  </section>
</template>

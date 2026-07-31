<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, ClipboardCheck, Edit3, Mail, RefreshCw } from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox } from '@/shared/components/atoms'
import { DhDataTable, DhPagination, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import type { ImportRateDto } from '@/core/interfaces/pricing'
import PricingImportReviewDrawer from '@/modules/pricing/components/PricingImportReviewDrawer.vue'
import PricingWorkflowGuide from '@/modules/pricing/components/PricingWorkflowGuide.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { formatDate, formatMoney, statusTone } from '@/modules/pricing/utils/pricingFormat'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

const rows = ref<ImportRateDto[]>([])
const selectedIds = ref<string[]>([])
const loading = ref(false)
const approving = ref(false)
const page = ref(1)
const pageSize = ref(25)
const total = ref(0)
const viewFilter = ref<'all' | 'missing' | 'ready'>('missing')
const batchId = computed(() => String(route.params.batchId ?? ''))
const canReview = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.approve))
const canApprove = canReview

const columns: DhTableColumn<ImportRateDto>[] = [
  { key: 'selected', label: '', width: '46px', align: 'center' },
  { key: 'carrier', label: 'Naviera / Agente' },
  { key: 'route', label: 'Ruta' },
  { key: 'container', label: 'Equipo' },
  { key: 'freight', label: 'Flete', align: 'right' },
  { key: 'validity', label: 'Vigencia' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'actions', label: '', width: '170px', align: 'right' },
]

function match(items: typeof catalogs.carriers.value, id?: string | null, ...values: Array<string | null | undefined>) {
  return catalogs.findBestMatch(items, id, ...values)
}
function carrier(row: ImportRateDto) {
  return match(catalogs.carriers.value, row.carrierId, row.carrier, row.carrierCode, row.carrierSlug)?.name || row.carrier || 'No asignada'
}
function agent(row: ImportRateDto) {
  return match(catalogs.agents.value, row.agentId, row.agent, row.agentCode, row.agentSlug)?.name || 'No asignado'
}
function pol(row: ImportRateDto) {
  return match(catalogs.polPorts.value, row.polId, row.pol, row.polCode, row.polSlug)?.name || row.pol || 'No asignado'
}
function poe(row: ImportRateDto) {
  return match(catalogs.poePorts.value, row.poeId, row.poe, row.poeCode, row.poeSlug)?.name || 'No asignado'
}
function pod(row: ImportRateDto) {
  return match(catalogs.podPorts.value, row.podId, row.pod, row.podCode, row.podSlug)?.name || row.pod || 'No asignado'
}
function container(row: ImportRateDto) {
  return match(catalogs.containerTypes.value, row.containerTypeId, row.containerType, row.containerTypeCode, row.containerTypeSlug)?.name || row.containerType || 'No asignado'
}
function currency(row: ImportRateDto) {
  return match(catalogs.currencies.value, row.currencyId, row.currency, row.currencyCode, row.currencySlug)?.code || row.currencyCode || 'USD'
}
function isComplete(row: ImportRateDto) {
  return Boolean(
    match(catalogs.importProfiles.value, row.importProfileId, row.importProfileName, row.importProfileCode, row.importProfileSlug) &&
      match(catalogs.polPorts.value, row.polId, row.pol, row.polCode, row.polSlug) &&
      match(catalogs.poePorts.value, row.poeId, row.poe, row.poeCode, row.poeSlug) &&
      match(catalogs.podPorts.value, row.podId, row.pod, row.podCode, row.podSlug) &&
      match(catalogs.carriers.value, row.carrierId, row.carrier, row.carrierCode, row.carrierSlug) &&
      match(catalogs.agents.value, row.agentId, row.agent, row.agentCode, row.agentSlug) &&
      match(catalogs.containerTypes.value, row.containerTypeId, row.containerType, row.containerTypeCode, row.containerTypeSlug) &&
      match(catalogs.currencies.value, row.currencyId, row.currency, row.currencyCode, row.currencySlug) &&
      Number(row.oceanFreight ?? row.freight) >= 0 &&
      Boolean(row.validFrom) && Boolean(row.validTo),
  )
}

const pendingRows = computed(() => rows.value.filter((row) => row.status === 'Pending'))
const incompleteRows = computed(() => pendingRows.value.filter((row) => !isComplete(row)))
const approvedRows = computed(() => rows.value.filter((row) => row.status === 'Approved'))
const visibleRows = computed(() => {
  if (viewFilter.value === 'missing') return rows.value.filter((row) => row.status === 'Pending' && !isComplete(row))
  if (viewFilter.value === 'ready') return rows.value.filter((row) => row.status === 'Pending' && isComplete(row))
  return rows.value
})
const allVisibleSelected = computed(() => visibleRows.value.length > 0 && visibleRows.value.every((row) => selectedIds.value.includes(row.id)))
const approvableSelectedIds = computed(() => rows.value.filter((row) => selectedIds.value.includes(row.id) && row.status === 'Pending' && isComplete(row)).map((row) => row.id))
const completionPercent = computed(() => {
  const reviewable = pendingRows.value.length + approvedRows.value.length
  if (!reviewable) return 0
  return Math.round(((pendingRows.value.filter(isComplete).length + approvedRows.value.length) / reviewable) * 100)
})

function missingFields(row: ImportRateDto) {
  const missing: string[] = []
  if (!match(catalogs.importProfiles.value, row.importProfileId, row.importProfileName, row.importProfileCode, row.importProfileSlug)) missing.push('perfil')
  if (!match(catalogs.polPorts.value, row.polId, row.pol, row.polCode, row.polSlug)) missing.push('POL')
  if (!match(catalogs.poePorts.value, row.poeId, row.poe, row.poeCode, row.poeSlug)) missing.push('POE')
  if (!match(catalogs.podPorts.value, row.podId, row.pod, row.podCode, row.podSlug)) missing.push('POD')
  if (!match(catalogs.carriers.value, row.carrierId, row.carrier, row.carrierCode, row.carrierSlug)) missing.push('naviera')
  if (!match(catalogs.agents.value, row.agentId, row.agent, row.agentCode, row.agentSlug)) missing.push('agente')
  if (!match(catalogs.containerTypes.value, row.containerTypeId, row.containerType, row.containerTypeCode, row.containerTypeSlug)) missing.push('contenedor')
  if (!match(catalogs.currencies.value, row.currencyId, row.currency, row.currencyCode, row.currencySlug)) missing.push('moneda')
  if (!row.validFrom || !row.validTo) missing.push('vigencia')
  if (!Number.isFinite(Number(row.oceanFreight ?? row.freight))) missing.push('flete')
  return missing
}

async function load() {
  if (!batchId.value) return
  try {
    loading.value = true
    const result = await PricingService.browseImportRates({
      importBatchId: batchId.value,
      pageNumber: page.value,
      pageSize: pageSize.value,
    })
    rows.value = result.items
    total.value = result.totalCount ?? result.items.length
    selectedIds.value = selectedIds.value.filter((id) => result.items.some((row) => row.id === id))
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el lote para revisión.')
  } finally {
    loading.value = false
  }
}

function toggle(id: string) {
  selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter((value) => value !== id) : [...selectedIds.value, id]
}
function toggleAll() {
  selectedIds.value = allVisibleSelected.value ? selectedIds.value.filter((id) => !visibleRows.value.some((row) => row.id === id)) : [...new Set([...selectedIds.value, ...visibleRows.value.map((row) => row.id)])]
}

function openReview(row: ImportRateDto) {
  if (!canReview.value || row.status !== 'Pending') return
  drawerStore.open({
    title: 'Aplicar revisión de tarifa',
    component: PricingImportReviewDrawer,
    size: 'xl',
    props: {
      importRate: row,
      canApprove: canApprove.value,
      onSaved: async () => load(),
      onApproved: async () => {
        drawerStore.close()
        await load()
      },
    },
  })
}

async function approveSelected() {
  if (!canApprove.value || approvableSelectedIds.value.length === 0) return
  try {
    approving.value = true
    await PricingService.approveImportRates(approvableSelectedIds.value)
    selectedIds.value = []
    toastStore.success('Tarifas aprobadas', 'Las revisiones completas fueron aprobadas.')
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron aprobar las tarifas seleccionadas.')
  } finally {
    approving.value = false
  }
}

function statusLabel(status: string) {
  return ({ Pending: 'Pendiente', Approved: 'Aprobada', Rejected: 'Rechazada', Created: 'Creada', Expired: 'Vencida' } as Record<string, string>)[status] ?? status
}

watch([page, pageSize], load)
onMounted(async () => {
  await catalogs.loadAll()
  await load()
})
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Revisar lote de tarifas"
      subtitle="Complete únicamente los datos señalados y apruebe las filas listas. No se vuelve a ejecutar la extracción."
      :icon="ClipboardCheck"
    >
      <template #actions>
        <DhButton label="Volver a bandeja" :icon="Mail" variant="secondary" @click="router.push('/pricing/email-imports')" />
        <DhButton label="Salir del lote" :icon="ArrowLeft" variant="ghost" @click="router.push('/pricing/imports')" />
        <DhButton label="Actualizar" :icon="RefreshCw" variant="ghost" @click="load" />
      </template>
    </DhPageHeader>

    <PricingWorkflowGuide current="review" compact />

    <section class="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <article class="rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Progreso del lote</p>
            <h2 class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ completionPercent }}% preparado</h2>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
              Corrija primero las filas incompletas. Las filas listas pueden aprobarse en conjunto.
            </p>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="rounded-[18px] border border-amber-500/25 bg-amber-500/10 px-3 py-2">
              <p class="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">Incompletas</p>
              <p class="mt-1 text-xl font-black">{{ incompleteRows.length }}</p>
            </div>
            <div class="rounded-[18px] border border-sky-500/25 bg-sky-500/10 px-3 py-2">
              <p class="text-[10px] font-black uppercase text-sky-700 dark:text-sky-300">Listas</p>
              <p class="mt-1 text-xl font-black">{{ pendingRows.length - incompleteRows.length }}</p>
            </div>
            <div class="rounded-[18px] border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
              <p class="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">Aprobadas</p>
              <p class="mt-1 text-xl font-black">{{ approvedRows.length }}</p>
            </div>
          </div>
        </div>
        <div class="mt-5 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div class="h-full rounded-full bg-[var(--dh-primary)] transition-all" :style="{ width: `${completionPercent}%` }" />
        </div>
        <p class="mt-3 break-all text-xs font-semibold text-[var(--dh-text-muted)]">Lote: {{ batchId }}</p>
      </article>

      <article class="rounded-[30px] border border-[rgb(var(--dh-primary-rgb)/0.24)] bg-[rgb(var(--dh-primary-rgb)/0.07)] p-5">
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Cómo terminar</p>
        <ol class="mt-3 space-y-3 text-sm font-semibold text-[var(--dh-text-muted)]">
          <li class="flex gap-3"><span class="font-black text-[var(--dh-primary)]">1.</span><span>Abra una fila marcada como incompleta.</span></li>
          <li class="flex gap-3"><span class="font-black text-[var(--dh-primary)]">2.</span><span>Complete los campos rojos y guarde.</span></li>
          <li class="flex gap-3"><span class="font-black text-[var(--dh-primary)]">3.</span><span>Apruebe las filas listas en conjunto.</span></li>
        </ol>
      </article>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-wrap gap-2">
          <DhButton label="Incompletas" size="sm" :variant="viewFilter === 'missing' ? 'primary' : 'secondary'" @click="viewFilter = 'missing'" />
          <DhButton label="Listas para aprobar" size="sm" :variant="viewFilter === 'ready' ? 'primary' : 'secondary'" @click="viewFilter = 'ready'" />
          <DhButton label="Todas" size="sm" :variant="viewFilter === 'all' ? 'primary' : 'secondary'" @click="viewFilter = 'all'" />
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <DhCheckbox :model-value="allVisibleSelected" label="Seleccionar visibles" @update:model-value="toggleAll" />
          <span v-if="selectedIds.length" class="text-sm font-bold text-[var(--dh-text-muted)]">{{ selectedIds.length }} seleccionadas</span>
          <DhButton
            v-if="canApprove && approvableSelectedIds.length"
            :label="`Aprobar listas (${approvableSelectedIds.length})`"
            :icon="Check"
            size="sm"
            :loading="approving"
            @click="approveSelected"
          />
        </div>
      </div>

      <div class="mt-5">
        <DhDataTable :columns="columns" :rows="visibleRows" :loading="loading" empty-text="No hay tarifas en este estado." @row-click="openReview">
          <template #cell-selected="{ row }"><div class="flex justify-center" @click.stop><DhCheckbox :model-value="selectedIds.includes(row.id)" @update:model-value="toggle(row.id)" /></div></template>
          <template #cell-carrier="{ row }"><div><p class="font-black">{{ carrier(row) }}</p><p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ agent(row) }}</p></div></template>
          <template #cell-route="{ row }">
            <div>
              <p class="font-black">{{ pol(row) }} → {{ poe(row) }} → {{ pod(row) }}</p>
              <p v-if="missingFields(row).length" class="mt-1 text-xs font-bold text-amber-600">
                Falta: {{ missingFields(row).join(', ') }}
              </p>
              <p v-else class="mt-1 text-xs font-bold text-emerald-600">Datos completos</p>
            </div>
          </template>
          <template #cell-container="{ row }"><DhBadge :label="container(row)" variant="neutral" /></template>
          <template #cell-freight="{ row }"><span class="font-black">{{ formatMoney(row.oceanFreight ?? row.freight, currency(row)) }}</span></template>
          <template #cell-validity="{ row }"><div class="text-xs font-semibold"><p>{{ formatDate(row.validFrom) }}</p><p class="text-[var(--dh-text-muted)]">hasta {{ formatDate(row.validTo) }}</p></div></template>
          <template #cell-status="{ row }"><DhBadge :label="statusLabel(row.status)" :variant="statusTone(row.status)" /></template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end">
              <DhButton
                v-if="row.status === 'Pending' && canReview"
                :label="isComplete(row) ? 'Revisar datos' : 'Completar tarifa'"
                :icon="Edit3"
                size="sm"
                :variant="isComplete(row) ? 'secondary' : 'primary'"
                @click.stop="openReview(row)"
              />
              <DhBadge v-else-if="row.status === 'Approved'" label="Aprobada" variant="success" />
            </div>
          </template>
        </DhDataTable>
      </div>
      <div class="mt-5"><DhPagination v-model:page="page" v-model:page-size="pageSize" :total="total" /></div>
    </section>
  </section>
</template>

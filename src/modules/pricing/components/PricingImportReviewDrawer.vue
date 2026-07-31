<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Check, Save } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useToastStore } from '@/core/stores/toastStore'
import type { ImportRateDto, ReviewImportRateRequest } from '@/core/interfaces/pricing'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'

const props = withDefaults(
  defineProps<{
    importRate: ImportRateDto
    canApprove?: boolean
    onSaved?: (rate: ImportRateDto) => void | Promise<void>
    onApproved?: (rate: ImportRateDto) => void | Promise<void>
  }>(),
  { canApprove: false },
)

const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const current = ref<ImportRateDto>(props.importRate)
const loading = ref(false)
const saving = ref(false)
const savingAndApproving = ref(false)
const errors = reactive<Record<string, string>>({})
const form = reactive({
  importProfileId: '',
  polId: '',
  poeId: '',
  podId: '',
  carrierId: '',
  agentId: '',
  containerTypeId: '',
  currencyId: '',
  commodity: '',
  oceanFreight: '',
  originCharges: '',
  destinationCharges: '',
  surcharges: '',
  totalSale: '',
  freeDays: '',
  transitDays: '',
  validFrom: '',
  validTo: '',
  reviewNotes: '',
})

function dateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function bestId(
  items: typeof catalogs.carriers.value,
  id?: string | null,
  ...values: Array<string | null | undefined>
) {
  return catalogs.findBestMatch(items, id, ...values)?.id ?? ''
}

function hydrate(rate: ImportRateDto) {
  current.value = rate
  form.importProfileId = bestId(
    catalogs.importProfiles.value,
    rate.importProfileId,
    rate.importProfileName,
    rate.importProfileCode,
    rate.importProfileSlug,
  )
  form.polId = bestId(catalogs.polPorts.value, rate.polId, rate.pol, rate.polCode, rate.polSlug)
  form.poeId = bestId(catalogs.poePorts.value, rate.poeId, rate.poe, rate.poeCode, rate.poeSlug)
  form.podId = bestId(catalogs.podPorts.value, rate.podId, rate.pod, rate.podCode, rate.podSlug)
  form.carrierId = bestId(
    catalogs.carriers.value,
    rate.carrierId,
    rate.carrier,
    rate.carrierCode,
    rate.carrierSlug,
  )
  form.agentId = bestId(
    catalogs.agents.value,
    rate.agentId,
    rate.agent,
    rate.agentCode,
    rate.agentSlug,
  )
  form.containerTypeId = bestId(
    catalogs.containerTypes.value,
    rate.containerTypeId,
    rate.containerType,
    rate.containerTypeCode,
    rate.containerTypeSlug,
  )
  form.currencyId = bestId(
    catalogs.currencies.value,
    rate.currencyId,
    rate.currency,
    rate.currencyCode,
    rate.currencySlug,
  )
  form.commodity = rate.commodity ?? ''
  form.oceanFreight = String(rate.oceanFreight ?? rate.freight ?? 0)
  form.originCharges = String(rate.originCharges ?? 0)
  form.destinationCharges = String(rate.destinationCharges ?? 0)
  form.surcharges = String(rate.surcharges ?? 0)
  form.totalSale = rate.totalSale == null ? '' : String(rate.totalSale)
  form.freeDays = String(rate.freeDays ?? 0)
  form.transitDays = rate.transitDays == null ? '' : String(rate.transitDays)
  form.validFrom = dateInput(rate.validFrom)
  form.validTo = dateInput(rate.validTo)
  form.reviewNotes = ''
}

const calculatedCost = computed(
  () =>
    Number(form.oceanFreight || 0) +
    Number(form.originCharges || 0) +
    Number(form.destinationCharges || 0) +
    Number(form.surcharges || 0),
)

const requiredFieldStatus = computed(() => [
  { label: 'Perfil', ready: Boolean(form.importProfileId) },
  { label: 'Agente', ready: Boolean(form.agentId) },
  { label: 'Naviera', ready: Boolean(form.carrierId) },
  { label: 'Contenedor', ready: Boolean(form.containerTypeId) },
  { label: 'POL', ready: Boolean(form.polId) },
  { label: 'POE', ready: Boolean(form.poeId) },
  { label: 'POD', ready: Boolean(form.podId) },
  { label: 'Moneda', ready: Boolean(form.currencyId) },
  { label: 'Flete', ready: form.oceanFreight !== '' && Number(form.oceanFreight) >= 0 },
  { label: 'Vigencia', ready: Boolean(form.validFrom && form.validTo) },
])
const missingRequired = computed(() => requiredFieldStatus.value.filter((field) => !field.ready))
const completionPercent = computed(() => Math.round(((requiredFieldStatus.value.length - missingRequired.value.length) / requiredFieldStatus.value.length) * 100))

function validate() {
  Object.keys(errors).forEach((key) => delete errors[key])
  const requiredCatalogs: Array<[keyof typeof form, string]> = [
    ['importProfileId', 'Seleccione el perfil.'],
    ['polId', 'Seleccione el POL.'],
    ['poeId', 'Seleccione el POE.'],
    ['podId', 'Seleccione el POD.'],
    ['carrierId', 'Seleccione la naviera.'],
    ['agentId', 'Seleccione el agente.'],
    ['containerTypeId', 'Seleccione el contenedor.'],
    ['currencyId', 'Seleccione la moneda.'],
  ]
  for (const [key, message] of requiredCatalogs) {
    if (!String(form[key] ?? '').trim()) errors[key] = message
  }

  const numericFields: Array<[keyof typeof form, string]> = [
    ['oceanFreight', 'El flete es obligatorio.'],
    ['originCharges', 'Indique los cargos de origen.'],
    ['destinationCharges', 'Indique los cargos de destino.'],
    ['surcharges', 'Indique los recargos.'],
    ['freeDays', 'Indique los días libres.'],
  ]
  for (const [key, message] of numericFields) {
    const value = Number(form[key])
    if (!String(form[key]).trim() || !Number.isFinite(value) || value < 0) errors[key] = message
  }
  if (form.totalSale && (!Number.isFinite(Number(form.totalSale)) || Number(form.totalSale) < 0)) {
    errors.totalSale = 'La venta no puede ser negativa.'
  }
  if (form.transitDays && (!Number.isFinite(Number(form.transitDays)) || Number(form.transitDays) < 0)) {
    errors.transitDays = 'Los días de tránsito no pueden ser negativos.'
  }
  if (!form.validFrom) errors.validFrom = 'Seleccione la fecha inicial.'
  if (!form.validTo) errors.validTo = 'Seleccione la fecha final.'
  if (form.validFrom && form.validTo && form.validTo < form.validFrom) {
    errors.validTo = 'La fecha final no puede ser menor a la inicial.'
  }
  return Object.keys(errors).length === 0
}

function payload(): ReviewImportRateRequest {
  return {
    importProfileId: form.importProfileId,
    polId: form.polId,
    poeId: form.poeId,
    podId: form.podId,
    carrierId: form.carrierId,
    agentId: form.agentId,
    containerTypeId: form.containerTypeId,
    currencyId: form.currencyId,
    commodity: form.commodity.trim() || null,
    oceanFreight: Number(form.oceanFreight),
    originCharges: Number(form.originCharges),
    destinationCharges: Number(form.destinationCharges),
    surcharges: Number(form.surcharges),
    totalSale: form.totalSale.trim() ? Number(form.totalSale) : null,
    freeDays: Number(form.freeDays),
    transitDays: form.transitDays.trim() ? Number(form.transitDays) : null,
    validFrom: form.validFrom,
    validTo: form.validTo,
    reviewNotes: form.reviewNotes.trim() || null,
  }
}

async function save(approveAfter: boolean) {
  if (!validate() || saving.value || savingAndApproving.value) return
  try {
    if (approveAfter) savingAndApproving.value = true
    else saving.value = true

    await PricingService.reviewImportRate(current.value.id, payload())
    const refreshed = await PricingService.getImportRate(current.value.id)
    current.value = refreshed
    await props.onSaved?.(refreshed)

    if (approveAfter) {
      await PricingService.approveImportRate(current.value.id)
      const approved = { ...refreshed, status: 'Approved' as const }
      current.value = approved
      toastStore.success('Revisión aplicada', 'La tarifa fue corregida y aprobada correctamente.')
      await props.onApproved?.(approved)
    } else {
      toastStore.success('Revisión guardada', 'Los cambios quedaron aplicados a la tarifa importada.')
    }
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aplicar la revisión de la tarifa.')
  } finally {
    saving.value = false
    savingAndApproving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await catalogs.loadAll()
    const detail = await PricingService.getImportRate(props.importRate.id)
    hydrate(detail)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo preparar la pantalla de revisión.')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-5 pb-24">
    <div
      v-if="loading"
      class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]"
    >
      Cargando datos para revisión...
    </div>

    <template v-else>
      <section class="rounded-[28px] border border-[rgb(var(--dh-primary-rgb)/0.25)] bg-[rgb(var(--dh-primary-rgb)/0.07)] p-5">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Estado de la tarifa</p>
            <h3 class="mt-2 text-xl font-black text-[var(--dh-text)]">{{ completionPercent }}% completa</h3>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
              <span v-if="missingRequired.length">Falta completar: {{ missingRequired.map((field) => field.label).join(', ') }}.</span>
              <span v-else>Todos los datos obligatorios están listos para guardar y aprobar.</span>
            </p>
          </div>
          <div class="min-w-[160px]">
            <div class="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div class="h-full rounded-full bg-[var(--dh-primary)]" :style="{ width: `${completionPercent}%` }" />
            </div>
            <p class="mt-2 text-right text-xs font-black text-[var(--dh-text-muted)]">
              {{ requiredFieldStatus.length - missingRequired.length }}/{{ requiredFieldStatus.length }} campos clave
            </p>
          </div>
        </div>
      </section>

      <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <div class="mb-4">
          <p class="text-xs font-black uppercase tracking-[0.13em] text-[var(--dh-primary)]">1. Clasificación comercial</p>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Identifique quién ofrece la tarifa y para qué tipo de importación aplica.</p>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <DhSelect v-model="form.importProfileId" label="Perfil de importación *" :options="catalogs.profileOptions.value" :error="errors.importProfileId" />
          <DhSelect v-model="form.agentId" label="Agente *" :options="catalogs.agentOptions.value" :error="errors.agentId" />
          <DhSelect v-model="form.carrierId" label="Naviera *" :options="catalogs.carrierOptions.value" :error="errors.carrierId" />
          <DhSelect v-model="form.containerTypeId" label="Contenedor *" :options="catalogs.containerOptions.value" :error="errors.containerTypeId" />
        </div>
      </section>

      <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <div class="mb-4">
          <p class="text-xs font-black uppercase tracking-[0.13em] text-[var(--dh-primary)]">2. Ruta</p>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Confirme la secuencia POL → POE → POD. El POE debe existir en Config para aprobar.</p>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <DhSelect v-model="form.polId" label="POL · Puerto de origen *" :options="catalogs.polOptions.value" :error="errors.polId" />
          <DhSelect v-model="form.poeId" label="POE · Puerto de entrada *" :options="catalogs.poeOptions.value" :error="errors.poeId" />
          <DhSelect v-model="form.podId" label="POD · Destino final *" :options="catalogs.podOptions.value" :error="errors.podId" />
        </div>
      </section>

      <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <div class="mb-4">
          <p class="text-xs font-black uppercase tracking-[0.13em] text-[var(--dh-primary)]">3. Valores y condiciones</p>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Revise el flete y los cargos detectados. Los campos en cero son válidos.</p>
        </div>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DhSelect v-model="form.currencyId" label="Moneda *" :options="catalogs.currencyOptions.value" :error="errors.currencyId" />
          <DhInput v-model="form.oceanFreight" type="number" label="Flete internacional *" :error="errors.oceanFreight" />
          <DhInput v-model="form.originCharges" type="number" label="Cargos de origen *" :error="errors.originCharges" />
          <DhInput v-model="form.destinationCharges" type="number" label="Cargos de destino *" :error="errors.destinationCharges" />
          <DhInput v-model="form.surcharges" type="number" label="Recargos *" :error="errors.surcharges" />
          <DhInput v-model="form.totalSale" type="number" label="Venta opcional" :error="errors.totalSale" />
          <DhInput v-model="form.freeDays" type="number" label="Días libres *" :error="errors.freeDays" />
          <DhInput v-model="form.transitDays" type="number" label="Días de tránsito" :error="errors.transitDays" />
        </div>
        <div class="mt-4 rounded-[20px] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">Costo total calculado</p>
          <p class="mt-1 text-2xl font-black text-[var(--dh-text)]">{{ calculatedCost.toFixed(2) }}</p>
        </div>
      </section>

      <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <div class="mb-4">
          <p class="text-xs font-black uppercase tracking-[0.13em] text-[var(--dh-primary)]">4. Vigencia y auditoría</p>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Defina la vigencia comercial y documente cualquier corrección manual.</p>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <DhInput v-model="form.validFrom" type="date" label="Vigente desde *" :error="errors.validFrom" />
          <DhInput v-model="form.validTo" type="date" label="Vigente hasta *" :error="errors.validTo" />
        </div>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <DhTextarea v-model="form.commodity" label="Mercancía / condición comercial" :rows="4" />
          <DhTextarea v-model="form.reviewNotes" label="Notas de revisión para auditoría" :rows="4" />
        </div>
      </section>

      <div class="sticky bottom-0 z-10 -mx-1 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)]/95 p-4 shadow-xl backdrop-blur-xl">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm font-semibold text-[var(--dh-text-muted)]">
            <span v-if="missingRequired.length">Puede guardar el avance, pero complete los campos marcados antes de aprobar.</span>
            <span v-else>La tarifa está lista para guardarse y aprobarse.</span>
          </p>
          <div class="flex flex-col-reverse gap-2 sm:flex-row">
            <DhButton label="Guardar cambios" :icon="Save" variant="secondary" :loading="saving" @click="save(false)" />
            <DhButton v-if="canApprove" label="Guardar y aprobar" :icon="Check" :loading="savingAndApproving" @click="save(true)" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

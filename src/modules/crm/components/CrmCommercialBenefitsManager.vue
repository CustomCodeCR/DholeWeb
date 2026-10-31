<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/core/stores/authStore'
import { PricingService } from '@/core/services/pricingService'
import type { CostDetailType, CostSelectDto } from '@/core/interfaces/pricing'
import { BadgePercent, Check, Pencil, Plus, RefreshCw, ShieldCheck, X } from 'lucide-vue-next'
import CrmMultiCatalogPicker from './CrmMultiCatalogPicker.vue'
import { benefitUsesPod } from '../utils/crmBenefitRouteCatalog'
import { crmError, crmPath, crmRequest, fromUtc, toUtc } from '../services/crmApi'

type Mode = 'FCL' | 'LCL' | 'FTL' | 'LTL' | 'AIR'
type BenefitType = 'FIXED_AMOUNT' | 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENT' |
  'INSURANCE_PERCENT' | 'WAIVE' | 'NEGOTIATED'
type Rate = {
  id: string; accountId: string; rowVersion: number; modality: Mode
  laneCode: string | null; chargeCode: string; customChargeName: string | null
  rateType: BenefitType; value: number | null; minimumCharge: number | null
  insuranceCostPercent: number | null; insuranceSalePercent: number | null
  currencyCode: string | null; unitCode: string | null
  equipmentCode: string | null; originCode: string | null; destinationCode: string | null
  equipmentCodes: string[]; polCodes: string[]; poeCodes: string[]; podCodes: string[]
  validFrom: string | null; validUntil: string | null; notes: string | null; isActive: boolean
}
type Settings = {
  id: string; accountId: string; rowVersion: number
  notes: string | null
}
type BenefitsResponse = {
  accountId: string; categoryType: string; categoryCode: string
  settings: Settings | null; rates: Rate[]
}
interface Draft {
  modality: Mode; laneCode: string
  chargeCode: CostDetailType; customChargeName: string
  rateType: BenefitType; value: string; minimumCharge: string
  insuranceCostPercent: string; insuranceSalePercent: string
  currencyCode: string; unitCode: string
  equipmentCodes: string[]; polCodes: string[]; poeCodes: string[]; podCodes: string[]
  validFrom: string; validUntil: string; notes: string; isActive: boolean
}
const props = defineProps<{ accountId: string }>()
const router = useRouter()
const auth = useAuthStore()
const canEdit = computed(() => auth.hasScope('crm.account.update'))
const canReadPricingConcepts = computed(() => auth.hasScope('pricing.cost.select'))
const modes: { key: Mode; label: string; description: string }[] = [
  { key: 'FCL', label: 'FCL', description: 'Contenedores' },
  { key: 'LCL', label: 'LCL', description: 'Carga consolidada' },
  { key: 'FTL', label: 'FTL', description: 'Camión completo' },
  { key: 'LTL', label: 'LTL', description: 'Carga parcial terrestre' },
  { key: 'AIR', label: 'AIR', description: 'Aéreo' },
]
// Exactly Pricing.CostDetailType (the rubros used by the quote line editor).
const charges: { value: CostDetailType; label: string }[] = [
  { value: 'Freight', label: 'Flete internacional' },
  { value: 'AgentCharge', label: 'Costo de agente' },
  { value: 'OriginCharge', label: 'Cargo en origen' },
  { value: 'DestinationCharge', label: 'Cargo en destino' },
  { value: 'PortCharge', label: 'Cargo portuario' },
  { value: 'CustomsCharge', label: 'Aduana' },
  { value: 'InlandTransport', label: 'Transporte interno' },
  { value: 'Documentation', label: 'Documentación' },
  { value: 'Insurance', label: 'Seguro de carga' },
  { value: 'Other', label: 'Otro' },
]
const chargeLabels: Record<string, string> = Object.fromEntries(charges.map(x => [x.value, x.label]))
const legacyChargeMap: Record<string, CostDetailType> = {
  FREIGHT: 'Freight', ORIGIN: 'OriginCharge', PICKUP: 'OriginCharge',
  DESTINATION: 'DestinationCharge', DELIVERY: 'DestinationCharge',
  CUSTOMS: 'CustomsCharge', INSURANCE: 'Insurance', DOCUMENTATION: 'Documentation',
  OTHER: 'Other', SED: 'Other', HANDLING: 'Other', VGM: 'Other',
  TICA: 'Other', SEAL: 'Other', FORWARDING: 'Other',
}
function canonicalCharge(value: string): CostDetailType {
  return legacyChargeMap[value] ?? (charges.some(x => x.value === value)
    ? value as CostDetailType : 'Other')
}
const rateTypes: Array<{ value: BenefitType; label: string }> = [
  { value: 'FIXED_AMOUNT', label: 'Precio de venta preferencial' },
  { value: 'DISCOUNT_AMOUNT', label: 'Descuento fijo' },
  { value: 'DISCOUNT_PERCENT', label: 'Descuento porcentual' },
  { value: 'INSURANCE_PERCENT', label: 'Seguro: porcentaje del valor de la mercancía (costo y venta)' },
  { value: 'WAIVE', label: 'Cargo exonerado' },
  { value: 'NEGOTIATED', label: 'Condición especial negociada' },
]
const unitOptions = [
  { value: 'SHIPMENT', label: 'Embarque' }, { value: 'CONTAINER', label: 'Contenedor' },
  { value: 'TEU', label: 'TEU' }, { value: 'BL', label: 'BL' },
  { value: 'CBM', label: 'CBM' }, { value: 'CFT', label: 'CFT' },
  { value: 'KG', label: 'KG' }, { value: 'LB', label: 'LB' },
  { value: 'TRUCK', label: 'Camión' }, { value: 'PALLET', label: 'Tarima' },
  { value: 'PACKAGE', label: 'Bulto' },
]
const tab = ref<Mode>('FCL')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const loaded = ref(false)
const settings = ref<Settings | null>(null)
const rates = ref<Rate[]>([])
const category = ref({ type: '', code: '' })
const settingsNotes = ref('')
const editingId = ref('')
const editorOpen = ref(false)
const version = ref<number | null>(null)
const costs = ref<CostSelectDto[]>([])
const costsLoading = ref(false)
const costMessage = ref('')
const draft = reactive<Draft>(empty())
let sequence = 0

function empty(mode: Mode = 'FCL'): Draft {
  return {
    modality: mode, laneCode: '', chargeCode: 'Freight', customChargeName: '',
    rateType: 'FIXED_AMOUNT', value: '', minimumCharge: '',
    insuranceCostPercent: '', insuranceSalePercent: '',
    currencyCode: 'USD',
    unitCode: mode === 'FCL' ? 'CONTAINER' : mode === 'LCL' ? 'CBM' : mode === 'AIR' ? 'KG' : 'TRUCK',
    equipmentCodes: [], polCodes: [], poeCodes: [], podCodes: [],
    validFrom: '', validUntil: '', notes: '', isActive: true,
  }
}
const equipmentSlugs = computed(() => ['FTL', 'LTL'].includes(draft.modality)
  ? ['land-equipment-sizes', 'land-equipment-types'] : ['container-types'])
const filteredCosts = computed(() => costs.value.filter(item =>
  item.costDetailType === draft.chargeCode &&
  (!item.shipmentMode || String(item.shipmentMode).toUpperCase() === draft.modality ||
    (draft.modality === 'AIR' && String(item.shipmentMode) === 'AirConsol')))
  .sort((a, b) => a.name.localeCompare(b.name, 'es')))
const visible = computed(() => rates.value.filter(x => x.modality === tab.value)
  .sort((a, b) => Number(b.isActive) - Number(a.isActive) ||
    String(b.validFrom ?? '').localeCompare(String(a.validFrom ?? ''))))
const activeCount = computed(() => {
  const now = Date.now()
  return rates.value.filter(x => x.isActive &&
    (!x.validFrom || new Date(x.validFrom).getTime() <= now) &&
    (!x.validUntil || new Date(x.validUntil).getTime() >= now)).length
})
const insurance = computed(() => draft.rateType === 'INSURANCE_PERCENT')
const needsNumber = computed(() => !insurance.value && !['WAIVE', 'NEGOTIATED'].includes(draft.rateType))
const needsMoney = computed(() => ['FIXED_AMOUNT', 'DISCOUNT_AMOUNT'].includes(draft.rateType) ||
  (insurance.value && draft.minimumCharge.trim() !== ''))
const unitVisible = computed(() => draft.rateType === 'FIXED_AMOUNT')
const isPercent = computed(() => draft.rateType === 'DISCOUNT_PERCENT')
function endpoint() { return crmPath('accounts', props.accountId, 'commercial-benefits') }
function categoryLabel(type: string, code: string): string {
  if (type === 'LITTLE') return 'Cargas Little'
  if (type === 'NVOCC') return 'NVOCC ' + code
  return 'Cliente ' + code
}
function openCategoryEditor() {
  void router.push({ path: '/crm/accounts/' + encodeURIComponent(props.accountId), query: { edit: '1' } })
}
async function loadCosts() {
  if (!canReadPricingConcepts.value) {
    costMessage.value = 'Los tipos de rubro son los de Pricing. Para elegir conceptos ya configurados se requiere permiso de consulta de costos de Pricing.'
    return
  }
  costsLoading.value = true
  try {
    costs.value = await PricingService.selectCosts({ isActive: true })
    costMessage.value = ''
  } catch {
    costs.value = []
    costMessage.value = 'No se pudieron consultar los conceptos activos de Pricing. Podés ingresar el nombre manualmente.'
  } finally { costsLoading.value = false }
}
async function reload() {
  const request = ++sequence
  loading.value = true
  error.value = ''
  try {
    const response = await crmRequest<BenefitsResponse>(endpoint())
    if (request !== sequence) return
    settings.value = response.settings
    rates.value = response.rates
    category.value = { type: response.categoryType, code: response.categoryCode }
    settingsNotes.value = response.settings?.notes ?? ''
    loaded.value = true
  } catch (cause) {
    if (request !== sequence) return
    loaded.value = false
    error.value = crmError(cause)
  } finally { if (request === sequence) loading.value = false }
}
watch(() => props.accountId, () => {
  loaded.value = false
  editorOpen.value = false
  settings.value = null; rates.value = []
  void reload()
}, { immediate: true })
onMounted(() => void loadCosts())
async function saveSettings() {
  if (!canEdit.value || saving.value) return
  saving.value = true
  error.value = ''; success.value = ''
  try {
    await crmRequest(endpoint() + '/settings', 'PUT', {
      expectedVersion: settings.value?.rowVersion ?? null,
      notes: settingsNotes.value.trim() || null,
    })
    await reload()
    success.value = 'Condiciones comerciales guardadas.'
  } catch (cause) { error.value = crmError(cause) }
  finally { saving.value = false }
}
function beginCreate() {
  editingId.value = ''
  version.value = null
  Object.assign(draft, empty(tab.value))
  editorOpen.value = true; error.value = ''; success.value = ''
}
function selection(values: string[] | undefined | null, legacy: string | null): string[] {
  return values?.length ? [...values] : legacy ? [legacy] : []
}
function beginEdit(rate: Rate) {
  tab.value = rate.modality
  editingId.value = rate.id; version.value = rate.rowVersion
  Object.assign(draft, {
    modality: rate.modality, laneCode: rate.laneCode ?? '',
    chargeCode: canonicalCharge(rate.chargeCode),
    customChargeName: rate.customChargeName ?? '',
    rateType: rate.rateType,
    value: rate.rateType === 'INSURANCE_PERCENT' ? '' : rate.value == null ? '' : String(rate.value),
    minimumCharge: rate.minimumCharge == null ? '' : String(rate.minimumCharge),
    insuranceCostPercent: rate.insuranceCostPercent == null ? '' : String(rate.insuranceCostPercent),
    insuranceSalePercent: (rate.insuranceSalePercent ?? (rate.rateType === 'INSURANCE_PERCENT' ? rate.value : null)) == null
      ? '' : String(rate.insuranceSalePercent ?? rate.value),
    currencyCode: rate.currencyCode ?? 'USD', unitCode: rate.unitCode ?? 'SHIPMENT',
    equipmentCodes: selection(rate.equipmentCodes, rate.equipmentCode),
    polCodes: selection(rate.polCodes, rate.originCode),
    poeCodes: selection(rate.poeCodes, rate.destinationCode),
    podCodes: [...(rate.podCodes ?? [])],
    validFrom: fromUtc(rate.validFrom), validUntil: fromUtc(rate.validUntil),
    notes: rate.notes ?? '', isActive: rate.isActive,
  })
  editorOpen.value = true; error.value = ''; success.value = ''
}
function changeModality(next: Mode) {
  if (next === draft.modality) return
  draft.modality = next
  draft.laneCode = ''
  draft.equipmentCodes = []
  // Each modality uses its own CY / SD / APT catalogs, as in Pricing.
  // Do not carry a sea port into an air or land commercial benefit.
  draft.polCodes = []
  draft.poeCodes = []
  draft.podCodes = []
  draft.unitCode = empty(next).unitCode
}
function selectType(next: BenefitType) {
  draft.rateType = next; draft.value = ''; draft.minimumCharge = ''
  draft.insuranceCostPercent = ''; draft.insuranceSalePercent = ''
  if (next === 'INSURANCE_PERCENT') draft.chargeCode = 'Insurance'
}
function selectCharge(next: CostDetailType) {
  const wasInsurance = insurance.value
  draft.chargeCode = next
  draft.customChargeName = ''
  if (next === 'Insurance') selectType('INSURANCE_PERCENT')
  else if (wasInsurance) selectType('FIXED_AMOUNT')
}
function payload() {
  const ins = insurance.value
  return {
    expectedVersion: version.value,
    modality: draft.modality, laneCode: draft.modality === 'LCL' ? draft.laneCode || null : null,
    chargeCode: draft.chargeCode, customChargeName: draft.customChargeName.trim() || null,
    rateType: draft.rateType,
    value: ins ? Number(draft.insuranceSalePercent) :
      needsNumber.value && draft.value.trim() !== '' ? Number(draft.value) : null,
    insuranceCostPercent: ins ? Number(draft.insuranceCostPercent) : null,
    insuranceSalePercent: ins ? Number(draft.insuranceSalePercent) : null,
    minimumCharge: ins && draft.minimumCharge.trim() ? Number(draft.minimumCharge) : null,
    currencyCode: needsMoney.value ? draft.currencyCode : null,
    unitCode: unitVisible.value ? draft.unitCode : null,
    // Empty arrays are wildcard scopes, not an empty/invalid route.
    equipmentCodes: [...draft.equipmentCodes], polCodes: [...draft.polCodes],
    poeCodes: [...draft.poeCodes], podCodes: benefitUsesPod(draft.modality) ? [...draft.podCodes] : [],
    equipmentCode: null, originCode: null, destinationCode: null,
    validFrom: toUtc(draft.validFrom), validUntil: toUtc(draft.validUntil),
    notes: draft.notes.trim() || null, isActive: draft.isActive,
  }
}
function validPercent(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100
}
function validate(): string {
  if (insurance.value && (!validPercent(draft.insuranceCostPercent) || !validPercent(draft.insuranceSalePercent)))
    return 'El seguro necesita porcentaje de costo y porcentaje de venta entre 0 % y 100 %. Ambos se calculan sobre el valor de la mercancía.'
  if (needsNumber.value && (!draft.value.trim() || !Number.isFinite(Number(draft.value)) || Number(draft.value) < 0))
    return 'Ingresá un valor válido y no negativo.'
  if (isPercent.value && Number(draft.value) > 100) return 'El descuento no puede superar el 100 %.'
  if (insurance.value && draft.minimumCharge.trim() &&
    (!Number.isFinite(Number(draft.minimumCharge)) || Number(draft.minimumCharge) < 0))
    return 'La prima mínima debe ser válida y no negativa.'
  if (draft.chargeCode === 'Other' && !draft.customChargeName.trim())
    return 'Indicá el nombre del concepto para Otro.'
  if (draft.rateType === 'NEGOTIATED' && !draft.notes.trim())
    return 'Describí la condición especial negociada.'
  if (draft.validFrom && draft.validUntil && draft.validFrom > draft.validUntil)
    return 'La fecha final debe ser posterior o igual a la inicial.'
  if (unitVisible.value && !draft.unitCode) return 'Seleccioná la unidad de cobro.'
  if ([draft.equipmentCodes, draft.polCodes, draft.poeCodes, draft.podCodes]
    .some(xs => xs.length > 60)) return 'Podés seleccionar como máximo 60 valores por campo.'
  return ''
}
async function saveRate() {
  if (!canEdit.value || saving.value) return
  error.value = validate()
  if (error.value) return
  saving.value = true; success.value = ''
  try {
    await crmRequest(endpoint() + '/rates' +
      (editingId.value ? '/' + encodeURIComponent(editingId.value) : ''),
      editingId.value ? 'PUT' : 'POST', payload())
    editorOpen.value = false
    await reload()
    tab.value = draft.modality
    success.value = editingId.value ? 'Beneficio actualizado.' : 'Beneficio registrado.'
  } catch (cause) { error.value = crmError(cause) }
  finally { saving.value = false }
}
async function setActive(rate: Rate, active: boolean) {
  if (!canEdit.value || saving.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    await crmRequest(endpoint() + '/rates/' + encodeURIComponent(rate.id), 'PUT', {
      expectedVersion: rate.rowVersion, modality: rate.modality, laneCode: rate.laneCode,
      chargeCode: rate.chargeCode, customChargeName: rate.customChargeName, rateType: rate.rateType,
      value: rate.value, minimumCharge: rate.minimumCharge,
      insuranceCostPercent: rate.insuranceCostPercent,
      insuranceSalePercent: rate.insuranceSalePercent,
      currencyCode: rate.currencyCode, unitCode: rate.unitCode,
      equipmentCodes: selection(rate.equipmentCodes, rate.equipmentCode),
      polCodes: selection(rate.polCodes, rate.originCode),
      poeCodes: selection(rate.poeCodes, rate.destinationCode),
      podCodes: benefitUsesPod(rate.modality) ? (rate.podCodes ?? []) : [],
      equipmentCode: null, originCode: null, destinationCode: null,
      validFrom: rate.validFrom, validUntil: rate.validUntil, notes: rate.notes, isActive: active,
    })
    if (editorOpen.value && editingId.value === rate.id) editorOpen.value = false
    await reload()
    success.value = active ? 'Beneficio reactivado.' : 'Beneficio desactivado, sin borrar su historial.'
  } catch (cause) { error.value = crmError(cause) }
  finally { saving.value = false }
}
function displayValue(rate: Rate): string {
  if (rate.rateType === 'WAIVE') return 'Exonerado'
  if (rate.rateType === 'NEGOTIATED') return 'Condición negociada'
  const n = (value: number | null) => value == null ? 'Pendiente' :
    value.toLocaleString('es-CR', { maximumFractionDigits: 6 })
  if (rate.rateType === 'INSURANCE_PERCENT') {
    return 'Costo ' + n(rate.insuranceCostPercent) + ' % · Venta ' +
      n(rate.insuranceSalePercent ?? rate.value) + ' % del valor de la mercancía' +
      (rate.minimumCharge == null ? '' : ' · prima mínima ' + n(rate.minimumCharge) + ' ' + (rate.currencyCode ?? ''))
  }
  if (rate.rateType === 'DISCOUNT_PERCENT') return n(rate.value) + ' % de descuento'
  return (rate.rateType === 'DISCOUNT_AMOUNT' ? 'Descuento ' : '') +
    (rate.currencyCode ?? '') + ' ' + n(rate.value) +
    (rate.unitCode ? ' / ' + rate.unitCode : '')
}
function stateLabel(rate: Rate): string {
  if (!rate.isActive) return 'Desactivada'
  if (rate.validFrom && new Date(rate.validFrom).getTime() > Date.now()) return 'Programada'
  if (rate.validUntil && new Date(rate.validUntil).getTime() < Date.now()) return 'Vencida'
  return 'Vigente'
}
function readableDate(s: string | null): string {
  return s ? new Date(s).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Sin límite'
}
function scopeText(rate: Rate): string {
  return [
    (rate.equipmentCodes ?? []).length ? 'Equipos: ' + rate.equipmentCodes.join(', ') :
      rate.equipmentCode ? 'Equipo: ' + rate.equipmentCode : '',
    (rate.polCodes ?? []).length ? 'POL: ' + rate.polCodes.join(', ') :
      rate.originCode ? 'POL: ' + rate.originCode : '',
    (rate.poeCodes ?? []).length ? 'POE: ' + rate.poeCodes.join(', ') :
      rate.destinationCode ? 'POE: ' + rate.destinationCode : '',
    (rate.podCodes ?? []).length ? 'POD: ' + rate.podCodes.join(', ') : '',
  ].filter(Boolean).join(' · ')
}
</script>

<template>
  <section class="space-y-4" data-crm-commercial-benefits>
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]">
          <BadgePercent class="h-5 w-5" />
        </span>
        <div>
          <h2 class="text-base font-extrabold">Tarifas y beneficios preferenciales</h2>
          <p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">Acuerdos exclusivos por cuenta · {{ activeCount }} vigentes</p>
        </div>
      </div>
      <button type="button" class="benefit-button" :disabled="loading || saving" @click="reload">
        <RefreshCw class="h-4 w-4" /> Actualizar
      </button>
    </header>
    <p v-if="error" role="alert" class="rounded-lg border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="success" role="status" class="rounded-lg border border-emerald-500/40 p-3 text-sm text-emerald-600">{{ success }}</p>
    <p v-if="loading" role="status" class="text-sm text-[var(--dh-text-muted)]">Consultando beneficios de la cuenta…</p>
    <template v-if="loaded">
      <section class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <ShieldCheck class="h-4 w-4 text-[var(--dh-primary)]" />
          <h3 class="text-sm font-extrabold">Categoría comercial de la cuenta</h3>
        </div>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm">Categoría de la cuenta:
            <strong>{{ categoryLabel(category.type, category.code) }}</strong>.
          </p>
          <button v-if="canEdit" type="button" class="benefit-button" @click="openCategoryEditor">
            <Pencil class="h-4 w-4" /> Editar categoría de la cuenta
          </button>
        </div>
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="saveSettings">
          <label class="benefit-label min-w-[250px] flex-1">Condiciones comerciales generales
            <input v-model="settingsNotes" class="benefit-input" maxlength="2000"
              :disabled="!canEdit || saving" placeholder="Beneficios o restricciones generales del acuerdo" />
          </label>
          <button v-if="canEdit" type="submit" class="benefit-button benefit-primary" :disabled="saving">
            <Check class="h-4 w-4" /> Guardar condiciones
          </button>
        </form>
      </section>

      <section class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-extrabold">Beneficios por modalidad</h3>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Conceptos de cobro de Pricing, seguro, descuentos y vigencias.</p>
          </div>
          <button v-if="canEdit" type="button" class="benefit-button benefit-primary" @click="beginCreate">
            <Plus class="h-4 w-4" /> Agregar beneficio
          </button>
        </div>
        <nav class="mb-4 flex flex-wrap gap-2 border-b border-[var(--dh-border)] pb-3" aria-label="Modalidades">
          <button v-for="mode in modes" :key="mode.key" type="button" class="benefit-button"
            :aria-pressed="tab===mode.key"
            :class="tab===mode.key?'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]':''"
            @click="tab=mode.key;editorOpen=false">
            {{ mode.label }} <span class="rounded-full bg-[var(--dh-shell)] px-2 py-0.5 text-xs">
              {{ rates.filter(rate=>rate.modality===mode.key && rate.isActive).length }}
            </span>
          </button>
        </nav>
        <p v-if="!visible.length" class="rounded-xl border border-dashed border-[var(--dh-border)] p-7 text-center text-sm text-[var(--dh-text-muted)]">
          No hay beneficios preferenciales en {{ modes.find(m=>m.key===tab)?.description }}.
        </p>
        <div v-else class="grid gap-3 lg:grid-cols-2">
          <article v-for="rate in visible" :key="rate.id"
            class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="text-sm font-bold">{{ rate.customChargeName || chargeLabels[canonicalCharge(rate.chargeCode)] || rate.chargeCode }}</h4>
                  <span class="rounded-full border border-[var(--dh-border)] px-2 py-0.5 text-[10px]"
                    :class="stateLabel(rate)==='Vigente'?'text-emerald-600':'text-[var(--dh-text-muted)]'">
                    {{ stateLabel(rate) }}
                  </span>
                </div>
                <p class="mt-2 text-sm font-extrabold text-[var(--dh-primary)]">{{ displayValue(rate) }}</p>
                <p v-if="rate.laneCode==='MIAMI'" class="mt-1 text-xs font-bold">LCL Miami</p>
                <p v-if="rate.rateType==='INSURANCE_PERCENT' && rate.insuranceCostPercent == null"
                  class="mt-2 text-xs text-amber-500">Seguro antiguo: falta establecer el porcentaje de costo.</p>
              </div>
              <div v-if="canEdit" class="flex flex-wrap gap-1">
                <button type="button" class="benefit-button" aria-label="Editar beneficio" @click="beginEdit(rate)">
                  <Pencil class="h-3.5 w-3.5" />
                </button>
                <button type="button" class="benefit-button text-xs" :disabled="saving" @click="setActive(rate,!rate.isActive)">
                  {{ rate.isActive?'Desactivar':'Reactivar' }}
                </button>
              </div>
            </div>
            <p v-if="scopeText(rate)" class="mt-2 break-words text-xs text-[var(--dh-text-muted)]">{{ scopeText(rate) }}</p>
            <p class="mt-2 text-xs text-[var(--dh-text-muted)]">
              Vigencia: {{ readableDate(rate.validFrom) }} — {{ readableDate(rate.validUntil) }}
            </p>
            <p v-if="rate.notes" class="mt-2 whitespace-pre-wrap text-xs leading-relaxed">{{ rate.notes }}</p>
          </article>
        </div>
      </section>

      <section v-if="editorOpen && canEdit" class="rounded-xl border border-[var(--dh-primary)]/40 bg-[var(--dh-card)] p-4 sm:p-5"
        aria-label="Editor de beneficio preferencial">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-extrabold">{{ editingId?'Modificar beneficio':'Nuevo beneficio preferencial' }}</h3>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">El acuerdo pertenece únicamente a esta cuenta. No cambia las cotizaciones actuales.</p>
          </div>
          <button type="button" class="benefit-button" aria-label="Cerrar editor" @click="editorOpen=false">
            <X class="h-4 w-4" />
          </button>
        </div>
        <form class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" @submit.prevent="saveRate">
          <label class="benefit-label">Modalidad
            <select :value="draft.modality" class="benefit-input"
              @change="changeModality(($event.target as HTMLSelectElement).value as Mode)">
              <option v-for="mode in modes" :key="mode.key" :value="mode.key">{{ mode.label }} · {{ mode.description }}</option>
            </select>
          </label>
          <label v-if="draft.modality==='LCL'" class="benefit-label">Servicio
            <select v-model="draft.laneCode" class="benefit-input">
              <option value="">LCL general</option><option value="MIAMI">LCL Miami</option>
            </select>
          </label>
          <label class="benefit-label">Rubro de cobro (Pricing)
            <select :value="draft.chargeCode" class="benefit-input"
              @change="selectCharge(($event.target as HTMLSelectElement).value as CostDetailType)">
              <option v-for="item in charges" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label class="benefit-label">Concepto / ítem de cobro
            <input v-model.trim="draft.customChargeName" class="benefit-input" list="crm-pricing-benefit-costs"
              maxlength="120" :required="draft.chargeCode==='Other'"
              placeholder="Seleccionar rubro existente o escribir nombre" />
            <datalist id="crm-pricing-benefit-costs">
              <option v-for="cost in filteredCosts" :key="cost.id" :value="cost.name" />
            </datalist>
          </label>
          <p class="self-center text-xs text-[var(--dh-text-muted)]">
            {{ costsLoading ? 'Consultando conceptos de Pricing…' : costMessage ||
              filteredCosts.length + ' conceptos configurados para este rubro y modalidad.' }}
          </p>
          <label class="benefit-label">Tipo de beneficio
            <select :value="draft.rateType" class="benefit-input"
              @change="selectType(($event.target as HTMLSelectElement).value as BenefitType)">
              <option v-for="item in rateTypes.filter(x=>x.value!=='INSURANCE_PERCENT'||draft.chargeCode==='Insurance')"
                :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>

          <template v-if="insurance">
            <label class="benefit-label">Seguro · costo (% del valor de la mercancía)
              <input v-model="draft.insuranceCostPercent" type="number" min="0" max="100" step="0.000001"
                class="benefit-input" required placeholder="Porcentaje que nos cobra el proveedor" />
            </label>
            <label class="benefit-label">Seguro · venta (% del valor de la mercancía)
              <input v-model="draft.insuranceSalePercent" type="number" min="0" max="100" step="0.000001"
                class="benefit-input" required placeholder="Porcentaje que cobramos al cliente" />
            </label>
            <p class="self-center text-xs text-[var(--dh-text-muted)]">
              Costo = valor mercancía × costo % / 100. Venta = valor mercancía × venta % / 100.
            </p>
            <label class="benefit-label">Prima mínima de venta (opcional)
              <input v-model="draft.minimumCharge" type="number" min="0" step="0.000001"
                class="benefit-input" placeholder="Sin mínimo" />
            </label>
          </template>
          <label v-else-if="needsNumber" class="benefit-label">{{ isPercent?'Descuento (%)':'Valor preferencial' }}
            <input v-model="draft.value" type="number" min="0" :max="isPercent?100:undefined"
              step="0.000001" class="benefit-input" required placeholder="0.00" />
          </label>
          <label v-if="needsMoney" class="benefit-label">Moneda
            <select v-model="draft.currencyCode" class="benefit-input">
              <option value="USD">USD</option><option value="CRC">CRC</option>
            </select>
          </label>
          <label v-if="unitVisible" class="benefit-label">Unidad de cobro
            <select v-model="draft.unitCode" class="benefit-input" required>
              <option v-for="item in unitOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>

          <CrmMultiCatalogPicker v-model="draft.equipmentCodes" label="Equipos (selección múltiple)"
            :catalog-group-slugs="equipmentSlugs" />
          <CrmMultiCatalogPicker v-model="draft.polCodes"
            :label="draft.modality === 'AIR' ? 'POL · aeropuertos de origen' : ['FTL','LTL'].includes(draft.modality) ? 'POL · orígenes terrestres' : 'POL · puertos de origen'"
            :catalog-group-slugs="['pol']" :route-mode="draft.modality" route-role="pol" />
          <CrmMultiCatalogPicker v-model="draft.poeCodes"
            :label="draft.modality === 'AIR' ? 'POE · aeropuertos de destino' : ['FTL','LTL'].includes(draft.modality) ? 'POE · destinos terrestres' : 'POE · puertos de entrada'"
            :catalog-group-slugs="['poe']" :route-mode="draft.modality" route-role="poe" />
          <CrmMultiCatalogPicker v-if="benefitUsesPod(draft.modality)" v-model="draft.podCodes"
            label="POD · destinos finales (selección múltiple)"
            :catalog-group-slugs="['pod']" :route-mode="draft.modality" route-role="pod" />

          <label class="benefit-label">Vigencia desde (opcional)
            <input v-model="draft.validFrom" type="datetime-local" class="benefit-input" />
          </label>
          <label class="benefit-label">Vigencia hasta (opcional)
            <input v-model="draft.validUntil" type="datetime-local" class="benefit-input" />
          </label>
          <label class="benefit-label sm:col-span-2 xl:col-span-3">Observaciones y condiciones especiales
            <textarea v-model="draft.notes" maxlength="2000" class="benefit-input min-h-[88px]"
              placeholder="Restricciones, detalles del acuerdo, autorizaciones" />
          </label>
          <label class="flex items-center gap-2 text-sm sm:col-span-2 xl:col-span-3">
            <input v-model="draft.isActive" type="checkbox" class="h-4 w-4 accent-[var(--dh-primary)]" />
            Beneficio habilitado
          </label>
          <div class="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--dh-border)] pt-4 sm:col-span-2 xl:col-span-3">
            <button type="button" class="benefit-button" @click="editorOpen=false">Cancelar</button>
            <button type="submit" class="benefit-button benefit-primary" :disabled="saving">
              {{ saving?'Guardando…':editingId?'Guardar cambios':'Agregar beneficio' }}
            </button>
          </div>
        </form>
      </section>
      <p class="text-xs text-[var(--dh-text-muted)]">
        Los beneficios se guardan en CRM; Pricing aún no los aplica automáticamente.
      </p>
    </template>
  </section>
</template>

<style scoped>
.benefit-button{display:inline-flex;min-height:36px;align-items:center;justify-content:center;gap:.4rem;border:1px solid var(--dh-border);border-radius:.7rem;padding:.5rem .8rem;font-size:.78rem;font-weight:750}
.benefit-button:hover:not(:disabled){border-color:var(--dh-primary)}
.benefit-button:disabled{opacity:.5}
.benefit-primary{background:var(--dh-primary);color:white;border-color:var(--dh-primary)}
.benefit-label{display:flex;min-width:0;flex-direction:column;gap:.4rem;font-size:.75rem;font-weight:700;color:var(--dh-text-muted)}
.benefit-input{width:100%;min-width:0;border:1px solid var(--dh-border);border-radius:.7rem;padding:.65rem .75rem;background:var(--dh-input);color:var(--dh-text);font-size:.85rem;font-weight:500}
.benefit-input:focus{outline:2px solid var(--dh-primary);outline-offset:1px}
</style>

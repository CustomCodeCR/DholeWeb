<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useAuthStore } from '@/core/stores/authStore'
import { BadgePercent, Check, Pencil, Plus, RefreshCw, ShieldCheck, X } from 'lucide-vue-next'
import { crmError, crmPath, crmRequest, fromUtc, toUtc } from '../services/crmApi'

type Mode = 'FCL' | 'LCL' | 'FTL' | 'LTL' | 'AIR'
type RateType = 'FIXED_AMOUNT' | 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENT' |
  'INSURANCE_PERCENT' | 'WAIVE' | 'NEGOTIATED'
type Rate = {
  id: string
  accountId: string
  rowVersion: number
  modality: Mode
  laneCode: string | null
  chargeCode: string
  customChargeName: string | null
  rateType: RateType
  value: number | null
  minimumCharge: number | null
  currencyCode: string | null
  unitCode: string | null
  equipmentCode: string | null
  originCode: string | null
  destinationCode: string | null
  validFrom: string | null
  validUntil: string | null
  notes: string | null
  isActive: boolean
}
type Settings = {
  id: string
  accountId: string
  rowVersion: number
  miamiLclPlanCode: string | null
  notes: string | null
}
type Response = {
  accountId: string
  settings: Settings | null
  rates: Rate[]
  pricingIntegrationStatus: string
}
interface Draft {
  modality: Mode
  laneCode: string
  chargeCode: string
  customChargeName: string
  rateType: RateType
  value: string
  minimumCharge: string
  currencyCode: string
  unitCode: string
  equipmentCode: string
  originCode: string
  destinationCode: string
  validFrom: string
  validUntil: string
  notes: string
  isActive: boolean
}
const props = defineProps<{ accountId: string }>()
const auth = useAuthStore()
const canEdit = computed(() => auth.hasScope('crm.account.update'))
const modes: { key: Mode; label: string; description: string }[] = [
  { key: 'FCL', label: 'FCL', description: 'Contenedores' },
  { key: 'LCL', label: 'LCL', description: 'Carga consolidada' },
  { key: 'FTL', label: 'FTL', description: 'Camión completo' },
  { key: 'LTL', label: 'LTL', description: 'Carga parcial terrestre' },
  { key: 'AIR', label: 'AIR', description: 'Aéreo' },
]
const plans = [
  { value: '', label: 'Sin plan definido (clasificar después)' },
  { value: 'A', label: 'Cliente A' },
  { value: 'B', label: 'Cliente B' },
  { value: 'C', label: 'Cliente C' },
  { value: 'D', label: 'Cliente D' },
  { value: 'NVOCC-A', label: 'Cliente NVOCC-A' },
  { value: 'NVOCC-B', label: 'Cliente NVOCC-B' },
  { value: 'LITTLE', label: 'Cargas Little' },
]
const charges = [
  { value: 'FREIGHT', label: 'Flete' },
  { value: 'PICKUP', label: 'Recolección' },
  { value: 'DELIVERY', label: 'Entrega' },
  { value: 'ORIGIN', label: 'Cargos en origen' },
  { value: 'DESTINATION', label: 'Cargos en destino' },
  { value: 'CUSTOMS', label: 'Trámite de aduanas' },
  { value: 'INSURANCE', label: 'Seguro de carga' },
  { value: 'SED', label: 'SED' },
  { value: 'HANDLING', label: 'Handling' },
  { value: 'VGM', label: 'VGM' },
  { value: 'TICA', label: 'TICA' },
  { value: 'SEAL', label: 'Sello' },
  { value: 'DOCUMENTATION', label: 'Documentación' },
  { value: 'FORWARDING', label: 'Forwarding' },
  { value: 'OTHER', label: 'Otro cargo' },
]
const rateTypes = [
  { value: 'FIXED_AMOUNT', label: 'Precio de venta preferencial' },
  { value: 'DISCOUNT_AMOUNT', label: 'Descuento fijo' },
  { value: 'DISCOUNT_PERCENT', label: 'Descuento porcentual' },
  { value: 'INSURANCE_PERCENT', label: 'Seguro: porcentaje sobre valor de carga' },
  { value: 'WAIVE', label: 'Cargo exonerado (sin cobro)' },
  { value: 'NEGOTIATED', label: 'Condición especial negociada' },
]
const unitOptions = [
  { value: 'SHIPMENT', label: 'Embarque' },
  { value: 'CONTAINER', label: 'Contenedor' },
  { value: 'TEU', label: 'TEU' },
  { value: 'BL', label: 'BL' },
  { value: 'CBM', label: 'CBM' },
  { value: 'CFT', label: 'CFT' },
  { value: 'KG', label: 'KG' },
  { value: 'LB', label: 'LB' },
  { value: 'TRUCK', label: 'Camión' },
  { value: 'PALLET', label: 'Tarima' },
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
const selectedPlan = ref('')
const settingsNotes = ref('')
const editingId = ref('')
const editorOpen = ref(false)
const recordVersion = ref<number | null>(null)
const draft = reactive<Draft>(empty())
let sequence = 0

function empty(mode: Mode = 'FCL'): Draft {
  return {
    modality: mode, laneCode: '', chargeCode: 'FREIGHT', customChargeName: '',
    rateType: 'FIXED_AMOUNT', value: '', minimumCharge: '',
    currencyCode: 'USD', unitCode: mode === 'FCL' ? 'CONTAINER' : mode === 'LCL' ? 'CBM'
      : mode === 'AIR' ? 'KG' : 'TRUCK',
    equipmentCode: '', originCode: '', destinationCode: '',
    validFrom: '', validUntil: '', notes: '', isActive: true,
  }
}
const visible = computed(() => rates.value.filter(x => x.modality === tab.value)
  .sort((a, b) => Number(b.isActive) - Number(a.isActive) ||
    String(b.validFrom ?? '').localeCompare(String(a.validFrom ?? ''))))
const summary = computed(() => {
  const now = Date.now()
  return {
    active: rates.value.filter(x => x.isActive &&
      (!x.validFrom || new Date(x.validFrom).getTime() <= now) &&
      (!x.validUntil || new Date(x.validUntil).getTime() >= now)).length,
    all: rates.value.length,
  }
})
const needsNumber = computed(() => !['WAIVE', 'NEGOTIATED'].includes(draft.rateType))
const needsMoney = computed(() => ['FIXED_AMOUNT', 'DISCOUNT_AMOUNT'].includes(draft.rateType) ||
  (draft.rateType === 'INSURANCE_PERCENT' && draft.minimumCharge.trim() !== ''))
const isPercent = computed(() => draft.rateType === 'DISCOUNT_PERCENT' || draft.rateType === 'INSURANCE_PERCENT')
const unitVisible = computed(() => draft.rateType === 'FIXED_AMOUNT')

function endpoint() {
  return crmPath('accounts', props.accountId, 'commercial-benefits')
}
async function reload() {
  const request = ++sequence
  loading.value = true
  error.value = ''
  try {
    const response = await crmRequest<Response>(endpoint())
    if (request !== sequence) return
    settings.value = response.settings
    rates.value = response.rates
    selectedPlan.value = response.settings?.miamiLclPlanCode ?? ''
    settingsNotes.value = response.settings?.notes ?? ''
    loaded.value = true
  } catch (cause) {
    if (request !== sequence) return
    loaded.value = false
    error.value = crmError(cause)
  } finally {
    if (request === sequence) loading.value = false
  }
}
watch(() => props.accountId, () => {
  loaded.value = false
  editorOpen.value = false
  settings.value = null
  rates.value = []
  void reload()
}, { immediate: true })

async function saveSettings() {
  if (!canEdit.value || saving.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await crmRequest(endpoint() + '/settings', 'PUT', {
      expectedVersion: settings.value?.rowVersion ?? null,
      miamiLclPlanCode: selectedPlan.value || null,
      notes: settingsNotes.value.trim() || null,
    })
    await reload()
    success.value = 'Clasificación y condiciones comerciales guardadas.'
  } catch (cause) { error.value = crmError(cause) }
  finally { saving.value = false }
}
function beginCreate() {
  editingId.value = ''
  recordVersion.value = null
  Object.assign(draft, empty(tab.value))
  editorOpen.value = true
  error.value = ''
  success.value = ''
}
function beginEdit(rate: Rate) {
  tab.value = rate.modality
  editingId.value = rate.id
  recordVersion.value = rate.rowVersion
  Object.assign(draft, {
    modality: rate.modality, laneCode: rate.laneCode ?? '',
    chargeCode: rate.chargeCode, customChargeName: rate.customChargeName ?? '',
    rateType: rate.rateType, value: rate.value == null ? '' : String(rate.value),
    minimumCharge: rate.minimumCharge == null ? '' : String(rate.minimumCharge),
    currencyCode: rate.currencyCode ?? 'USD', unitCode: rate.unitCode ?? 'SHIPMENT',
    equipmentCode: rate.equipmentCode ?? '', originCode: rate.originCode ?? '',
    destinationCode: rate.destinationCode ?? '', validFrom: fromUtc(rate.validFrom),
    validUntil: fromUtc(rate.validUntil), notes: rate.notes ?? '', isActive: rate.isActive,
  })
  editorOpen.value = true
  error.value = ''
  success.value = ''
}
function selectType(next: RateType) {
  draft.rateType = next
  draft.value = ''
  draft.minimumCharge = ''
  if (next === 'INSURANCE_PERCENT') draft.chargeCode = 'INSURANCE'
}
function payload(isActive = draft.isActive) {
  const numeric = needsNumber.value && draft.value.trim() !== '' ? Number(draft.value) : null
  const minimum = draft.rateType === 'INSURANCE_PERCENT' && draft.minimumCharge.trim() !== ''
    ? Number(draft.minimumCharge) : null
  return {
    expectedVersion: recordVersion.value,
    modality: draft.modality, laneCode: draft.modality === 'LCL' ? draft.laneCode || null : null,
    chargeCode: draft.chargeCode,
    customChargeName: draft.chargeCode === 'OTHER' ? draft.customChargeName.trim() || null : null,
    rateType: draft.rateType,
    value: numeric, minimumCharge: minimum,
    currencyCode: needsMoney.value ? draft.currencyCode : null,
    unitCode: unitVisible.value ? draft.unitCode : null,
    equipmentCode: draft.equipmentCode.trim() || null,
    originCode: draft.originCode.trim() || null,
    destinationCode: draft.destinationCode.trim() || null,
    validFrom: toUtc(draft.validFrom),
    validUntil: toUtc(draft.validUntil),
    notes: draft.notes.trim() || null, isActive,
  }
}
function validate() {
  const number = Number(draft.value)
  if (needsNumber.value && (!draft.value.trim() || !Number.isFinite(number) || number < 0)) {
    return 'El valor debe ser un número positivo o cero.'
  }
  if (isPercent.value && number > 100) return 'El porcentaje no puede superar el 100 %.'
  if (draft.rateType === 'INSURANCE_PERCENT' && draft.minimumCharge.trim() &&
    (!Number.isFinite(Number(draft.minimumCharge)) || Number(draft.minimumCharge) < 0))
    return 'El mínimo de seguro debe ser válido y no negativo.'
  if (draft.chargeCode === 'OTHER' && !draft.customChargeName.trim())
    return 'Especificá el nombre del cargo personalizado.'
  if (draft.rateType === 'NEGOTIATED' && !draft.notes.trim())
    return 'Describí la condición especial negociada.'
  if (draft.validFrom && draft.validUntil && draft.validFrom > draft.validUntil)
    return 'La vigencia final debe ser posterior o igual a la inicial.'
  if (unitVisible.value && !draft.unitCode) return 'Seleccioná la unidad de cobro.'
  return ''
}
async function saveRate() {
  if (!canEdit.value || saving.value) return
  error.value = validate()
  if (error.value) return
  saving.value = true
  success.value = ''
  try {
    const url = endpoint() + '/rates' + (editingId.value ? '/' + encodeURIComponent(editingId.value) : '')
    await crmRequest(url, editingId.value ? 'PUT' : 'POST', payload())
    editorOpen.value = false
    await reload()
    tab.value = draft.modality
    success.value = editingId.value ? 'Beneficio actualizado.' : 'Beneficio agregado a esta cuenta.'
  } catch (cause) { error.value = crmError(cause) }
  finally { saving.value = false }
}
async function setActive(rate: Rate, active: boolean) {
  if (!canEdit.value || saving.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await crmRequest(endpoint() + '/rates/' + encodeURIComponent(rate.id), 'PUT', {
      expectedVersion: rate.rowVersion, modality: rate.modality,
      laneCode: rate.laneCode, chargeCode: rate.chargeCode,
      customChargeName: rate.customChargeName, rateType: rate.rateType,
      value: rate.value, minimumCharge: rate.minimumCharge,
      currencyCode: rate.currencyCode, unitCode: rate.unitCode,
      equipmentCode: rate.equipmentCode, originCode: rate.originCode,
      destinationCode: rate.destinationCode, validFrom: rate.validFrom,
      validUntil: rate.validUntil, notes: rate.notes, isActive: active,
    })
    if (editorOpen.value && editingId.value === rate.id) editorOpen.value = false
    await reload()
    success.value = active ? 'Beneficio reactivado.' : 'Beneficio desactivado; se conservó el historial.'
  } catch (cause) { error.value = crmError(cause) }
  finally { saving.value = false }
}
function displayValue(rate: Rate) {
  if (rate.rateType === 'WAIVE') return 'Exonerado'
  if (rate.rateType === 'NEGOTIATED') return 'Condición negociada'
  const n = Number(rate.value ?? 0)
  const formatted = n.toLocaleString('es-CR', { maximumFractionDigits: 6 })
  if (rate.rateType === 'DISCOUNT_PERCENT') return formatted + ' % de descuento'
  if (rate.rateType === 'INSURANCE_PERCENT') {
    return formatted + ' % sobre valor de carga' +
      (rate.minimumCharge == null ? '' : ' · mínimo ' + rate.minimumCharge + ' ' + (rate.currencyCode ?? ''))
  }
  return (rate.rateType === 'DISCOUNT_AMOUNT' ? 'Descuento ' : '') +
    (rate.currencyCode ?? '') + ' ' + formatted +
    (rate.unitCode ? ' / ' + rate.unitCode : '')
}
function stateLabel(rate: Rate) {
  if (!rate.isActive) return 'Desactivada'
  if (rate.validFrom && new Date(rate.validFrom).getTime() > Date.now()) return 'Programada'
  if (rate.validUntil && new Date(rate.validUntil).getTime() < Date.now()) return 'Vencida'
  return 'Vigente'
}
function readableDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Sin límite'
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
          <p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">Acuerdos exclusivos de esta cuenta · {{ summary.active }} vigentes</p>
        </div>
      </div>
      <button type="button" class="benefit-button" :disabled="loading || saving" @click="reload">
        <RefreshCw class="h-4 w-4" /> Actualizar
      </button>
    </header>
    <p v-if="error" role="alert" class="rounded-lg border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="success" role="status" class="rounded-lg border border-emerald-500/40 p-3 text-sm text-emerald-600">{{ success }}</p>
    <p v-if="loading" role="status" class="text-sm text-[var(--dh-text-muted)]">Consultando condiciones comerciales…</p>

    <template v-if="loaded">
      <section class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <ShieldCheck class="h-4 w-4 text-[var(--dh-primary)]" />
          <h3 class="text-sm font-extrabold">Clasificación para LCL Miami</h3>
        </div>
        <p class="mb-4 text-xs text-[var(--dh-text-muted)]">
          Clasificación independiente de la categoría A/B/C/D general del CRM.
          Permite conservar el plan comercial específico que más adelante podrá utilizar Pricing.
        </p>
        <form class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-end" @submit.prevent="saveSettings">
          <label class="benefit-label">Tipo de cliente para LCL Miami
            <select v-model="selectedPlan" class="benefit-input" :disabled="!canEdit || saving">
              <option v-for="plan in plans" :key="plan.value" :value="plan.value">{{ plan.label }}</option>
            </select>
          </label>
          <label class="benefit-label">Condiciones comerciales generales
            <input v-model="settingsNotes" class="benefit-input" maxlength="2000"
              placeholder="Beneficios, condiciones o restricciones del acuerdo" :disabled="!canEdit || saving" />
          </label>
          <button v-if="canEdit" type="submit" class="benefit-button benefit-primary" :disabled="saving">
            <Check class="h-4 w-4" /> Guardar clasificación
          </button>
        </form>
      </section>

      <section class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-extrabold">Beneficios por modalidad</h3>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Tarifas de venta, descuentos, seguros y cargos especiales.</p>
          </div>
          <button v-if="canEdit" type="button" class="benefit-button benefit-primary" @click="beginCreate">
            <Plus class="h-4 w-4" /> Agregar beneficio
          </button>
        </div>
        <nav class="mb-4 flex flex-wrap gap-2 border-b border-[var(--dh-border)] pb-3" aria-label="Modalidades preferenciales">
          <button v-for="mode in modes" :key="mode.key" type="button"
            class="benefit-button" :aria-pressed="tab===mode.key"
            :class="tab===mode.key?'border-[var(--dh-primary)] text-[var(--dh-primary)] bg-[var(--dh-primary)]/10':''"
            @click="tab=mode.key;editorOpen=false">
            {{ mode.label }}
            <span class="rounded-full bg-[var(--dh-shell)] px-2 py-0.5 text-[10px]">
              {{ rates.filter(rate=>rate.modality===mode.key && rate.isActive).length }}
            </span>
          </button>
        </nav>
        <p v-if="!visible.length" class="rounded-xl border border-dashed border-[var(--dh-border)] p-7 text-center text-sm text-[var(--dh-text-muted)]">
          No hay beneficios registrados para {{ modes.find(m=>m.key===tab)?.description }}.
          Se mantienen las tarifas generales hasta que se registren acuerdos específicos.
        </p>
        <div v-else class="grid gap-3 lg:grid-cols-2">
          <article v-for="rate in visible" :key="rate.id"
            class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="text-sm font-bold">{{ rate.chargeCode==='OTHER' ? rate.customChargeName : charges.find(c=>c.value===rate.chargeCode)?.label }}</h4>
                  <span class="rounded-full border border-[var(--dh-border)] px-2 py-0.5 text-[10px]"
                    :class="stateLabel(rate)==='Vigente'?'text-emerald-600':'text-[var(--dh-text-muted)]'">{{ stateLabel(rate) }}</span>
                </div>
                <p class="mt-2 text-base font-extrabold text-[var(--dh-primary)]">{{ displayValue(rate) }}</p>
                <p v-if="rate.laneCode==='MIAMI'" class="mt-1 text-xs font-bold">LCL Miami</p>
              </div>
              <div v-if="canEdit" class="flex flex-wrap gap-1">
                <button type="button" class="benefit-button" aria-label="Editar beneficio" @click="beginEdit(rate)"><Pencil class="h-3.5 w-3.5" /></button>
                <button type="button" class="benefit-button text-xs" :disabled="saving" @click="setActive(rate,!rate.isActive)">
                  {{ rate.isActive?'Desactivar':'Reactivar' }}
                </button>
              </div>
            </div>
            <p v-if="rate.equipmentCode || rate.originCode || rate.destinationCode"
              class="mt-2 text-xs text-[var(--dh-text-muted)]">
              {{ [rate.equipmentCode,rate.originCode&&'Origen: '+rate.originCode,
                rate.destinationCode&&'Destino: '+rate.destinationCode].filter(Boolean).join(' · ') }}
            </p>
            <p class="mt-2 text-xs text-[var(--dh-text-muted)]">
              Vigencia: {{ readableDate(rate.validFrom) }} — {{ readableDate(rate.validUntil) }}
            </p>
            <p v-if="rate.notes" class="mt-2 whitespace-pre-wrap text-xs leading-relaxed">{{ rate.notes }}</p>
          </article>
        </div>
      </section>

      <section v-if="editorOpen && canEdit" class="rounded-xl border border-[var(--dh-primary)]/40 bg-[var(--dh-card)] p-4 sm:p-5" aria-label="Editor de beneficio preferencial">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-extrabold">{{ editingId?'Modificar beneficio':'Nuevo beneficio preferencial' }}</h3>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">El acuerdo pertenece solo a esta cuenta. No modifica automáticamente cotizaciones existentes.</p>
          </div>
          <button type="button" class="benefit-button" aria-label="Cerrar editor" @click="editorOpen=false"><X class="h-4 w-4" /></button>
        </div>
        <form class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" @submit.prevent="saveRate">
          <label class="benefit-label">Modalidad
            <select v-model="draft.modality" class="benefit-input" @change="draft.laneCode=''">
              <option v-for="mode in modes" :key="mode.key" :value="mode.key">{{ mode.label }} · {{ mode.description }}</option>
            </select>
          </label>
          <label v-if="draft.modality==='LCL'" class="benefit-label">Servicio
            <select v-model="draft.laneCode" class="benefit-input">
              <option value="">LCL general</option><option value="MIAMI">LCL Miami</option>
            </select>
          </label>
          <label class="benefit-label">Concepto beneficiado
            <select v-model="draft.chargeCode" class="benefit-input"
              @change="draft.rateType==='INSURANCE_PERCENT' && draft.chargeCode!=='INSURANCE' ? selectType('FIXED_AMOUNT') : undefined">
              <option v-for="item in charges" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label v-if="draft.chargeCode==='OTHER'" class="benefit-label">Nombre del cargo
            <input v-model.trim="draft.customChargeName" class="benefit-input" maxlength="120" required placeholder="Concepto especial" />
          </label>
          <label class="benefit-label">Tipo de beneficio
            <select :value="draft.rateType" class="benefit-input" @change="selectType(($event.target as HTMLSelectElement).value as RateType)">
              <option v-for="item in rateTypes.filter(x=>x.value!=='INSURANCE_PERCENT'||draft.chargeCode==='INSURANCE')"
                :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label v-if="needsNumber" class="benefit-label">{{ isPercent?'Porcentaje (%)':'Valor' }}
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
              <option v-for="unit in unitOptions" :key="unit.value" :value="unit.value">{{ unit.label }}</option>
            </select>
          </label>
          <label v-if="draft.rateType==='INSURANCE_PERCENT'" class="benefit-label">Prima mínima preferencial (opcional)
            <input v-model="draft.minimumCharge" type="number" min="0" step=".000001" class="benefit-input" placeholder="Sin mínimo establecido" />
          </label>
          <label class="benefit-label">Equipo (opcional)
            <input v-model.trim="draft.equipmentCode" class="benefit-input" maxlength="80" placeholder="20DC, 40HC, 53, etc." />
          </label>
          <label class="benefit-label">POL / origen (opcional)
            <input v-model.trim="draft.originCode" class="benefit-input" maxlength="80" placeholder="Código o identificador del origen" />
          </label>
          <label class="benefit-label">POD / destino (opcional)
            <input v-model.trim="draft.destinationCode" class="benefit-input" maxlength="80" placeholder="Código o identificador del destino" />
          </label>
          <label class="benefit-label">Válida desde (opcional)
            <input v-model="draft.validFrom" type="datetime-local" class="benefit-input" />
          </label>
          <label class="benefit-label">Válida hasta (opcional)
            <input v-model="draft.validUntil" type="datetime-local" class="benefit-input" />
          </label>
          <label class="benefit-label sm:col-span-2 xl:col-span-3">Observaciones y condiciones del acuerdo
            <textarea v-model="draft.notes" class="benefit-input min-h-[88px]" maxlength="2000"
              placeholder="Condiciones pactadas, restricciones, alcance comercial o aprobación del beneficio" />
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
        Los beneficios se administran y conservan en CRM. La integración para seleccionarlos y aplicarlos en Pricing se realizará por separado.
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

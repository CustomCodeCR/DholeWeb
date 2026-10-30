<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, ChevronDown, RotateCcw, Wallet, X } from 'lucide-vue-next'
import { useAuthStore } from '@/core/stores/authStore'
import { crmError, crmPath, crmRequest, crmUuid, type CrmRow } from '../services/crmApi'

const props = defineProps<{ accountId: string; editable?: boolean }>()
const emit = defineEmits<{ (e: 'updated'): void }>()
const auth = useAuthStore()
const canRead = computed(() => auth.hasScope('crm.credit.read'))
const canManage = computed(() => props.editable && auth.hasScope('crm.credit.manage'))
const options = [
  { code: 'CUSTOMS_TAXES', label: 'Impuestos Aduanas' },
  { code: 'THIRD_PARTY_PAYMENTS', label: 'Pagos a terceros' },
  { code: 'BONDED_STORAGE', label: 'Almacenaje Fiscal' },
  { code: 'CUSTOMS_BROKERAGE', label: 'Servicio Correduría Aduanera' },
  { code: 'LOCAL_TRANSPORT', label: 'Transporte Local' },
  { code: 'INTERNATIONAL_FREIGHT', label: 'Transporte Internacional de Carga' },
] as const
type CoverageKind = 'INCLUDED' | 'EXCLUDED'
type CreditCoverage = CrmRow & { serviceCode?: string; coverageType?: string; description?: string; isActive?: boolean }
const availableCodes = new Set<string>(options.map(x => x.code))
const profiles = ref<CrmRow[]>([])
const coverage = ref<CreditCoverage[]>([])
const included = ref<string[]>([])
const excluded = ref<string[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const success = ref('')
const opened = ref<CoverageKind | null>(null)
const filter = ref('')
const changeReason = ref('')
const showNewProposal = ref(false)
const days = ref('30')
const creditLimit = ref('')
const currency = ref('USD')
const financing = ref('0')
const paymentConditions = ref('')
let requestGeneration = 0

const profile = computed(() =>
  profiles.value.find(x => x.status === 'PendingApproval') ??
  profiles.value.find(x => x.status === 'Approved') ?? null)
const editableCoverage = computed(() => canManage.value && profile.value?.status === 'PendingApproval')
const savedIncluded = computed(() => coverage.value
  .filter(x => x.isActive && x.coverageType === 'INCLUDED').map(x => String(x.serviceCode)))
const savedExcluded = computed(() => coverage.value
  .filter(x => x.isActive && x.coverageType === 'EXCLUDED').map(x => String(x.serviceCode)))
const dirty = computed(() =>
  [...included.value].sort().join('|') !== savedIncluded.value.filter(x => availableCodes.has(x)).sort().join('|') ||
  [...excluded.value].sort().join('|') !== savedExcluded.value.filter(x => availableCodes.has(x)).sort().join('|'))
const filteredOptions = computed(() => options.filter(x =>
  x.label.toLocaleLowerCase('es').includes(filter.value.toLocaleLowerCase('es'))))
const labelFor = (code: string) => options.find(x => x.code === code)?.label ??
  coverage.value.find(x => x.serviceCode === code)?.description ?? code
const activeUnknown = computed(() => coverage.value.filter(x => x.isActive && !availableCodes.has(String(x.serviceCode))))
const selectedOf = (kind: CoverageKind) => kind === 'INCLUDED' ? included.value : excluded.value
const statusLabel = computed(() => profile.value?.status === 'Approved' ? 'Aprobado' :
  profile.value?.status === 'PendingApproval' ? 'Pendiente de aprobación' : 'Sin propuesta vigente')

async function refresh() {
  if (!canRead.value || !props.accountId) return
  const generation = ++requestGeneration
  loading.value = true
  error.value = ''
  try {
    const list = await crmRequest<CrmRow[]>(crmPath('accounts', props.accountId, 'credit-profiles'))
    if (generation !== requestGeneration) return
    profiles.value = list
    const current = list.find(x => x.status === 'PendingApproval') ??
      list.find(x => x.status === 'Approved')
    const results = current
      ? await crmRequest<CreditCoverage[]>(crmPath('credit-profiles', current.id, 'coverages'))
      : []
    if (generation !== requestGeneration) return
    coverage.value = results
    included.value = results.filter(x => x.isActive && x.coverageType === 'INCLUDED' &&
      availableCodes.has(String(x.serviceCode))).map(x => String(x.serviceCode))
    excluded.value = results.filter(x => x.isActive && x.coverageType === 'EXCLUDED' &&
      availableCodes.has(String(x.serviceCode))).map(x => String(x.serviceCode))
    opened.value = null
    filter.value = ''
  } catch (cause) {
    if (generation === requestGeneration) error.value = crmError(cause)
  } finally { if (generation === requestGeneration) loading.value = false }
}
watch(() => [props.accountId, canRead.value], () => { void refresh() }, { immediate: true })

function toggle(kind: CoverageKind, code: string) {
  if (!editableCoverage.value || busy.value) return
  const same = kind === 'INCLUDED' ? included : excluded
  const opposite = kind === 'INCLUDED' ? excluded : included
  if (same.value.includes(code)) same.value = same.value.filter(x => x !== code)
  else {
    same.value = [...same.value, code]
    // A service may not be included and excluded simultaneously.
    opposite.value = opposite.value.filter(x => x !== code)
  }
  success.value = ''
}
function selectAll(kind: CoverageKind) {
  if (!editableCoverage.value || busy.value) return
  const codes: string[] = options.map(x => x.code)
  const same = kind === 'INCLUDED' ? included : excluded
  const opposite = kind === 'INCLUDED' ? excluded : included
  if (codes.every(x => same.value.includes(x))) same.value = []
  else {
    same.value = codes
    opposite.value = opposite.value.filter(x => !codes.includes(x))
  }
  success.value = ''
}
function resetSelection() {
  included.value = savedIncluded.value.filter(x => availableCodes.has(x))
  excluded.value = savedExcluded.value.filter(x => availableCodes.has(x))
  opened.value = null
}

async function saveCoverages() {
  if (!editableCoverage.value || !profile.value || !dirty.value || busy.value) return
  busy.value = true
  error.value = ''
  success.value = ''
  const id = profile.value.id
  const desired = new Map<string, CoverageKind>()
  included.value.forEach(code => desired.set(code, 'INCLUDED'))
  excluded.value.forEach(code => desired.set(code, 'EXCLUDED'))
  try {
    let current = await crmRequest<CrmRow>(crmPath('credit-profiles', id))
    const previous = coverage.value.filter(x => x.isActive && availableCodes.has(String(x.serviceCode)))
    for (const item of previous) {
      const code = String(item.serviceCode)
      if (desired.get(code) === item.coverageType) continue
      await crmRequest(crmPath('credit-profiles', id, 'coverages/' + encodeURIComponent(item.id) + '/deactivate'),
        'POST', { expectedVersion: current.rowVersion,
          reason: 'Actualización de coberturas desde la ficha del cliente' })
      current = await crmRequest<CrmRow>(crmPath('credit-profiles', id))
    }
    for (const [code, kind] of desired) {
      if (previous.some(x => x.serviceCode === code && x.coverageType === kind)) continue
      await crmRequest(crmPath('credit-profiles', id, 'coverages'), 'POST', {
        expectedVersion: current.rowVersion, serviceCode: code,
        coverageType: kind, description: labelFor(code),
      })
      current = await crmRequest<CrmRow>(crmPath('credit-profiles', id))
    }
    await refresh()
    success.value = 'Coberturas guardadas en la propuesta pendiente. Requieren aprobación.'
    emit('updated')
  } catch (cause) {
    const problem = crmError(cause)
    await refresh()
    error.value = problem + '. Se volvieron a cargar los datos del servidor; revisá si hubo cambios parciales.'
  } finally { busy.value = false }
}

async function proposeRevision() {
  if (!canManage.value || profile.value?.status !== 'Approved' || busy.value) return
  if (!changeReason.value.trim()) {
    error.value = 'Indicá por qué necesitás modificar la cobertura aprobada.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const current = profile.value
    await crmRequest(crmPath('credit-profiles', current.id, 'revise'), 'POST', {
      expectedVersion: current.rowVersion,
      reason: changeReason.value.trim(),
      terms: {
        creditEnabled: current.creditEnabled,
        creditDays: current.creditDays,
        creditLimit: current.creditLimit,
        currencyCode: current.currencyCode,
        monthlyFinancingPct: current.monthlyFinancingPct,
        paymentConditions: current.paymentConditions,
        effectiveFrom: current.effectiveFrom,
        reviewAt: current.reviewAt ?? null,
      },
    })
    changeReason.value = ''
    await refresh()
    success.value = 'Revisión creada. La propuesta aprobada sigue vigente hasta una nueva aprobación.'
    emit('updated')
  } catch (cause) { error.value = crmError(cause) }
  finally { busy.value = false }
}
async function proposeNew() {
  if (!canManage.value || profile.value || busy.value) return
  const limit = Number(creditLimit.value)
  const totalDays = Number(days.value)
  const monthly = Number(financing.value)
  if (!creditLimit.value.trim() || !Number.isFinite(limit) || limit < 0 ||
      !Number.isInteger(totalDays) || totalDays < 0 || totalDays > 3650 ||
      !Number.isFinite(monthly) || monthly < 0 || monthly > 100) {
    error.value = 'Ingresá límite, días y financiamiento válidos para la propuesta.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    await crmRequest(crmPath('accounts', props.accountId, 'credit-profiles'), 'POST', {
      creditEnabled: true, creditDays: totalDays, creditLimit: limit,
      currencyCode: currency.value, monthlyFinancingPct: monthly,
      paymentConditions: paymentConditions.value,
      effectiveFrom: new Date().toISOString(), reviewAt: null,
    }, crmUuid())
    showNewProposal.value = false
    await refresh()
    success.value = 'Propuesta de crédito creada. Ahora podés elegir las coberturas antes de solicitar su aprobación.'
    emit('updated')
  } catch (cause) { error.value = crmError(cause) }
  finally { busy.value = false }
}
</script>

<template>
  <section v-if="canRead" class="space-y-4" data-crm-credit-coverages>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-2">
        <Wallet class="mt-0.5 h-5 w-5 text-[var(--dh-primary)]" />
        <div>
          <h3 class="text-sm font-extrabold">Cobertura del crédito</h3>
          <p class="text-xs text-[var(--dh-text-muted)]">Qué servicios cubre el crédito y cuáles se cobran por separado.</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="rounded-full border border-[var(--dh-border)] px-2.5 py-1 text-xs font-semibold">{{ statusLabel }}</span>
        <button type="button" class="rounded-lg border border-[var(--dh-border)] p-2 text-[var(--dh-text-muted)]"
          :disabled="loading || busy" title="Actualizar coberturas" aria-label="Actualizar coberturas" @click="refresh">
          <RotateCcw class="h-4 w-4" />
        </button>
      </div>
    </div>
    <p v-if="error" role="alert" class="rounded-lg border border-red-500/30 p-3 text-xs text-red-500">{{ error }}</p>
    <p v-if="success" role="status" class="text-xs text-emerald-500">{{ success }}</p>
    <p v-if="loading" role="status" class="text-xs text-[var(--dh-text-muted)]">Cargando condiciones de crédito…</p>
    <template v-else-if="profile">
      <p class="text-xs text-[var(--dh-text-muted)]">
        {{ profile.creditDays }} días · {{ profile.currencyCode }} {{ profile.creditLimit }} ·
        Financiamiento mensual: {{ profile.monthlyFinancingPct }}%
      </p>
      <p v-if="!editableCoverage" class="rounded-lg border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 text-xs text-[var(--dh-text-muted)]">
        {{ profile.status === 'Approved'
          ? 'Estas son las condiciones aprobadas. Para cambiarlas se debe crear una revisión que pasará por aprobación.'
          : 'Las coberturas se pueden modificar únicamente en una propuesta pendiente y con permiso de crédito.' }}
      </p>
      <div class="grid gap-3 md:grid-cols-2">
        <div v-for="kind in (['INCLUDED','EXCLUDED'] as const)" :key="kind"
          class="min-w-0 space-y-2 rounded-xl border border-[var(--dh-border)] p-3">
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-xs font-extrabold">{{ kind === 'INCLUDED' ? 'Crédito incluye' : 'Crédito NO incluye' }}</h4>
            <span class="text-xs text-[var(--dh-text-muted)]">{{ selectedOf(kind).length }} seleccionados</span>
          </div>
          <div class="flex min-h-10 flex-wrap items-center gap-1.5">
            <span v-if="!selectedOf(kind).length" class="text-xs text-[var(--dh-text-muted)]">Sin conceptos seleccionados</span>
            <button v-for="code in selectedOf(kind)" :key="code" type="button"
              :disabled="!editableCoverage || busy" :title="editableCoverage ? 'Quitar concepto' : labelFor(code)"
              class="inline-flex items-center gap-1 rounded-lg bg-[var(--dh-shell)] px-2 py-1.5 text-xs font-semibold"
              @click="toggle(kind, code)">
              {{ labelFor(code) }} <X v-if="editableCoverage" class="h-3 w-3" />
            </button>
          </div>
          <div v-if="editableCoverage" class="space-y-2">
            <button type="button" class="flex w-full items-center justify-between rounded-lg border border-[var(--dh-border)] px-3 py-2 text-left text-xs font-semibold"
              :aria-expanded="opened === kind" @click="opened = opened === kind ? null : kind; filter = ''">
              Agregar o buscar servicios <ChevronDown class="h-4 w-4" />
            </button>
            <div v-if="opened === kind" class="space-y-1 rounded-lg bg-[var(--dh-shell)] p-2">
              <input v-model="filter" class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-xs"
                aria-label="Buscar concepto de crédito" placeholder="Buscar un concepto…" />
              <button type="button" class="w-full rounded-md px-2 py-2 text-left text-xs font-semibold hover:bg-[var(--dh-card)]"
                @click="selectAll(kind)">
                Seleccionar todo / Quitar todo
              </button>
              <div class="max-h-48 overflow-y-auto">
                <label v-for="item in filteredOptions" :key="item.code"
                  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-[var(--dh-card)]">
                  <input type="checkbox" :checked="selectedOf(kind).includes(item.code)" :disabled="busy"
                    class="accent-[var(--dh-primary)]" @change="toggle(kind, item.code)" />
                  {{ item.label }}
                  <Check v-if="selectedOf(kind).includes(item.code)" class="ml-auto h-3.5 w-3.5 text-[var(--dh-primary)]" />
                </label>
              </div>
              <button type="button" class="w-full rounded-lg px-3 py-2 text-right text-xs font-bold text-[var(--dh-primary)]"
                @click="opened = null">Listo</button>
            </div>
          </div>
        </div>
      </div>
      <p v-if="activeUnknown.length" class="text-xs text-[var(--dh-text-muted)]">
        Otros conceptos anteriores (se conservan):
        <span v-for="item in activeUnknown" :key="item.id" class="ml-1 inline-block rounded-md border border-[var(--dh-border)] px-2 py-1">
          {{ labelFor(String(item.serviceCode)) }} · {{ item.coverageType === 'INCLUDED' ? 'Incluido' : 'Excluido' }}
        </span>
      </p>
      <div v-if="editableCoverage" class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-[var(--dh-text-muted)]">Un concepto no puede estar incluido y excluido a la vez.</p>
        <div class="flex gap-2">
          <button type="button" class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold"
            :disabled="!dirty || busy" @click="resetSelection">Descartar cambios</button>
          <button type="button" class="rounded-lg bg-[var(--dh-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            :disabled="!dirty || busy" @click="saveCoverages">{{ busy ? 'Guardando…' : 'Guardar coberturas' }}</button>
        </div>
      </div>
      <div v-else-if="canManage && profile.status === 'Approved'" class="space-y-2 rounded-xl border border-[var(--dh-border)] p-3">
        <label class="block text-xs font-semibold" for="credit-coverage-reason">Motivo de la modificación</label>
        <textarea id="credit-coverage-reason" v-model="changeReason" rows="2" maxlength="1000"
          class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 text-sm"
          placeholder="Explicá por qué debe cambiar la cobertura…" />
        <button type="button" class="rounded-lg bg-[var(--dh-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          :disabled="busy || !changeReason.trim()" @click="proposeRevision">Crear revisión de crédito</button>
      </div>
    </template>
    <div v-else-if="canManage && !loading" class="space-y-3">
      <p class="text-xs text-[var(--dh-text-muted)]">No hay un perfil de crédito aprobado o pendiente para esta cuenta.</p>
      <button v-if="!showNewProposal" type="button" class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-bold"
        @click="showNewProposal=true">Crear propuesta de crédito</button>
      <div v-else class="grid gap-3 rounded-xl border border-[var(--dh-border)] p-3 sm:grid-cols-2">
        <label class="text-xs font-semibold">Días de crédito
          <input v-model="days" type="number" min="0" max="3650" class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2" />
        </label>
        <label class="text-xs font-semibold">Límite de crédito
          <input v-model="creditLimit" type="number" min="0" step="0.01" class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2" />
        </label>
        <label class="text-xs font-semibold">Moneda
          <select v-model="currency" class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2">
            <option value="USD">USD</option><option value="CRC">CRC</option>
          </select>
        </label>
        <label class="text-xs font-semibold">Financiamiento mensual (%)
          <input v-model="financing" type="number" min="0" max="100" step="0.0001" class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2" />
        </label>
        <label class="text-xs font-semibold sm:col-span-2">Condiciones de pago
          <textarea v-model="paymentConditions" rows="2" maxlength="4000"
            class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2" />
        </label>
        <div class="flex items-center justify-end gap-2 sm:col-span-2">
          <button type="button" class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs"
            @click="showNewProposal=false">Cancelar</button>
          <button type="button" class="rounded-lg bg-[var(--dh-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            :disabled="busy" @click="proposeNew">Guardar propuesta pendiente</button>
        </div>
      </div>
    </div>
    <p v-else-if="!loading" class="text-xs text-[var(--dh-text-muted)]">No hay un perfil de crédito aprobado o pendiente.</p>
  </section>
</template>

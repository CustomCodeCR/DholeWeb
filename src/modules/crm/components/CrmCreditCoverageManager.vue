<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, ChevronDown, RotateCcw, Wallet, X } from 'lucide-vue-next'
import { useAuthStore } from '@/core/stores/authStore'
import { crmError, crmPath, crmRequest, crmUuid, type CrmRow } from '../services/crmApi'
import { CRM_CREDIT_COVERAGE_OPTIONS } from '../model/crmCreditCoverage'

const props = defineProps<{ accountId: string; editable?: boolean }>()
const emit = defineEmits<{ (e: 'updated'): void }>()
const auth = useAuthStore()
const canRead = computed(() => auth.hasScope('crm.credit.read'))
const canManage = computed(() => props.editable && auth.hasScope('crm.credit.manage'))
const canRequest = computed(() => props.editable &&
  (auth.hasScope('crm.credit.manage') || auth.hasScope('crm.account.update')))
const canApprove = computed(() => auth.hasScope('crm.credit.approve'))
const approvalReason = ref('')
const options = CRM_CREDIT_COVERAGE_OPTIONS
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
const proposalError = ref('')
const proposalStatus = ref('')
// Reuse the idempotency key when a connection failure leaves the result uncertain.
const proposalOperationKey = ref(crmUuid())
const days = ref('30')
const creditLimit = ref('')
const currency = ref('USD')
type CreditCurrencyOption = { code: string; label: string }
const currencyOptions = ref<CreditCurrencyOption[]>([])
const currencyLoading = ref(false)
const currencyError = ref('')
let currencyGeneration = 0
async function loadCurrencies() {
  if (!canRead.value && !canRequest.value) return
  const generation = ++currencyGeneration
  currencyLoading.value = true
  currencyError.value = ''
  try {
    const available = await crmRequest<CreditCurrencyOption[]>(crmPath('credit-currencies'))
    if (generation !== currencyGeneration) return
    currencyOptions.value = available.filter(item => /^[A-Z]{3}$/.test(item.code))
    if (!currencyOptions.value.length) {
      currency.value = ''
      currencyError.value = 'No hay monedas ISO activas disponibles en Config. Revisá el catálogo de monedas.'
    } else if (!currencyOptions.value.some(item => item.code === currency.value)) {
      currency.value = currencyOptions.value.find(item => item.code === 'USD')?.code ??
        currencyOptions.value[0]?.code ?? ''
    }
  } catch (cause) {
    if (generation !== currencyGeneration) return
    currencyOptions.value = []
    currencyError.value = 'No se pudo cargar el catálogo de monedas activas. ' + crmError(cause)
  } finally {
    if (generation === currencyGeneration) currencyLoading.value = false
  }
}
watch([canRead, canRequest], () => { void loadCurrencies() }, { immediate: true })
const financing = ref('0')
const lateInterest = ref('0')
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
        lateInterestMonthlyPct: Number(current.lateInterestMonthlyPct ?? 0),
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
function approvalCoverageSnapshot() {
  // Existing historical catalog entries are preserved even when the local list of
  // selectable services does not know their codes.
  const selected = new Map<string, { serviceCode: string; coverageType: CoverageKind; description: string }>()
  for (const item of activeUnknown.value) {
    const code = String(item.serviceCode ?? '').toUpperCase()
    if (code && (item.coverageType === 'INCLUDED' || item.coverageType === 'EXCLUDED'))
      selected.set(code, { serviceCode: code, coverageType: item.coverageType,
        description: String(item.description || labelFor(code)) })
  }
  for (const code of included.value)
    selected.set(code.toUpperCase(), { serviceCode: code.toUpperCase(),
      coverageType: 'INCLUDED', description: labelFor(code) })
  for (const code of excluded.value)
    selected.set(code.toUpperCase(), { serviceCode: code.toUpperCase(),
      coverageType: 'EXCLUDED', description: labelFor(code) })
  return [...selected.values()]
}
async function resolveCredit(approve: boolean) {
  if (!canApprove.value || !profile.value || profile.value.status !== 'PendingApproval' || busy.value) return
  if (!approvalReason.value.trim()) { error.value = 'Indicá un motivo antes de aprobar o rechazar.'; return }
  busy.value = true; error.value = ''; success.value = ''
  try {
    const selectedCoverages = approve ? approvalCoverageSnapshot() : null
    await crmRequest(crmPath('credit-profiles', String(profile.value.id), approve ? 'approve' : 'reject'), 'POST', {
      expectedVersion: profile.value.rowVersion, reason: approvalReason.value.trim(),
      ...(approve ? { coverages: selectedCoverages } : {}),
    })
    approvalReason.value = ''
    await refresh()
    success.value = approve
      ? 'Crédito aprobado con ' + (selectedCoverages?.filter(x => x.coverageType === 'INCLUDED').length ?? 0) +
        ' servicios incluidos y ' + (selectedCoverages?.filter(x => x.coverageType === 'EXCLUDED').length ?? 0) +
        ' excluidos. Guardados en CRM.'
      : 'Solicitud de crédito rechazada.'
    emit('updated')
  } catch (cause) { error.value = crmError(cause) }
  finally { busy.value = false }
}
function proposalFailure(cause: unknown): string {
  const issue = cause && typeof cause === 'object'
    ? cause as { status?: number; data?: { title?: string; detail?: string }; message?: string }
    : null
  const description = issue?.data?.detail || issue?.data?.title || issue?.message || crmError(cause)
  if (issue?.status === 403) return 'No se pudo solicitar crédito para esta cuenta. Confirmá que tenés permiso para actualizarla o gestionar créditos y que está dentro de tus cuentas autorizadas. (403) ' + description
  if (issue?.status === 409) return 'La cuenta ya tiene una propuesta pendiente o hubo un conflicto (409). ' + description
  if (issue?.status === 400 && description.includes('Inactive Config currency'))
    return 'La moneda elegida no está disponible o activa en Config. Actualizá el selector de monedas antes de reintentar.'
  if (issue?.status === 400) return 'CRM rechazó los datos de la solicitud (400): ' + description
  if (issue?.status === 503) return 'El servicio de referencias (Config) no está disponible (503). ' + description
  return description
}
async function proposeNew() {
  if (busy.value) return
  proposalError.value = ''
  proposalStatus.value = 'Validando solicitud de crédito…'
  if (!canRequest.value) {
    proposalStatus.value = ''
    proposalError.value = 'Tu usuario requiere permisos de gestión de crédito o actualización de la cuenta para solicitarlo.'
    return
  }
  if (profile.value) {
    proposalStatus.value = ''
    proposalError.value = 'Esta cuenta ya tiene una propuesta pendiente o aprobada. Actualizá las condiciones existentes.'
    return
  }
  if (currencyLoading.value || !currencyOptions.value.some(item => item.code === currency.value)) {
    proposalStatus.value = ''
    proposalError.value = currencyError.value || 'Seleccioná una moneda activa de Config.'
    return
  }
  const limit = Number(creditLimit.value)
  const totalDays = Number(days.value)
  const monthly = Number(financing.value)
  const overdue = Number(lateInterest.value)
  if (!String(creditLimit.value ?? '').trim() || !Number.isFinite(limit) || limit <= 0 ||
      Math.abs(Math.round(limit * 100) - limit * 100) > 1e-6 ||
      !Number.isInteger(totalDays) || totalDays < 1 || totalDays > 3650 ||
      !Number.isFinite(monthly) || monthly < 0 || monthly > 100 ||
      Math.abs(Math.round(monthly * 10000) - monthly * 10000) > 1e-6 ||
      !Number.isFinite(overdue) || overdue < 0 || overdue > 100 ||
      Math.abs(Math.round(overdue * 10000) - overdue * 10000) > 1e-6) {
    proposalStatus.value = ''
    proposalError.value = 'Ingresá un límite con máximo 2 decimales, plazo de 1 a 3650 días, financiamiento e interés moratorio de 0% a 100% con máximo 4 decimales.'
    return
  }
  if (!props.accountId) {
    proposalStatus.value = ''
    proposalError.value = 'No se ha cargado el cliente. Volvé al detalle e intentá nuevamente.'
    return
  }
  busy.value = true
  error.value = ''
  success.value = ''
  proposalStatus.value = 'Enviando solicitud al backend de CRM…'
  try {
    const created = await crmRequest<CrmRow>(crmPath('accounts', props.accountId, 'credit-profiles'), 'POST', {
      creditEnabled: true, creditDays: totalDays, creditLimit: limit,
      currencyCode: currency.value, monthlyFinancingPct: monthly,
      lateInterestMonthlyPct: overdue,
      paymentConditions: paymentConditions.value.trim(),
      effectiveFrom: new Date().toISOString(), reviewAt: null,
    }, proposalOperationKey.value)
    if (!created?.id) throw new Error('El backend no confirmó el ID de la propuesta de crédito.')
    if (!profiles.value.some(p => p.id === created.id)) profiles.value = [created, ...profiles.value]
    proposalOperationKey.value = crmUuid()
    showNewProposal.value = false
    proposalStatus.value = 'La propuesta fue creada en CRM. Actualizando condiciones…'
    await refresh()
    success.value = 'Solicitud de crédito registrada en CRM y pendiente de aprobación.'
    emit('updated')
  } catch (cause) {
    proposalError.value = proposalFailure(cause)
    const reason = cause && typeof cause === 'object'
      ? String((cause as {data?: {title?: string}}).data?.title ?? '') : ''
    if (reason === 'Inactive Config currency') void loadCurrencies()
    const status = cause && typeof cause === 'object' && 'status' in cause
      ? Number((cause as { status?: number }).status) : 0
    // Reconcile only uncertain writes, not ordinary validation errors.
    if (!status || status === 409) {
      proposalStatus.value = 'Verificando si el backend registró la solicitud…'
      await refresh()
      if (profile.value) {
        showNewProposal.value = false
        proposalError.value = ''
        success.value = 'Solicitud encontrada en CRM. No se creó un duplicado.'
        proposalOperationKey.value = crmUuid()
        emit('updated')
      }
    }
  } finally {
    busy.value = false
    proposalStatus.value = ''
  }
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
    <p v-if="proposalStatus" role="status" class="rounded-xl border border-[var(--dh-border)] p-3 text-sm font-semibold text-[var(--dh-text)]">{{ proposalStatus }}</p>
    <p v-if="success" role="status" class="text-xs text-emerald-500">{{ success }}</p>
    <p v-if="loading" role="status" class="text-xs text-[var(--dh-text-muted)]">Cargando condiciones de crédito…</p>
    <template v-else-if="profile">
      <p class="text-xs text-[var(--dh-text-muted)]">
        {{ profile.creditDays }} días · {{ profile.currencyCode }} {{ profile.creditLimit }} ·
        Financiamiento mensual: {{ profile.monthlyFinancingPct }}% ·
        Interés moratorio mensual: {{ profile.lateInterestMonthlyPct ?? 0 }}%
      </p>
      <div v-if="profile.status === 'PendingApproval'" class="space-y-3 rounded-xl border border-[var(--dh-border)] p-3">
        <p class="text-xs font-semibold">Las coberturas seleccionadas se guardarán junto con la aprobación del crédito.</p>
        <p v-if="dirty" role="status" class="rounded-lg border border-amber-500/30 p-2 text-xs text-amber-500">
          Hay cambios de coberturas sin guardar. Al aprobar se registrarán automáticamente en la misma operación.
        </p>
        <template v-if="canApprove">
          <label class="block text-xs font-bold">Justificación de la decisión
            <textarea v-model.trim="approvalReason" maxlength="1000" rows="2" class="mt-2 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-3" placeholder="Motivo obligatorio para aprobar o rechazar" />
          </label>
          <div class="flex flex-wrap gap-2">
            <button type="button" :disabled="busy || !approvalReason" class="rounded-lg bg-[var(--dh-primary)] px-3 py-2 text-xs font-bold text-white" @click="resolveCredit(true)">{{ dirty ? 'Guardar coberturas y aprobar' : 'Aprobar crédito' }}</button>
            <button type="button" :disabled="busy || !approvalReason" class="rounded-lg border border-red-500/40 px-3 py-2 text-xs font-bold text-red-500" @click="resolveCredit(false)">Rechazar solicitud</button>
          </div>
        </template>
      </div>
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
        <p v-if="!savedIncluded.length && !savedExcluded.length" class="text-xs text-amber-500">
          Este crédito fue aprobado sin servicios de cobertura registrados. Para agregar los conceptos faltantes,
          creá una revisión, elegí los servicios y aprobá la nueva propuesta.
        </p>
        <label class="block text-xs font-semibold" for="credit-coverage-reason">Motivo de la modificación</label>
        <textarea id="credit-coverage-reason" v-model="changeReason" rows="2" maxlength="1000"
          class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 text-sm"
          placeholder="Indicá los servicios que faltaron y por qué se debe corregir la aprobación…" />
        <button type="button" class="rounded-lg bg-[var(--dh-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          :disabled="busy || !changeReason.trim()" @click="proposeRevision">Corregir coberturas (crear revisión)</button>
      </div>
    </template>
    <div v-else-if="canRequest && !loading" class="space-y-4">
      <div v-if="!showNewProposal" class="rounded-xl border border-dashed border-[var(--dh-border)] bg-[var(--dh-shell)] p-5">
        <h4 class="font-bold">Este cliente todavía no tiene crédito configurado</h4>
        <p class="mt-2 text-sm text-[var(--dh-text-muted)]">Registrá primero el plazo y el límite. Quedará pendiente de aprobación; no se activará automáticamente.</p>
        <button type="button" class="mt-4 rounded-xl bg-[var(--dh-primary)] px-4 py-2.5 text-sm font-bold text-white"
          @click="proposalError='';showNewProposal=true">Añadir crédito</button>
      </div>
      <form v-else class="space-y-5 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5"
        novalidate data-crm-credit-proposal @submit.prevent="proposeNew">
        <header class="border-b border-[var(--dh-border)] pb-4">
          <h4 class="text-base font-extrabold">Nueva solicitud de crédito</h4>
          <p class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">Completá el plazo y el monto autorizado que se desea solicitar. Un responsable revisará la propuesta antes de activarla.</p>
        </header>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block space-y-1.5 text-sm font-semibold">Plazo de pago (días) *
            <input v-model="days" required type="number" min="1" max="3650" step="1"
              class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" />
            <span class="block text-xs font-normal text-[var(--dh-text-muted)]">Ejemplo: 30 días después de la facturación.</span>
          </label>
          <label class="block space-y-1.5 text-sm font-semibold">Límite de crédito *
            <input v-model="creditLimit" required type="number" min="0.01" step="0.01" placeholder="Ej. 100000"
              class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" />
          </label>
          <label class="block space-y-1.5 text-sm font-semibold">Moneda *
            <select v-model="currency" :disabled="currencyLoading || !currencyOptions.length"
              class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm">
              <option v-if="!currencyOptions.length" value="">Sin monedas disponibles</option>
              <option v-for="option in currencyOptions" :key="option.code" :value="option.code">
                {{ option.code }} · {{ option.label }}
              </option>
            </select>
            <span v-if="currencyLoading" class="block text-xs font-normal text-[var(--dh-text-muted)]">Consultando monedas activas en Config…</span>
            <span v-if="currencyError" role="alert" class="block text-xs font-normal text-red-500">{{ currencyError }}</span>
            <button v-if="currencyError" type="button" :disabled="currencyLoading"
              class="text-xs font-semibold text-[var(--dh-primary)]" @click="loadCurrencies">
              Volver a consultar monedas
            </button>
          </label>
          <label class="block space-y-1.5 text-sm font-semibold">Financiamiento mensual (%)
            <input v-model="financing" type="number" min="0" max="100" step="0.0001"
              class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" />
            <span class="block text-xs font-normal text-[var(--dh-text-muted)]">Usá 0 si no se cobra interés por financiamiento.</span>
          </label>
          <label class="block space-y-1.5 text-sm font-semibold">Interés moratorio mensual (%)
            <input v-model="lateInterest" type="number" min="0" max="100" step="0.0001"
              class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" />
            <span class="block text-xs font-normal text-[var(--dh-text-muted)]">Aplicable a pagos vencidos según las condiciones aprobadas. Usá 0 si no aplica.</span>
          </label>
        </div>
        <label class="block space-y-1.5 text-sm font-semibold">Condiciones adicionales (opcional)
          <textarea v-model="paymentConditions" rows="3" maxlength="4000" placeholder="Ej. Se factura al cierre de cada mes."
            class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" />
        </label>
        <p v-if="proposalError" role="alert" class="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-500">{{ proposalError }}</p>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--dh-border)] pt-4">
          <p class="max-w-md text-xs text-[var(--dh-text-muted)]">Al guardar, la solicitud queda pendiente de aprobación.</p>
          <div class="flex gap-2">
            <button type="button" :disabled="busy" class="rounded-xl border border-[var(--dh-border)] px-4 py-2.5 text-sm" @click="showNewProposal=false;proposalError=''">Cancelar</button>
            <button type="submit" :disabled="busy || currencyLoading || !currencyOptions.some(item => item.code === currency)" data-crm-credit-submit
              class="rounded-xl bg-[var(--dh-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{{ busy ? 'Guardando solicitud…' : 'Solicitar crédito' }}</button>
          </div>
        </div>
      </form>
    </div>
    <p v-else-if="!loading" class="text-xs text-[var(--dh-text-muted)]">No hay un perfil de crédito aprobado o pendiente.</p>
  </section>
</template>

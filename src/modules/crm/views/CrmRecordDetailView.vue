<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowLeft, BriefcaseBusiness, Plus, ChevronDown, UsersRound, MapPin,
  Activity, Route, Wallet, FileText, CalendarClock, Settings2, Mail, Phone } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhDrawer, DhPageHeader } from '@/shared/components/organisms'
import CrmCatalogPicker from '../components/CrmCatalogPicker.vue'
import CrmExecutivePicker from '../components/CrmExecutivePicker.vue'
import CrmAccountHub from '../components/CrmAccountHub.vue'
import CrmAccountEditor from '../components/CrmAccountEditor.vue'
import CrmContactForm from '../components/CrmContactForm.vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useAuthStore } from '@/core/stores/authStore'
import { useI18n } from 'vue-i18n'
import { crmEnabled, crmError, crmGet, crmPath, crmRequest,
  crmUuid, toUtc, type CrmRow } from '../services/crmApi'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const section = computed(() => String(route.meta.crmSection ?? 'accounts'))
const id = computed(() => String(route.params.id ?? ''))
const record = ref<CrmRow | null>(null)
const error = ref('')
const success = ref('')
const loading = ref(false)
const saving = ref(false)
const pendingCreateKeys = new Map<string, string>()
const relationRows = ref<CrmRow[]>([])
const relation = ref('')
const showRelationForm = ref(false)
const showAdvancedAccountManagement = ref(false)
const showExecutiveDrawer = ref(false)
const showAccountEditor = ref(false)
const accountEditingDirty = ref(false)
const selectedExecutive = ref('')
const executiveReason = ref('')
const createRelationPermissions: Record<string, string> = {
  'accounts:addresses': 'crm.account.update',
  'accounts:followup-policy': 'crm.followup.manage',
  'accounts:contacts': 'crm.contact.create',
  'accounts:credit-profiles': 'crm.credit.manage',
  'accounts:credit-contracts': 'crm.contract.manage',
  'activities:notes': 'crm.activity.update',
  'analyses:services': 'crm.analysis.manage',
  'analyses:routes': 'crm.analysis.manage',
  'opportunities:negotiations': 'crm.opportunity.update',
  'opportunities:quotes': 'crm.quote.link',
  'opportunities:rate-requests': 'crm.quote.link',
  'settings:stages': 'crm.settings.manage',
}
const accountRelationOptions = [
  { key: 'contacts', label: 'Contactos', subtitle: 'Personas y responsables', icon: UsersRound,
    description: 'Gestioná las personas vinculadas con esta empresa y sus medios de comunicación.',
    empty: 'Todavía no hay contactos relacionados con esta cuenta.' },
  { key: 'addresses', label: 'Direcciones', subtitle: 'Sedes y ubicaciones', icon: MapPin,
    description: 'Registrá las direcciones de la empresa para operaciones y facturación.',
    empty: 'No hay direcciones registradas para este cliente.' },
  { key: 'business-activities', label: 'Actividades económicas', subtitle: 'Giro del negocio', icon: Activity,
    description: 'Actividades económicas registradas para la cuenta.',
    empty: 'No hay actividades económicas vinculadas.' },
  { key: 'trade-profiles', label: 'Rutas habituales', subtitle: 'Mercados y logística', icon: Route,
    description: 'Historial y perfiles de rutas de esta cuenta.',
    empty: 'Todavía no hay rutas habituales registradas.' },
  { key: 'credit-profiles', label: 'Perfiles de crédito', subtitle: 'Condiciones financieras', icon: Wallet,
    description: 'Consultá y gestioná propuestas de crédito según tus permisos.',
    empty: 'Este cliente todavía no tiene un perfil de crédito.' },
  { key: 'credit-contracts', label: 'Contratos de crédito', subtitle: 'Documentos y vigencias', icon: FileText,
    description: 'Documentos, condiciones y vigencias de contratos del cliente.',
    empty: 'No hay contratos de crédito vinculados.' },
  { key: 'followup-policy', label: 'Política de seguimiento', subtitle: 'Agenda del cliente', icon: CalendarClock,
    description: 'Configurá el seguimiento comercial de la cuenta, no de contactos individuales.',
    empty: 'No hay una política de seguimiento configurada para esta cuenta.' },
]
const accountRelationInfo = computed(() =>
  accountRelationOptions.find(option => option.key === relation.value))

const canAddRelation = computed(() => {
  const scope = createRelationPermissions[`${section.value}:${relation.value}`]
  return !!scope && auth.hasScope(scope)
})
const drafts = reactive({
  note: '', reason: '', outcome: 'Completed', date: '',
  stageId: '', status: '', contactName: '', contactEmail: '',
  quoteId: '', pricingRequestId: '', priority: 'Green', shipmentMode: 'Fcl',
  originName: '', destinationName: '', payload: '{}', serviceCode: '', volume: '1',
  polCode: '', poeCode: '', podCode: '', creditDays: '30', creditLimit: '0',
  monthlyFinancingPct: '0', currencyCode: 'USD', paymentConditions: '',
  contractNumber: '', renewalDate: '', expiryDate: '', startDate: '',
  marketCode: 'OTHER', decisionRole: 'INFLUENCER', fileId: '', timezoneId: 'America/Costa_Rica',
  channelStrategy: 'BOTH', frequencyDays: '7', reminderLeadMinutes: '60',
  assignedUserId: String(auth.userId || ''), operationId: crmUuid(),
  addressText: '', addressType: 'WORK', transportModeCode: 'SEA', modalityCode: 'FCL',
  summary: '',
})
const stages = ref<CrmRow[]>([])
const can = (scope: string) => auth.hasScope(scope)
const tabs = computed(() => {
  if (section.value === 'accounts') return ['contacts', 'addresses', 'business-activities', 'trade-profiles', 'credit-profiles', 'credit-contracts', 'followup-policy']
  if (section.value === 'leads') return ['activities']
  if (section.value === 'opportunities') return ['stage-history', 'quotes', 'rate-requests', 'negotiations', 'contacts']
  if (section.value === 'activities') return ['notes', 'participants']
  if (section.value === 'followups') return ['history']
  if (section.value === 'analyses') return ['routes', 'services']
  if (section.value === 'settings') return ['stages']
  return []
})
function permitted(tab: string) {
  if (tab === 'credit-profiles') return can('crm.credit.read')
  if (tab === 'credit-contracts') return can('crm.contract.read')
  if (tab === 'contacts' || tab === 'participants') return can('crm.contact.read') || section.value !== 'accounts'
  if (tab === 'followup-policy') return can('crm.followup.manage')
  if (tab === 'business-activities') return can('crm.account.read') || can('crm.account.read-all')
  if (tab === 'trade-profiles') return can('crm.analysis.read')
  if (tab === 'quotes' || tab === 'rate-requests') return can('crm.quote.read')
  return true
}
function endpoint(tab: string) {
  if (tab === 'stages') return crmPath('pipelines', id.value, 'stages')
  if (tab === 'contacts' && section.value === 'accounts') return crmPath('accounts', id.value, 'contacts')
  if (tab === 'contacts') return crmPath('opportunities', id.value, 'contacts')
  if (tab === 'addresses' || tab === 'business-activities' || tab === 'trade-profiles' || tab === 'credit-profiles' ||
      tab === 'credit-contracts' || tab === 'followup-policy')
    return crmPath('accounts', id.value, tab)
  return crmPath(section.value, id.value, tab)
}
async function loadRelation() {
  relationRows.value = []
  if (!permitted(relation.value)) return
  try {
    const res = await crmRequest<CrmRow[] | CrmRow>(endpoint(relation.value))
    if (Array.isArray(res)) relationRows.value = res.map(row => row.contact ? row.contact as CrmRow : row)
    else if (res && typeof res === 'object') relationRows.value = [res]
  } catch (e) { error.value = crmError(e) }
}
async function load() {
  loading.value = true; error.value = ''; success.value = ''
  try {
    if (section.value === 'settings') {
      const list = await crmRequest<CrmRow[]>(crmPath('pipelines'))
      record.value = list.find(x => x.id === id.value) ?? null
      if (!record.value) throw new Error('Pipeline no encontrado')
    } else {
      record.value = await crmGet(section.value, id.value)
    }
    if (section.value === 'opportunities') {
      const pipelineId = String(record.value?.pipelineId ?? '')
      if (pipelineId) stages.value = await crmRequest<CrmRow[]>(crmPath('pipelines', pipelineId, 'stages'))
    }
    if (!tabs.value.includes(relation.value)) relation.value = tabs.value.find(permitted) ?? ''
    if (relation.value) await loadRelation()
  } catch (e) { record.value = null; error.value = crmError(e) }
  finally { loading.value = false }
}
async function perform(action: string, body: unknown, scope: string, path?: string) {
  if (!record.value || !can(scope) || saving.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    await crmRequest(path ?? crmPath(section.value, id.value, action), 'POST', body, crmUuid())
    await load()
    success.value = t('crm.saved')
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
function leaveAccountEditing(): boolean {
  if (accountEditingDirty.value &&
      !window.confirm('Hay cambios en la ficha sin guardar. ¿Querés descartarlos?')) return false
  accountEditingDirty.value = false
  showAccountEditor.value = false
  const query = { ...route.query }
  delete query.edit
  void router.replace({ path: route.path, query, hash: route.hash })
  return true
}
function toggleAccountEditing() {
  if (!can('crm.account.update')) return
  if (showAccountEditor.value) {
    leaveAccountEditing()
  } else {
    accountEditingDirty.value = false
    showAccountEditor.value = true
    void router.replace({ path: route.path, query: { ...route.query, edit: '1' }, hash: route.hash })
  }
}
function openRelatedManagement() {
  if (!leaveAccountEditing()) return
  showAdvancedAccountManagement.value = true
  window.requestAnimationFrame(() => document.getElementById('crm-related-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
function openExecutiveDrawer() {
  selectedExecutive.value = record.value?.isCastroFallasExecutive === true
    ? '__castro_fallas__'
    : String(record.value?.executiveUserId ?? '')
  executiveReason.value = ''
  showExecutiveDrawer.value = true
}
async function reassignExecutive() {
  if (section.value !== 'accounts' || !record.value || !can('crm.account.assign') ||
      !selectedExecutive.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await crmRequest(crmPath('accounts', id.value, 'assign'), 'POST', {
      expectedVersion: version(),
      executiveUserId: selectedExecutive.value === '__castro_fallas__' ? null : selectedExecutive.value,
      assignToCastroFallas: selectedExecutive.value === '__castro_fallas__',
      reason: executiveReason.value.trim() || null,
    }, crmUuid())
    showExecutiveDrawer.value = false
    await load()
    success.value = t('crm.saved')
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
function version() { return Number(record.value?.rowVersion ?? 0) }
async function createRelation(tab: string, body: unknown, requiredScope: string) {
  if (!can(requiredScope) || saving.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    const fingerprint = endpoint(tab) + ':' + JSON.stringify(body)
    const key = pendingCreateKeys.get(fingerprint) ?? crmUuid()
    pendingCreateKeys.set(fingerprint, key)
    await crmRequest(endpoint(tab), 'POST', body, key)
    pendingCreateKeys.delete(fingerprint)
    await loadRelation(); success.value = t('crm.saved'); showRelationForm.value = false
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
function onLinkedContactSaved() {
  showRelationForm.value = false
  success.value = t('crm.saved')
  void loadRelation()
  void load()
}
async function convertLead() {
  await perform('convert', {
    existingAccountId: null, notes: drafts.reason || null, taxIdTypeCode: null,
    customerTypeCode: 'cash', categoryType: 'CUSTOMER', categoryCode: 'A',
  }, 'crm.lead.convert')
}
async function stageMove() {
  if (!drafts.stageId) return
  await perform('move-stage', { expectedVersion: version(), stageId: drafts.stageId,
    reason: drafts.reason || null }, 'crm.opportunity.update')
}
async function closeOpportunity() {
  const stage = stages.value.find(s => s.id === drafts.stageId)
  if (!stage || (!stage.isWon && !stage.isLost)) {
    error.value = t('crm.selectTerminalStage'); return
  }
  await perform('close', { expectedVersion: version(), stageId: drafts.stageId,
    lossReasonCode: stage.isLost ? 'OTHER' : null, reason: drafts.reason || null }, 'crm.opportunity.close')
}
async function completeActivity() {
  await perform('complete', { expectedVersion: version(), outcome: drafts.outcome,
    occurredAt: new Date().toISOString(), note: drafts.note || null }, 'crm.activity.update')
}
async function rescheduleActivity() {
  if (!drafts.date) return
  await perform('reschedule', { expectedVersion: version(), scheduledStartAt: toUtc(drafts.date),
    scheduledEndAt: null, reason: drafts.reason || 'Reprogramación comercial' }, 'crm.activity.update')
}
async function completeFollowup() {
  await perform('complete', { expectedVersion: version(), outcome: drafts.outcome,
    nextFollowupAt: drafts.date ? toUtc(drafts.date) : null }, 'crm.task.manage')
}
async function rescheduleFollowup() {
  if (!drafts.date) return
  await perform('reschedule', { expectedVersion: version(), dueAt: toUtc(drafts.date),
    reason: drafts.reason || 'Reprogramación comercial' }, 'crm.task.manage')
}
async function linkQuote() {
  await createRelation('quotes', {
    pricingQuoteId: drafts.quoteId, pricingRequestId: drafts.pricingRequestId || null,
  }, 'crm.quote.link')
}
async function createPricingRequest() {
  let payload: unknown
  try { payload = JSON.parse(drafts.payload) }
  catch { error.value = t('crm.invalidJson'); return }
  if (!drafts.shipmentMode.trim() || !drafts.originName.trim()) {
    error.value = t('crm.required'); return
  }
  await createRelation('rate-requests', {
    priority: drafts.priority, shipmentMode: drafts.shipmentMode,
    originName: drafts.originName, destinationName: drafts.destinationName,
    poeId: null, poeName: null, podId: null, podName: null, payload,
  }, 'crm.quote.link')
}
async function createCredit() {
  await createRelation('credit-profiles', {
    creditEnabled: true, creditDays: Number(drafts.creditDays), creditLimit: Number(drafts.creditLimit),
    currencyCode: drafts.currencyCode, monthlyFinancingPct: Number(drafts.monthlyFinancingPct),
    paymentConditions: drafts.paymentConditions, effectiveFrom: new Date().toISOString(),
    reviewAt: drafts.renewalDate ? toUtc(drafts.renewalDate) : null,
  }, 'crm.credit.manage')
}
async function createContract() {
  if (!drafts.startDate || !drafts.renewalDate) { error.value = t('crm.required'); return }
  await createRelation('credit-contracts', {
    creditProfileId: null, contractNumber: drafts.contractNumber || null,
    startDate: toUtc(drafts.startDate), renewalDate: toUtc(drafts.renewalDate),
    expiryDate: drafts.expiryDate ? toUtc(drafts.expiryDate) : null,
    paymentTerms: drafts.paymentConditions, autoRenew: false,
  }, 'crm.contract.manage')
}
async function createRoute() {
  await createRelation('routes', {
    polCode: drafts.polCode || null, poeCode: drafts.poeCode || null, podCode: drafts.podCode || null,
    originCountryCode: null, destinationCountryCode: null,
    frequencyPerMonth: null, notes: drafts.note || null,
  }, 'crm.analysis.manage')
}
async function createStage() {
  await createRelation('stages', {
    name: drafts.contactName, sortOrder: Number(drafts.volume),
    defaultWinProbability: 0, isWon: false, isLost: false,
  }, 'crm.settings.manage')
}
async function actOnChild(item: CrmRow, action: string, required: string, body: Record<string, unknown>) {
  if (!can(required) || saving.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    await crmRequest(crmPath(relation.value === 'credit-profiles' ? 'credit-profiles' : 'credit-contracts',
      item.id, action), 'POST', { expectedVersion: item.rowVersion, ...body }, crmUuid())
    drafts.operationId = crmUuid()
    await loadRelation()
    success.value = t('crm.saved')
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
function savePolicy() {
  const policy = relationRows.value[0]
  if (!drafts.date) { error.value = t('crm.required'); return }
  saving.value = true; error.value = ''
  void crmRequest(crmPath('accounts', id.value, 'followup-policy'), 'PUT', {
    expectedVersion: policy?.rowVersion ?? null, enabled: true,
    ownerUserId: drafts.assignedUserId || auth.userId,
    channelStrategy: drafts.channelStrategy, frequencyDays: Number(drafts.frequencyDays),
    nextDueAt: toUtc(drafts.date), timezoneId: drafts.timezoneId,
    reminderLeadMinutes: Number(drafts.reminderLeadMinutes), pausedUntil: null,
  }).then(async () => { await loadRelation(); success.value = t('crm.saved') })
    .catch(e => { error.value = crmError(e) }).finally(() => { saving.value = false })
}
function addService() {
  return createRelation('services', {
    serviceCode: drafts.serviceCode, modalityCode: drafts.modalityCode,
    transportModeCode: drafts.transportModeCode, requiresCustoms: false,
    cargoTypeCode: null, volume: Number(drafts.volume), volumeUnit: 'CBM',
    containerTypeCode: null, equipmentQuantity: null,
    expectedMovementsPerMonth: null, notes: drafts.note || null,
  }, 'crm.analysis.manage')
}
function addAddress() {
  return createRelation('addresses', {
    contactId: null, countryId: null, addressType: drafts.addressType,
    addressText: drafts.addressText, location: null,
  }, 'crm.account.update')
}
function addNote() {
  return createRelation('notes', { noteText: drafts.note }, 'crm.activity.update')
}
function addNegotiation() {
  return createRelation('negotiations', {
    pricingQuoteId: drafts.quoteId || null, status: 'Open',
    changeSummary: drafts.summary, agreedTerms: null, nextActionAt: null,
  }, 'crm.opportunity.update')
}

function back() { router.push('/crm/' + section.value) }
onBeforeRouteLeave(() => {
  if (saving.value) return window.confirm(t('crm.leaveDuringSave'))
  if (accountEditingDirty.value) return window.confirm('Hay cambios en la ficha sin guardar. ¿Querés salir sin guardarlos?')
  return true
})
watch([id, section], () => { void load() })
watch(() => [route.query.edit, section.value], ([edit]) => {
  showAccountEditor.value = section.value === 'accounts' && edit === '1' && can('crm.account.update')
}, { immediate: true })
watch(relation, () => { showRelationForm.value = false; if (relation.value) void loadRelation() })
watch(success, value => { if (value) showRelationForm.value = false })
onMounted(() => { if (crmEnabled()) void load() })
</script>

<template>
  <main class="mx-auto w-full text-[var(--dh-text)]" :class="section === 'accounts' ? 'max-w-[1750px] space-y-3 p-2 sm:p-4' : 'max-w-6xl space-y-5 p-3 sm:p-6'" data-crm-detail>
    <DhButton :label="t('crm.back')" :icon="ArrowLeft" variant="secondary" @click="back" />
    <p v-if="error" role="alert" class="crm-error">{{ error }}</p>
    <p v-if="section === 'accounts' && route.query.onboarding === 'partial'" role="alert"
      class="rounded-xl border border-amber-500/40 bg-[var(--dh-card)] p-3 text-xs text-[var(--dh-text)]">
      La cuenta se guardó correctamente, pero no se pudo agregar {{ String(route.query.missing || 'algún registro relacionado') }}.
      Podés completar esos datos desde «Gestionar contactos, crédito, contratos y otros registros», sin crear otra cuenta.
    </p>
    <p v-if="success" role="status" class="text-sm text-emerald-600">{{ success }}</p>
    <p v-if="loading" role="status">{{ t('common.loading') }}</p>
    <template v-if="record">
      <section :class="section === 'accounts' ? 'space-y-0' : 'crm-panel space-y-3 p-4 sm:p-5'">
        <DhPageHeader v-if="section !== 'accounts'" :icon="BriefcaseBusiness"
          :title="String(record.displayName ?? record.name ?? record.title ?? record.subject ?? record.marketCode ?? record.id)"
          :subtitle="t('crm.version') + ' ' + record.rowVersion + ' · ID ' + record.id" hide-excel-export />
        <DhDrawer :open="showExecutiveDrawer" title="Asignar ejecutivo comercial" size="md" @close="showExecutiveDrawer=false">
          <form class="space-y-4" @submit.prevent="reassignExecutive">
            <CrmExecutivePicker :model-value="selectedExecutive" label="Ejecutivo"
              @update:model-value="selectedExecutive=$event" />
            <label class="block text-xs font-bold text-[var(--dh-text-muted)]">
              Motivo de reasignación
              <input v-model.trim="executiveReason" class="crm-input mt-2" maxlength="1000" />
            </label>
            <div class="flex justify-end gap-2">
              <DhButton label="Cancelar" variant="secondary" @click="showExecutiveDrawer=false" />
              <DhButton label="Asignar" type="submit" :loading="saving" :disabled="!selectedExecutive" />
            </div>
          </form>
        </DhDrawer>
        <CrmAccountHub v-if="section === 'accounts'" :account="record"
          :editing="showAccountEditor && can('crm.account.update')"
          @change-executive="openExecutiveDrawer" @edit-account="toggleAccountEditing"
          @manage-related="openRelatedManagement" @logo-updated="load" />
        <CrmAccountEditor v-if="section === 'accounts' && showAccountEditor && can('crm.account.update')"
          :account="record" :open="true" @close="leaveAccountEditing"
          @dirty-change="accountEditingDirty=$event"
          @saved="load" @manage-related="openRelatedManagement" />
        <dl v-else-if="section !== 'accounts'" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <template v-for="[key, value] in Object.entries(record).filter(([key]) =>
            !['id','rowVersion','createdByUserId','updatedByUserId'].includes(key) &&
            !key.toLowerCase().includes('hash') && !key.toLowerCase().includes('payload'))" :key="key">
            <div class="rounded-xl border border-[var(--dh-border)] p-3">
              <dt class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ key }}</dt>
              <dd class="break-words text-sm">{{ value ?? '—' }}</dd>
            </div>
          </template>
        </dl>
      </section>

      <section v-if="section === 'leads' && can('crm.lead.convert')" class="crm-panel space-y-3 p-4">
        <h2 class="font-bold">{{ t('crm.convert') }}</h2>
        <input v-model="drafts.reason" class="crm-input" :placeholder="t('crm.notes')" />
        <button class="crm-action" :disabled="saving" @click="convertLead">{{ t('crm.convert') }}</button>
      </section>

      <section v-if="section === 'opportunities'" class="crm-panel space-y-3 p-4">
        <h2 class="font-bold">{{ t('crm.pipeline') }}</h2>
        <div class="grid gap-3 sm:grid-cols-[1fr,2fr,auto]">
          <select v-model="drafts.stageId" class="crm-input" :aria-label="t('crm.stage')">
            <option value="">{{ t('crm.choose') }}</option>
            <option v-for="s in stages" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <input v-model="drafts.reason" class="crm-input" :placeholder="t('crm.reason')" />
          <button v-if="can('crm.opportunity.update')" class="crm-action" :disabled="saving" @click="stageMove">{{ t('crm.moveStage') }}</button>
        </div>
        <button v-if="can('crm.opportunity.close')" class="crm-action" :disabled="saving" @click="closeOpportunity">{{ t('crm.closeOpportunity') }}</button>
      </section>

      <section v-if="section === 'activities' && can('crm.activity.update')" class="crm-panel space-y-3 p-4">
        <h2 class="font-bold">{{ t('crm.activityActions') }}</h2>
        <input v-model="drafts.outcome" class="crm-input" :placeholder="t('crm.outcome')" />
        <textarea v-model="drafts.note" class="crm-input" :placeholder="t('crm.notes')" />
        <button class="crm-action" :disabled="saving" @click="completeActivity">{{ t('crm.complete') }}</button>
        <input v-model="drafts.date" type="datetime-local" class="crm-input" />
        <input v-model="drafts.reason" class="crm-input" :placeholder="t('crm.reason')" />
        <button class="crm-action" :disabled="saving" @click="rescheduleActivity">{{ t('crm.reschedule') }}</button>
        <button class="crm-action" :disabled="saving" @click="perform('cancel',{expectedVersion:version(),reason:drafts.reason||'Cancelado'},'crm.activity.update')">{{ t('crm.cancelActivity') }}</button>
      </section>

      <section v-if="section === 'followups' && can('crm.task.manage')" class="crm-panel space-y-3 p-4">
        <h2 class="font-bold">{{ t('crm.followupActions') }}</h2>
        <input v-model="drafts.outcome" class="crm-input" :placeholder="t('crm.outcome')" />
        <button class="crm-action" :disabled="saving" @click="completeFollowup">{{ t('crm.complete') }}</button>
        <input v-model="drafts.date" type="datetime-local" class="crm-input" />
        <input v-model="drafts.reason" class="crm-input" :placeholder="t('crm.reason')" />
        <button class="crm-action" :disabled="saving" @click="rescheduleFollowup">{{ t('crm.reschedule') }}</button>
        <button class="crm-action" :disabled="saving" @click="perform('cancel',{expectedVersion:version(),reason:drafts.reason||'Cancelado'},'crm.task.manage')">{{ t('crm.cancelActivity') }}</button>
      </section>

      <section v-if="section === 'accounts' && !showAccountEditor" id="crm-related-management"
        class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]"
        data-crm-account-advanced>
        <div class="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div class="flex min-w-0 items-start gap-3">
            <div class="rounded-xl bg-[var(--dh-primary)]/10 p-2.5 text-[var(--dh-primary)]">
              <Settings2 class="h-5 w-5" />
            </div>
            <div class="min-w-0">
              <h2 class="text-sm font-extrabold sm:text-base">Gestión de la cuenta</h2>
              <p class="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--dh-text-muted)]">
                Contactos, direcciones, actividad comercial, crédito y seguimientos: todo vinculado al cliente.
              </p>
            </div>
          </div>
          <button type="button"
            class="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-bold hover:border-[var(--dh-primary)] hover:text-[var(--dh-primary)]"
            :aria-expanded="showAdvancedAccountManagement" aria-controls="crm-advanced-sections"
            @click="showAdvancedAccountManagement = !showAdvancedAccountManagement">
            {{ showAdvancedAccountManagement ? 'Ocultar secciones' : 'Ver y gestionar secciones' }}
            <ChevronDown class="h-4 w-4 transition-transform" :class="showAdvancedAccountManagement && 'rotate-180'" />
          </button>
        </div>
        <div v-if="showAdvancedAccountManagement" id="crm-advanced-sections"
          class="border-t border-[var(--dh-border)] p-3 sm:p-4">
          <p class="mb-3 text-xs leading-relaxed text-[var(--dh-text-muted)]">
            Elegí qué información querés consultar o actualizar. Los registros se guardan en esta cuenta.
          </p>
          <nav class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-label="Secciones de gestión de la cuenta">
            <button v-for="option in accountRelationOptions.filter(item => permitted(item.key))" :key="option.key"
              type="button" :aria-current="relation === option.key ? 'page' : undefined"
              :aria-pressed="relation === option.key"
              class="group flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
              :class="relation === option.key
                ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10 text-[var(--dh-primary)] shadow-sm'
                : 'border-[var(--dh-border)] bg-[var(--dh-shell)] hover:border-[var(--dh-primary)]/50'"
              @click="relation = option.key">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--dh-card)]">
                <component :is="option.icon" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-xs font-extrabold">{{ option.label }}</span>
                <span class="mt-1 block text-[11px] leading-snug text-[var(--dh-text-muted)]">{{ option.subtitle }}</span>
              </span>
              <ChevronDown class="h-3.5 w-3.5 shrink-0 -rotate-90 text-[var(--dh-text-muted)]" />
            </button>
          </nav>
        </div>
      </section>
      <nav v-if="section !== 'accounts'" class="flex flex-wrap gap-2" aria-label="CRM">
        <button v-for="tab in tabs.filter(permitted)" :key="tab" class="crm-action"
          :aria-pressed="relation===tab" @click="relation=tab">
          {{ ({
            contacts: 'Contactos',
            addresses: 'Direcciones',
            'business-activities': 'Actividades económicas',
            'trade-profiles': 'Rutas habituales',
            'credit-profiles': 'Perfiles de crédito',
            'credit-contracts': 'Contratos de crédito',
            'followup-policy': 'Política de seguimiento',
            routes: 'Rutas', services: 'Servicios',
          } as Record<string, string>)[tab] ?? tab }}
        </button>
      </nav>
      <section v-if="relation && permitted(relation) && (section !== 'accounts' || (showAdvancedAccountManagement && !showAccountEditor))"
        class="crm-panel space-y-4 p-4 sm:p-5" :data-crm-advanced-content="section === 'accounts' ? relation : undefined">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--dh-border)] pb-4">
          <div class="min-w-0">
            <p v-if="section === 'accounts'" class="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--dh-primary)]">Información complementaria</p>
            <h3 class="text-base font-extrabold">
              {{ section === 'accounts' ? (accountRelationInfo?.label ?? relation) : relation }}
              <span class="ml-1 text-xs font-medium text-[var(--dh-text-muted)]">({{ relationRows.length }})</span>
            </h3>
            <p v-if="section === 'accounts'" class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">{{ accountRelationInfo?.description }}</p>
          </div>
          <DhButton v-if="canAddRelation" :icon="Plus"
            :label="section === 'accounts' && relation === 'contacts' ? 'Nuevo contacto' : t('common.create')"
            @click="showRelationForm = true" />
        </div>
        <div v-if="!relationRows.length"
          class="rounded-xl border border-dashed border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-8 text-center">
          <p class="text-sm font-semibold">{{ section === 'accounts' ? (accountRelationInfo?.empty ?? 'Sin información registrada.') : t('common.noData') }}</p>
          <p v-if="section === 'accounts' && canAddRelation" class="mt-2 text-xs text-[var(--dh-text-muted)]">Podés agregar el primer registro con el botón de arriba.</p>
        </div>
        <div v-for="item in relationRows" :key="item.id"
          class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 text-sm sm:p-4">
          <template v-if="section === 'accounts' && relation === 'contacts'">
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dh-primary)]/10 text-xs font-extrabold text-[var(--dh-primary)]">
                {{ String(item.name ?? '?').trim().slice(0,2).toUpperCase() }}
              </div>
              <div class="min-w-0 flex-1 space-y-1">
                <RouterLink v-if="can('crm.contact.read')" :to="'/crm/contacts/' + encodeURIComponent(String(item.id))"
                  class="block truncate text-sm font-extrabold hover:text-[var(--dh-primary)] hover:underline">
                  {{ item.name || 'Contacto' }}
                </RouterLink>
                <p v-else class="font-extrabold">{{ item.name || 'Contacto' }}</p>
                <p v-if="item.jobTitle" class="text-xs text-[var(--dh-text-muted)]">{{ item.jobTitle }}</p>
              </div>
              <span v-if="item.isPrimary" class="rounded-full border border-[var(--dh-primary)]/40 bg-[var(--dh-primary)]/10 px-2 py-1 text-[10px] font-semibold text-[var(--dh-primary)]">Contacto principal</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-3 border-t border-[var(--dh-border)] pt-3 text-xs">
              <a v-if="item.email" :href="'mailto:' + String(item.email)"
                class="inline-flex items-center gap-1.5 text-[var(--dh-text-muted)] hover:text-[var(--dh-primary)]">
                <Mail class="h-3.5 w-3.5" />{{ item.email }}
              </a>
              <a v-if="item.phone" :href="'tel:' + String(item.phone)"
                class="inline-flex items-center gap-1.5 text-[var(--dh-text-muted)] hover:text-[var(--dh-primary)]">
                <Phone class="h-3.5 w-3.5" />{{ item.phone }}
              </a>
              <span v-if="!item.email && !item.phone" class="text-[var(--dh-text-muted)]">Sin medios de contacto</span>
            </div>
          </template>
          <template v-else-if="relation === 'business-activities'">
            <div class="flex items-start gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]"><Activity class="h-4 w-4" /></div>
              <div class="min-w-0">
                <p class="text-sm font-extrabold">{{ item.activityCode ?? item.code ?? 'Actividad económica' }}</p>
                <p class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">{{ item.activityDescription ?? item.description ?? 'Sin descripción registrada' }}</p>
              </div>
            </div>
          </template>
          <template v-else-if="relation === 'addresses'">
            <div class="flex items-start gap-3">
              <MapPin class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
              <div class="min-w-0"><p class="text-sm font-bold">{{ item.addressText ?? 'Dirección sin especificar' }}</p>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ item.addressType === 'WORK' ? 'Oficina / trabajo' : item.addressType === 'BILLING' ? 'Facturación' : item.addressType ?? 'Dirección de la cuenta' }}</p>
              </div>
            </div>
          </template>
          <template v-else>
            <p class="font-bold">{{ item.name ?? item.activityCode ?? item.quoteNumberSnapshot ?? item.serviceCode ?? item.status ?? item.addressText ?? 'Registro' }}</p>
            <p v-if="item.activityDescription || item.email || item.reason || item.paymentTerms || item.statusSnapshot"
              class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">
              {{ item.activityDescription ?? item.email ?? item.reason ?? item.paymentTerms ?? item.statusSnapshot }}
            </p>
          </template>
          <div v-if="relation==='credit-profiles' && section==='accounts' && item.status==='PendingApproval'
            && can('crm.credit.approve')" class="mt-3 flex flex-wrap gap-2">
            <button :disabled="saving" class="crm-action"
              @click="actOnChild(item,'approve','crm.credit.approve',{reason:drafts.reason||'Aprobación financiera'})">
              {{ t('crm.approveCredit') }}
            </button>
            <button :disabled="saving" class="crm-action"
              @click="actOnChild(item,'reject','crm.credit.approve',{reason:drafts.reason||'Rechazo financiero'})">
              {{ t('crm.rejectCredit') }}
            </button>
          </div>
          <div v-if="relation==='credit-contracts' && section==='accounts' && can('crm.contract.manage')"
            class="mt-3 flex flex-wrap gap-2">
            <button v-if="item.status==='Draft'" :disabled="saving" class="crm-action"
              @click="actOnChild(item,'activate','crm.contract.manage',{reason:drafts.reason||'Activación'})">
              {{ t('crm.activateContract') }}
            </button>
            <button v-if="item.status==='Active'" :disabled="saving" class="crm-action"
              @click="actOnChild(item,'cancel','crm.contract.manage',{reason:drafts.reason||'Cancelación'})">
              {{ t('crm.cancelContract') }}
            </button>
            <button v-if="item.status==='Active' && drafts.renewalDate" :disabled="saving" class="crm-action"
              @click="actOnChild(item,'renew','crm.contract.manage',{
                operationId:drafts.operationId,renewalDate:toUtc(drafts.renewalDate),
                expiryDate:drafts.expiryDate?toUtc(drafts.expiryDate):null,
                reason:drafts.reason||'Renovación'
              })">
              {{ t('crm.renewContract') }}
            </button>
            <button v-if="drafts.fileId" :disabled="saving" class="crm-action"
              @click="actOnChild(item,'signed-document','crm.contract.manage',{fileId:drafts.fileId})">
              {{ t('crm.attachSigned') }}
            </button>
          </div>

        </div>
        <DhDrawer :open="showRelationForm && canAddRelation"
          :title="section === 'accounts'
             ? (relation === 'contacts' ? 'Nuevo contacto' : 'Nuevo · ' + (accountRelationInfo?.label ?? relation))
             : t('common.create') + ' · ' + relation" size="lg" @close="showRelationForm = false">
          <p v-if="error" role="alert" class="mb-3 rounded-xl border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
        <form v-if="section==='accounts' && relation==='addresses' && can('crm.account.update')"
          class="grid gap-3 sm:grid-cols-3" @submit.prevent="addAddress">
          <input v-model.trim="drafts.addressType" class="crm-input" required :placeholder="t('crm.addressType')" />
          <input v-model.trim="drafts.addressText" class="crm-input" required :placeholder="t('crm.address')" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.addAddress') }}</button>
        </form>
        <form v-if="section==='accounts' && relation==='followup-policy' && can('crm.followup.manage')"
          class="grid gap-3 sm:grid-cols-3" @submit.prevent="savePolicy">
          <input v-model.trim="drafts.assignedUserId" class="crm-input" required :placeholder="t('crm.assignedUser')" />
          <input v-model="drafts.date" class="crm-input" type="datetime-local" required />
          <input v-model.trim="drafts.timezoneId" class="crm-input" required />
          <input v-model="drafts.frequencyDays" class="crm-input" type="number" min="1" max="365" required />
          <select v-model="drafts.channelStrategy" class="crm-input">
            <option value="BOTH">System + Email</option><option value="SYSTEM">System</option><option value="EMAIL">Email</option>
          </select>
          <input v-model="drafts.reminderLeadMinutes" class="crm-input" type="number" min="0" max="10080" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.savePolicy') }}</button>
        </form>
        <form v-if="section==='activities' && relation==='notes' && can('crm.activity.update')"
          class="grid gap-3 sm:grid-cols-[1fr,auto]" @submit.prevent="addNote">
          <textarea v-model="drafts.note" required class="crm-input" :placeholder="t('crm.notes')" />
          <button type="submit" class="crm-action" :disabled="saving">{{ t('crm.addNote') }}</button>
        </form>
        <form v-if="section==='analyses' && relation==='services' && can('crm.analysis.manage')"
          class="grid gap-3 sm:grid-cols-4" @submit.prevent="addService">
          <input v-model.trim="drafts.serviceCode" required class="crm-input" :placeholder="t('crm.serviceCode')" />
          <input v-model.trim="drafts.modalityCode" required class="crm-input" placeholder="FCL" />
          <input v-model="drafts.volume" type="number" min="0" step=".01" required class="crm-input" />
          <button type="submit" class="crm-action" :disabled="saving">{{ t('crm.addService') }}</button>
        </form>
        <form v-if="section==='opportunities' && relation==='negotiations' && can('crm.opportunity.update')"
          class="grid gap-3 sm:grid-cols-[1fr,auto]" @submit.prevent="addNegotiation">
          <input v-model.trim="drafts.summary" required class="crm-input" :placeholder="t('crm.negotiationSummary')" />
          <button type="submit" class="crm-action" :disabled="saving">{{ t('crm.addNegotiation') }}</button>
        </form>
        <div v-if="section==='accounts' && relation==='credit-contracts' && can('crm.contract.manage')"
          class="grid gap-3 sm:grid-cols-3">
          <input v-model.trim="drafts.fileId" class="crm-input" :placeholder="t('crm.signedFileId')" />
          <input v-model.trim="drafts.reason" class="crm-input" :placeholder="t('crm.reason')" />
          <input v-model="drafts.renewalDate" type="datetime-local" class="crm-input" />
        </div>
        <CrmContactForm v-if="section==='accounts' && relation==='contacts' && showRelationForm && can('crm.contact.create')"
          :account-id="id" @saved="onLinkedContactSaved" @cancel="showRelationForm=false" />
        <form v-if="section==='accounts' && relation==='credit-profiles' && can('crm.credit.manage')"
          class="grid gap-3 sm:grid-cols-3" @submit.prevent="createCredit">
          <input v-model="drafts.creditDays" type="number" min="0" class="crm-input" :placeholder="t('crm.creditDays')" />
          <input v-model="drafts.creditLimit" type="number" min="0" step=".01" class="crm-input" :placeholder="t('crm.creditLimit')" />
          <input v-model="drafts.monthlyFinancingPct" type="number" min="0" max="100" step=".0001" class="crm-input" :placeholder="t('crm.monthlyRate')" />
          <CrmCatalogPicker label="Moneda" catalog-group-slug="currencies" value-kind="value" v-model="drafts.currencyCode" />
          <input v-model="drafts.paymentConditions" class="crm-input" :placeholder="t('crm.paymentTerms')" />
          <input v-model="drafts.renewalDate" type="datetime-local" class="crm-input" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.proposeCredit') }}</button>
        </form>
        <form v-if="section==='accounts' && relation==='credit-contracts' && can('crm.contract.manage')"
          class="grid gap-3 sm:grid-cols-3" @submit.prevent="createContract">
          <input v-model="drafts.contractNumber" class="crm-input" :placeholder="t('crm.contractNumber')" />
          <input v-model="drafts.startDate" required type="datetime-local" class="crm-input" />
          <input v-model="drafts.renewalDate" required type="datetime-local" class="crm-input" />
          <input v-model="drafts.expiryDate" type="datetime-local" class="crm-input" />
          <input v-model="drafts.paymentConditions" class="crm-input" :placeholder="t('crm.paymentTerms')" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.createContract') }}</button>
        </form>
        <form v-if="section==='opportunities' && relation==='quotes' && can('crm.quote.link')"
          class="grid gap-3 sm:grid-cols-3" @submit.prevent="linkQuote">
          <input v-model.trim="drafts.quoteId" required class="crm-input" :placeholder="t('crm.quoteId')" />
          <input v-model.trim="drafts.pricingRequestId" class="crm-input" :placeholder="t('crm.pricingRequestId')" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.linkQuote') }}</button>
        </form>
        <form v-if="section==='opportunities' && relation==='rate-requests' && can('crm.quote.link')"
          class="grid gap-3 sm:grid-cols-2" @submit.prevent="createPricingRequest">
          <select v-model="drafts.priority" class="crm-input">
            <option v-for="p in ['Green','Yellow','Red']" :key="p">{{ p }}</option>
          </select>
          <input v-model="drafts.shipmentMode" class="crm-input" :placeholder="t('crm.shipmentMode')" required />
          <input v-model="drafts.originName" class="crm-input" :placeholder="t('crm.origin')" required />
          <input v-model="drafts.destinationName" class="crm-input" :placeholder="t('crm.destination')" />
          <textarea v-model="drafts.payload" class="crm-input sm:col-span-2" rows="3" :aria-label="t('crm.pricingPayload')" />
          <p class="text-xs text-[var(--dh-text-muted)] sm:col-span-2">{{ t('crm.pricingRequestWarning') }}</p>
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.createPricingRequest') }}</button>
        </form>
        <form v-if="section==='analyses' && relation==='routes' && can('crm.analysis.manage')"
          class="grid gap-3 sm:grid-cols-4" @submit.prevent="createRoute">
          <CrmCatalogPicker label="POL · Puerto de origen" catalog-group-slug="pol" value-kind="code"
            v-model="drafts.polCode" />
          <CrmCatalogPicker label="POE · Puerto de entrada" catalog-group-slug="poe" value-kind="code"
            v-model="drafts.poeCode" />
          <CrmCatalogPicker label="POD · Puerto de destino" catalog-group-slug="pod" value-kind="code"
            v-model="drafts.podCode" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.addRoute') }}</button>
        </form>
        <form v-if="section==='settings' && relation==='stages' && can('crm.settings.manage')"
          class="grid gap-3 sm:grid-cols-3" @submit.prevent="createStage">
          <input v-model="drafts.contactName" required class="crm-input" :placeholder="t('crm.stageName')" />
          <input v-model="drafts.volume" type="number" min="0" class="crm-input" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.addStage') }}</button>
        </form>
        </DhDrawer>
      </section>
    </template>
  </main>
</template>

<style scoped>
.crm-panel{border:1px solid var(--dh-border);border-radius:1.25rem;background:var(--dh-card)}
.crm-action{border:1px solid var(--dh-border);border-radius:.75rem;padding:.6rem .95rem;font-weight:700;min-height:42px;color:var(--dh-text)}
.crm-action:disabled{opacity:.5}.crm-action[aria-pressed=true]{background:var(--dh-primary);color:#fff}
.crm-input{min-width:0;width:100%;background:var(--dh-card);color:var(--dh-text);border:1px solid var(--dh-border);border-radius:.75rem;padding:.6rem}
.crm-error{border:1px solid #da8d79;border-radius:.75rem;padding:.8rem}
</style>

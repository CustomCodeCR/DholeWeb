<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
const relationRows = ref<CrmRow[]>([])
const relation = ref('')
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
  if (section.value === 'accounts') return ['contacts', 'addresses', 'trade-profiles', 'credit-profiles', 'credit-contracts', 'followup-policy']
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
  if (tab === 'trade-profiles') return can('crm.analysis.read')
  if (tab === 'quotes' || tab === 'rate-requests') return can('crm.quote.read')
  return true
}
function endpoint(tab: string) {
  if (tab === 'stages') return crmPath('pipelines', id.value, 'stages')
  if (tab === 'contacts' && section.value === 'accounts') return crmPath('accounts', id.value, 'contacts')
  if (tab === 'contacts') return crmPath('opportunities', id.value, 'contacts')
  if (tab === 'addresses' || tab === 'trade-profiles' || tab === 'credit-profiles' ||
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
function version() { return Number(record.value?.rowVersion ?? 0) }
async function createRelation(tab: string, body: unknown, requiredScope: string) {
  if (!can(requiredScope) || saving.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    await crmRequest(endpoint(tab), 'POST', body, crmUuid())
    await loadRelation(); success.value = t('crm.saved')
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
async function createContact() {
  if (!drafts.contactName.trim()) { error.value = t('crm.required'); return }
  await createRelation('contacts', {
    name: drafts.contactName, email: drafts.contactEmail || null, jobTitle: null,
    countryId: null, phone: null, relationRole: 'COMMERCIAL', isPrimary: false,
  }, 'crm.contact.create')
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
  if (!saving.value) return true
  return window.confirm(t('crm.leaveDuringSave'))
})
watch([id, section], () => { void load() })
watch(relation, () => { if (relation.value) void loadRelation() })
onMounted(() => { if (crmEnabled()) void load() })
</script>

<template>
  <main class="mx-auto max-w-6xl space-y-5 p-3 text-[var(--dh-text)] sm:p-6" data-crm-detail>
    <button type="button" class="crm-action" @click="back">← {{ t('crm.back') }}</button>
    <p v-if="error" role="alert" class="crm-error">{{ error }}</p>
    <p v-if="success" role="status" class="text-sm text-emerald-600">{{ success }}</p>
    <p v-if="loading" role="status">{{ t('common.loading') }}</p>
    <template v-if="record">
      <section class="crm-panel space-y-3 p-5">
        <h1 class="text-2xl font-black">{{ record.displayName ?? record.name ?? record.title ?? record.subject ?? record.marketCode ?? record.id }}</h1>
        <p class="text-sm text-[var(--dh-text-muted)]">{{ t('crm.version') }} {{ record.rowVersion }} · ID {{ record.id }}</p>
        <dl class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

      <nav class="flex flex-wrap gap-2" aria-label="CRM">
        <button v-for="tab in tabs.filter(permitted)" :key="tab" class="crm-action"
          :aria-pressed="relation===tab" @click="relation=tab">{{ tab }}</button>
      </nav>
      <section v-if="relation && permitted(relation)" class="crm-panel space-y-4 p-4">
        <h2 class="text-lg font-bold">{{ relation }} ({{ relationRows.length }})</h2>
        <div v-if="!relationRows.length" class="text-sm text-[var(--dh-text-muted)]">{{ t('common.noData') }}</div>
        <div v-for="item in relationRows" :key="item.id" class="rounded-xl border border-[var(--dh-border)] p-3 text-sm">
          <p class="font-bold">{{ item.name ?? item.quoteNumberSnapshot ?? item.serviceCode ?? item.status ?? item.id }}</p>
          <button v-if="relation==='contacts' && section==='accounts' && can('crm.contact.read')"
            type="button" class="crm-action mt-2" @click="router.push('/crm/contacts/'+encodeURIComponent(item.id))">
            {{ t('common.details') }}
          </button>
          <p class="text-[var(--dh-text-muted)]">{{ item.email ?? item.reason ?? item.paymentTerms ?? item.statusSnapshot ?? '' }}</p>
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
        <form v-if="section==='accounts' && relation==='contacts' && can('crm.contact.create')"
          class="grid gap-3 sm:grid-cols-3" @submit.prevent="createContact">
          <input v-model.trim="drafts.contactName" required class="crm-input" :placeholder="t('crm.contactName')" />
          <input v-model.trim="drafts.contactEmail" type="email" class="crm-input" :placeholder="t('crm.email')" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.addContact') }}</button>
        </form>
        <form v-if="section==='accounts' && relation==='credit-profiles' && can('crm.credit.manage')"
          class="grid gap-3 sm:grid-cols-3" @submit.prevent="createCredit">
          <input v-model="drafts.creditDays" type="number" min="0" class="crm-input" :placeholder="t('crm.creditDays')" />
          <input v-model="drafts.creditLimit" type="number" min="0" step=".01" class="crm-input" :placeholder="t('crm.creditLimit')" />
          <input v-model="drafts.monthlyFinancingPct" type="number" min="0" max="100" step=".0001" class="crm-input" :placeholder="t('crm.monthlyRate')" />
          <input v-model="drafts.currencyCode" class="crm-input" placeholder="USD" />
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
          <input v-model="drafts.polCode" class="crm-input" placeholder="POL" />
          <input v-model="drafts.poeCode" class="crm-input" placeholder="POE" />
          <input v-model="drafts.podCode" class="crm-input" placeholder="POD" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.addRoute') }}</button>
        </form>
        <form v-if="section==='settings' && relation==='stages' && can('crm.settings.manage')"
          class="grid gap-3 sm:grid-cols-3" @submit.prevent="createStage">
          <input v-model="drafts.contactName" required class="crm-input" :placeholder="t('crm.stageName')" />
          <input v-model="drafts.volume" type="number" min="0" class="crm-input" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.addStage') }}</button>
        </form>
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

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { BriefcaseBusiness, Plus, RefreshCw } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhSwitch, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhDrawer, DhPageHeader } from '@/shared/components/organisms'
import CrmReferencePicker from '../components/CrmReferencePicker.vue'
import CrmExecutivePicker from '../components/CrmExecutivePicker.vue'
import CrmCatalogPicker from '../components/CrmCatalogPicker.vue'
import CrmHaciendaLookup, { type HaciendaResult } from '../components/CrmHaciendaLookup.vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/core/stores/authStore'
import { useRequiredFieldFeedback } from '@/core/composables/useRequiredFieldFeedback'
import { useI18n } from 'vue-i18n'
import { CRM_MODULES, crmDefaults, crmPayload, type CrmSection } from '../model/crmForms'
import { crmAction, crmCreate, crmEnabled, crmError, crmList, crmPatch,
  crmRequest, crmUuid, crmPath, fromUtc, type CrmRow } from '../services/crmApi'
import { crmSectionScope } from '../model/crmForms'
import { crmAgendaDays, crmAgendaRecordsForDay } from '../model/crmAgenda'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { t, locale } = useI18n()
const section = computed(() => String(route.meta.crmSection || 'dashboard') as CrmSection)
const model = computed(() => CRM_MODULES[section.value])
const pageTitle = computed(() => section.value === 'dashboard' ? t('crm.dashboard') : section.value === 'finance' ? t('crm.finance') : model.value?.title ?? t('crm.title'))
const formTitle = computed(() => `${edited.value ? t('common.edit') : t('common.create')} · ${model.value?.title ?? ''}`)
const referenceResources: Record<string, 'accounts' | 'leads' | 'opportunities'> = {
  accountId: 'accounts', leadId: 'leads', opportunityId: 'opportunities',
}
const referenceScopes: Record<string, string[]> = {
  accountId: ['crm.account.read', 'crm.account.read-all'],
  leadId: ['crm.lead.read', 'crm.lead.read-all'],
  opportunityId: ['crm.opportunity.read', 'crm.opportunity.read-all'],
}
const canSelectReference = (key: string) => (referenceScopes[key] ?? []).some(scope => auth.hasScope(scope))
const catalogFields: Record<string, { slug: string; kind: 'id' | 'code' | 'value' }> = {
  countryId: { slug: 'countries', kind: 'id' },
  currencyCode: { slug: 'currencies', kind: 'value' },
}
function applyHacienda(result: HaciendaResult) {
  // Never overwrite a manually-entered commercial name.
  form.legalName = result.name
  if (!String(form.displayName ?? '').trim()) form.displayName = result.name
  if (result.identificationType) form.taxIdTypeCode = result.identificationType
}

const columns = computed<DhTableColumn<CrmRow>[]>(() => {
  const action = { key: 'actions', label: t('common.actions'), align: 'right' as const }
  if (section.value === 'accounts') return [
    { key: '_crmTitle', label: 'Cliente' },
    { key: '_crmDescription', label: 'Razón social' },
    { key: '_crmTax', label: 'Identificación' },
    { key: '_crmType', label: 'Tipo de cliente' },
    { key: '_crmStatus', label: t('common.status') },
    action,
  ]
  if (section.value === 'leads') return [
    { key: '_crmTitle', label: 'Prospecto' },
    { key: '_crmDescription', label: 'Empresa' },
    { key: '_crmEmail', label: 'Correo' },
    { key: '_crmStatus', label: t('common.status') },
    action,
  ]
  return [
    { key: '_crmTitle', label: t('common.name') },
    { key: '_crmDescription', label: t('common.description') },
    { key: '_crmStatus', label: t('common.status') },
    action,
  ]
})
const tableRows = computed(() => rows.value.map(item => ({
  ...item,
  _crmTitle: String(item[model.value?.primary ?? 'contractNumber'] ?? item.contractNumber ?? item.id),
  _crmDescription: String(item[model.value?.secondary ?? 'paymentTerms'] ?? '—'),
  _crmStatus: String(item.status ?? item.qualificationStatus ?? '—'),
  _crmTax: String(item.taxId ?? '—'),
  _crmType: item.customerTypeCode === 'credit' ? 'Crédito' : item.customerTypeCode === 'cash' ? 'Contado' : '—',
  _crmEmail: String(item.contactEmail ?? '—'),
})))
const can = (scope: string) => auth.hasScope(scope)
const allowed = computed(() => crmEnabled() && crmSectionScope[section.value].some(can))
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const rows = ref<CrmRow[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const showForm = ref(false)
const pendingCreateKey = ref(crmUuid())
const edited = ref<CrmRow | null>(null)
const form = reactive<Record<string, unknown>>({})
const requiredFields = computed(() => (model.value?.fields ?? [])
  .filter(field => field.required && (form[field.key] == null || String(form[field.key]).trim() === ''))
  .map(field => ({ key: field.key, label: field.label })))
const { fieldError, isInvalid, resetValidation, validateRequiredFields } =
  useRequiredFieldFeedback(() => requiredFields.value)
const pipelineStages = ref<CrmRow[]>([])
const pipelineId = ref('')
const viewMode = ref<'table' | 'kanban' | 'week'>('table')
const selectedAccount = ref('')
const financeQuery = ref('')
const financeAccounts = ref<CrmRow[]>([])
const financeAccountsTotal = ref(0)
const financeAccountsLoading = ref(false)
const financeTab = ref<'credit' | 'contracts'>(can('crm.credit.read') ? 'credit' : 'contracts')
const dashboard = reactive({ accounts: 0, leads: 0, opportunities: 0, activities: 0, weighted: 0, loaded: false })
const configWarning = ref('')

function beginCreate() {
  resetValidation()
  pendingCreateKey.value = crmUuid()
  edited.value = null
  Object.keys(form).forEach(key => delete form[key])
  Object.assign(form, crmDefaults(section.value))
  if (section.value === 'followups') form.assignedUserId = auth.userId ?? ''
  if (section.value === 'accounts') form.executiveUserId = auth.userId ?? ''
  showForm.value = true
}
function beginEdit(item: CrmRow) {
  resetValidation()
  edited.value = item
  Object.keys(form).forEach(key => delete form[key])
  for (const f of model.value?.fields ?? []) {
    form[f.key] = f.type === 'datetime-local' ? fromUtc(item[f.key]) : item[f.key] ?? (f.type === 'checkbox' ? false : '')
  }
  showForm.value = true
}
function canCreate() {
  return !!model.value?.createScope && can(model.value.createScope)
}
function canEdit() {
  return !!model.value?.updateScope && can(model.value.updateScope)
}
function details(item: CrmRow) {
  router.push({ path: '/crm/' + section.value + '/' + encodeURIComponent(item.id) })
}
async function loadDashboard() {
  const modules = ['accounts', 'leads', 'opportunities', 'activities'] as const
  const granted = modules.filter(name => crmSectionScope[name].some(can))
  // Only ask for data that the authenticated user is already allowed to query.
  const replies = await Promise.allSettled(granted.map(async key => {
    const response = await crmList(key, { page: 1, pageSize: 100 })
    return { key, response }
  }))
  dashboard.accounts = 0; dashboard.leads = 0
  dashboard.opportunities = 0; dashboard.activities = 0; dashboard.weighted = 0
  configWarning.value = ''
  for (const reply of replies) {
    if (reply.status !== 'fulfilled') {
      configWarning.value = t('crm.partialDashboard')
      continue
    }
    const { key, response } = reply.value
    if (key === 'accounts') dashboard.accounts = response.total
    if (key === 'leads') dashboard.leads = response.total
    if (key === 'opportunities') {
      dashboard.opportunities = response.total
      // Not a forecast for the entire organization if pagination truncates results.
      if (response.total <= response.items.length) {
        dashboard.weighted = response.items.reduce((sum, item) =>
          sum + Number(item.amountEstimated || 0) * Number(item.probabilityPct || 0) / 100, 0)
      } else configWarning.value = t('crm.partialDashboard')
    }
    if (key === 'activities') dashboard.activities = response.total
  }
  dashboard.loaded = true
}
async function loadFinanceAccounts() {
  if (!can('crm.account.read') && !can('crm.account.read-all')) {
    financeAccounts.value = []
    financeAccountsTotal.value = 0
    return
  }
  financeAccountsLoading.value = true
  try {
    // Search is always scoped server-side to the user's authorized account records.
    const result = await crmList('accounts', { q: financeQuery.value.trim(), page: 1, pageSize: 50 })
    financeAccounts.value = result.items
    financeAccountsTotal.value = result.total
    if (selectedAccount.value && !result.items.some(account => account.id === selectedAccount.value)) {
      selectedAccount.value = ''
    }
  } catch (e) {
    financeAccounts.value = []
    financeAccountsTotal.value = 0
    error.value = crmError(e)
  } finally {
    financeAccountsLoading.value = false
  }
}
async function loadFinance() {
  if (!selectedAccount.value) { rows.value = []; total.value = 0; return }
  const endpoint = '/api/crm/accounts/' + encodeURIComponent(selectedAccount.value) +
    (financeTab.value === 'credit' ? '/credit-profiles' : '/credit-contracts')
  const list = await crmRequest<CrmRow[]>(endpoint)
  rows.value = list
  total.value = list.length
}
async function loadStages() {
  if (!crmSectionScope.opportunities.some(can)) return
  const pipelines = await crmRequest<CrmRow[]>(crmPath('pipelines'))
  const selected = pipelines.find(p => p.isDefault === true) ?? pipelines[0]
  if (selected?.id) {
    pipelineId.value = selected.id
    pipelineStages.value = await crmRequest<CrmRow[]>(crmPath('pipelines', selected.id, 'stages'))
  }
}
async function load() {
  error.value = ''; success.value = ''
  if (!allowed.value) return
  loading.value = true
  try {
    if (section.value === 'dashboard') await loadDashboard()
    else if (section.value === 'finance') { await loadFinanceAccounts(); await loadFinance() }
    else if (section.value === 'settings') {
      rows.value = await crmRequest<CrmRow[]>(crmPath('pipelines'))
      total.value = rows.value.length
    } else {
      const response = await crmList(model.value!.resource, {
        page: page.value, pageSize: 25, q: search.value.trim(),
        ...(section.value === 'opportunities' && pipelineId.value ? { pipelineId: pipelineId.value } : {}),
      })
      rows.value = response.items
      total.value = response.total
      if (section.value === 'opportunities') await loadStages()
    }
  } catch (e) { error.value = crmError(e); rows.value = [] }
  finally { loading.value = false }
}
async function save() {
  if (!model.value || saving.value) return
  if (!validateRequiredFields()) return
  error.value = ''; saving.value = true
  try {
    let body = crmPayload(section.value, form, edited.value ?? undefined)
    if (section.value === 'followups') body = {
      ...body, assignedUserId: String(form.assignedUserId || auth.userId || ''),
    }
    if (section.value === 'accounts' && edited.value) {
      body.categoryType = edited.value.categoryType
      body.categoryCode = edited.value.categoryCode
    }
    if (section.value === 'leads' && edited.value) {
      body.qualificationStatus = edited.value.qualificationStatus || 'New'
    }
    // Editing activities and followups has dedicated commands, not generic PATCH.
    if (edited.value && ['activities', 'followups'].includes(section.value)) {
      throw new Error(t('crm.useDetailActions'))
    }
    if (edited.value) await crmPatch(model.value.resource, edited.value.id, body)
    else await crmCreate(model.value.resource, body, pendingCreateKey.value)
    showForm.value = false
    pendingCreateKey.value = crmUuid()
    await load()
    success.value = t('crm.saved')
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
async function changeStage(item: CrmRow, stageId: string) {
  if (!stageId || !can('crm.opportunity.update')) return
  try {
    await crmAction('opportunities', item.id, 'move-stage', {
      expectedVersion: item.rowVersion, stageId, reason: 'Cambio en tablero CRM',
    })
    await load()
  } catch (e) { error.value = crmError(e) }
}
const stages = computed(() => pipelineStages.value.filter(x => x.isActive !== false))
const kanbanRows = (stageId: string) => rows.value.filter(x => x.stageId === stageId)
const agendaDays = computed(() => crmAgendaDays(new Date(), locale.value === 'en' ? 'en-US' : 'es-CR'))
const agendaForDay = (dateKey: string) => crmAgendaRecordsForDay(rows.value, dateKey)
const financeAllowed = computed(() =>
  financeTab.value === 'credit' ? can('crm.credit.read') : can('crm.contract.read'))
watch([section, financeTab, pipelineId], () => { page.value = 1; showForm.value = false; void load() })
watch(selectedAccount, () => { if (section.value === 'finance') void load() })
onMounted(() => { if (allowed.value) void load() })
</script>

<template>
  <main class="mx-auto w-full max-w-[1600px] space-y-5 p-3 text-[var(--dh-text)] sm:p-6" data-crm-page>
    <DhPageHeader :title="pageTitle" :subtitle="t('crm.title')" :icon="BriefcaseBusiness" hide-excel-export>
      <template #actions>
        <DhButton :icon="RefreshCw" :label="t('common.refresh')" variant="secondary" :disabled="loading" @click="load" />
        <DhButton v-if="model && canCreate() && section !== 'followups'"
          :icon="Plus" :label="t('common.create')" @click="beginCreate" />
        <DhButton v-if="section === 'followups' && can('crm.followup.manage')"
          :icon="Plus" :label="t('crm.newFollowup')" @click="beginCreate" />
      </template>
    </DhPageHeader>
    <p v-if="!allowed" role="alert" class="crm-alert">{{ t('crm.denied') }}</p>
    <template v-else>
      <p v-if="error" role="alert" class="crm-alert">{{ error }}</p>
      <p v-if="success" role="status" class="text-sm text-emerald-600">{{ success }}</p>
      <p v-if="loading" role="status" class="text-sm text-[var(--dh-text-muted)]">{{ t('common.loading') }}</p>
      <template v-if="section === 'dashboard'">
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DhCard v-for="metric in [
            { label: t('crm.accounts'), value: dashboard.accounts },
            { label: t('crm.leads'), value: dashboard.leads },
            { label: t('crm.opportunities'), value: dashboard.opportunities },
            { label: t('crm.activities'), value: dashboard.activities },
            { label: t('crm.weighted'), value: dashboard.weighted.toLocaleString(undefined,{maximumFractionDigits:2}) },
          ]" :key="metric.label">
            <p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ metric.label }}</p>
            <p class="mt-3 text-2xl font-black">{{ dashboard.loaded ? metric.value : '—' }}</p>
          </DhCard>
        </div>
        <p v-if="configWarning" class="text-sm text-amber-700">{{ configWarning }}</p>
        <p class="text-sm text-[var(--dh-text-muted)]">{{ t('crm.dashboardNote') }}</p>
      </template>

      <template v-else-if="section === 'finance'">
        <DhCard class="space-y-4">
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">{{ t('crm.financeSelectAccount') }}</p>
          <form class="flex flex-wrap items-end gap-2" @submit.prevent="loadFinanceAccounts">
            <DhInput class="min-w-[200px] flex-1" :label="t('crm.searchAccounts')"
              :model-value="financeQuery" :placeholder="t('common.search')" :disabled="financeAccountsLoading"
              @update:model-value="financeQuery = $event" />
            <DhButton :label="t('common.search')" type="submit" variant="secondary" :disabled="financeAccountsLoading" />
          </form>
          <DhSelect :label="t('crm.selectAccount')" class="max-w-xl" :model-value="selectedAccount"
            :placeholder="t('crm.choose')" :options="financeAccounts.map(a => ({value: a.id, label: String(a.displayName ?? a.legalName ?? a.id)}))"
            @update:model-value="selectedAccount = String($event)" />
          <p v-if="financeAccountsTotal > financeAccounts.length" class="text-xs text-[var(--dh-text-muted)]">
            {{ t('crm.searchAccountHint') }}
          </p>
          <div class="flex gap-2">
            <DhButton v-if="can('crm.credit.read')" :label="t('crm.credit')"
              :variant="financeTab === 'credit' ? 'primary' : 'secondary'" @click="financeTab='credit'" />
            <DhButton v-if="can('crm.contract.read')" :label="t('crm.contracts')"
              :variant="financeTab === 'contracts' ? 'primary' : 'secondary'" @click="financeTab='contracts'" />
          </div>
        </DhCard>
        <p v-if="!financeAllowed" class="crm-alert">{{ t('crm.denied') }}</p>
      </template>

      <template v-else>
        <div class="flex flex-wrap items-end gap-2">
          <DhInput v-if="section !== 'settings'" class="min-w-[200px] flex-1"
            :model-value="search" :placeholder="t('common.search')"
            @update:model-value="search = $event" @keyup.enter="page=1;load()" />
          <DhButton v-if="section !== 'settings'" :label="t('common.search')" variant="secondary"
            @click="page=1;load()" />
          <DhButton v-if="section === 'opportunities'"
            :label="viewMode === 'kanban' ? t('crm.table') : t('crm.kanban')"
            :variant="viewMode === 'kanban' ? 'primary' : 'secondary'"
            @click="viewMode=viewMode==='kanban'?'table':'kanban'" />
          <DhButton v-if="section === 'followups' || section === 'activities'"
            :label="viewMode === 'week' ? t('crm.table') : t('crm.week')"
            :variant="viewMode === 'week' ? 'primary' : 'secondary'"
            @click="viewMode=viewMode==='week'?'table':'week'" />
        </div>
      </template>

      <div v-if="section === 'opportunities' && viewMode === 'kanban'" class="flex gap-4 overflow-x-auto pb-3">
        <DhCard v-for="stage in stages" :key="stage.id" class="min-w-[260px] flex-1">
          <h2 class="font-bold">{{ stage.name }} ({{ kanbanRows(stage.id).length }})</h2>
          <article v-for="item in kanbanRows(stage.id)" :key="item.id" class="mt-3 rounded-xl border border-[var(--dh-border)] p-3">
            <button class="block text-left font-semibold underline" @click="details(item)">{{ item.title }}</button>
            <p class="text-sm text-[var(--dh-text-muted)]">{{ item.amountEstimated }} {{ item.currencyCode }}</p>
            <select v-if="can('crm.opportunity.update')" class="crm-input mt-2" :value="String(item.stageId)"
              :aria-label="t('crm.stage')" @change="changeStage(item,($event.target as HTMLSelectElement).value)">
              <option v-for="s in stages" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </article>
        </DhCard>
      </div>
      <div v-else-if="section === 'activities' || section === 'followups' ? viewMode === 'week' : false"
        class="space-y-3 rounded-[var(--dh-radius-xl)] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <h2 class="text-lg font-bold">{{ t('crm.week') }}</h2>
        <p v-if="total > rows.length" class="text-sm text-amber-700" role="status">{{ t('crm.partialAgenda', { loaded: rows.length, total }) }}</p>
        <div v-for="day in agendaDays" :key="day.dateKey" class="border-b border-[var(--dh-border)] pb-2">
          <h3 class="text-sm font-bold">{{ day.label }}</h3>
          <button v-for="item in agendaForDay(day.dateKey)" :key="item.id"
            class="block text-sm underline" @click="details(item)">{{ item.subject ?? item.channel }}</button>
        </div>
      </div>
      <div v-else-if="section !== 'dashboard'" class="space-y-3">
        <DhDataTable :columns="columns" :rows="tableRows" :loading="loading" :empty-text="t('common.noData')" @row-click="section !== 'finance' && details($event)">
          <template #cell-_crmTitle="{ value }">
            <span class="font-bold text-[var(--dh-text)]">{{ value }}</span>
          </template>
          <template #cell-_crmDescription="{ value }">
            <span class="line-clamp-2 text-[var(--dh-text-muted)]">{{ value }}</span>
          </template>
          <template #cell-_crmStatus="{ value }">
            <span class="inline-flex max-w-48 truncate rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-2.5 py-1 text-xs font-bold">
              {{ value }}
            </span>
          </template>
          <template #cell-actions="{ row }">
            <div v-if="section !== 'finance'" class="flex flex-wrap justify-end gap-1">
              <DhButton :label="t('common.details')" size="sm" variant="ghost" @click="details(row)" />
              <DhButton v-if="canEdit() && !['activities','followups'].includes(section)"
                :label="t('common.edit')" size="sm" variant="secondary" @click="beginEdit(row)" />
            </div>
          </template>
        </DhDataTable>
        <footer v-if="section !== 'settings' && section !== 'finance'" class="flex flex-wrap items-center justify-between gap-3 px-2 text-sm text-[var(--dh-text-muted)]">
          <span>{{ rows.length }} / {{ total }}</span>
          <div class="flex items-center gap-2">
            <DhButton :disabled="page <= 1 || loading" label="‹" variant="secondary" size="sm" @click="page--;load()" />
            <span class="min-w-6 text-center font-bold">{{ page }}</span>
            <DhButton :disabled="page*25 >= total || loading" label="›" variant="secondary" size="sm" @click="page++;load()" />
          </div>
        </footer>
      </div>

      <DhDrawer :open="showForm && Boolean(model)" :title="formTitle" size="lg" @close="showForm = false">
        <form v-if="model" class="space-y-6" @submit.prevent="save">
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">{{ t('crm.formHint') }}</p>
          <p v-if="error" role="alert" class="rounded-2xl border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-500">{{ error }}</p>
          <template v-if="section === 'accounts'">
            <section class="space-y-4 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <h3 class="text-sm font-black uppercase tracking-wide text-[var(--dh-text)]">Identificación del cliente</h3>
              <div class="grid gap-4 sm:grid-cols-2">
                <DhInput label="Nombre comercial *" data-required-field="displayName" :error="fieldError('displayName')" :model-value="String(form.displayName ?? '')"
                  @update:model-value="form.displayName = $event" />
                <DhInput label="Razón social *" data-required-field="legalName" :error="fieldError('legalName')" :model-value="String(form.legalName ?? '')"
                  @update:model-value="form.legalName = $event" />
                <CrmCatalogPicker label="País" catalog-group-slug="countries" value-kind="id"
                  :model-value="String(form.countryId ?? '')" @update:model-value="form.countryId = $event" />
                <DhInput label="Identificación fiscal" :model-value="String(form.taxId ?? '')"
                  @update:model-value="form.taxId = $event" />
                <DhInput label="Tipo de identificación" :model-value="String(form.taxIdTypeCode ?? '')"
                  @update:model-value="form.taxIdTypeCode = $event" />
              </div>
              <CrmHaciendaLookup v-if="!edited"
                :country-id="String(form.countryId ?? '')" :tax-id="String(form.taxId ?? '')"
                @resolved="applyHacienda" />
            </section>
            <section class="space-y-4 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <h3 class="text-sm font-black uppercase tracking-wide text-[var(--dh-text)]">Perfil comercial</h3>
              <div class="grid gap-4 sm:grid-cols-2">
                <DhSelect label="Tipo de cliente *" :model-value="String(form.customerTypeCode ?? 'cash')" placeholder=""
                  :options="[{label:'Contado',value:'cash'},{label:'Crédito',value:'credit'}]"
                  @update:model-value="form.customerTypeCode = $event" />
                <DhSelect label="Tipo de categoría" :model-value="String(form.categoryType ?? 'CUSTOMER')" placeholder=""
                  :options="[{label:'Cliente',value:'CUSTOMER'},{label:'NVOCC',value:'NVOCC'}]"
                  @update:model-value="form.categoryType = $event; form.categoryCode = 'A'" />
                <DhSelect label="Categoría" data-required-field="categoryCode" :error="fieldError('categoryCode')" :model-value="String(form.categoryCode ?? 'A')" placeholder=""
                  :options="(String(form.categoryType) === 'NVOCC' ? ['A','B'] : ['A','B','C','D']).map(x=>({label:x,value:x}))"
                  @update:model-value="form.categoryCode = $event" />
                <DhInput label="Origen de la cuenta" :model-value="String(form.sourceCode ?? '')"
                  @update:model-value="form.sourceCode = $event" />
                <DhInput label="Tipo de relación comercial" :model-value="String(form.relationshipTypeCode ?? '')"
                  @update:model-value="form.relationshipTypeCode = $event" />
              </div>
              <CrmExecutivePicker v-if="can('crm.account.assign') && can('auth.users.view') && !edited"
                :model-value="String(form.executiveUserId ?? '')" label="Ejecutivo de ventas"
                @update:model-value="form.executiveUserId = $event" />
              <p class="text-xs text-[var(--dh-text-muted)]">
                Si no se selecciona un ejecutivo, se asigna al usuario actual.
                Los contactos, direcciones, actividades económicas y seguimientos se administran desde el detalle del cliente.
              </p>
            </section>
          </template>
          <div v-if="section !== 'accounts'" class="grid gap-4 sm:grid-cols-2">
            <div v-for="f in model.fields" :key="f.key" :class="f.type === 'textarea' && 'sm:col-span-2'">
              <DhSelect v-if="f.type === 'select'" :data-required-field="f.key" :error="fieldError(f.key)" :label="f.label" :options="f.options ?? []" placeholder=""
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = $event" />
              <DhTextarea v-else-if="f.type === 'textarea'" :data-required-field="f.key" :error="fieldError(f.key)" :label="f.label" :rows="4"
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = $event" />
              <div v-else-if="f.type === 'checkbox'" :data-required-field="f.key" :class="isInvalid(f.key) ? '!border-red-500 ring-2 ring-red-500/20' : ''" class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
                <DhSwitch :label="f.label" :model-value="Boolean(form[f.key])" @update:model-value="form[f.key] = $event" />
              </div>
              <CrmCatalogPicker v-else-if="catalogFields[f.key]" :data-required-field="f.key" :error="fieldError(f.key)"
                :label="f.label" :catalog-group-slug="catalogFields[f.key]?.slug ?? ''"
                :value-kind="catalogFields[f.key]?.kind ?? 'id'"
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = $event" />
              <CrmReferencePicker v-else-if="canSelectReference(f.key)" :data-required-field="f.key" :error="fieldError(f.key)"
                :label="f.label" :resource="referenceResources[f.key] ?? 'accounts'"
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = $event" />
              <DhInput v-else :data-required-field="f.key" :error="fieldError(f.key)" :label="f.label + (f.required ? ' *' : '')"
                :type="f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : f.type === 'datetime-local' ? 'datetime-local' : 'text'"
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = $event" />
            </div>
            <DhInput v-if="section === 'followups'" :label="t('crm.assignedUser')"
              :model-value="String(form.assignedUserId ?? '')" @update:model-value="form.assignedUserId = $event" />
          </div>
          <div class="sticky bottom-0 z-10 -mx-3 flex flex-wrap justify-end gap-2 border-t border-[var(--dh-border)] bg-[var(--dh-bg)] px-3 py-4 sm:-mx-5 sm:px-5">
            <DhButton :label="t('common.cancel')" variant="secondary" @click="showForm = false" />
            <DhButton type="submit" :label="t('common.save')" :loading="saving" />
          </div>
        </form>
      </DhDrawer>
    </template>
  </main>
</template>

<style scoped>
.crm-card{border:1px solid var(--dh-border);border-radius:1.25rem;background:var(--dh-card);box-shadow:var(--dh-shadow-sm)}
.crm-input{display:block;width:100%;background:var(--dh-input);color:var(--dh-text);border:1px solid var(--dh-border);border-radius:1.125rem;padding:.7rem}
.crm-alert{background:var(--dh-card);border:1px solid #d38c6a;border-radius:.8rem;padding:1rem}
</style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/core/stores/authStore'
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
const pipelineStages = ref<CrmRow[]>([])
const pipelineId = ref('')
const viewMode = ref<'table' | 'kanban' | 'week'>('table')
const selectedAccount = ref('')
const financeTab = ref<'credit' | 'contracts'>('credit')
const dashboard = reactive({ accounts: 0, leads: 0, opportunities: 0, activities: 0, weighted: 0, loaded: false })
const configWarning = ref('')

function beginCreate() {
  pendingCreateKey.value = crmUuid()
  edited.value = null
  Object.keys(form).forEach(key => delete form[key])
  Object.assign(form, crmDefaults(section.value))
  if (section.value === 'followups') form.assignedUserId = auth.userId ?? ''
  showForm.value = true
}
function beginEdit(item: CrmRow) {
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
    else if (section.value === 'finance') await loadFinance()
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
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-[var(--dh-text-muted)]">{{ t('crm.title') }}</p>
        <h1 class="text-2xl font-black sm:text-3xl">
          {{ section === 'dashboard' ? t('crm.dashboard') : section === 'finance' ? t('crm.finance') : model?.title }}
        </h1>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="crm-button" :disabled="loading" @click="load">{{ t('common.refresh') }}</button>
        <button v-if="model && canCreate() && !['followups'].includes(section)"
          type="button" class="crm-button crm-primary" @click="beginCreate">{{ t('common.create') }}</button>
        <button v-if="section === 'followups' && can('crm.followup.manage')"
          type="button" class="crm-button crm-primary" @click="beginCreate">{{ t('crm.newFollowup') }}</button>
      </div>
    </header>
    <p v-if="!allowed" role="alert" class="crm-alert">{{ t('crm.denied') }}</p>
    <template v-else>
      <p v-if="error" role="alert" class="crm-alert">{{ error }}</p>
      <p v-if="success" role="status" class="text-sm text-emerald-600">{{ success }}</p>
      <p v-if="loading" role="status" class="text-sm text-[var(--dh-text-muted)]">{{ t('common.loading') }}</p>
      <template v-if="section === 'dashboard'">
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div v-for="metric in [
            { label: t('crm.accounts'), value: dashboard.accounts },
            { label: t('crm.leads'), value: dashboard.leads },
            { label: t('crm.opportunities'), value: dashboard.opportunities },
            { label: t('crm.activities'), value: dashboard.activities },
            { label: t('crm.weighted'), value: dashboard.weighted.toLocaleString(undefined,{maximumFractionDigits:2}) },
          ]" :key="metric.label" class="crm-card p-5">
            <p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ metric.label }}</p>
            <p class="mt-3 text-2xl font-black">{{ dashboard.loaded ? metric.value : '—' }}</p>
          </div>
        </div>
        <p v-if="configWarning" class="text-sm text-amber-700">{{ configWarning }}</p>
        <p class="text-sm text-[var(--dh-text-muted)]">{{ t('crm.dashboardNote') }}</p>
      </template>

      <template v-else-if="section === 'finance'">
        <div class="crm-card space-y-4 p-4">
          <p class="text-sm text-[var(--dh-text-muted)]">{{ t('crm.financeSelectAccount') }}</p>
          <label class="block max-w-xl text-sm font-bold">{{ t('crm.accountId') }}
            <input v-model.trim="selectedAccount" class="crm-input mt-1" :placeholder="t('crm.uuidHint')" />
          </label>
          <div class="flex gap-2">
            <button v-if="can('crm.credit.read')" class="crm-button"
              :aria-pressed="financeTab === 'credit'" @click="financeTab='credit'">{{ t('crm.credit') }}</button>
            <button v-if="can('crm.contract.read')" class="crm-button"
              :aria-pressed="financeTab === 'contracts'" @click="financeTab='contracts'">{{ t('crm.contracts') }}</button>
          </div>
        </div>
        <p v-if="!financeAllowed" class="crm-alert">{{ t('crm.denied') }}</p>
      </template>

      <template v-else>
        <div class="flex flex-wrap items-center gap-3">
          <label v-if="!['settings'].includes(section)" class="min-w-[200px] flex-1">
            <span class="sr-only">{{ t('common.search') }}</span>
            <input v-model="search" class="crm-input" :placeholder="t('common.search')" @keyup.enter="page=1;load()" />
          </label>
          <button v-if="!['settings'].includes(section)" class="crm-button" @click="page=1;load()">{{ t('common.search') }}</button>
          <button v-if="section === 'opportunities'" class="crm-button"
            :aria-pressed="viewMode === 'kanban'" @click="viewMode=viewMode==='kanban'?'table':'kanban'">
            {{ viewMode === 'kanban' ? t('crm.table') : t('crm.kanban') }}
          </button>
          <button v-if="section === 'followups' || section === 'activities'" class="crm-button"
            :aria-pressed="viewMode === 'week'" @click="viewMode=viewMode==='week'?'table':'week'">
            {{ viewMode === 'week' ? t('crm.table') : t('crm.week') }}
          </button>
        </div>
      </template>

      <div v-if="section === 'opportunities' && viewMode === 'kanban'" class="flex gap-4 overflow-x-auto pb-3">
        <section v-for="stage in stages" :key="stage.id" class="crm-card min-w-[260px] flex-1 p-4">
          <h2 class="font-bold">{{ stage.name }} ({{ kanbanRows(stage.id).length }})</h2>
          <article v-for="item in kanbanRows(stage.id)" :key="item.id" class="mt-3 rounded-xl border border-[var(--dh-border)] p-3">
            <button class="block text-left font-semibold underline" @click="details(item)">{{ item.title }}</button>
            <p class="text-sm text-[var(--dh-text-muted)]">{{ item.amountEstimated }} {{ item.currencyCode }}</p>
            <select v-if="can('crm.opportunity.update')" class="crm-input mt-2" :value="String(item.stageId)"
              :aria-label="t('crm.stage')" @change="changeStage(item,($event.target as HTMLSelectElement).value)">
              <option v-for="s in stages" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </article>
        </section>
      </div>
      <div v-else-if="section === 'activities' || section === 'followups' ? viewMode === 'week' : false"
        class="crm-card space-y-3 p-4">
        <h2 class="text-lg font-bold">{{ t('crm.week') }}</h2>
        <p v-if="total > rows.length" class="text-sm text-amber-700" role="status">{{ t('crm.partialAgenda', { loaded: rows.length, total }) }}</p>
        <div v-for="day in agendaDays" :key="day.dateKey" class="border-b border-[var(--dh-border)] pb-2">
          <h3 class="text-sm font-bold">{{ day.label }}</h3>
          <button v-for="item in agendaForDay(day.dateKey)" :key="item.id"
            class="block text-sm underline" @click="details(item)">{{ item.subject ?? item.channel }}</button>
        </div>
      </div>
      <div v-else-if="section !== 'dashboard'" class="crm-card overflow-x-auto">
        <table class="w-full min-w-[550px] text-left text-sm">
          <thead><tr class="border-b border-[var(--dh-border)] text-[var(--dh-text-muted)]">
            <th class="p-4">{{ t('common.name') }}</th>
            <th class="p-4">{{ t('common.description') }}</th>
            <th class="p-4">{{ t('common.status') }}</th>
            <th class="p-4">{{ t('common.actions') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="item in rows" :key="item.id" class="border-b border-[var(--dh-border)]">
              <td class="p-4 font-semibold">{{ item[model?.primary ?? 'contractNumber'] ?? item.contractNumber ?? item.id }}</td>
              <td class="max-w-[300px] truncate p-4">{{ item[model?.secondary ?? 'paymentTerms'] ?? '—' }}</td>
              <td class="p-4">{{ item.status ?? item.qualificationStatus ?? '—' }}</td>
              <td class="space-x-2 p-4">
                <button v-if="section !== 'finance'" class="crm-link" @click="details(item)">{{ t('common.details') }}</button>
                <button v-if="section !== 'finance' && canEdit() && !['activities','followups'].includes(section)"
                  class="crm-link" @click="beginEdit(item)">{{ t('common.edit') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!rows.length && !loading" class="p-6 text-center text-sm text-[var(--dh-text-muted)]">{{ t('common.noData') }}</p>
        <footer v-if="section !== 'settings' && section !== 'finance'" class="flex items-center justify-between p-4 text-sm">
          <span>{{ rows.length }} / {{ total }}</span>
          <div class="flex gap-2">
            <button class="crm-button" :disabled="page <= 1" @click="page--;load()">‹</button>
            <span class="py-2">{{ page }}</span>
            <button class="crm-button" :disabled="page*25 >= total" @click="page++;load()">›</button>
          </div>
        </footer>
      </div>

      <form v-if="showForm && model" class="crm-card space-y-4 p-4 sm:p-6" @submit.prevent="save">
        <h2 class="text-lg font-bold">{{ edited ? t('common.edit') : t('common.create') }} — {{ model.title }}</h2>
        <div class="grid gap-4 md:grid-cols-2">
          <label v-for="f in model.fields" :key="f.key" class="block text-sm font-semibold">
            <span>{{ f.label }}</span>
            <input v-if="!['select','textarea','checkbox'].includes(f.type)" v-model="form[f.key]"
              :type="f.type" :required="f.required" class="crm-input mt-1" />
            <select v-else-if="f.type === 'select'" v-model="form[f.key]" class="crm-input mt-1">
              <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <textarea v-else-if="f.type === 'textarea'" :value="String(form[f.key] ?? '')" @input="form[f.key] = ($event.target as HTMLTextAreaElement).value" class="crm-input mt-1" rows="3" />
            <input v-else v-model="form[f.key]" type="checkbox" class="ml-3" />
          </label>
          <label v-if="section === 'followups'" class="block text-sm font-semibold">
            {{ t('crm.assignedUser') }}
            <input v-model.trim="form.assignedUserId" class="crm-input mt-1" required />
          </label>
        </div>
        <p class="text-xs text-[var(--dh-text-muted)]">{{ t('crm.formHint') }}</p>
        <div class="flex gap-2">
          <button class="crm-button crm-primary" type="submit" :disabled="saving">{{ saving ? t('common.loading') : t('common.save') }}</button>
          <button class="crm-button" type="button" @click="showForm=false">{{ t('common.cancel') }}</button>
        </div>
      </form>
    </template>
  </main>
</template>

<style scoped>
.crm-card{border:1px solid var(--dh-border);border-radius:1.25rem;background:var(--dh-card);box-shadow:var(--dh-shadow-sm)}
.crm-button{border:1px solid var(--dh-border);border-radius:.8rem;padding:.6rem 1rem;font-weight:700;min-height:42px;background:var(--dh-card);color:var(--dh-text)}
.crm-button:disabled{opacity:.45;cursor:not-allowed}.crm-button[aria-pressed=true]{outline:2px solid var(--dh-primary)}
.crm-primary{background:var(--dh-primary);color:white}
.crm-input{display:block;width:100%;background:var(--dh-card);color:var(--dh-text);border:1px solid var(--dh-border);border-radius:.7rem;padding:.6rem}
.crm-link{text-decoration:underline;color:var(--dh-primary);font-weight:700}
.crm-alert{background:var(--dh-card);border:1px solid #d38c6a;border-radius:.8rem;padding:1rem}
</style>

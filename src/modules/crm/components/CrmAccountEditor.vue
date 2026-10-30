<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Building2, Save, ShieldCheck, UserRound, Wallet, X } from 'lucide-vue-next'
import { DhDrawer } from '@/shared/components/organisms'
import { DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { useAuthStore } from '@/core/stores/authStore'
import CrmCatalogPicker from './CrmCatalogPicker.vue'
import CrmHaciendaLookup from './CrmHaciendaLookup.vue'
import type { HaciendaResult } from './CrmHaciendaLookup.vue'
import { crmPatch, crmPath, crmRequest, crmUuid, crmError, type CrmRow } from '../services/crmApi'

const props = defineProps<{ account: CrmRow; open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void; (e: 'manage-related'): void }>()
const auth = useAuthStore()
const can = (scope: string) => auth.hasScope(scope)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const accountDraft = reactive({
  displayName: '', legalName: '', countryId: '', taxIdTypeCode: '', taxId: '',
  customerTypeCode: 'cash', categoryType: 'CUSTOMER', categoryCode: 'A',
  sourceCode: '', relationshipTypeCode: '',
})
type IdentityField = keyof typeof accountDraft
const profileGroups = [
  { title: 'Contacto y datos empresariales', fields: [
    ['phone','Teléfono corporativo'], ['email','Correo principal'], ['website','Sitio web'],
    ['billingEmail','Correo de facturación'], ['marketingEmail','Correo comercial'],
    ['sector','Sector productivo'], ['businessActivity','Actividad de la empresa'],
    ['products','Líneas de productos'], ['companyHistory','Historia de la empresa'],
    ['activeServices','Servicios activos'], ['presenceCountries','Países con presencia'],
    ['webCustomerReference','Referencia cliente web (sin contraseñas)'],
  ] },
  { title: 'Estrategia y seguimiento comercial', fields: [
    ['commercialObservations','Observaciones comerciales'], ['commercialStrategy','Estrategia comercial'],
    ['projectsOfInterest','Proyectos vinculados'], ['pricingObservations','Observaciones de Pricing'],
    ['tariffMonitoringNotes','Tarifas por enviar'], ['tariffSendingNotes','Tarifas enviadas'],
    ['competitorObservations','Análisis de competidores'],
  ] },
  { title: 'Operaciones y logística', fields: [
    ['operationalInstructions','Instrucciones operativas'], ['customsInstructions','Aduanas y nacionalización'],
    ['cargoCollectionInstructions','Recolección de carga'], ['documentReviewInstructions','Revisión de documentos'],
    ['assignedOperations','Operativa asignada'], ['tradeAgreementNotes','Acuerdos comerciales'],
  ] },
] as const
const profileDraft = reactive<Record<string, string>>({})
for (const group of profileGroups) for (const [key] of group.fields) profileDraft[key] = ''
const profileVersion = ref<number | null>(null)
const loadedProfile = ref(false)
const identitySnapshot = ref('')
const businessSnapshot = ref('')
const identityChanged = computed(() => JSON.stringify(accountDraft) !== identitySnapshot.value)
const businessChanged = computed(() => JSON.stringify(profileDraft) !== businessSnapshot.value)
const fiscalFieldsChanged = computed(() =>
  ['countryId','taxId','taxIdTypeCode'].some(k =>
    accountDraft[k as IdentityField] !== String(props.account[k] ?? '')))
const canSave = computed(() => (identityChanged.value || businessChanged.value) && !loading.value && !saving.value)

function resetFromAccount() {
  for (const key of Object.keys(accountDraft) as IdentityField[]) {
    accountDraft[key] = String(props.account[key] ?? (key === 'customerTypeCode' ? 'cash' :
      key === 'categoryType' ? 'CUSTOMER' : key === 'categoryCode' ? 'A' : ''))
  }
  identitySnapshot.value = JSON.stringify(accountDraft)
}
async function load() {
  loading.value = true
  error.value = ''
  loadedProfile.value = false
  resetFromAccount()
  const expectedId = props.account.id
  try {
    const result = await crmRequest<CrmRow | null>(crmPath('accounts', String(expectedId), 'business-profile'))
    if (!props.open || expectedId !== props.account.id) return
    profileVersion.value = typeof result?.rowVersion === 'number' ? result.rowVersion : null
    for (const key of Object.keys(profileDraft)) profileDraft[key] = String(result?.[key] ?? '')
    businessSnapshot.value = JSON.stringify(profileDraft)
    loadedProfile.value = true
  } catch (cause) {
    error.value = 'No se pudo cargar la ficha empresarial. ' + crmError(cause)
  } finally { loading.value = false }
}
watch(() => [props.open, props.account.id], ([open]) => {
  if (open) void load()
}, { immediate: true })
function resolved(data: HaciendaResult) {
  if (data.identification.replace(/[\s-]/g, '') !== accountDraft.taxId.replace(/[\s-]/g, '')) return
  accountDraft.displayName = data.name
  accountDraft.legalName = data.name
  if (data.identificationType) accountDraft.taxIdTypeCode = data.identificationType
}
async function save() {
  if (!can('crm.account.update') || !loadedProfile.value || !canSave.value) return
  if (!accountDraft.displayName.trim() || !accountDraft.legalName.trim()) {
    error.value = 'Nombre comercial y razón social son obligatorios.'
    return
  }
  if (accountDraft.taxId.trim() && (!accountDraft.countryId || !accountDraft.taxIdTypeCode.trim())) {
    error.value = 'Para modificar la cédula, completá país y tipo de identificación.'
    return
  }
  saving.value = true
  error.value = ''
  let identityCommitted = false
  try {
    if (identityChanged.value) {
      const updated = await crmPatch<CrmRow>('accounts', String(props.account.id), {
        expectedVersion: props.account.rowVersion,
        ...accountDraft,
        updateFiscalIdentity: fiscalFieldsChanged.value,
        countryId: accountDraft.countryId || null,
        taxId: accountDraft.taxId || null,
        taxIdTypeCode: accountDraft.taxIdTypeCode || null,
      })
      identityCommitted = true
      identitySnapshot.value = JSON.stringify(accountDraft)
      emit('saved')
      if (updated?.rowVersion != null) {
        // The enclosing record refreshes after saving.
      }
    }
    if (businessChanged.value) {
      await crmRequest(crmPath('accounts', String(props.account.id), 'business-profile'), 'PUT',
        { ...profileDraft, expectedVersion: profileVersion.value }, crmUuid())
      businessSnapshot.value = JSON.stringify(profileDraft)
    }
    emit('saved')
    emit('close')
  } catch (cause) {
    error.value = crmError(cause) + (identityCommitted
      ? ' Los datos generales sí se guardaron. Actualizá la ficha antes de volver a intentar.'
      : '')
  } finally { saving.value = false }
}
</script>

<template>
  <DhDrawer :open="open" title="Editar cuenta comercial" size="full" @close="emit('close')">
    <div class="mx-auto max-w-6xl space-y-5 pb-20" data-crm-account-editor>
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-5">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">Gestión de cliente</p>
          <h2 class="mt-1 break-words text-lg font-extrabold">{{ account.displayName }}</h2>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Un formulario para identidad, clasificación y perfil empresarial. Las acciones financieras conservan sus aprobaciones.</p>
        </div>
        <button type="button" class="rounded-xl border border-[var(--dh-border)] p-2" aria-label="Cerrar" @click="emit('close')"><X class="h-5 w-5" /></button>
      </div>
      <p v-if="error" role="alert" class="rounded-xl border border-red-500/30 p-3 text-sm text-red-500">{{ error }}</p>
      <p v-if="loading" role="status" class="text-sm text-[var(--dh-text-muted)]">Cargando datos registrados…</p>
      <form v-if="!loading && loadedProfile" class="space-y-5" @submit.prevent="save">
        <section class="crm-editor-section">
          <div class="crm-editor-heading"><Building2 class="h-5 w-5" /><div><h3>Identidad del cliente</h3><p>Información comercial y tributaria</p></div></div>
          <div class="grid gap-4 md:grid-cols-2">
            <DhInput v-model="accountDraft.displayName" label="Nombre comercial *" />
            <DhInput v-model="accountDraft.legalName" label="Razón social *" />
            <CrmCatalogPicker label="País" catalog-group-slug="countries" value-kind="id"
              :model-value="accountDraft.countryId" @update:model-value="accountDraft.countryId=$event" />
            <DhInput v-model="accountDraft.taxId" label="Identificación fiscal" />
            <DhInput v-model="accountDraft.taxIdTypeCode" label="Tipo de identificación" />
            <div class="flex flex-col justify-end"><CrmHaciendaLookup :country-id="accountDraft.countryId"
              :tax-id="accountDraft.taxId" @resolved="resolved" /></div>
          </div>
        </section>
        <section class="crm-editor-section">
          <div class="crm-editor-heading"><UserRound class="h-5 w-5" /><div><h3>Clasificación comercial</h3><p>Datos que utiliza el equipo de ventas</p></div></div>
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DhSelect label="Condición de cliente" :model-value="accountDraft.customerTypeCode"
              :options="[{label:'Contado',value:'cash'},{label:'Crédito',value:'credit'}]"
              @update:model-value="accountDraft.customerTypeCode=$event" />
            <DhSelect label="Tipo de cuenta" :model-value="accountDraft.categoryType"
              :options="[{label:'Cliente',value:'CUSTOMER'},{label:'Agente / NVOCC',value:'NVOCC'}]"
              @update:model-value="accountDraft.categoryType=$event;accountDraft.categoryCode='A'" />
            <DhSelect label="Categoría" :model-value="accountDraft.categoryCode"
              :options="(accountDraft.categoryType==='NVOCC'?['A','B']:['A','B','C','D']).map(value=>({label:'Categoría '+value,value}))"
              @update:model-value="accountDraft.categoryCode=$event" />
            <DhInput v-model="accountDraft.sourceCode" label="Origen de la cuenta" />
            <DhInput v-model="accountDraft.relationshipTypeCode" label="Tipo de relación" />
          </div>
        </section>
        <section v-for="group in profileGroups" :key="group.title" class="crm-editor-section">
          <div class="crm-editor-heading"><ShieldCheck class="h-5 w-5" /><div><h3>{{ group.title }}</h3><p>Información complementaria del cliente</p></div></div>
          <div class="grid gap-4 md:grid-cols-2">
            <div v-for="[key,label] in group.fields" :key="key"
              :class="['email','website','phone','billingEmail','marketingEmail','sector','webCustomerReference','assignedOperations'].includes(key) ? '' : 'md:col-span-2'">
              <DhTextarea v-if="!['email','website','phone','billingEmail','marketingEmail','sector','webCustomerReference','assignedOperations'].includes(key)"
                :label="label" :model-value="profileDraft[key]" @update:model-value="profileDraft[key]=$event" :rows="2" />
              <DhInput v-else :label="label" :model-value="profileDraft[key]"
                @update:model-value="profileDraft[key]=$event" />
            </div>
          </div>
        </section>
        <section class="crm-editor-section flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3"><Wallet class="h-5 w-5 text-[var(--dh-primary)]" /><p class="text-sm">Contactos, direcciones, rutas, crédito y contratos se gestionan desde esta misma cuenta con sus respectivos permisos.</p></div>
          <button type="button" class="crm-editor-link" @click="emit('manage-related')">Administrar registros vinculados</button>
        </section>
        <div class="sticky bottom-3 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-lg">
          <span v-if="canSave" class="mr-auto text-xs text-[var(--dh-text-muted)]">Tenés cambios sin guardar</span>
          <button type="button" class="crm-editor-secondary" @click="emit('close')">Cancelar</button>
          <button type="submit" class="crm-editor-primary" :disabled="!canSave || !can('crm.account.update')">
            <Save class="h-4 w-4" />{{ saving ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </div>
  </DhDrawer>
</template>

<style scoped>
.crm-editor-section{border:1px solid var(--dh-border);border-radius:1.15rem;padding:1.25rem 1.4rem;background:var(--dh-card);box-shadow:var(--dh-shadow-sm)}
.crm-editor-heading{display:flex;align-items:center;gap:.75rem;margin-bottom:1.2rem;color:var(--dh-primary)}
.crm-editor-heading h3{font-size:.94rem;font-weight:850;color:var(--dh-text)}
.crm-editor-heading p{font-size:.72rem;color:var(--dh-text-muted);margin-top:.2rem}
.crm-editor-primary{display:inline-flex;align-items:center;gap:.45rem;padding:.7rem 1rem;border-radius:.75rem;background:var(--dh-primary);font-weight:800;color:white;font-size:.82rem}
.crm-editor-primary:disabled{opacity:.45}
.crm-editor-secondary,.crm-editor-link{padding:.65rem .8rem;border-radius:.7rem;border:1px solid var(--dh-border);font-weight:700;font-size:.78rem}
.crm-editor-link{color:var(--dh-primary)}
</style>
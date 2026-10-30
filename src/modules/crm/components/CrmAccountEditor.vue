<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Building2, Save, ShieldCheck, UserRound, Wallet, X } from 'lucide-vue-next'
import { DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { useAuthStore } from '@/core/stores/authStore'
import CrmCatalogPicker from './CrmCatalogPicker.vue'
import CrmRelationshipPicker from './CrmRelationshipPicker.vue'
import CrmCreditCoverageManager from './CrmCreditCoverageManager.vue'
import CrmHaciendaLookup from './CrmHaciendaLookup.vue'
import type { HaciendaResult } from './CrmHaciendaLookup.vue'
import { crmPatch, crmPath, crmRequest, crmUuid, crmError, type CrmRow } from '../services/crmApi'

const props = defineProps<{ account: CrmRow; open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
  (e: 'manage-related'): void
  (e: 'dirty-change', value: boolean): void
}>()
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
const relatedContacts = ref<CrmRow[]>([])
const relatedAddresses = ref<CrmRow[]>([])
const editingContactId = ref('')
const editingAddressId = ref('')
const contactDraft = reactive({ firstName: '', lastName: '', jobTitle: '', email: '', phone: '' })
const addressDraft = reactive({ addressType: '', addressText: '', location: '' })
const relationSaving = ref(false)
const relatedError = ref('')
const relatedSuccess = ref('')

function beginContactEdit(contact: CrmRow) {
  editingContactId.value = String(contact.id)
  // Don't infer compound surnames from a legacy full name.
  Object.assign(contactDraft, { firstName: String(contact.firstName ?? ''),
    lastName: String(contact.lastName ?? ''), jobTitle: String(contact.jobTitle ?? ''),
    email: String(contact.email ?? ''), phone: String(contact.phone ?? '') })
  editingAddressId.value = ''
  relatedError.value = ''
}
function beginAddressEdit(address: CrmRow) {
  editingAddressId.value = String(address.id)
  Object.assign(addressDraft, { addressType: String(address.addressType ?? 'WORK'),
    addressText: String(address.addressText ?? ''), location: String(address.location ?? '') })
  editingContactId.value = ''
  relatedError.value = ''
}
async function saveContact() {
  const previous = relatedContacts.value.find(c => String(c.id) === editingContactId.value)
  if (!previous || !can('crm.contact.update') || relationSaving.value) return
  if (!contactDraft.firstName.trim() || !contactDraft.lastName.trim()) {
    relatedError.value = 'Nombre(s) y apellido(s) del contacto son obligatorios.'; return
  }
  relationSaving.value = true
  relatedError.value = ''
  try {
    const updated = await crmPatch<CrmRow>('contacts', String(previous.id), {
      ...contactDraft,
      name: [contactDraft.firstName.trim(), contactDraft.lastName.trim()].join(' '),
      expectedVersion: previous.rowVersion,
    })
    relatedContacts.value = relatedContacts.value.map(c => c.id === updated.id ? updated : c)
    editingContactId.value = ''
    relatedSuccess.value = 'Contacto actualizado.'
    emit('saved')
  } catch (cause) { relatedError.value = crmError(cause) }
  finally { relationSaving.value = false }
}
async function saveAddress() {
  const previous = relatedAddresses.value.find(a => String(a.id) === editingAddressId.value)
  if (!previous || !can('crm.account.update') || relationSaving.value) return
  if (!addressDraft.addressText.trim()) { relatedError.value = 'La dirección es obligatoria.'; return }
  relationSaving.value = true
  relatedError.value = ''
  try {
    const updated = await crmPatch<CrmRow>('addresses', String(previous.id), {
      ...addressDraft, expectedVersion: previous.rowVersion,
    })
    relatedAddresses.value = relatedAddresses.value.map(a => a.id === updated.id ? updated : a)
    editingAddressId.value = ''
    relatedSuccess.value = 'Dirección actualizada.'
    emit('saved')
  } catch (cause) { relatedError.value = crmError(cause) }
  finally { relationSaving.value = false }
}
const loadedProfile = ref(false)
const identitySnapshot = ref('')
const businessSnapshot = ref('')
const identityChanged = computed(() => JSON.stringify(accountDraft) !== identitySnapshot.value)
const businessChanged = computed(() => JSON.stringify(profileDraft) !== businessSnapshot.value)
const fiscalFieldsChanged = computed(() =>
  ['countryId','taxId','taxIdTypeCode'].some(k =>
    accountDraft[k as IdentityField] !== String(props.account[k] ?? '')))
const isDirty = computed(() => identityChanged.value || businessChanged.value)
const canSave = computed(() => isDirty.value && !loading.value && !saving.value)
watch(isDirty, dirty => emit('dirty-change', dirty), { immediate: true })

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
    relatedContacts.value = []
    relatedAddresses.value = []
    editingContactId.value = ''
    editingAddressId.value = ''
    relatedError.value = ''
    relatedSuccess.value = ''
    const requests: Promise<void>[] = []
    if (can('crm.contact.read')) requests.push(
      crmRequest<CrmRow[]>(crmPath('accounts', String(expectedId), 'contacts'))
        .then(rows => {
          if (props.open && expectedId === props.account.id) {
            relatedContacts.value = rows.map(x => x.contact && typeof x.contact === 'object'
              ? x.contact as CrmRow : x)
          }
        }).catch(() => { relatedError.value = 'No fue posible consultar los contactos relacionados.' }))
    if (can('crm.account.read') || can('crm.account.read-all')) requests.push(
      crmRequest<CrmRow[]>(crmPath('accounts', String(expectedId), 'addresses'))
        .then(rows => {
          if (props.open && expectedId === props.account.id) relatedAddresses.value = rows
        }).catch(() => { relatedError.value = 'No fue posible consultar las direcciones relacionadas.' }))
    await Promise.all(requests)
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
    emit('dirty-change', false)
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
  <section v-if="open" class="w-full" data-crm-inline-editing aria-label="Edición de la ficha de cliente">
    <div class="w-full space-y-4 pb-12" data-crm-account-editor>
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-5">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-wider text-[var(--dh-primary)]">Ficha comercial · Modo edición</p>
          <h2 class="mt-1 break-words text-lg font-extrabold">{{ account.displayName }}</h2>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Modificá los campos directamente en la ficha. Guardá para aplicar los cambios o cancelá para volver al detalle.</p>
        </div>
        <button type="button" class="rounded-xl border border-[var(--dh-border)] p-2" aria-label="Cancelar edición y volver al detalle" @click="emit('close')"><X class="h-5 w-5" /></button>
      </div>
      <p v-if="error" role="alert" class="rounded-xl border border-red-500/30 p-3 text-sm text-red-500">{{ error }}</p>
      <p v-if="loading" role="status" class="text-sm text-[var(--dh-text-muted)]">Cargando datos registrados…</p>
      <div v-if="!loading && !loadedProfile" class="rounded-xl border border-amber-500/30 bg-[var(--dh-card)] p-4">
        <p class="mb-3 text-sm text-[var(--dh-text-muted)]">No se puede editar hasta cargar la versión actual de la cuenta.</p>
        <button type="button" class="crm-editor-secondary" @click="load">Reintentar carga</button>
      </div>
      <nav v-if="!loading && loadedProfile" class="flex gap-2 overflow-x-auto rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-2 text-xs font-bold" aria-label="Secciones editables">
        <a v-for="section in [{id:'identity',text:'Datos de la cuenta'}, {id:'commercial',text:'Ficha comercial'}, {id:'company',text:'Datos empresariales'}, {id:'contacts',text:'Contactos'}, {id:'addresses',text:'Direcciones'}, {id:'credit',text:'Cobertura del crédito'}]"
          :key="section.id" :href="'#crm-edit-' + section.id"
          class="shrink-0 rounded-lg bg-[var(--dh-shell)] px-3 py-2 hover:text-[var(--dh-primary)]">{{ section.text }}</a>
      </nav>
      <form v-if="!loading && loadedProfile" class="space-y-4" @submit.prevent="save">
        <section id="crm-edit-identity" class="crm-editor-section scroll-mt-24">
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
        <section id="crm-edit-commercial" class="crm-editor-section scroll-mt-24">
          <div class="crm-editor-heading"><UserRound class="h-5 w-5" /><div><h3>Clasificación comercial</h3><p>Datos que utiliza el equipo de ventas</p></div></div>
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DhSelect label="Condición de cliente" :model-value="accountDraft.customerTypeCode"
              :options="[{label:'Contado',value:'cash'},{label:'Crédito',value:'credit'}]"
              @update:model-value="accountDraft.customerTypeCode=String($event)" />
            <DhSelect label="Tipo de cuenta" :model-value="accountDraft.categoryType"
              :options="[{label:'Cliente',value:'CUSTOMER'},{label:'Agente / NVOCC',value:'NVOCC'}]"
              @update:model-value="accountDraft.categoryType=String($event);accountDraft.categoryCode='A'" />
            <DhSelect label="Categoría" :model-value="accountDraft.categoryCode"
              :options="(accountDraft.categoryType==='NVOCC'?['A','B']:['A','B','C','D']).map(value=>({label:'Categoría '+value,value}))"
              @update:model-value="accountDraft.categoryCode=String($event)" />
            <DhInput v-model="accountDraft.sourceCode" label="Origen de la cuenta" />
            <CrmRelationshipPicker :model-value="accountDraft.relationshipTypeCode" label="Tipos de relación"
              @update:model-value="accountDraft.relationshipTypeCode=$event" />
          </div>
        </section>
        <section id="crm-edit-company" class="space-y-4 scroll-mt-24">
          <h3 class="px-1 text-sm font-extrabold">Información de la empresa y sus operaciones</h3>
          <section v-for="group in profileGroups" :key="group.title" class="crm-editor-section">
          <div class="crm-editor-heading"><ShieldCheck class="h-5 w-5" /><div><h3>{{ group.title }}</h3><p>Información complementaria del cliente</p></div></div>
          <div class="grid gap-4 md:grid-cols-2">
            <div v-for="[key,label] in group.fields" :key="key"
              :class="['email','website','phone','billingEmail','marketingEmail','sector','webCustomerReference','assignedOperations'].includes(key) ? '' : 'md:col-span-2'">
              <DhTextarea v-if="!['email','website','phone','billingEmail','marketingEmail','sector','webCustomerReference','assignedOperations'].includes(key)"
                :label="label"  :model-value="profileDraft[key] ?? ''" @update:model-value="profileDraft[key]=$event" :rows="2" />
              <DhInput v-else :label="label"  :model-value="profileDraft[key] ?? ''"
                @update:model-value="profileDraft[key]=$event" />
            </div>
          </div>
        </section>
        </section>
        <section v-if="can('crm.contact.read')" id="crm-edit-contacts" class="crm-editor-section scroll-mt-24">
          <div class="crm-editor-heading"><UserRound class="h-5 w-5" /><div>
            <h3>Contactos vinculados</h3><p>Editá los contactos sin salir de esta cuenta.</p>
          </div></div>
          <p v-if="!relatedContacts.length" class="text-sm text-[var(--dh-text-muted)]">No hay contactos registrados.</p>
          <div v-for="contact in relatedContacts" :key="String(contact.id)"
            class="mb-3 rounded-xl border border-[var(--dh-border)] p-3">
            <div class="flex items-center justify-between gap-2">
              <div><p class="text-sm font-bold">{{ contact.name }}</p>
                <p class="text-xs text-[var(--dh-text-muted)]">{{ contact.email || contact.phone || 'Sin medios de contacto' }}</p>
              </div>
              <button v-if="can('crm.contact.update')" type="button" class="crm-editor-link"
                @click="beginContactEdit(contact)">Editar</button>
            </div>
            <div v-if="editingContactId===String(contact.id)" class="mt-4 grid gap-3 md:grid-cols-2">
              <DhInput v-model="contactDraft.firstName" label="Nombre(s) *" />
              <DhInput v-model="contactDraft.lastName" label="Apellido(s) *" />
              <DhInput v-model="contactDraft.jobTitle" label="Puesto" />
              <DhInput v-model="contactDraft.email" label="Correo electrónico" />
              <DhInput v-model="contactDraft.phone" label="Teléfono" />
              <p v-if="!contact.firstName && !contact.lastName"
                class="text-xs text-[var(--dh-text-muted)] md:col-span-2">
                Este contacto antiguo requiere ingresar los nombres y apellidos reales antes de guardar.
              </p>
              <div class="flex gap-2 md:col-span-2">
                <button type="button" class="crm-editor-secondary" @click="editingContactId=''">Cancelar</button>
                <button type="button" class="crm-editor-primary" :disabled="relationSaving" @click="saveContact">Guardar contacto</button>
              </div>
            </div>
          </div>
        </section>
        <section id="crm-edit-addresses" class="crm-editor-section scroll-mt-24">
          <div class="crm-editor-heading"><Building2 class="h-5 w-5" /><div>
            <h3>Direcciones</h3><p>Direcciones registradas de la empresa</p>
          </div></div>
          <p v-if="!relatedAddresses.length" class="text-sm text-[var(--dh-text-muted)]">Sin direcciones registradas.</p>
          <div v-for="address in relatedAddresses" :key="String(address.id)"
            class="mb-3 rounded-xl border border-[var(--dh-border)] p-3">
            <div class="flex items-center justify-between gap-3">
              <div><p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ address.addressType }}</p>
                <p class="text-sm">{{ address.addressText }}</p></div>
              <button v-if="can('crm.account.update')" type="button" class="crm-editor-link"
                @click="beginAddressEdit(address)">Editar</button>
            </div>
            <div v-if="editingAddressId===String(address.id)" class="mt-4 grid gap-3 md:grid-cols-2">
              <DhInput v-model="addressDraft.addressType" label="Tipo de dirección" />
              <DhInput v-model="addressDraft.location" label="Ubicación" />
              <div class="md:col-span-2"><DhTextarea v-model="addressDraft.addressText" label="Dirección completa" :rows="2" /></div>
              <div class="flex gap-2 md:col-span-2">
                <button type="button" class="crm-editor-secondary" @click="editingAddressId=''">Cancelar</button>
                <button type="button" class="crm-editor-primary" :disabled="relationSaving" @click="saveAddress">Guardar dirección</button>
              </div>
            </div>
          </div>
        </section>
        <p v-if="relatedError" role="alert" class="text-sm text-red-500">{{ relatedError }}</p>
        <p v-if="relatedSuccess" role="status" class="text-sm text-emerald-500">{{ relatedSuccess }}</p>
        <section class="crm-editor-section flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3"><Wallet class="h-5 w-5 text-[var(--dh-primary)]" /><p class="text-sm">Contactos, direcciones, rutas, crédito y contratos se gestionan desde esta misma cuenta con sus respectivos permisos.</p></div>
          <button type="button" class="crm-editor-link" @click="emit('manage-related')">Administrar registros vinculados</button>
        </section>
        <div class="sticky bottom-3 z-20 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)]/95 p-3 shadow-lg backdrop-blur">
          <span v-if="canSave" class="mr-auto text-xs text-[var(--dh-text-muted)]">Tenés cambios sin guardar</span>
          <button type="button" class="crm-editor-secondary" @click="emit('close')">Cancelar</button>
          <button type="submit" class="crm-editor-primary" :disabled="!canSave || !can('crm.account.update')">
            <Save class="h-4 w-4" />{{ saving ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
      <section v-if="loadedProfile && can('crm.credit.read')" id="crm-edit-credit"
        class="crm-editor-section scroll-mt-24">
        <CrmCreditCoverageManager :account-id="String(account.id)" :editable="can('crm.credit.manage')" @updated="emit('saved')" />
      </section>
    </div>
  </section>
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
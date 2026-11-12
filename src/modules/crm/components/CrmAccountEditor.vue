<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Building2, Save, ShieldCheck, UserRound, Wallet, X } from 'lucide-vue-next'
import { DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { useAuthStore } from '@/core/stores/authStore'
import CrmCatalogPicker from './CrmCatalogPicker.vue'
import CrmRelationshipPicker from './CrmRelationshipPicker.vue'
import CrmCreditCoverageManager from './CrmCreditCoverageManager.vue'
import CrmPhoneInput from './CrmPhoneInput.vue'
import CrmAddressLocationFields from './CrmAddressLocationFields.vue'
import CrmHaciendaLookup from './CrmHaciendaLookup.vue'
import { useCrmDraftAutosave } from '../utils/crmDraftAutosave'
import type { HaciendaResult } from './CrmHaciendaLookup.vue'
import { identificationOptionsForCountry, normalizeIdentificationType } from '../model/crmIdentification'
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
function upperAccountName(value: unknown): string {
  return String(value ?? '').toLocaleUpperCase('es-CR')
}
const accountDraft = reactive({
  displayName: '', legalName: '', countryId: '', taxIdTypeCode: '', taxId: '',
  customerTypeCode: 'cash', categoryType: 'CUSTOMER', categoryCode: 'A',
  sourceCode: '', relationshipTypeCode: '',
})
const countryLabels = ref<Record<string, string>>({})
const accountIdentificationOptions = computed(() =>
  identificationOptionsForCountry(countryLabels.value[accountDraft.countryId] || ''))
function rememberAccountCountry(item: { value: string; label: string }) {
  countryLabels.value = { ...countryLabels.value, [item.value]: item.label }
}
function updateAccountCountry(id: string) {
  if (id !== accountDraft.countryId &&
      !['01', '02'].includes(normalizeIdentificationType(accountDraft.taxIdTypeCode))) {
    accountDraft.taxIdTypeCode = ''
  }
  accountDraft.countryId = id
}
type IdentityField = keyof typeof accountDraft
// Retain historic profile fields in the PUT payload so legacy data is not cleared.
const historicalProfileKeys = [
  'phone', 'email', 'website', 'billingEmail', 'marketingEmail', 'sector',
  'businessActivity', 'products', 'companyHistory', 'activeServices',
  'presenceCountries', 'webCustomerReference', 'commercialObservations',
  'commercialStrategy', 'projectsOfInterest', 'pricingObservations',
  'tariffMonitoringNotes', 'tariffSendingNotes', 'competitorObservations',
  'operationalInstructions', 'customsInstructions', 'cargoCollectionInstructions',
  'documentReviewInstructions', 'assignedOperations', 'tradeAgreementNotes',
]
const profileGroups = [
  { title: 'Datos empresariales', fields: [
    ['phone', 'Teléfono corporativo'], ['email', 'Correo electrónico'],
    ['website', 'Sitio web'],
  ] },
] as const
const profileDraft = reactive<Record<string, string>>({})
for (const key of historicalProfileKeys) profileDraft[key] = ''
type EditorSection = 'identity' | 'commercial' | 'company' | 'contacts' | 'addresses' | 'credit'
const activeEditorSection = ref<EditorSection>('identity')
const editorSections: Array<{id: EditorSection; label: string; detail: string}> = [
  { id: 'identity', label: 'Datos de la cuenta', detail: 'Identificación y datos fiscales' },
  { id: 'commercial', label: 'Clasificación', detail: 'Tipo, categoría y relaciones' },
  { id: 'company', label: 'Datos empresariales', detail: 'Información general de la empresa' },
  { id: 'contacts', label: 'Contactos', detail: 'Personas relacionadas' },
  { id: 'addresses', label: 'Direcciones', detail: 'Ubicaciones de la cuenta' },
  { id: 'credit', label: 'Crédito', detail: 'Cobertura y condiciones' },
]
const activeProfileGroup = computed(() => activeEditorSection.value === 'company' ? profileGroups[0] : null)
const profileVersion = ref<number | null>(null)
const relatedContacts = ref<CrmRow[]>([])
const relatedAddresses = ref<CrmRow[]>([])
const editingContactId = ref('')
const creatingContact = ref(false)
function beginNewContact() {
  accountContactAutosave.stop()
  Object.assign(contactDraft, { firstName: '', lastName: '', jobTitle: '',
    email: '', phone: '', countryId: accountDraft.countryId || String(props.account.countryId ?? '') })
  editingContactId.value = ''
  creatingContact.value = true
  accountContactAutosave.begin()
  relatedError.value = ''
  relatedSuccess.value = ''
}
const editingAddressId = ref('')
const contactDraft = reactive({ firstName: '', lastName: '', jobTitle: '', email: '', phone: '', countryId: '' })
const addressDraft = reactive({
  addressType: 'WORK', addressText: '', location: '',
  countryId: '', countryCode: '', admin1Code: '', admin1Name: '',
  admin2Code: '', admin2Name: '', admin3Code: '', admin3Name: '', postalCode: '',
})
const creatingAddress = ref(false)
const accountContactAutosave = useCrmDraftAutosave({
  scope: () => 'account-contact:' + props.account.id + ':' + (editingContactId.value || 'new'),
  enabled: () => props.open && (creatingContact.value || Boolean(editingContactId.value)),
  capture: () => ({ ...contactDraft }),
  apply: (snapshot) => { Object.assign(contactDraft, snapshot) },
})
const accountAddressAutosave = useCrmDraftAutosave({
  scope: () => 'account-address:' + props.account.id + ':' + (editingAddressId.value || 'new'),
  enabled: () => props.open && (creatingAddress.value || Boolean(editingAddressId.value)),
  capture: () => ({ ...addressDraft }),
  apply: (snapshot) => { Object.assign(addressDraft, snapshot) },
})
function beginNewAddress() {
  accountAddressAutosave.stop()
  Object.assign(addressDraft, {
    addressType: 'WORK', addressText: '', location: '',
    countryId: accountDraft.countryId || String(props.account.countryId ?? ''), countryCode: '', admin1Code: '', admin1Name: '', admin2Code: '', admin2Name: '',
    admin3Code: '', admin3Name: '', postalCode: '',
  })
  editingAddressId.value = ''
  creatingAddress.value = true
  accountAddressAutosave.begin()
  relatedError.value = ''
}
const relationSaving = ref(false)
const relatedError = ref('')
const relatedSuccess = ref('')

function beginContactEdit(contact: CrmRow) {
  accountContactAutosave.stop()
  creatingContact.value = false
  editingContactId.value = String(contact.id)
  // Don't infer compound surnames from a legacy full name.
  Object.assign(contactDraft, { firstName: String(contact.firstName ?? ''),
    lastName: String(contact.lastName ?? ''), jobTitle: String(contact.jobTitle ?? ''),
    email: String(contact.email ?? ''), phone: String(contact.phone ?? ''),
    countryId: String(contact.countryId || props.account.countryId || '') })
  editingAddressId.value = ''
  accountContactAutosave.begin()
  relatedError.value = ''
}
function beginAddressEdit(address: CrmRow) {
  accountAddressAutosave.stop()
  editingAddressId.value = String(address.id)
  Object.assign(addressDraft, {
    addressType: String(address.addressType ?? 'WORK'),
    addressText: String(address.addressText ?? ''), location: String(address.location ?? ''),
    countryId: String(address.countryId || accountDraft.countryId || props.account.countryId || ''),
    countryCode: String(address.countryCode ?? ''),
    admin1Code: String(address.admin1Code ?? ''), admin1Name: String(address.admin1Name ?? ''),
    admin2Code: String(address.admin2Code ?? ''), admin2Name: String(address.admin2Name ?? ''),
    admin3Code: String(address.admin3Code ?? ''), admin3Name: String(address.admin3Name ?? ''),
    postalCode: String(address.postalCode ?? ''),
  })
  creatingAddress.value = false
  creatingContact.value = false
  editingContactId.value = ''
  accountAddressAutosave.begin()
  relatedError.value = ''
}
async function saveContact() {
  const previous = relatedContacts.value.find(c => String(c.id) === editingContactId.value)
  if ((!previous && !creatingContact.value) || relationSaving.value ||
      (previous ? !can('crm.contact.update') : !can('crm.contact.create'))) return
  if (!contactDraft.firstName.trim() || !contactDraft.lastName.trim()) {
    relatedError.value = 'Nombre(s) y apellido(s) del contacto son obligatorios.'; return
  }
  relationSaving.value = true
  relatedError.value = ''
  try {
    const payload = {
      ...contactDraft, countryId: contactDraft.countryId || props.account.countryId || null,
      name: [contactDraft.firstName.trim(), contactDraft.lastName.trim()].join(' '),
    }
    const updated = previous
      ? await crmPatch<CrmRow>('contacts', String(previous.id), {
          ...payload, expectedVersion: previous.rowVersion,
        })
      : await crmRequest<CrmRow>(crmPath('accounts', String(props.account.id), 'contacts'),
          'POST', { ...payload, relationRole: 'CONTACT', isPrimary: false })
    relatedContacts.value = previous
      ? relatedContacts.value.map(c => c.id === updated.id ? updated : c)
      : [...relatedContacts.value, updated]
    accountContactAutosave.commit()
    editingContactId.value = ''
    creatingContact.value = false
    relatedSuccess.value = previous ? 'Contacto actualizado.' : 'Contacto creado y vinculado a esta cuenta.'
    emit('saved')
  } catch (cause) { relatedError.value = crmError(cause) }
  finally { relationSaving.value = false }
}
async function saveAddress() {
  const previous = relatedAddresses.value.find(a => String(a.id) === editingAddressId.value)
  if ((!previous && !creatingAddress.value) || !can('crm.account.update') || relationSaving.value) return
  if (!addressDraft.addressText.trim()) { relatedError.value = 'La dirección es obligatoria.'; return }
  relationSaving.value = true
  relatedError.value = ''
  try {
    const updated = previous
      ? await crmPatch<CrmRow>('addresses', String(previous.id), {
          ...addressDraft, expectedVersion: previous.rowVersion,
        })
      : await crmRequest<CrmRow>(crmPath('accounts', String(props.account.id), 'addresses'),
          'POST', { ...addressDraft, countryId: addressDraft.countryId || props.account.countryId || null,
            contactId: null })
    relatedAddresses.value = previous
      ? relatedAddresses.value.map(a => a.id === updated.id ? updated : a)
      : [...relatedAddresses.value, updated]
    accountAddressAutosave.commit()
    editingAddressId.value = ''
    creatingAddress.value = false
    relatedSuccess.value = previous ? 'Dirección actualizada.' : 'Dirección registrada.'
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
function captureAccountDraft() {
  return { identity: { ...accountDraft }, business: { ...profileDraft } }
}
const accountAutosave = useCrmDraftAutosave({
  scope: () => 'account-edit:' + props.account.id,
  enabled: () => props.open && loadedProfile.value,
  capture: captureAccountDraft,
  apply: (snapshot: ReturnType<typeof captureAccountDraft>) => {
    Object.assign(accountDraft, snapshot.identity)
    Object.assign(profileDraft, snapshot.business)
  },
})
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
  accountAutosave.stop()
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
    creatingContact.value = false
    editingAddressId.value = ''
    creatingAddress.value = false
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
    accountAutosave.begin()
  } catch (cause) {
    error.value = 'No se pudo cargar la ficha empresarial. ' + crmError(cause)
  } finally { loading.value = false }
}
watch(() => [props.open, props.account.id], ([open]) => {
  if (open) { activeEditorSection.value = 'identity'; void load() }
}, { immediate: true })
function resolved(data: HaciendaResult) {
  if (data.identification.replace(/[\s-]/g, '') !== accountDraft.taxId.replace(/[\s-]/g, '')) return
  accountDraft.displayName = upperAccountName(data.name)
  accountDraft.legalName = upperAccountName(data.name)
  if (data.identificationType) accountDraft.taxIdTypeCode = normalizeIdentificationType(data.identificationType)
}
async function save() {
  if (!can('crm.account.update') || !loadedProfile.value || !canSave.value) return
  accountDraft.displayName = upperAccountName(accountDraft.displayName).trim()
  accountDraft.legalName = upperAccountName(accountDraft.legalName).trim()
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
    accountAutosave.commit()
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
      <div v-if="!loading && loadedProfile" class="grid gap-4 lg:grid-cols-[235px_minmax(0,1fr)]" data-crm-editor-tabs>
        <nav class="flex min-w-0 gap-2 overflow-x-auto rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-2 lg:flex-col lg:overflow-visible lg:self-start" aria-label="Secciones editables">
          <button v-for="section in editorSections.filter(item=>item.id!=='credit'||can('crm.credit.read'))"
            :key="section.id" type="button" class="crm-editor-tab"
            :aria-current="activeEditorSection===section.id?'step':undefined"
            :class="activeEditorSection===section.id?'crm-editor-tab-active':''"
            @click="activeEditorSection=section.id">
            <span class="block whitespace-nowrap text-left text-sm font-bold">{{ section.label }}</span>
            <span class="hidden text-left text-[11px] text-[var(--dh-text-muted)] lg:block">{{ section.detail }}</span>
          </button>
        </nav>
        <div class="min-w-0">
      <form v-if="!loading && loadedProfile" class="space-y-4" @submit.prevent="save">
        <p v-if="accountAutosave.status.value !== 'idle'" role="status" class="text-xs text-[var(--dh-text-muted)]">
          {{ accountAutosave.status.value === 'restored' ? 'Se recuperaron los cambios de la ficha.' :
            accountAutosave.status.value === 'saved' ? 'Borrador guardado automáticamente en este navegador.' :
            'El navegador no pudo guardar el borrador local.' }}
        </p>
        <section v-show="activeEditorSection==='identity'" id="crm-edit-identity" class="crm-editor-section">
          <div class="crm-editor-heading"><Building2 class="h-5 w-5" /><div><h3>Identidad del cliente</h3><p>Información comercial y tributaria</p></div></div>
          <div class="grid gap-4 md:grid-cols-2">
            <DhInput :model-value="accountDraft.displayName" label="Nombre comercial *"
               @update:model-value="accountDraft.displayName=upperAccountName($event)" />
            <DhInput :model-value="accountDraft.legalName" label="Razón social *"
               @update:model-value="accountDraft.legalName=upperAccountName($event)" />
            <CrmCatalogPicker :key="props.account.id" label="País" catalog-group-slug="countries" value-kind="id"
              :model-value="accountDraft.countryId" @resolved-label="rememberAccountCountry"
              @update:model-value="updateAccountCountry" />
            <DhInput v-model="accountDraft.taxId" label="Identificación fiscal" />
            <DhSelect label="Tipo de identificación" :model-value="normalizeIdentificationType(accountDraft.taxIdTypeCode)"
              :disabled="!accountDraft.countryId" placeholder="Seleccionar tipo de identificación"
              :options="accountIdentificationOptions" @update:model-value="accountDraft.taxIdTypeCode=String($event)" />
            <div class="flex flex-col justify-end"><CrmHaciendaLookup :country-id="accountDraft.countryId"
              :tax-id="accountDraft.taxId" @resolved="resolved" /></div>
          </div>
        </section>
        <section v-show="activeEditorSection==='commercial'" id="crm-edit-commercial" class="crm-editor-section">
          <div class="crm-editor-heading"><UserRound class="h-5 w-5" /><div><h3>Clasificación comercial</h3><p>Datos que utiliza el equipo de ventas</p></div></div>
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DhSelect label="Condición de cliente" :model-value="accountDraft.customerTypeCode"
              :options="[{label:'Contado',value:'cash'},{label:'Crédito',value:'credit'}]"
              @update:model-value="accountDraft.customerTypeCode=String($event)" />
            <DhSelect label="Tipo de cuenta" :disabled="!can('crm.account.category.manage')" :model-value="accountDraft.categoryType"
              :options="[{label:'Cliente',value:'CUSTOMER'},{label:'Agente / NVOCC',value:'NVOCC'},{label:'Cargas Little',value:'LITTLE'}]"
              @update:model-value="accountDraft.categoryType=String($event);accountDraft.categoryCode='A'" />
            <DhSelect label="Categoría" :disabled="!can('crm.account.category.manage')" :model-value="accountDraft.categoryCode"
              :options="(accountDraft.categoryType==='LITTLE'?['A']:accountDraft.categoryType==='NVOCC'?['A','B']:['A','B','C','D']).map(value=>({label:accountDraft.categoryType==='LITTLE'?'Cargas Little':'Categoría '+value,value}))"
              @update:model-value="accountDraft.categoryCode=String($event)" />
            <p v-if="!can('crm.account.category.manage')" class="text-xs text-[var(--dh-text-muted)] md:col-span-2">La clasificación solo puede modificarse con el permiso CRM · Clientes · Asignar categoría.</p>
            <DhInput v-model="accountDraft.sourceCode" label="Origen de la cuenta" />
            <CrmRelationshipPicker :model-value="accountDraft.relationshipTypeCode" label="Tipos de relación"
              @update:model-value="accountDraft.relationshipTypeCode=$event" />
          </div>
        </section>
        <section v-if="activeEditorSection==='company'" id="crm-edit-company" class="space-y-4">
          <h3 class="px-1 text-sm font-extrabold">{{ editorSections.find(item=>item.id===activeEditorSection)?.label }}</h3>
          <section v-if="activeProfileGroup" :key="activeEditorSection" class="crm-editor-section">
          <div class="crm-editor-heading"><ShieldCheck class="h-5 w-5" /><div><h3>{{ activeProfileGroup.title }}</h3><p>Información complementaria del cliente</p></div></div>
          <div class="grid gap-4 md:grid-cols-2">
            <div v-for="[key,label] in activeProfileGroup.fields" :key="key"
              :class="['email','website','phone','billingEmail','marketingEmail','sector','webCustomerReference','assignedOperations'].includes(key) ? '' : 'md:col-span-2'">
              <DhTextarea v-if="!['email','website','phone','billingEmail','marketingEmail','sector','webCustomerReference','assignedOperations'].includes(key)"
                :label="label"  :model-value="profileDraft[key] ?? ''" @update:model-value="profileDraft[key]=$event" :rows="2" />
              <CrmPhoneInput v-else-if="key === 'phone'" :label="label"
                :country-id="accountDraft.countryId" :model-value="profileDraft[key] ?? ''"
                @update:model-value="profileDraft[key]=$event" />
              <DhInput v-else :label="label"  :model-value="profileDraft[key] ?? ''"
                @update:model-value="profileDraft[key]=$event" />
            </div>
          </div>
        </section>
        </section>
        <section v-if="can('crm.contact.read') || can('crm.contact.create')" v-show="activeEditorSection==='contacts'" id="crm-edit-contacts" class="crm-editor-section">
          <div class="crm-editor-heading"><UserRound class="h-5 w-5" /><div>
            <h3>Contactos vinculados</h3><p>Editá los contactos sin salir de esta cuenta.</p>
          </div></div>
          <button v-if="can('crm.contact.create')" type="button" class="crm-editor-secondary mb-3"
            @click="beginNewContact">Agregar contacto</button>
          <div v-if="creatingContact" class="mb-4 grid gap-3 rounded-xl border border-[var(--dh-border)] p-3 md:grid-cols-2">
            <DhInput v-model="contactDraft.firstName" label="Nombre(s) *" />
            <DhInput v-model="contactDraft.lastName" label="Apellido(s) *" />
            <DhInput v-model="contactDraft.jobTitle" label="Puesto" />
            <DhInput v-model="contactDraft.email" label="Correo electrónico" type="email" />
            <CrmPhoneInput v-model="contactDraft.phone" :country-id="contactDraft.countryId" label="Teléfono" />
            <CrmCatalogPicker v-model="contactDraft.countryId" label="País" catalog-group-slug="countries" value-kind="id" />
            <div class="flex gap-2 md:col-span-2">
              <button type="button" class="crm-editor-secondary" @click="creatingContact=false">Cancelar</button>
              <button type="button" class="crm-editor-primary" :disabled="relationSaving" @click="saveContact">Crear contacto</button>
            </div>
          </div>
          <p v-if="!relatedContacts.length && !creatingContact" class="text-sm text-[var(--dh-text-muted)]">No hay contactos registrados.</p>
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
              <CrmPhoneInput v-model="contactDraft.phone" :country-id="contactDraft.countryId" label="Teléfono" />
              <CrmCatalogPicker v-model="contactDraft.countryId" label="País" catalog-group-slug="countries" />
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
        <section v-show="activeEditorSection==='addresses'" id="crm-edit-addresses" class="crm-editor-section">
          <div class="crm-editor-heading"><Building2 class="h-5 w-5" /><div>
            <h3>Direcciones</h3><p>Direcciones registradas de la empresa</p>
          </div></div>
          <button v-if="can('crm.account.update')" type="button" class="crm-editor-secondary mb-3"
            @click="beginNewAddress">Agregar dirección</button>
          <p v-if="!relatedAddresses.length" class="text-sm text-[var(--dh-text-muted)]">Sin direcciones registradas.</p>
          <div v-if="creatingAddress" class="mb-4 grid gap-3 rounded-xl border border-[var(--dh-border)] p-3">
            <DhInput v-model="addressDraft.addressType" label="Tipo de dirección" />
            <CrmAddressLocationFields :model-value="addressDraft"
                :default-country-id="accountDraft.countryId || String(account.countryId ?? '')"
                @update:model-value="Object.assign(addressDraft, $event)" />
            <DhInput v-model="addressDraft.location" label="Referencia / ubicación adicional" />
            <DhTextarea v-model="addressDraft.addressText" label="Dirección exacta" :rows="3" />
            <div class="flex gap-2">
              <button type="button" class="crm-editor-secondary" @click="creatingAddress=false">Cancelar</button>
              <button type="button" class="crm-editor-primary" :disabled="relationSaving" @click="saveAddress">Crear dirección</button>
            </div>
          </div>
          <div v-for="address in relatedAddresses" :key="String(address.id)"
            class="mb-3 rounded-xl border border-[var(--dh-border)] p-3">
            <div class="flex items-center justify-between gap-3">
              <div><p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ address.addressType }}</p>
                <p class="text-sm">{{ address.addressText }}</p>
                <p v-if="address.countryCode" class="mt-1 text-xs text-[var(--dh-text-muted)]">
                  {{ [address.admin3Name, address.admin2Name, address.admin1Name, address.countryCode].filter(Boolean).join(', ') }}
                  <span v-if="address.postalCode"> · CP {{ address.postalCode }}</span>
                </p></div>
              <button v-if="can('crm.account.update')" type="button" class="crm-editor-link"
                @click="beginAddressEdit(address)">Editar</button>
            </div>
            <div v-if="editingAddressId===String(address.id)" class="mt-4 grid gap-3 md:grid-cols-2">
              <DhInput v-model="addressDraft.addressType" label="Tipo de dirección" />
              <DhInput v-model="addressDraft.location" label="Referencia / ubicación adicional" />
              <div class="md:col-span-2"><CrmAddressLocationFields :model-value="addressDraft"
                :default-country-id="accountDraft.countryId || String(account.countryId ?? '')"
                @update:model-value="Object.assign(addressDraft, $event)" /></div>
              <div class="md:col-span-2"><DhTextarea v-model="addressDraft.addressText" label="Dirección completa" :rows="2" /></div>
              <div class="flex gap-2 md:col-span-2">
                <button type="button" class="crm-editor-secondary" @click="editingAddressId=''">Cancelar</button>
                <button type="button" class="crm-editor-primary" :disabled="relationSaving" @click="saveAddress">Guardar dirección</button>
              </div>
            </div>
          </div>
        </section>
        <p v-if="relatedError && ['contacts','addresses'].includes(activeEditorSection)" role="alert" class="text-sm text-red-500">{{ relatedError }}</p>
        <p v-if="relatedSuccess && ['contacts','addresses'].includes(activeEditorSection)" role="status" class="text-sm text-emerald-500">{{ relatedSuccess }}</p>
        <section v-show="['contacts','addresses'].includes(activeEditorSection)" class="crm-editor-section flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3"><Wallet class="h-5 w-5 text-[var(--dh-primary)]" /><p class="text-sm">Contactos, direcciones, rutas, crédito y contratos se gestionan desde esta misma cuenta con sus respectivos permisos.</p></div>
          <button type="button" class="crm-editor-link" @click="emit('manage-related')">Administrar registros vinculados</button>
        </section>
        <div v-if="activeEditorSection!=='credit'" class="sticky bottom-3 z-20 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)]/95 p-3 shadow-lg backdrop-blur">
          <span v-if="canSave" class="mr-auto text-xs text-[var(--dh-text-muted)]">Tenés cambios sin guardar</span>
          <button type="button" class="crm-editor-secondary" @click="emit('close')">Cancelar</button>
          <button type="submit" class="crm-editor-primary" :disabled="!canSave || !can('crm.account.update')">
            <Save class="h-4 w-4" />{{ saving ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
      <section v-if="loadedProfile && can('crm.credit.read')" v-show="activeEditorSection==='credit'" id="crm-edit-credit"
        class="crm-editor-section">
        <p class="mb-4 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 text-xs text-[var(--dh-text-muted)]">
          Las solicitudes y coberturas de crédito se guardan por separado de los datos generales. Utilizá sus botones de solicitud, guardar o aprobación.
        </p>
        <CrmCreditCoverageManager :account-id="String(account.id)" :editable="can('crm.credit.manage')" @updated="emit('saved')" />
      </section>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.crm-editor-section{border:1px solid var(--dh-border);border-radius:1.15rem;padding:1.25rem 1.4rem;background:var(--dh-card);box-shadow:var(--dh-shadow-sm)}
.crm-editor-tab{display:block;min-width:max-content;text-align:left;border:1px solid transparent;border-radius:.8rem;padding:.75rem .9rem;transition:background .15s}
.crm-editor-tab:hover{background:var(--dh-card-hover)}
.crm-editor-tab-active{background:var(--dh-primary);color:white;border-color:var(--dh-primary)}
.crm-editor-tab-active span{color:white}
.crm-editor-heading{display:flex;align-items:center;gap:.75rem;margin-bottom:1.2rem;color:var(--dh-primary)}
.crm-editor-heading h3{font-size:.94rem;font-weight:850;color:var(--dh-text)}
.crm-editor-heading p{font-size:.72rem;color:var(--dh-text-muted);margin-top:.2rem}
.crm-editor-primary{display:inline-flex;align-items:center;gap:.45rem;padding:.7rem 1rem;border-radius:.75rem;background:var(--dh-primary);font-weight:800;color:white;font-size:.82rem}
.crm-editor-primary:disabled{opacity:.45}
.crm-editor-secondary,.crm-editor-link{padding:.65rem .8rem;border-radius:.7rem;border:1px solid var(--dh-border);font-weight:700;font-size:.78rem}
.crm-editor-link{color:var(--dh-primary)}
</style>
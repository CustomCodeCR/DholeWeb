<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Save, Plus, Trash2, ShieldCheck, RefreshCw } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhSearchInput } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { useAuthStore } from '@/core/stores/authStore'
import { crmPath, crmRequest } from '@/modules/crm/services/crmApi'
import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'
import { operationsApi, type ApertureDraft, type CrmAccountOption } from '../services/operationsApi'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const caseId = computed(() => typeof route.params.id === 'string' ? route.params.id : '')
const editing = computed(() => Boolean(caseId.value))
const isAdmin = computed(() => ['SuperAdmin', 'SuperUsuario', 'SuperUser', 'superusuario'].some(auth.hasRole))
const canCreate = computed(() => auth.hasScope('operations.case.create'))
const companyId = ref('')
const counterReady = ref(false)
const lastHistoricalIdtra = ref('')
const counterReference = ref('')
const accountId = ref('')
const clientQuery = ref('')
const accounts = ref<CrmAccountOption[]>([])
const divisionOptions = ref<Array<{ label: string; value: string }>>([])
const operationalContacts = ref<Array<{ id: string; name: string; email: string; isActive: boolean }>>([])
const accountLoading = ref(false)
const form = ref({ modalityCode: 'FCL', priority: 1, complexityPoints: 1,
  originCountryCode: '', destinationCountryCode: '' })
const error = ref('')
const message = ref('')
const loading = ref(true)
const busy = ref(false)
const counterBusy = ref(false)
const completeness = ref<string[]>([])
const idtra = ref('')
const recordVersion = ref(0)
const recordStatus = ref('DRAFT')
const catalogLoading = ref(false)
const catalogErrors = ref<string[]>([])
const catalogs = ref<Record<string, CatalogItemSelectDto[]>>({})
const etdInput = ref('')
const etaInput = ref('')
const serviceSearch = ref('')

function emptyDraft(): ApertureDraft {
  return {
    clientPoReference: null, crmDivisionId: null,
    shipmentTypeCode: null, transportTypeCode: 'MARITIME', incotermCode: null,
    polCode: null, poeCode: null, podCode: null, cargoDescription: null,
    weightValue: null, weightUnit: 'KG', volumeValue: null, volumeUnit: 'CBM',
    packageCount: null, packageTypeCode: null, requiresPickup: false,
    pickupAddress: null, pickupContact: null, pickupWindow: null,
    warehouseName: null, consolidationReference: null, isImo: false,
    imoClass: null, unNumber: null, stackable: null, isOverweight: false,
    overweightNotes: null, carrierCode: null, agentCode: null,
    merchantCode: null, bookingReference: null, collectionReference: null,
    estimatedDepartureAtUtc: null, estimatedArrivalAtUtc: null,
    observations: null, equipment: [], serviceCodes: [],
  }
}
const draft = ref<ApertureDraft>(emptyDraft())
const isMaritime = computed(() => draft.value.transportTypeCode === 'MARITIME')
const isCargo = computed(() => form.value.modalityCode !== 'DOCUMENT_ONLY')
const hasWHS = computed(() => ['LCL', 'LTL'].includes(form.value.modalityCode))
const canSave = computed(() => !busy.value && Boolean(accountId.value) &&
  (editing.value || Boolean(companyId.value) && counterReady.value))
const accountOptions = computed(() => [
  { label: 'Seleccionar cliente', value: '' },
  ...accounts.value.map(x => ({ label: x.displayName || x.legalName || x.id, value: x.id })),
])
const selections = (slug: string) => [
  { label: 'Pendiente / No aplica', value: '' },
  ...(catalogs.value[slug] || []).filter(x => x.isActive !== false)
    .map(x => ({ label: x.label, value: x.code || x.id })),
]
const locationOptions = (slug: string) =>
  (catalogs.value[slug] || []).filter(x => x.isActive !== false).map(x => ({
    value: x.code || x.id, label: x.label,
    searchText: [x.code, x.slug].filter(Boolean).join(' '),
  }))
const offeredServices = computed(() =>
  (catalogs.value['pricing-services'] || []).filter(x =>
    x.isActive !== false &&
    (!serviceSearch.value || (x.label + ' ' + x.code).toLowerCase().includes(serviceSearch.value.toLowerCase()))))
const availableEquipment = computed(() => selections('container-types'))
const modes = [
  { label: 'FCL', value: 'FCL' }, { label: 'LCL', value: 'LCL' },
  { label: 'FTL', value: 'FTL' }, { label: 'LTL', value: 'LTL' },
  { label: 'Aéreo', value: 'AIR' }, { label: 'Multimodal', value: 'MULTIMODAL' },
]
const shipmentTypes = [
  { label: 'Pendiente', value: '' },
  { label: 'Importación', value: 'IMPORT' },
  { label: 'Exportación', value: 'EXPORT' },
  { label: 'Nacional / Local', value: 'DOMESTIC' },
]
const transportTypes = [
  { label: 'Marítimo', value: 'MARITIME' },
  { label: 'Aéreo', value: 'AIR' },
  { label: 'Terrestre', value: 'GROUND' },
  { label: 'Multimodal', value: 'MULTIMODAL' },
]
const boolOptions = [
  { label: 'Pendiente', value: '' }, { label: 'Sí', value: 'yes' },
  { label: 'No', value: 'no' },
]
const asNumber = (v: string | number) => v === '' || v === null || v === undefined ? null : Number(v)
const toNullable = (v: string) => v.trim() || null
const isoDate = (value: string) => value ? new Date(value).toISOString() : null
function toLocal(value: string | null | undefined) {
  if (!value) return ''
  const d = new Date(value)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
function displayError(cause: unknown) {
  return cause instanceof Error ? cause.message : 'No se pudo guardar la apertura.'
}
async function loadAccounts() {
  accountLoading.value = true
  try {
    const data = await operationsApi.crmAccounts(clientQuery.value)
    accounts.value = data.items
  } catch (cause) {
    error.value = 'No se pudo consultar cuentas CRM: ' + displayError(cause)
  } finally { accountLoading.value = false }
}
async function loadClientDetails(id: string) {
  divisionOptions.value = []
  operationalContacts.value = []
  if (!id) return
  try {
    const account = await crmRequest<Record<string, unknown>>(crmPath('accounts', id))
    const raw = Array.isArray(account.divisions) ? account.divisions : []
    divisionOptions.value = raw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .filter(x => typeof x.id === 'string')
      .map(x => ({ label: String(x.name || x.displayName || x.id), value: String(x.id) }))
  } catch { /* Division is optional and CRM owns the master. */ }
  try {
    const response = await crmRequest<unknown>(crmPath('accounts', id, 'operations-contacts'))
    const contacts = Array.isArray(response) ? response :
      response && typeof response === 'object' && 'items' in response &&
      Array.isArray((response as { items: unknown }).items) ?
      (response as { items: Array<unknown> }).items : []
    operationalContacts.value = contacts
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .filter(x => typeof x.id === 'string')
      .map(x => ({
        id: String(x.id), name: String(x.displayName || x.name || ''),
        email: String(x.email || x.emailAddress || ''),
        isActive: x.isActive !== false,
      }))
  } catch {
    // No recipients are guessed when CRM does not expose that feature.
  }
}
async function loadCatalogs() {
  catalogLoading.value = true
  const slugs = ['pol', 'poe', 'pod', 'incoterms', 'pricing-services',
    'container-types', 'carriers', 'agents', 'merchants', 'countries']
  const results = await Promise.all(slugs.map(async slug => {
    try { return [slug, await CatalogItemsService.select({ catalogGroupSlug: slug })] as const }
    catch { catalogErrors.value.push(slug); return [slug, [] as CatalogItemSelectDto[]] as const }
  }))
  catalogs.value = Object.fromEntries(results)
  catalogLoading.value = false
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(clientQuery, () => {
  clearTimeout(timer)
  timer = setTimeout(() => { void loadAccounts() }, 300)
})
watch(accountId, id => { void loadClientDetails(id) })
watch(() => form.value.modalityCode, mod => {
  if (mod === 'AIR') draft.value.transportTypeCode = 'AIR'
  else if (mod === 'FTL' || mod === 'LTL') draft.value.transportTypeCode = 'GROUND'
  else if (mod === 'MULTIMODAL') draft.value.transportTypeCode = 'MULTIMODAL'
  else draft.value.transportTypeCode = 'MARITIME'
})
async function initializeTeams() {
  if (!isAdmin.value) return
  busy.value = true
  try {
    await operationsApi.initializeTeams()
    companyId.value = (await operationsApi.createContext()).companyId || ''
  } catch (cause) { error.value = displayError(cause) }
  finally { busy.value = false }
}
async function synchronizeCounter() {
  if (!isAdmin.value || counterBusy.value || !/^IDTRA[0-9]+$/i.test(lastHistoricalIdtra.value.trim()) ||
      !counterReference.value.trim()) return
  counterBusy.value = true
  error.value = ''
  try {
    const answer = await operationsApi.synchronizeIdtraCounter(
      lastHistoricalIdtra.value.trim().toUpperCase(), counterReference.value.trim())
    counterReady.value = answer.ready
    message.value = 'Contador histórico sincronizado. El siguiente número será ' + answer.nextFormat
  } catch (cause) { error.value = displayError(cause) }
  finally { counterBusy.value = false }
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    if (editing.value) {
      const [caseInfo, saved] = await Promise.all([
        operationsApi.caseDetail(caseId.value),
        operationsApi.apertureDetails(caseId.value),
      ])
      if (caseInfo.apertureType !== 'MANUAL') {
        error.value = 'Los datos heredados de una QUO aceptada no se modifican desde una apertura manual.'
        return
      }
      recordVersion.value = saved.version
      recordStatus.value = saved.status
      idtra.value = caseInfo.idtra
      accountId.value = caseInfo.accountId
      companyId.value = caseInfo.companyId
      counterReady.value = true
      form.value = {
        modalityCode: caseInfo.modalityCode,
        priority: caseInfo.priority,
        complexityPoints: caseInfo.complexityPoints,
        originCountryCode: caseInfo.originCountryCode || '',
        destinationCountryCode: caseInfo.destinationCountryCode || '',
      }
      draft.value = { ...emptyDraft(), ...saved.details,
        equipment: saved.details.equipment || [],
        serviceCodes: saved.details.serviceCodes || [] }
      completeness.value = saved.missingBlocking || []
      etdInput.value = toLocal(draft.value.estimatedDepartureAtUtc)
      etaInput.value = toLocal(draft.value.estimatedArrivalAtUtc)
    } else {
      const context = await operationsApi.createContext()
      companyId.value = context.companyId || ''
      counterReady.value = context.idtraCounterReady
    }
    await Promise.all([loadAccounts(), loadCatalogs()])
  } catch (cause) { error.value = displayError(cause) }
  finally { loading.value = false }
}
function draftForSave(): ApertureDraft {
  return {
    ...draft.value,
    estimatedDepartureAtUtc: isoDate(etdInput.value),
    estimatedArrivalAtUtc: isoDate(etaInput.value),
    serviceCodes: [...draft.value.serviceCodes],
    equipment: draft.value.equipment.map(x => ({
      equipmentCode: x.equipmentCode.trim(), quantity: Number(x.quantity),
    })),
  }
}
function toggleService(code: string, selected: boolean) {
  draft.value.serviceCodes = selected
    ? [...new Set([...draft.value.serviceCodes, code])]
    : draft.value.serviceCodes.filter(x => x !== code)
}
function toggleContact(id: string, selected: boolean) {
  draft.value.operationalContactIds = selected
    ? [...new Set([...(draft.value.operationalContactIds || []), id])]
    : (draft.value.operationalContactIds || []).filter(x => x !== id)
}
async function save() {
  if (!canSave.value) return
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    const details = draftForSave()
    if (editing.value) {
      const result = await operationsApi.updateApertureDetails(
        caseId.value, recordVersion.value, details, {
          modalityCode: form.value.modalityCode,
          originCountryCode: toNullable(form.value.originCountryCode.toUpperCase()),
          destinationCountryCode: toNullable(form.value.destinationCountryCode.toUpperCase()),
          priority: Number(form.value.priority),
          complexityPoints: Number(form.value.complexityPoints),
        })
      recordVersion.value = result.version
      completeness.value = result.missingBlocking
      message.value = 'Borrador del trámite actualizado y auditado.'
    } else {
      const created = await operationsApi.createAperture({
        companyId: companyId.value, accountId: accountId.value,
        modalityCode: form.value.modalityCode,
        priority: Number(form.value.priority),
        complexityPoints: Number(form.value.complexityPoints),
        originCountryCode: toNullable(form.value.originCountryCode.toUpperCase()),
        destinationCountryCode: toNullable(form.value.destinationCountryCode.toUpperCase()),
        details,
      })
      await router.replace({ name: 'operations-case-detail', params: { id: created.id } })
    }
  } catch (cause) { error.value = displayError(cause) }
  finally { busy.value = false }
}
async function submitValidation() {
  if (!editing.value || recordStatus.value !== 'DRAFT' || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const submitted = await operationsApi.submitAperture(caseId.value, recordVersion.value)
    recordVersion.value = submitted.version
    recordStatus.value = submitted.status
    await router.push({ name: 'operations-case-detail', params: { id: caseId.value } })
  } catch (cause) { error.value = 'No se puede enviar para validar: ' + displayError(cause) }
  finally { busy.value = false }
}
onMounted(() => { void load() })
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div class="mx-auto w-full max-w-[1640px] space-y-5 px-3 py-5 sm:px-6 lg:px-9">
    <RouterLink to="/operations/cases" class="inline-flex items-center gap-2 text-sm font-semibold text-[var(--dh-primary)]">
      <ArrowLeft class="h-4 w-4" /> Volver a Trámites
    </RouterLink>
    <DhPageHeader :title="editing ? 'Editar Apertura · ' + idtra : 'Nuevo trámite · Apertura manual'"
      subtitle="Formulario completo del expediente. Guarda un borrador incompleto y completa los campos requeridos antes de validar."
      :hide-excel-export="true">
      <template #actions>
        <DhButton variant="secondary" :icon="RefreshCw" label="Actualizar" :loading="loading" @click="load" />
        <DhButton :icon="Save" label="Guardar borrador" :disabled="!canSave || loading" :loading="busy" @click="save" />
      </template>
    </DhPageHeader>
    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{{ error }}</div>
    <div v-if="message" role="status" class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">{{ message }}</div>
    <div v-if="loading" class="rounded-2xl bg-[var(--dh-input)] p-8 text-center text-sm">Cargando datos de CRM y Config…</div>
    <template v-else>
      <DhCard v-if="!counterReady && !editing" title="Consecutivo IDTRA pendiente de sincronización"
        subtitle="El IDTRA se asigna automáticamente desde el contador global de PostgreSQL.">
        <p class="mb-3 text-sm text-[var(--dh-text-muted)]">
          Para conservar el contador real de Dynamics, un administrador debe registrar el último IDTRA
          existente antes de crear uno nuevo. No se empezará desde 1 ni se reiniciará el histórico.
        </p>
        <div v-if="isAdmin" class="grid gap-3 sm:grid-cols-2">
          <DhInput v-model="lastHistoricalIdtra" label="Último IDTRA histórico" placeholder="IDTRA12345" />
          <DhInput v-model="counterReference" label="Referencia de verificación" placeholder="Dynamics · fecha y origen de verificación" />
          <DhButton :icon="ShieldCheck" label="Sincronizar consecutivo" :loading="counterBusy"
            :disabled="!/^IDTRA[0-9]+$/i.test(lastHistoricalIdtra.trim()) || !counterReference.trim()"
            @click="synchronizeCounter" />
        </div>
        <p v-else class="text-sm text-amber-400">Solicite al administrador la sincronización del histórico de IDTRA.</p>
      </DhCard>
      <DhCard v-if="!companyId && isAdmin" title="Empresa operativa"
        subtitle="El catálogo de equipos aún no ha sido inicializado en este entorno.">
        <DhButton variant="secondary" label="Inicializar equipos de Operations" @click="initializeTeams" />
      </DhCard>
      <DhCard title="1 · Cliente y referencia comercial"
        subtitle="El cliente y su ejecutivo proceden de CRM. La QUO no es obligatoria para una apertura manual.">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <DhSearchInput v-model="clientQuery" placeholder="Buscar cuenta CRM por nombre o cédula" />
            <DhSelect v-model="accountId" label="Cuenta cliente" :options="accountOptions"
              :disabled="editing || accountLoading" />
          </div>
          <DhInput v-model="draft.clientPoReference" label="PO / Referencia del cliente" placeholder="Orden de compra / referencia" />
          <DhSelect v-model="draft.crmDivisionId" label="División del cliente (si aplica)"
            :options="[{ label: 'Sin división', value: '' }, ...divisionOptions]" />
        </div>
        <div v-if="operationalContacts.length" class="mt-4">
          <p class="mb-2 text-xs font-bold uppercase text-[var(--dh-text-muted)]">Contactos operativos habilitados en CRM</p>
          <div class="grid gap-2 sm:grid-cols-2">
            <label v-for="contact in operationalContacts.filter(x => x.isActive)" :key="contact.id"
              class="flex items-center gap-2 rounded-xl border border-[var(--dh-border)] p-3 text-sm">
              <input type="checkbox" :checked="(draft.operationalContactIds || []).includes(contact.id)"
                @change="toggleContact(contact.id, ($event.target as HTMLInputElement).checked)" />
              <span>{{ contact.name }} · {{ contact.email || 'Sin correo' }}</span>
            </label>
          </div>
        </div>
      </DhCard>
      <DhCard title="2 · Modalidad, transporte y ruta"
        subtitle="Catálogos existentes de Config/Pricing, sin crear puertos o navieras nuevos.">
        <div class="grid gap-4 md:grid-cols-3">
          <DhSelect v-model="form.modalityCode" label="Modalidad" :options="modes" />
          <DhSelect v-model="draft.shipmentTypeCode" label="Tipo de embarque" :options="shipmentTypes" />
          <DhSelect v-model="draft.transportTypeCode" label="Tipo de transporte" :options="transportTypes" />
          <DhSelect v-model="draft.incotermCode" label="Incoterm" :options="selections('incoterms')" />
          <DhSelect v-model="form.originCountryCode" label="País de origen"
            :options="selections('countries')" />
          <DhSelect v-model="form.destinationCountryCode" label="País de destino"
            :options="selections('countries')" />
          <PricingLocationSearchSelect  :model-value="draft.polCode || ''" @update:model-value="draft.polCode = $event" label="POL · Origen"
            :options="locationOptions('pol')" :optional="true" />
          <PricingLocationSearchSelect  :model-value="draft.poeCode || ''" @update:model-value="draft.poeCode = $event" label="POE · Salida"
            :options="locationOptions('poe')" :optional="true" />
          <PricingLocationSearchSelect  :model-value="draft.podCode || ''" @update:model-value="draft.podCode = $event" label="POD · Destino"
            :options="locationOptions('pod')" :optional="true" />
          <DhSelect v-if="isMaritime" v-model="draft.carrierCode" label="Naviera" :options="selections('carriers')" />
          <DhSelect v-model="draft.agentCode" label="Agente / oficina de origen" :options="selections('agents')" />
          <DhSelect v-if="isMaritime" v-model="draft.merchantCode" label="Merchant (si aplica)" :options="selections('merchants')" />
        </div>
        <p v-if="catalogErrors.length" class="mt-3 text-xs text-amber-400">
          Algunos catálogos no respondieron: {{ catalogErrors.join(', ') }}. No se generaron opciones ficticias.
        </p>
      </DhCard>
      <DhCard title="3 · Carga y mercancía" subtitle="Se conservan unidades originales y se normalizan kg/CBM en el backend.">
        <div class="grid gap-4 md:grid-cols-3">
          <div class="md:col-span-3">
            <DhTextarea v-model="draft.cargoDescription" label="Descripción de la mercancía" :rows="3" />
          </div>
          <DhInput :model-value="draft.weightValue ?? ''" label="Peso" type="number" :min="0" :step="0.001"
            @update:model-value="draft.weightValue = asNumber($event)" />
          <DhSelect v-model="draft.weightUnit" label="Unidad de peso" :options="[{label:'Kilogramos (kg)',value:'KG'},{label:'Libras (lb)',value:'LB'}]" />
          <DhInput :model-value="draft.packageCount ?? ''" label="Cantidad de bultos" type="number" :min="0" :step="1"
            @update:model-value="draft.packageCount = asNumber($event)" />
          <DhInput :model-value="draft.volumeValue ?? ''" label="Volumen" type="number" :min="0" :step="0.001"
            @update:model-value="draft.volumeValue = asNumber($event)" />
          <DhSelect v-model="draft.volumeUnit" label="Unidad de volumen" :options="[{label:'Metros cúbicos (CBM)',value:'CBM'},{label:'Pies cúbicos (CFT)',value:'CFT'}]" />
          <DhInput v-model="draft.packageTypeCode" label="Tipo de bulto (código)" placeholder="Cajas, pallets, sacos…" />
        </div>
        <div v-if="isCargo" class="mt-4 grid gap-4 md:grid-cols-3">
          <DhSelect :model-value="draft.stackable === null ? '' : draft.stackable ? 'yes' : 'no'"
            label="¿Estibable?" :options="boolOptions"
            @update:model-value="draft.stackable = $event === '' ? null : $event === 'yes'" />
          <label class="flex items-center gap-2 text-sm">
            <input v-model="draft.isImo" type="checkbox" /> Mercancía IMO
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="draft.isOverweight" type="checkbox" /> Sobrepeso
          </label>
          <DhInput v-if="draft.isImo" v-model="draft.imoClass" label="Clase IMO" />
          <DhInput v-if="draft.isImo" v-model="draft.unNumber" label="Número UN" />
          <DhTextarea v-if="draft.isOverweight" v-model="draft.overweightNotes" label="Requerimientos por sobrepeso" :rows="2" />
        </div>
      </DhCard>
      <DhCard title="4 · Equipos y contenedores" subtitle="Admite varias combinaciones, por ejemplo 2 × 40HC y 1 × 20GP.">
        <div v-for="(equipment, index) in draft.equipment" :key="index" class="mb-3 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
          <DhSelect v-model="equipment.equipmentCode" label="Tipo de equipo" :options="availableEquipment" />
          <DhInput :model-value="equipment.quantity" label="Cantidad" type="number" :min="1" :step="1"
            @update:model-value="equipment.quantity = Number($event)" />
          <DhButton variant="secondary" :icon="Trash2" label="Eliminar" @click="draft.equipment.splice(index, 1)" />
        </div>
        <DhButton variant="secondary" :icon="Plus" label="Agregar equipo"
          @click="draft.equipment.push({ equipmentCode: '', quantity: 1 })" />
        <p class="mt-2 text-xs text-[var(--dh-text-muted)]">FCL requiere al menos un equipo positivo para validarse, pero puedes guardar el borrador antes de completarlo.</p>
      </DhCard>
      <DhCard title="5 · Servicios contratados" subtitle="Selecciona los servicios del catálogo de Pricing. Las adiciones comerciales posteriores requieren revisión de Pricing.">
        <DhSearchInput v-model="serviceSearch" placeholder="Buscar servicio del catálogo" />
        <div class="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          <label v-for="service in offeredServices" :key="service.id"
            class="flex items-center gap-2 rounded-xl border border-[var(--dh-border)] p-3 text-sm">
            <input type="checkbox" :checked="draft.serviceCodes.includes(service.code || service.id)"
              @change="toggleService(service.code || service.id, ($event.target as HTMLInputElement).checked)" />
            {{ service.label }}
          </label>
        </div>
        <p v-if="!offeredServices.length" class="mt-3 text-sm text-[var(--dh-text-muted)]">
          No se encontraron servicios en el catálogo.
        </p>
      </DhCard>
      <DhCard title="6 · Recolecta, WHS y consolidado" subtitle="Los requisitos se aplican según Incoterm, modalidad y servicios.">
        <label class="mb-4 flex items-center gap-2 text-sm font-bold">
          <input v-model="draft.requiresPickup" type="checkbox" /> Requiere recolecta
        </label>
        <div class="grid gap-4 md:grid-cols-2">
          <template v-if="draft.requiresPickup">
            <DhInput v-model="draft.pickupAddress" label="Dirección de recolecta" />
            <DhInput v-model="draft.pickupContact" label="Contacto de recolecta" />
            <DhInput v-model="draft.pickupWindow" label="Horario / Ventana de retiro" />
          </template>
          <DhInput v-if="hasWHS || draft.incotermCode === 'FCA'" v-model="draft.warehouseName" label="Nombre de WHS / Almacén" />
          <DhInput v-if="hasWHS" v-model="draft.consolidationReference" label="Consolidado" />
          <DhInput v-model="draft.collectionReference" label="Referencia de recolección" />
        </div>
      </DhCard>
      <DhCard title="7 · Fechas, booking y observaciones" subtitle="La captura manual no crea por sí sola una reserva con ninguna naviera.">
        <div class="grid gap-4 md:grid-cols-3">
          <label class="block text-xs font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">
            ETD estimada
            <input v-model="etdInput" type="datetime-local"
              class="mt-1 block h-11 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 text-sm text-[var(--dh-text)]" />
          </label>
          <label class="block text-xs font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">
            ETA estimada
            <input v-model="etaInput" type="datetime-local"
              class="mt-1 block h-11 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 text-sm text-[var(--dh-text)]" />
          </label>
          <DhInput v-model="draft.bookingReference" label="Booking externo (si existe)" />
          <div class="md:col-span-3">
            <DhTextarea v-model="draft.observations" label="Observaciones e instrucciones iniciales" :rows="4" />
          </div>
        </div>
      </DhCard>
      <DhCard v-if="editing" title="8 · Revisión de completitud" subtitle="El backend decide qué campos bloquean la validación; guardar borrador no los obliga.">
        <div v-if="completeness.length" class="flex flex-wrap gap-2">
          <span v-for="field in completeness" :key="field"
            class="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
            Pendiente · {{ field }}
          </span>
        </div>
        <p v-else class="text-sm">No hay pendientes bloqueantes detectados para los datos guardados.</p>
        <DhButton v-if="recordStatus === 'DRAFT'" class="mt-3" :icon="ShieldCheck"
          label="Enviar a validación de Aperturas" :loading="busy" :disabled="!canSave || completeness.length > 0"
          @click="submitValidation" />
      </DhCard>
      <div class="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-xl">
        <p class="max-w-xl text-xs text-[var(--dh-text-muted)]">
          {{ editing ? idtra : 'El siguiente IDTRA se asignará automáticamente al guardar.' }}
          Los datos se guardan como borrador y se auditan. Una QUO no es obligatoria.
        </p>
        <div class="flex gap-2">
          <RouterLink to="/operations/cases"><DhButton variant="secondary" label="Cancelar" /></RouterLink>
          <DhButton :icon="Save" label="Guardar borrador" :disabled="!canSave || loading" :loading="busy" @click="save" />
        </div>
      </div>
    </template>
  </div>
</template>

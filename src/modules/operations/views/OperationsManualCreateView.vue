<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Package, Plus, Trash2, Save, FolderPlus, Route, Check, Search, FileUp, Ship, Plane, Truck, Boxes, PackageOpen, RefreshCw, UserRound, CircleAlert, CircleCheck, UsersRound } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { operationsApi, type OperationsAssignmentTeam } from '../services/operationsApi'
import { crmGet, crmPath, crmRequest } from '@/modules/crm/services/crmApi'
import PricingCrmClientSelect from '@/modules/pricing/components/PricingCrmClientSelect.vue'
import { callEndpoint } from '@/core/api/callEndpoint'
import { StorageService } from '@/core/services/storageService'
import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'
import PricingWizardStepper from '@/modules/pricing/components/PricingWizardStepper.vue'
import PricingContainerSelector from '@/modules/pricing/components/PricingContainerSelector.vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { useAuthStore } from '@/core/stores/authStore'

const router = useRouter()
const route = useRoute()
const editingId = computed(() => typeof route.params.id === 'string' ? route.params.id : '')
const existingVersion = ref(0)
const canEdit = ref(false)
const auth = useAuthStore()
const companyId = ref('')
const canInitialize = computed(() => auth.hasScope('operations.team.manage'))
const initializing = ref(false)
const accountId = ref('')
const selectedClientName = ref('')
const executiveName = ref('')
const executiveUserId = ref('')
const institutionalExecutive = ref(false)
const executiveLoading = ref(false)
const operationalContactsLoading = ref(false)
const operationalContactsIssue = ref('')
const operationalContacts = ref<Array<{ id: string; name: string; email: string }>>([])
let clientGeneration = 0
let lastSelectedAccountId = ''
const executiveAssigned = computed(() => institutionalExecutive.value || Boolean(executiveUserId.value))
const executiveLabel = computed(() =>
  executiveLoading.value ? 'Consultando responsable comercial en CRM…'
    : executiveName.value || (executiveUserId.value ? 'Ejecutivo asignado; nombre pendiente de consulta'
      : 'Sin ejecutivo comercial asignado en CRM'))
const selectedOperationalContacts = computed(() =>
  operationalContacts.value.filter(contact => form.value.contactIds.includes(contact.id)))
const modality = ref('')
const priority = ref(1)
const complexity = ref(1)
const saving = ref(false)
const autosaveState = ref<'pending' | 'saved' | 'error'>('saved')
const lastAutoSaveAt = ref('')
const contactsTouched = ref(false)
const assignmentPendingId = ref('')
const assignedTeamId = ref('')
const availableTeams = ref<OperationsAssignmentTeam[]>([])
const assignmentTeamsLoading = ref(false)
const assignmentTeamsError = ref('')
const selectedOpeningTeam = computed(() => availableTeams.value.find(team => team.id === assignedTeamId.value))
const assignmentTeamOptions = computed(() => availableTeams.value.map(team => ({
  value: team.id,
  label: team.name + (team.canAssign
    ? ' · ' + team.availableReviewers + ' disponibles'
    : ' · Sin dos validadores disponibles'),
})))
async function loadAssignmentTeams() {
  if (!companyId.value || editingId.value) return
  assignmentTeamsLoading.value = true
  assignmentTeamsError.value = ''
  try {
    availableTeams.value = await operationsApi.assignmentTeams(companyId.value)
  } catch (cause) {
    assignmentTeamsError.value = cause instanceof Error ? cause.message : 'No se pudieron consultar los equipos de Aperturas.'
  } finally { assignmentTeamsLoading.value = false }
}
const autosaveReady = ref(false)
const remoteDraftId = ref('')
let autosaveTimer: ReturnType<typeof setTimeout> | undefined
const activeStep = ref(1)
const wizardSteps = [
  { id: 1, label: 'Cliente y ruta', hint: 'Cliente CRM, modalidad, embarque, Incoterm y terminales' },
  { id: 2, label: 'Carga y documentos', hint: 'CABYS, mercancía, equipos y respaldos' },
  { id: 3, label: 'Revisión', hint: 'Confirmar datos y asignar validación al equipo' },
]
const activeStepMeta = computed(() => wizardSteps.find(x => x.id === activeStep.value) ?? wizardSteps[0]!)
const catalogLoading = ref(false)
const catalogIssue = ref('')
const catalogs = ref<Record<string, CatalogItemSelectDto[]>>({})
const selectedPol = ref('')
const selectedPoe = ref('')
const selectedPod = ref('')
const selectedWarehouse = ref('')
let restoringOpening = false
const currentCatalog = (key: string) => catalogs.value[key] || []
const optionText = (item: CatalogItemSelectDto) => String(item.value || item.label || item.code).trim()
const catalogChoices = (key: string) => currentCatalog(key).filter(item => item.isActive).map(item => ({ value: optionText(item), label: optionText(item) }))
const locationChoices = (key: string) => currentCatalog(key).filter(item => item.isActive).map(item => ({ value: item.id, label: optionText(item), searchText: [item.label,item.code,item.slug].join(' ') }))
const polOptions = computed(() => locationChoices('pol'))
const poeOptions = computed(() => locationChoices('poe'))
const podOptions = computed(() => locationChoices('pod'))
const warehouseOptions = computed(() => locationChoices('warehouses'))
const incotermChoices = computed(() => {
  const items = catalogChoices('incoterms')
  const values = items.length ? items : incoterms.map(value => ({ label: value, value }))
  return values.filter(item => isMaritime.value || !['FAS','FOB','CFR','CIF'].includes(item.value.toUpperCase()))
})
function lookupLabel(key: string, id: string) { return optionText(currentCatalog(key).find(x => x.id === id) || { value: '', label: '', code: '' } as CatalogItemSelectDto) }
function selectedForLabel(key: string, label: string) {
  return currentCatalog(key).find(item => optionText(item).trim().toLowerCase() === label.trim().toLowerCase())?.id || ''
}
function reconcileLocations() {
  selectedPol.value = selectedForLabel('pol', form.value.pol)
  selectedPoe.value = selectedForLabel('poe', form.value.poe)
  selectedPod.value = selectedForLabel('pod', form.value.pod)
  selectedWarehouse.value = selectedForLabel('warehouses', form.value.whsName)
}
async function loadPricingCatalogs() {
  catalogLoading.value = true
  try {
    const names = ['pol','poe','pod','incoterms','container-types','land-equipment-sizes']
    const result = await Promise.all(names.map(async key => {
      try { return [key, await CatalogItemsService.select({ catalogGroupSlug: key })] as const }
      catch { return [key, [] as CatalogItemSelectDto[]] as const }
    }))
    const warehouseGroups = ['pricing-warehouses','warehouses','whs','fca-warehouses']
    let warehouseItems: CatalogItemSelectDto[] = []
    for (const key of warehouseGroups) {
      try { warehouseItems = await CatalogItemsService.select({ catalogGroupSlug: key }); if (warehouseItems.length) break } catch { /* legacy slug */ }
    }
    catalogs.value = { ...Object.fromEntries(result), warehouses: warehouseItems }
    if (!polOptions.value.length || !poeOptions.value.length || !podOptions.value.length)
      catalogIssue.value = 'No se pudieron consultar todos los catálogos de ubicaciones; puede conservar las referencias manuales.'
    reconcileLocations()
  } finally { catalogLoading.value = false }
}
function goToStep(target: number) {
  if (target < 1 || target > wizardSteps.length) return
  activeStep.value = target
  void nextTick(() => document.getElementById('operations-opening-wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
const loading = ref(true)
const error = ref('')
const form = ref({
  provenance: 'CLIENT', clientPoReference: '', crmDivisionId: '',
  shipmentType: '', cargoNature: '', transportType: '', incoterm: '',
  pol: '', poe: '', pod: '', pickupAddress: '', pickupContact: '',
  pickupWindow: '', requiresPickup: false, whsName: '',
  destinationAddress: '', cargoDescription: '', packageCount: '',
  packageType: '', weightValue: '', weightUnit: 'KG',
  volumeValue: '', volumeUnit: 'CBM', consolidationReference: '',
  isImo: false, imoClass: '', unNumber: '', stackable: true,
  overweight: false, overweightNotes: '', carrierReference: '',
  agentReference: '', merchantReference: '', etm: '', eta: '',
  services: [] as string[], observations: '',
  contactReferences: '', contactIds: [] as string[], commercialReviewRequested: false,
  equipment: [] as Array<{ equipmentType: string; equipmentCatalogId?: string; quantity: number; weightKg?: number }>,
  originCountryCode: '', destinationCountryCode: '',
  cabysSearch: '', cabysCode: '', portHandlingMode: '',
  supportEntityId: '',
  supportDocuments: [] as Array<{ id: string; fileName: string; category: string; categoryLabel: string; sizeInBytes: number }>,
})
const cabysResults = ref<Array<{ code: string; description: string }>>([])
const searchingCabys = ref(false)
const uploadingSupport = ref('')
const supportCategories = [
  {key:'OC',label:'OC / Detalle de la carga'}, {key:'PL',label:'Packing List (PL)'},
  {key:'INVOICE',label:'Invoice'}, {key:'MSDS',label:'MSDS / Ficha técnica'},
]
const supportAccept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp'
const packageTypeOptions = [
  { label: 'Cajas', value: 'Cajas' }, { label: 'Pallets / tarimas', value: 'Pallets' },
  { label: 'Bultos', value: 'Bultos' }, { label: 'Sacos', value: 'Sacos' },
  { label: 'Fardos', value: 'Fardos' }, { label: 'Rollos', value: 'Rollos' },
  { label: 'Tambores', value: 'Tambores' }, { label: 'Piezas', value: 'Piezas' },
  { label: 'Granel', value: 'Granel' }, { label: 'Otros', value: 'Otros' },
]
const cargoNatureOptions = [
  { label: 'Carga general', value: 'Carga general' },
  { label: 'Perecedera', value: 'Perecedera' },
  { label: 'Refrigerada', value: 'Refrigerada' },
  { label: 'Peligrosa / IMO', value: 'Peligrosa' },
  { label: 'Frágil', value: 'Frágil' },
  { label: 'Sobredimensionada', value: 'Sobredimensionada' },
  { label: 'Otro', value: 'Otro' },
]
const packageTypeChoiceOptions = computed(() => form.value.packageType &&
  !packageTypeOptions.some(x => x.value === form.value.packageType)
  ? [...packageTypeOptions, { label: form.value.packageType + ' (registrado)', value: form.value.packageType }]
  : packageTypeOptions)
const cargoNatureChoiceOptions = computed(() => form.value.cargoNature &&
  !cargoNatureOptions.some(x => x.value === form.value.cargoNature)
  ? [...cargoNatureOptions, { label: form.value.cargoNature + ' (registrado)', value: form.value.cargoNature }]
  : cargoNatureOptions)
const modalOptions = [
  { label: 'FCL', value: 'FCL' }, { label: 'LCL', value: 'LCL' },
  { label: 'FTL', value: 'FTL' }, { label: 'LTL', value: 'LTL' },
  { label: 'Aéreo', value: 'AIR' },
]
const transportSelectionOptions = [
  { label: 'Marítimo', value: 'MARITIME', caption: 'FCL o LCL' },
  { label: 'Aéreo', value: 'AIR', caption: 'Carga aérea internacional' },
  { label: 'Terrestre', value: 'ROAD', caption: 'FTL o LTL' },
]
const shipmentOptionsByTransport: Record<string, Array<{ label: string; value: string }>> = {
  MARITIME: [{ label: 'FCL · Contenedor completo', value: 'FCL' }, { label: 'LCL · Coloading / propio', value: 'LCL' }],
  AIR: [{ label: 'Carga aérea', value: 'AIR' }],
  ROAD: [{ label: 'FTL · Furgón completo', value: 'FTL' }, { label: 'LTL · Carga consolidada', value: 'LTL' }],
  MULTIMODAL: [{ label: 'FCL · Contenedor completo', value: 'FCL' }, { label: 'LCL · Carga consolidada', value: 'LCL' },
    { label: 'FTL · Furgón completo', value: 'FTL' }, { label: 'LTL · Carga consolidada', value: 'LTL' }],
}
const shipmentOptions = computed(() => shipmentOptionsByTransport[form.value.transportType] ?? [])
const effectiveShipment = computed(() => {
  const saved = form.value.shipmentType.toUpperCase()
  return shipmentOptions.value.some(item => item.value === saved) ? saved :
    shipmentOptions.value.some(item => item.value === modality.value) ? modality.value : ''
})
const equipmentCatalogKey = computed(() => effectiveShipment.value === 'FTL' ? 'land-equipment-sizes' : 'container-types')
function selectTransport(value: string) {
  if (form.value.transportType === value) return
  const available = shipmentOptionsByTransport[value] ?? []
  form.value.transportType = value
  if (!available.some(item => item.value === effectiveShipment.value)) {
    form.value.shipmentType = ''
    modality.value = ''
  } else {
    modality.value = value === 'MULTIMODAL' ? 'MULTIMODAL' : effectiveShipment.value
  }
  if (!['MARITIME', 'MULTIMODAL'].includes(value) && ['FAS','FOB','CFR','CIF'].includes(form.value.incoterm.toUpperCase())) {
    form.value.incoterm = ''
  }
}
function selectShipment(value: string) {
  if (!shipmentOptions.value.some(item => item.value === value)) return
  form.value.shipmentType = value
  modality.value = form.value.transportType === 'MULTIMODAL' ? 'MULTIMODAL' : value
}
function resolvedEquipmentId(item: { equipmentType: string; equipmentCatalogId?: string }) {
  return item.equipmentCatalogId || selectedForLabel(equipmentCatalogKey.value, item.equipmentType)
}
function setEquipmentType(item: { equipmentType: string; equipmentCatalogId?: string }, id: string) {
  if (id && form.value.equipment.some(other => other !== item && resolvedEquipmentId(other) === id)) {
    error.value = 'Este tipo de equipo ya está agregado. Aumenta su cantidad en la misma fila.'
    return
  }
  error.value = ''
  item.equipmentCatalogId = id
  item.equipmentType = lookupLabel(equipmentCatalogKey.value, id) || id
}
const totalEquipment = computed(() => form.value.equipment.reduce((total, row) => total + (Number(row.quantity) || 0), 0))
const uniqueEquipment = computed(() => {
  const ids = form.value.equipment.map(resolvedEquipmentId).filter(Boolean)
  return ids.length === new Set(ids).size
})
const originOptions = [
  { label: 'Cliente', value: 'CLIENT' }, { label: 'Proveedor', value: 'SUPPLIER' },
  { label: 'Agente', value: 'AGENT' }, { label: 'Oficina de origen', value: 'ORIGIN_OFFICE' },
]
const incoterms = ['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP']
const isMaritime = computed(() => ['MARITIME','MULTIMODAL'].includes(form.value.transportType))
const needsEquipment = computed(() => ['FCL','FTL'].includes(effectiveShipment.value))
const requiresWarehouse = computed(() => form.value.incoterm?.trim().toUpperCase() === 'FCA')
const valid = computed(() =>
  (editingId.value ? canEdit.value : /^[0-9a-f-]{36}$/i.test(companyId.value)) &&
  (modalOptions.some(x => x.value === modality.value) || (Boolean(editingId.value) && modality.value === 'MULTIMODAL')) &&
  /^[0-9a-f-]{36}$/i.test(accountId.value) &&
  priority.value >= 1 && priority.value <= 5 && complexity.value > 0 &&
  (!form.value.originCountryCode || /^[A-Za-z]{2}$/.test(form.value.originCountryCode)) &&
  (!form.value.destinationCountryCode || /^[A-Za-z]{2}$/.test(form.value.destinationCountryCode)) &&
  form.value.equipment.every(x => Number.isInteger(x.quantity) && x.quantity > 0 && (x.weightKg == null || Number(x.weightKg) >= 0)) &&
  uniqueEquipment.value)
const blockers = computed(() => {
  const result: string[] = []
  if (!accountId.value) result.push('Cliente CRM')
  else if (!executiveLoading.value && !executiveAssigned.value) result.push('Ejecutivo comercial por asignar en CRM')
  if (!form.value.transportType) result.push('Modalidad de transporte')
  if (!effectiveShipment.value) result.push('Tipo de embarque')
  if (!form.value.cargoDescription.trim()) result.push('Descripción de la carga')
  if (!form.value.pol.trim()) result.push('POL / lugar de origen')
  if (!form.value.pod.trim()) result.push('POD / lugar de destino')
  if (!form.value.incoterm.trim()) result.push('Incoterm')
  if (needsEquipment.value && !form.value.equipment.length) result.push('Equipos')
  if (needsEquipment.value && form.value.equipment.some(x => !x.equipmentType.trim())) result.push('Tipo de equipo por seleccionar')
  if (!uniqueEquipment.value) result.push('Equipos duplicados: unifica las cantidades')
  if (!editingId.value) {
    if (!assignedTeamId.value) result.push('Equipo de Aperturas por seleccionar')
    else if (!selectedOpeningTeam.value?.canAssign) result.push('El equipo seleccionado requiere dos validadores habilitados')
  }
  if (requiresWarehouse.value && !form.value.whsName.trim()) result.push('Nombre WHS (FCA)')
  if (form.value.isImo && (!form.value.imoClass || !form.value.unNumber)) result.push('Clase IMO / número UN')
  if (form.value.overweight && !form.value.overweightNotes.trim()) result.push('Observaciones de sobrepeso')
  return result
})
function addEquipment() { form.value.equipment.push({ equipmentType: '', equipmentCatalogId: '', quantity: 1 }) }

function toggleOperationalContact(id: string, selected: boolean) {
  contactsTouched.value = true
  form.value.contactIds = selected
    ? [...new Set([...form.value.contactIds, id])]
    : form.value.contactIds.filter(x => x !== id)
  // Keep legacy field for older cases; real IDs live in contactIds.
  form.value.contactReferences = form.value.contactIds.join(',')
}

async function resolveCrmOpeningData(id: string, client: {
  executiveName?: string; executiveUserId?: string; isCastroFallasExecutive?: boolean
}) {
  const generation = ++clientGeneration
  executiveLoading.value = true
  operationalContactsLoading.value = true
  operationalContacts.value = []
  operationalContactsIssue.value = ''
  executiveName.value = client.executiveName?.trim() || ''
  executiveUserId.value = client.executiveUserId?.trim() || ''
  institutionalExecutive.value = client.isCastroFallasExecutive === true
  try {
    const [accountResponse, contactsResponse] = await Promise.allSettled([
      crmGet('accounts', id),
      crmRequest<unknown>(crmPath('accounts', id, 'contacts')),
    ])
    if (generation !== clientGeneration || accountId.value !== id) return
    if (accountResponse.status === 'fulfilled') {
      const account = accountResponse.value as Record<string, unknown>
      institutionalExecutive.value = institutionalExecutive.value || account.isCastroFallasExecutive === true
      executiveUserId.value = String(account.executiveUserId || executiveUserId.value || '')
      executiveName.value = String(account.executiveName || executiveName.value || '').trim()
    }
    if (institutionalExecutive.value && !executiveName.value) executiveName.value = 'Castro Fallas'
    if (executiveUserId.value && !executiveName.value) {
      try {
        const labels = await crmRequest<{ owners?: Record<string, string> }>(
          crmPath('calendar/labels') + '?' +
          new URLSearchParams({ ownerIds: executiveUserId.value }))
        if (generation !== clientGeneration || accountId.value !== id) return
        executiveName.value = labels.owners?.[executiveUserId.value]?.trim() || ''
      } catch { /* The CRM executive ID remains assigned if labels are unavailable. */ }
    }
    if (contactsResponse.status === 'fulfilled') {
      const raw = contactsResponse.value
      const entries = Array.isArray(raw) ? raw
        : raw && typeof raw === 'object' && Array.isArray((raw as {items?: unknown}).items)
          ? (raw as {items: unknown[]}).items : []
      operationalContacts.value = entries.flatMap((entry: unknown) => {
        if (!entry || typeof entry !== 'object') return []
        const relation = entry as Record<string, unknown>
        const contact = (relation.contact && typeof relation.contact === 'object'
          ? relation.contact : relation) as Record<string, unknown>
        const active = relation.isActive !== false && contact.isActive !== false &&
          !['INACTIVE','DISABLED'].includes(String(contact.status ?? '').toUpperCase())
        const operations = relation.isOperationsContact === true || contact.isOperationsContact === true
        const email = String(contact.email || '').trim()
        const name = String(contact.name || [contact.firstName,contact.lastName].filter(Boolean).join(' ') || '').trim()
        const contactId = String(contact.id || relation.contactId || '')
        return active && operations && contactId && name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? [{ id: contactId, name, email }] : []
      })
      if (!contactsTouched.value && !form.value.contactIds.length) {
        form.value.contactIds = operationalContacts.value.map(contact => contact.id)
        form.value.contactReferences = form.value.contactIds.join(',')
      }
    } else {
      operationalContactsIssue.value = 'No se pudieron consultar los contactos de CRM; puede conservar el borrador.'
    }
  } finally {
    if (generation === clientGeneration) {
      executiveLoading.value = false
      operationalContactsLoading.value = false
    }
  }
}

function onCrmClientSelected(client: {
  id: string; kind?: 'account' | 'lead'; displayName: string;
  executiveName: string; executiveUserId?: string; isCastroFallasExecutive?: boolean
} | null) {
  if (client?.kind === 'lead') {
    ++clientGeneration
    accountId.value = ''
    lastSelectedAccountId = ''
    selectedClientName.value = ''
    executiveName.value = ''
    executiveUserId.value = ''
    institutionalExecutive.value = false
    operationalContacts.value = []
    executiveLoading.value = false
    operationalContactsLoading.value = false
    operationalContactsIssue.value = ''
    error.value = 'Para aperturar el trámite, convierta primero el prospecto en una cuenta CRM.'
    return
  }
  if (!client) {
    ++clientGeneration
    lastSelectedAccountId = ''
    selectedClientName.value = ''
    executiveName.value = ''
    executiveUserId.value = ''
    institutionalExecutive.value = false
    operationalContacts.value = []
    executiveLoading.value = false
    operationalContactsLoading.value = false
    operationalContactsIssue.value = ''
    form.value.contactIds = []
    contactsTouched.value = false
    return
  }
  if (lastSelectedAccountId && lastSelectedAccountId !== client.id) {
    form.value.contactIds = []
    form.value.contactReferences = ''
    contactsTouched.value = false
  }
  lastSelectedAccountId = client.id
  error.value = ''
  selectedClientName.value = client.displayName
  void resolveCrmOpeningData(client.id, client)
}
function countryFromRoute(group: 'pol' | 'pod', id: string, location: string): string {
  const item = currentCatalog(group).find(x => x.id === id)
    || currentCatalog(group).find(x => optionText(x).toLowerCase() === location.toLowerCase())
  let meta: Record<string, unknown> = {}
  try { if (item?.metadataJson) meta = JSON.parse(item.metadataJson) as Record<string, unknown> }
  catch { /* Metadata is optional; fall back to the location label. */ }
  const nested = meta.location && typeof meta.location === 'object'
    ? meta.location as Record<string, unknown> : {}
  for (const code of [meta.countryCode, meta.countryIso2, meta.isoCountryCode, meta.countryIso,
    nested.countryCode, nested.countryIso2]) {
    if (typeof code === 'string' && /^[A-Z]{2}$/i.test(code.trim())) return code.trim().toUpperCase()
  }
  const country = (location || item?.label || '').split(',').at(-1)?.trim() || ''
  if (/^[A-Z]{2}$/i.test(country)) return country.toUpperCase()
  if (!country) return ''
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  for (const locale of ['es','en']) {
    const display = new Intl.DisplayNames([locale], { type: 'region' })
    for (let a = 65; a < 91; a++) for (let b = 65; b < 91; b++) {
      const code = String.fromCharCode(a,b)
      if (normalize(display.of(code) || '') === normalize(country)) return code
    }
  }
  return ''
}
watch(() => [selectedPol.value, form.value.pol, selectedPod.value, form.value.pod], () => {
  if (restoringOpening) return
  form.value.originCountryCode = countryFromRoute('pol', selectedPol.value, form.value.pol)
  form.value.destinationCountryCode = countryFromRoute('pod', selectedPod.value, form.value.pod)
})
async function searchCabys() {
  const query = form.value.cabysSearch.trim()
  if (query.length < 3) { error.value = 'Escriba al menos 3 caracteres para buscar CABYS.'; return }
  searchingCabys.value = true
  error.value = ''
  try {
    const payload = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/cabys?q=' + encodeURIComponent(query) + '&top=20',
      headers: { Accept: 'application/json' },
    })
    const root = payload as Record<string, unknown> | null
    const entries = Array.isArray(payload) ? payload : Array.isArray(root?.cabys) ? root.cabys
      : Array.isArray(root?.data) ? root.data : Array.isArray(root?.results) ? root.results
      : root && (root.codigo || root.code) ? [root] : []
    cabysResults.value = entries.map((row: unknown) => {
      const item = row as Record<string, unknown>
      return { code: String(item.codigo ?? item.code ?? item.cabys ?? ''),
        description: String(item.descripcion ?? item.description ?? item.detalle ?? '') }
    }).filter((item: {code:string;description:string}) => Boolean(item.code && item.description))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo consultar CABYS de Hacienda.'
  } finally { searchingCabys.value = false }
}
function chooseCabys(item: {code:string;description:string}) {
  form.value.cabysCode = item.code
  form.value.cargoDescription = item.description
  cabysResults.value = []
}
async function uploadDocument(category: string, categoryLabel: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || uploadingSupport.value) return
  uploadingSupport.value = category
  error.value = ''
  try {
    if (!form.value.supportEntityId) form.value.supportEntityId = crypto.randomUUID()
    const uploaded = await StorageService.uploadFile({
      file, sourceService: 'DholeWeb', entityType: 'OperationsOpeningSupport',
      entityId: form.value.supportEntityId,
      metadataJson: JSON.stringify({ category, categoryLabel, caseId: editingId.value || null }),
    })
    form.value.supportDocuments.push({
      id: uploaded.id, fileName: uploaded.originalFileName,
      sizeInBytes: uploaded.sizeInBytes, category, categoryLabel,
    })
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo subir el documento.' }
  finally { uploadingSupport.value = '' }
}
async function removeDocument(id: string) {
  try {
    await StorageService.deleteFile(id)
    form.value.supportDocuments = form.value.supportDocuments.filter(x => x.id !== id)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo eliminar el documento.' }
}
function toggleHandling(value: 'Redestino' | 'Anticipado') {
  form.value.portHandlingMode = form.value.portHandlingMode === value ? '' : value
}

async function loadContext() {
  try {
    companyId.value = (await operationsApi.createContext()).companyId || ''
    if (!companyId.value) error.value = 'El servicio no pudo resolver la empresa operativa. Configure Operations antes de crear el expediente.'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No fue posible resolver el contexto.' }
  finally { loading.value = false }
}
async function initializeWorkspace() {
  if (!canInitialize.value || initializing.value) return
  initializing.value = true
  error.value = ''
  try {
    await operationsApi.initializeTeams()
    companyId.value = (await operationsApi.createContext()).companyId || ''
    if (!companyId.value)
      error.value = 'El catálogo se inicializó, pero no se identificó la empresa operativa.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo inicializar Operaciones.'
  } finally { initializing.value = false }
}
// Drafts remain local and scoped to this logged-in user until a case is created.
const draftStorageKey = computed(() =>
  'dhole.operations.manual-opening.v2:' + (auth.userId || 'guest') + ':' +
  (auth.clientId || 'company') + ':' + (editingId.value || 'new'))
function persistLocalDraft() {
  if (!autosaveReady.value || editingId.value) return
  const state = {
    savedAt: Date.now(), version: 2, form: form.value,
    accountId: accountId.value, selectedClientName: selectedClientName.value,
    modality: modality.value, step: activeStep.value,
    executiveName: executiveName.value, executiveUserId: executiveUserId.value,
    institutionalExecutive: institutionalExecutive.value,
    contactsTouched: contactsTouched.value, assignmentPendingId: assignmentPendingId.value,
    assignedTeamId: assignedTeamId.value, remoteDraftId: remoteDraftId.value,
  }
  // LocalStorage is only an offline safety copy. PostgreSQL is authoritative.
  try { window.localStorage.setItem(draftStorageKey.value, JSON.stringify(state)) }
  catch { /* Some browsers disable localStorage; server autosave still works. */ }
  if (!remoteDraftId.value) { autosaveState.value = 'error'; return }
  void operationsApi.saveManualDraft(remoteDraftId.value, state)
    .then(() => {
      autosaveState.value = 'saved'
      lastAutoSaveAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })
    .catch(() => { autosaveState.value = 'error' })
}
async function restoreServerDraft() {
  if (editingId.value) return
  try {
    const latest = await operationsApi.latestManualDraft()
    if (latest?.id && latest.payloadJson) {
      remoteDraftId.value = latest.id
      const saved = JSON.parse(latest.payloadJson) as Record<string, unknown>
      const local = window.localStorage.getItem(draftStorageKey.value)
      const localSavedAt = local ? Number((JSON.parse(local) as Record<string, unknown>).savedAt || 0) : 0
      if (Number(saved.savedAt || 0) > localSavedAt && saved.form &&
          typeof saved.form === 'object' && !Array.isArray(saved.form)) {
        form.value = { ...form.value, ...saved.form } as typeof form.value
        if (!Array.isArray(form.value.contactIds)) form.value.contactIds = []
        if (!Array.isArray(form.value.equipment)) form.value.equipment = []
        if (!Array.isArray(form.value.supportDocuments)) form.value.supportDocuments = []
        accountId.value = String(saved.accountId || '')
        lastSelectedAccountId = accountId.value
        selectedClientName.value = String(saved.selectedClientName || '')
        modality.value = String(saved.modality || '')
        executiveName.value = String(saved.executiveName || '')
        executiveUserId.value = String(saved.executiveUserId || '')
        institutionalExecutive.value = saved.institutionalExecutive === true
        contactsTouched.value = saved.contactsTouched === true
        assignedTeamId.value = String(saved.assignedTeamId || '')
        assignmentPendingId.value = String(saved.assignmentPendingId || '')
        const step = Number(saved.step)
        activeStep.value = step >= 1 && step <= wizardSteps.length ? step : 1
        reconcileLocations()
        if (accountId.value && !assignmentPendingId.value) {
          void resolveCrmOpeningData(accountId.value, {
            executiveName: executiveName.value, executiveUserId: executiveUserId.value,
            isCastroFallasExecutive: institutionalExecutive.value,
          })
        }
      }
    }
  } catch { /* Cached local version remains available during server downtime. */ }
  if (!remoteDraftId.value) remoteDraftId.value = crypto.randomUUID()
}

function scheduleLocalDraft() {
  if (!autosaveReady.value || editingId.value) return
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveState.value = 'pending'
  autosaveTimer = setTimeout(persistLocalDraft, 650)
}
function restoreLocalDraft() {
  if (editingId.value) return
  try {
    const raw = window.localStorage.getItem(draftStorageKey.value)
    if (!raw) return
    const draft = JSON.parse(raw) as Record<string, unknown>
    if (draft.version !== 2 || !Number.isFinite(Number(draft.savedAt)) ||
        Date.now() - Number(draft.savedAt) > 7 * 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(draftStorageKey.value)
      return
    }
    if (draft.form && typeof draft.form === 'object' && !Array.isArray(draft.form)) {
      form.value = { ...form.value, ...draft.form } as typeof form.value
      if (!Array.isArray(form.value.contactIds)) form.value.contactIds = []
      if (!Array.isArray(form.value.equipment)) form.value.equipment = []
      if (!Array.isArray(form.value.supportDocuments)) form.value.supportDocuments = []
    }
    remoteDraftId.value = String(draft.remoteDraftId || '')
    accountId.value = String(draft.accountId || '')
    lastSelectedAccountId = accountId.value
    selectedClientName.value = String(draft.selectedClientName || '')
    modality.value = String(draft.modality || '')
    executiveName.value = String(draft.executiveName || '')
    executiveUserId.value = String(draft.executiveUserId || '')
    institutionalExecutive.value = draft.institutionalExecutive === true
    contactsTouched.value = draft.contactsTouched === true
    assignmentPendingId.value = String(draft.assignmentPendingId || '')
    assignedTeamId.value = String(draft.assignedTeamId || '')
    const step = Number(draft.step)
    activeStep.value = step >= 1 && step <= wizardSteps.length ? step : 1
    reconcileLocations()
    lastAutoSaveAt.value = new Date(Number(draft.savedAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (accountId.value && !assignmentPendingId.value) {
      void resolveCrmOpeningData(accountId.value, {
        executiveName: executiveName.value, executiveUserId: executiveUserId.value,
        isCastroFallasExecutive: institutionalExecutive.value,
      })
    }
  } catch { autosaveState.value = 'error' }
}
function clearLocalDraft() {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveReady.value = false
  remoteDraftId.value = ''
  try { window.localStorage.removeItem(draftStorageKey.value) } catch { /* storage restricted */ }
}
watch([form, accountId, selectedClientName, modality, activeStep, contactsTouched, assignmentPendingId, assignedTeamId],
  scheduleLocalDraft, { deep: true })
onBeforeUnmount(() => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  if (autosaveReady.value && !editingId.value) persistLocalDraft()
})

async function save() {
  if (saving.value || (editingId.value ? !canEdit.value : !auth.hasScope('operations.case.create'))) return
  if (!editingId.value && !selectedOpeningTeam.value?.canAssign) {
    error.value = 'Selecciona un equipo de Aperturas con al menos dos validadores disponibles.'
    return
  }
  if ((!valid.value || blockers.value.length > 0) && !assignmentPendingId.value && !editingId.value) {
    error.value = 'Completa los campos indispensables antes de crear y asignar el trámite. Los avances se guardan automáticamente en PostgreSQL.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const openingData = {
      ...form.value,
      // Weight belongs to Coordinación Origen. Preserve historical values only
      // when editing an existing record; never introduce them in manual creation.
      ...(!editingId.value ? { weightValue: undefined, weightUnit: undefined, weightKg: undefined } : {}),
      stackable: ['LCL', 'LTL'].includes(effectiveShipment.value) ? form.value.stackable : null,
      volumeCbm: form.value.volumeValue ? Number(form.value.volumeValue) *
        (form.value.volumeUnit === 'CFT' ? 0.028316846592 : 1) : null,
      equipment: form.value.equipment.map(item => ({
        equipmentType: item.equipmentType,
        equipmentCatalogId: item.equipmentCatalogId || undefined,
        quantity: Number(item.quantity),
        ...(editingId.value && item.weightKg != null ? { weightKg: item.weightKg } : {}),
      })),
      completionStatus: blockers.value.length ? 'DRAFT_INCOMPLETE' : 'READY_FOR_VALIDATION',
      missingFields: blockers.value,
      commercialStatus: 'SIN_QUO',
    }
    const result = editingId.value
      ? await operationsApi.updateCase(editingId.value, {
          expectedVersion: existingVersion.value,
          modalityCode: modality.value, priority: Number(priority.value),
          complexityPoints: Number(complexity.value),
          originCountryCode: form.value.originCountryCode.toUpperCase() || null,
          destinationCountryCode: form.value.destinationCountryCode.toUpperCase() || null,
          openingData,
        }).then(() => ({ id: editingId.value }))
      : assignmentPendingId.value
        ? { id: assignmentPendingId.value }
        : await operationsApi.createAperture({
          companyId: companyId.value,
          accountId: accountId.value,
          modalityCode: modality.value,
          priority: Number(priority.value),
          complexityPoints: Number(complexity.value),
          originCountryCode: form.value.originCountryCode.toUpperCase() || null,
          destinationCountryCode: form.value.destinationCountryCode.toUpperCase() || null,
          openingData,
        })
    // A created IDTRA is retained across assignment retries: never create a duplicate.
    if (!editingId.value) {
      assignmentPendingId.value = result.id
      persistLocalDraft()
      await operationsApi.assign(result.id, assignedTeamId.value)
    }
    const completedDraftId = remoteDraftId.value
    clearLocalDraft()
    if (completedDraftId) void operationsApi.deleteManualDraft(completedDraftId).catch(() => {})
    await router.push({ name: 'operations-case-detail', params: { id: result.id } })
  } catch (cause) {
    error.value = assignmentPendingId.value
      ? 'El IDTRA fue creado, pero no se pudo completar la asignación al equipo seleccionado. Comprueba que tenga dos validadores activos con permisos y reintenta; el IDTRA no se duplicará. Detalle: ' + (cause instanceof Error ? cause.message : 'Error desconocido')
      : cause instanceof Error ? cause.message : 'No se pudo crear la apertura.'
  } finally { saving.value = false }
}
watch(selectedPol, id => { const label = lookupLabel('pol', id); if (label) form.value.pol = label })
watch(selectedPoe, id => { const label = lookupLabel('poe', id); if (label) form.value.poe = label })
watch(selectedPod, id => { const label = lookupLabel('pod', id); if (label) form.value.pod = label })
watch(selectedWarehouse, id => { const label = lookupLabel('warehouses', id); if (label) form.value.whsName = label })
onMounted(async () => {
  await Promise.all([loadContext(), loadPricingCatalogs()])
  if (!editingId.value) { restoreLocalDraft(); await restoreServerDraft(); autosaveReady.value = true; await loadAssignmentTeams() }
  if (editingId.value) {
    try {
      const [detail, tabs] = await Promise.all([
        operationsApi.caseDetail(editingId.value), operationsApi.caseTabs(editingId.value),
      ])
      canEdit.value = tabs.tabs.some(x => x.code === 'RESUMEN' && x.accessLevel === 'EDITABLE')
      if (!canEdit.value) { error.value = 'No tiene permisos para modificar esta apertura.'; return }
      restoringOpening = true
      existingVersion.value = detail.version
      accountId.value = detail.accountId
      lastSelectedAccountId = detail.accountId
      companyId.value = detail.companyId
      modality.value = detail.modalityCode
      priority.value = detail.priority
      complexity.value = detail.complexityPoints
      const parsed = JSON.parse(detail.openingDataJson || '{}') as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        form.value = { ...form.value, ...parsed } as typeof form.value
        if (!Array.isArray(form.value.contactIds)) form.value.contactIds = []
      }
      if (!form.value.transportType) {
        form.value.transportType = modality.value === 'AIR' ? 'AIR'
          : ['FTL','LTL'].includes(modality.value) ? 'ROAD'
            : modality.value === 'MULTIMODAL' ? 'MULTIMODAL' : 'MARITIME'
      }
      if (!form.value.shipmentType && modality.value !== 'MULTIMODAL') form.value.shipmentType = modality.value
      form.value.originCountryCode = detail.originCountryCode || ''
      form.value.destinationCountryCode = detail.destinationCountryCode || ''
      reconcileLocations()
      await nextTick()
      restoringOpening = false
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'No fue posible abrir la captura.'
    } finally { restoringOpening = false }
  }
})
</script>

<template>
  <div id="operations-opening-wizard" class="mx-auto w-full max-w-[1440px] space-y-5 px-3 pb-32 pt-4 sm:px-6 sm:pt-6 lg:px-8 scroll-mt-36">
    <RouterLink to="/operations/cases" class="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--dh-primary)]">
      <ArrowLeft class="h-4 w-4" /> Trámites
    </RouterLink>
    <DhPageHeader
      :title="editingId ? 'Modificar apertura' : 'Nueva apertura manual'"
      subtitle="La misma experiencia guiada de Crear tarifas, adaptada al expediente operativo."
      :icon="FolderPlus"
      :hide-excel-export="true"
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-3">
          <span v-if="!editingId" role="status" aria-live="polite" class="text-xs font-semibold"
            :class="autosaveState === 'error' ? 'text-amber-500' : 'text-[var(--dh-text-muted)]'">
            {{ autosaveState === 'error' ? 'Autoguardado no disponible' : autosaveState === 'pending' ? 'Guardando cambios…' : lastAutoSaveAt ? 'Guardado automáticamente · ' + lastAutoSaveAt : 'Autoguardado activado' }}
          </span>
          <DhButton :icon="editingId ? Save : FolderPlus"
            :label="editingId ? 'Guardar modificaciones' : assignmentPendingId ? 'Reintentar asignación' : 'Crear y asignar a equipo'"
            :loading="saving" :disabled="loading || saving || (!valid && !assignmentPendingId) || (!editingId && blockers.length > 0 && !assignmentPendingId)"
            @click="save" />
        </div>
      </template>
    </DhPageHeader>

    <div class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)] sm:p-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-4">
          <div class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]">
            <FolderPlus class="h-7 w-7" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-black uppercase tracking-[.18em] text-[var(--dh-primary)]">OPERATIONS · APERTURAS</p>
            <h2 class="text-xl font-black tracking-tight text-[var(--dh-text)] sm:text-2xl">{{ editingId ? 'Actualizar expediente' : 'Crear expediente operativo' }}</h2>
            <p class="mt-1 text-xs font-medium text-[var(--dh-text-muted)]">Completa una etapa a la vez. Los cambios se guardan automáticamente; el IDTRA se crea al confirmar.</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <DhBadge variant="neutral">IDTRA automático</DhBadge>
          <DhBadge variant="primary">{{ editingId ? 'Modificación' : 'Apertura manual' }}</DhBadge>
          <DhBadge variant="neutral">Paso {{ activeStep }} de {{ wizardSteps.length }}</DhBadge>
        </div>
      </div>
      <div class="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--dh-input)]">
        <div class="h-full rounded-full bg-[var(--dh-primary)] transition-all duration-300" :style="{ width: (activeStep / wizardSteps.length * 100) + '%' }" />
      </div>
    </div>

    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-500">{{ error }}</div>
    <div v-if="assignmentPendingId" role="status" class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-500">
      El IDTRA ya fue creado. La asignación sigue pendiente; utiliza «Reintentar asignación» para continuar sin generar otro expediente.
    </div>
    <div v-if="catalogIssue" role="status" class="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs font-semibold text-amber-500">{{ catalogIssue }}</div>
    <DhCard v-if="!companyId && canInitialize && !editingId" title="Inicialización de Operaciones" subtitle="Acción administrativa, necesaria solo cuando la empresa operativa no se ha identificado.">
      <DhButton variant="secondary" label="Inicializar equipos" :loading="initializing" @click="initializeWorkspace" />
    </DhCard>

    <PricingWizardStepper
      :steps="wizardSteps"
      :active-step="activeStep"
      aria-label="Etapas de creación de apertura"
      @update:active-step="goToStep"
    />

    <section class="scroll-mt-36 overflow-visible rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)]">
      <header class="flex flex-wrap items-center gap-3 rounded-t-[26px] border-b border-[var(--dh-border)] p-5 sm:p-6">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.10)] text-[var(--dh-primary)]">
          <Route v-if="activeStep === 1" class="h-5 w-5" />
          <Package v-else-if="activeStep === 2" class="h-5 w-5" />
          <ClipboardCheck v-else class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-[10px] font-black uppercase tracking-[.16em] text-[var(--dh-primary)]">PASO {{ activeStep }} DE {{ wizardSteps.length }}</p>
          <h3 class="mt-0.5 text-lg font-black tracking-tight">{{ activeStepMeta.label }}</h3>
          <p class="text-xs font-medium text-[var(--dh-text-muted)]">{{ activeStepMeta.hint }}</p>
        </div>
        <DhBadge v-if="activeStep === 3" variant="warning" class="ml-auto">{{ blockers.length }} pendientes</DhBadge>
      </header>

      <div class="p-4 sm:p-6">
        <div v-show="activeStep === 1" class="grid gap-5 lg:grid-cols-2">
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/25 p-4 sm:p-5">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 class="text-sm font-black">Modalidad de transporte</h4>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Selecciona el medio principal de la operación.</p>
              </div>
              <DhBadge variant="neutral">3 opciones</DhBadge>
            </div>
            <div class="grid gap-2 sm:grid-cols-3">
              <button v-for="option in transportSelectionOptions" :key="option.value" type="button"
                :aria-pressed="form.transportType === option.value"
                class="relative flex min-h-[116px] flex-col items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                :class="form.transportType === option.value
                  ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-text)] shadow-sm'
                  : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text)] hover:border-[var(--dh-primary)]/60 hover:bg-[var(--dh-card-hover)]'"
                @click="selectTransport(option.value)">
                <component :is="option.value === 'MARITIME' ? Ship : option.value === 'AIR' ? Plane : Truck"
                  class="h-5 w-5 text-[var(--dh-primary)]" />
                <span><strong class="block text-sm">{{ option.label }}</strong><span class="mt-1 block text-[11px] font-medium text-[var(--dh-text-muted)]">{{ option.caption }}</span></span>
                <CircleCheck v-if="form.transportType === option.value" class="absolute right-3 top-3 h-4 w-4 text-[var(--dh-primary)]" />
              </button>
            </div>
            <p v-if="form.transportType === 'MULTIMODAL' && editingId"
              class="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-500">
              Este expediente histórico es multimodal. Sus datos se conservan; para nuevas aperturas selecciona marítimo, aéreo o terrestre.
            </p>
          </div>
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/25 p-4 sm:p-5">
            <h4 class="text-sm font-black">Tipo de embarque</h4>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Opciones compatibles con la modalidad seleccionada.</p>
            <div v-if="shipmentOptions.length" class="mt-4 grid gap-2 sm:grid-cols-2">
              <button v-for="option in shipmentOptions" :key="option.value" type="button"
                :aria-pressed="effectiveShipment === option.value"
                class="flex min-h-[92px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                :class="effectiveShipment === option.value
                  ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)]'
                  : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[var(--dh-primary)]/60 hover:bg-[var(--dh-card-hover)]'"
                @click="selectShipment(option.value)">
                <span class="flex items-center gap-3">
                  <component :is="option.value === 'FCL' ? Boxes : option.value === 'LCL' ? PackageOpen : option.value === 'FTL' ? Truck : option.value === 'LTL' ? Package : Plane"
                    class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
                  <span class="text-sm font-bold">{{ option.label }}</span>
                </span>
                <CircleCheck v-if="effectiveShipment === option.value" class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
              </button>
            </div>
            <div v-else class="mt-4 rounded-2xl border border-dashed border-[var(--dh-border)] p-6 text-center text-xs text-[var(--dh-text-muted)]">
              Elige primero la modalidad de transporte.
            </div>
          </div>
        </div>

        <div v-show="activeStep === 1" class="mt-6 space-y-5">
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/60 p-4 sm:p-5">
            <div class="mb-4">
              <h4 class="text-base font-black">Cuenta y responsable comercial</h4>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">El cliente y el ejecutivo se obtienen de CRM; nunca debes introducir un UUID o IDTRA.</p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-3 md:col-span-2">
                <PricingCrmClientSelect v-model="accountId" mode="create" :disabled="Boolean(editingId)" :inline-results="true" @selected="onCrmClientSelected" />
                <div role="status" aria-live="polite"
                  class="flex flex-wrap items-center gap-3 rounded-2xl border p-4"
                  :class="executiveAssigned ? 'border-[var(--dh-primary)]/35 bg-[rgb(var(--dh-primary-rgb)/0.09)]' : 'border-amber-500/35 bg-amber-500/5'">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--dh-card)]">
                    <UserRound class="h-5 w-5 text-[var(--dh-primary)]" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-[11px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Ejecutivo comercial responsable (CRM)</span>
                    <span class="mt-1 block text-base font-extrabold">{{ accountId ? executiveLabel : 'Selecciona una cuenta de CRM' }}</span>
                    <span v-if="accountId && !executiveLoading && !executiveAssigned" class="mt-1 block text-xs text-amber-500">
                      Pendiente bloqueante para validar; la asignación debe resolverse en CRM.
                    </span>
                  </span>
                  <CircleCheck v-if="executiveAssigned" class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
                  <CircleAlert v-else-if="accountId && !executiveLoading" class="h-5 w-5 shrink-0 text-amber-500" />
                </div>
              </div>
              <DhSelect v-model="form.provenance" label="Asignación recibida desde" :options="originOptions" />
              <DhInput v-model="form.clientPoReference" label="Orden / PO / referencia del cliente" />
              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3.5">
                <p class="text-[11px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]">División comercial CRM (opcional)</p>
                <p class="mt-1 text-xs font-semibold">{{ form.crmDivisionId || 'Sin división vinculada' }}</p>
                <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">La selección de divisiones se habilitará cuando CRM publique su catálogo. No se aceptan referencias inventadas.</p>
              </div>
              <div class="md:col-span-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h5 class="flex items-center gap-2 text-sm font-black"><UsersRound class="h-4 w-4 text-[var(--dh-primary)]" /> Contactos operativos para notificaciones</h5>
                    <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Contactos operativos habilitados en CRM. Se seleccionan por defecto; puedes desmarcar cualquiera. El autoguardado no envía correos.</p>
                  </div>
                  <DhBadge variant="neutral">{{ form.contactIds.length }} seleccionados</DhBadge>
                </div>
                <p v-if="operationalContactsLoading" class="mt-3 text-xs text-[var(--dh-text-muted)]">Consultando contactos de CRM…</p>
                <p v-else-if="operationalContactsIssue" role="status" class="mt-3 text-xs text-amber-500">{{ operationalContactsIssue }}</p>
                <p v-else-if="accountId && !operationalContacts.length" class="mt-3 text-xs text-[var(--dh-text-muted)]">No hay contactos operativos activos con correo válido. Se pueden registrar después en CRM.</p>
                <p v-else-if="!accountId" class="mt-3 text-xs text-[var(--dh-text-muted)]">Selecciona primero una cuenta CRM.</p>
                <div v-else class="mt-3 grid gap-2 sm:grid-cols-2">
                  <label v-for="contact in operationalContacts" :key="contact.id"
                    class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors"
                    :class="form.contactIds.includes(contact.id)
                      ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.08)]'
                      : 'border-[var(--dh-border)] bg-[var(--dh-input)]/25 hover:border-[var(--dh-primary)]/50'">
                    <input type="checkbox" class="h-4 w-4 accent-[var(--dh-primary)]"
                      :checked="form.contactIds.includes(contact.id)"
                      @change="toggleOperationalContact(contact.id, ($event.target as HTMLInputElement).checked)" />
                    <span class="min-w-0"><span class="block truncate text-xs font-black">{{ contact.name }}</span>
                      <span class="mt-0.5 block truncate text-[11px] text-[var(--dh-text-muted)]">{{ contact.email }}</span></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-show="activeStep === 1" class="mt-6 space-y-5">
          <div class="grid gap-4 md:grid-cols-2">
            <DhSelect v-model="form.incoterm" label="Incoterm" :options="incotermChoices" />
            <DhSelect v-model="form.cargoNature" label="Naturaleza de la carga"
              :options="cargoNatureChoiceOptions" placeholder="Seleccione la naturaleza de la carga" />
          </div>
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4 sm:p-5">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h4 class="text-base font-black">Ruta de transporte</h4><p class="mt-1 text-xs font-medium text-[var(--dh-text-muted)]">Buscadores de POL, POE y POD compartidos con el wizard de Pricing.</p></div>
              <DhBadge variant="neutral">{{ catalogLoading ? 'Cargando catálogos' : 'Catálogos de Config' }}</DhBadge>
            </div>
            <div class="grid gap-4 md:grid-cols-3">
              <div>
                <PricingLocationSearchSelect v-if="polOptions.length" v-model="selectedPol" label="Origen / POL" placeholder="Buscar puerto o ciudad…" search-placeholder="Nombre, código o país…" :options="polOptions" terminal-type="CY" />
                <DhInput v-else v-model="form.pol" label="Origen / POL" placeholder="Puerto o lugar de origen" />
                <DhInput v-if="form.pol && !selectedPol && polOptions.length" v-model="form.pol" label="Origen registrado / texto libre" />
              </div>
              <div>
                <PricingLocationSearchSelect v-if="poeOptions.length" v-model="selectedPoe" label="Entrada / POE" placeholder="Buscar puerto de entrada…" search-placeholder="Nombre, código o país…" :options="poeOptions" terminal-type="CY" />
                <DhInput v-else v-model="form.poe" label="Entrada / POE" placeholder="Puerto de entrada" />
                <DhInput v-if="form.poe && !selectedPoe && poeOptions.length" v-model="form.poe" label="POE registrado / texto libre"  />
              </div>
              <div>
                <PricingLocationSearchSelect v-if="podOptions.length" v-model="selectedPod" label="Destino final / POD" placeholder="Buscar destino…" search-placeholder="Nombre, código o país…" :options="podOptions" terminal-type="SD" />
                <DhInput v-else v-model="form.pod" label="Destino final / POD" placeholder="Destino" />
                <DhInput v-if="form.pod && !selectedPod && podOptions.length" v-model="form.pod" label="POD registrado / texto libre" />
              </div>
            </div>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <DhInput v-model="form.etm" label="Fecha estimada de salida (ETD)" type="date" />
            <DhInput v-model="form.eta" label="Fecha estimada de llegada (ETA)" type="date" />
          </div>
          <div v-if="requiresWarehouse" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4 sm:p-5">
            <h4 class="mb-1 text-sm font-black">Almacén de origen (WHS)</h4>
            <p class="mb-3 text-xs text-[var(--dh-text-muted)]">Obligatorio para FCA con carga LCL o LTL.</p>
            <PricingLocationSearchSelect v-if="warehouseOptions.length" v-model="selectedWarehouse"
              label="WHS" placeholder="Buscar almacén…" search-placeholder="Buscar bodega o ciudad…"
              :options="warehouseOptions" terminal-type="WHS" />
            <DhInput v-model="form.whsName" label="Nombre WHS / referencia registrada" />
          </div>
        </div>

        <div v-show="activeStep === 2" class="space-y-5">
          <div class="space-y-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4">
            <h4 class="text-base font-black">Descripción de carga y CABYS</h4>
            <div class="flex flex-wrap items-end gap-3">
              <div class="min-w-[180px] flex-1">
                <DhInput v-model="form.cabysSearch" label="Buscar CABYS de Hacienda" placeholder="Ej. repuestos, textiles, maquinaria…" @keyup.enter="searchCabys" />
              </div>
              <DhButton :icon="Search" label="Buscar" :loading="searchingCabys" @click="searchCabys" />
            </div>
            <div v-if="cabysResults.length" class="max-h-52 overflow-auto rounded-xl border border-[var(--dh-border)]">
              <button v-for="item in cabysResults" :key="item.code" type="button"
                class="flex w-full gap-3 border-b border-[var(--dh-border)] p-3 text-left text-sm hover:bg-[var(--dh-card-hover)]" @click="chooseCabys(item)">
                <span class="font-mono font-black">{{ item.code }}</span>
                <span>{{ item.description }}</span>
              </button>
            </div>
            <p v-if="form.cabysCode" class="text-xs font-black">CABYS seleccionado: {{ form.cabysCode }}</p>
          </div>
          <DhTextarea v-model="form.cargoDescription" label="Descripción de la mercancía" :rows="3" />
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DhInput v-model="form.packageCount" label="Cantidad de bultos" type="number" :min="0" />
            <DhSelect v-model="form.packageType" label="Tipo de bulto" :options="packageTypeChoiceOptions" placeholder="Seleccione tipo de bulto" />
            <DhInput v-model="form.volumeValue" label="Volumen" type="number" :min="0" />
            <DhSelect v-model="form.volumeUnit" label="Unidad volumen" :options="[{ label: 'CBM', value: 'CBM' }, { label: 'CFT', value: 'CFT' }]" />
            <DhInput v-model="form.consolidationReference" label="Referencia de consolidado" />
          </div>
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4 sm:p-5">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div><h4 class="text-sm font-black">Condiciones especiales</h4><p class="text-xs text-[var(--dh-text-muted)]">Se mostrarán únicamente los campos que correspondan.</p></div>
            </div>
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <button type="button" :aria-pressed="form.isImo" @click="form.isImo = !form.isImo"
                  class="group flex min-h-[94px] items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                  :class="form.isImo ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] shadow-sm'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[var(--dh-primary)]/50 hover:bg-[var(--dh-card-hover)]'">
                  <span><span class="block text-sm font-black">IMO / Peligrosa</span>
                    <span class="mt-1 block text-xs font-medium text-[var(--dh-text-muted)]">Requiere clase IMO y número UN</span></span>
                  <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
                    :class="form.isImo ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                      : 'border-[var(--dh-border)] text-[var(--dh-text-muted)]'">
                    <Check v-if="form.isImo" class="h-4 w-4" />
                  </span>
                </button>
                <button v-if="['LCL', 'LTL'].includes(effectiveShipment)" type="button" :aria-pressed="form.stackable" @click="form.stackable = !form.stackable"
                  class="group flex min-h-[94px] items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                  :class="form.stackable ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] shadow-sm'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[var(--dh-primary)]/50 hover:bg-[var(--dh-card-hover)]'">
                  <span><span class="block text-sm font-black">Carga estibable</span>
                    <span class="mt-1 block text-xs font-medium text-[var(--dh-text-muted)]">Se permite apilar mercancía</span></span>
                  <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
                    :class="form.stackable ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                      : 'border-[var(--dh-border)] text-[var(--dh-text-muted)]'">
                    <Check v-if="form.stackable" class="h-4 w-4" />
                  </span>
                </button>
                <button type="button" :aria-pressed="form.overweight" @click="form.overweight = !form.overweight"
                  class="group flex min-h-[94px] items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                  :class="form.overweight ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] shadow-sm'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[var(--dh-primary)]/50 hover:bg-[var(--dh-card-hover)]'">
                  <span><span class="block text-sm font-black">Sobrepeso</span>
                    <span class="mt-1 block text-xs font-medium text-[var(--dh-text-muted)]">Registrar requerimientos especiales</span></span>
                  <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
                    :class="form.overweight ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                      : 'border-[var(--dh-border)] text-[var(--dh-text-muted)]'">
                    <Check v-if="form.overweight" class="h-4 w-4" />
                  </span>
                </button>
            </div>
            <div class="mt-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)]/30 p-4">
              <div class="mb-3">
                <h5 class="text-sm font-black">Muellaje en destino</h5>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Opciones excluyentes; selecciona únicamente la que corresponda.</p>
              </div>
              <div class="grid gap-2 sm:grid-cols-2">
                <button type="button" :aria-pressed="form.portHandlingMode === 'Redestino'" @click="toggleHandling('Redestino')"
                  class="group flex min-h-[94px] items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                  :class="form.portHandlingMode === 'Redestino' ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] shadow-sm'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[var(--dh-primary)]/50 hover:bg-[var(--dh-card-hover)]'">
                  <span><span class="block text-sm font-black">Redestino</span>
                    <span class="mt-1 block text-xs font-medium text-[var(--dh-text-muted)]">Retiro o entrega con redestino</span></span>
                  <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
                    :class="form.portHandlingMode === 'Redestino' ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                      : 'border-[var(--dh-border)] text-[var(--dh-text-muted)]'">
                    <Check v-if="form.portHandlingMode === 'Redestino'" class="h-4 w-4" />
                  </span>
                </button>
                <button type="button" :aria-pressed="form.portHandlingMode === 'Anticipado'" @click="toggleHandling('Anticipado')"
                  class="group flex min-h-[94px] items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                  :class="form.portHandlingMode === 'Anticipado' ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] shadow-sm'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[var(--dh-primary)]/50 hover:bg-[var(--dh-card-hover)]'">
                  <span><span class="block text-sm font-black">Anticipado</span>
                    <span class="mt-1 block text-xs font-medium text-[var(--dh-text-muted)]">Muellaje anticipado en destino</span></span>
                  <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
                    :class="form.portHandlingMode === 'Anticipado' ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                      : 'border-[var(--dh-border)] text-[var(--dh-text-muted)]'">
                    <Check v-if="form.portHandlingMode === 'Anticipado'" class="h-4 w-4" />
                  </span>
                </button>
              </div>
            </div>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <DhInput v-if="form.isImo" v-model="form.imoClass" label="Clase IMO" />
              <DhInput v-if="form.isImo" v-model="form.unNumber" label="Número UN" />
              <DhInput v-if="form.overweight" v-model="form.overweightNotes" label="Requerimientos por sobrepeso" />
            </div>
          </div>
          <div v-if="needsEquipment || form.equipment.length" class="overflow-hidden rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)]">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] bg-[rgb(var(--dh-primary-rgb)/0.04)] px-5 py-4">
              <div>
                <h4 class="text-base font-black">{{ effectiveShipment === 'FTL' ? 'Distribución de furgones FTL' : 'Distribución de contenedores FCL' }}</h4>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Cada tipo se agrega una vez. Utiliza Cantidad para varias unidades iguales.</p>
              </div>
              <DhButton variant="secondary" :icon="Plus" :label="effectiveShipment === 'FTL' ? 'Añadir furgón' : 'Añadir contenedor'" size="sm"
                :disabled="Boolean(assignmentPendingId)" @click="addEquipment" />
            </div>
            <div class="space-y-3 p-4 sm:p-5">
              <div v-if="!form.equipment.length" class="rounded-2xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm text-[var(--dh-text-muted)]">
                Selecciona al menos un tipo de equipo para este embarque.
              </div>
              <div v-for="(item, index) in form.equipment" :key="'equipment-' + index"
                class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)]/35 p-4 transition-colors"
                :class="resolvedEquipmentId(item) ? 'border-[var(--dh-primary)]/25' : ''">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <span class="text-[11px] font-black uppercase tracking-widest text-[var(--dh-primary)]">
                    {{ effectiveShipment === 'FTL' ? 'Furgón' : 'Contenedor' }} {{ index + 1 }}
                  </span>
                  <button v-if="form.equipment.length > 1" type="button"
                    class="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-500/10"
                    @click="form.equipment.splice(index, 1)"><Trash2 class="h-4 w-4" /> Quitar</button>
                </div>
                <div class="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                  <div class="min-w-0">
                    <PricingContainerSelector
                      :model-value="resolvedEquipmentId(item)"
                      :transport="effectiveShipment === 'FTL' ? 'land' : 'maritime'"
                      :excluded-equipment-ids="form.equipment.filter((_, otherIndex) => otherIndex !== index).map(other => resolvedEquipmentId(other)).filter(Boolean)"
                      :show-resolved-label="false"
                      @update:model-value="setEquipmentType(item, $event)"
                    />
                  </div>
                  <DhInput :model-value="item.quantity" label="Cantidad" type="number" :min="1" :step="1"
                    @update:model-value="item.quantity = Math.max(1, Math.floor(Number($event) || 1))" />
                </div>
                <p v-if="item.equipmentType" class="mt-2 text-xs text-[var(--dh-text-muted)]">
                  {{ item.equipmentType }}
                </p>
              </div>
              <div v-if="form.equipment.length"
                class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dh-primary)]/20 bg-[rgb(var(--dh-primary-rgb)/0.05)] px-4 py-3">
                <span class="text-xs font-black text-[var(--dh-primary)]">
                  Total: {{ totalEquipment }} {{ effectiveShipment === 'FTL' ? 'furgones' : 'contenedores' }}

                </span>
                <div class="flex flex-wrap gap-1.5">
                  <span v-for="(row, i) in form.equipment.filter(x => x.equipmentType)" :key="i"
                    class="rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] px-2.5 py-1 text-[10px] font-bold">
                    {{ row.quantity }} × {{ row.equipmentType }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="space-y-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/35 p-4 sm:p-5">
            <h4 class="text-base font-black">Documentos de respaldo</h4>
            <p class="text-xs text-[var(--dh-text-muted)]">Imágenes, PDF, Word y Excel quedan almacenados en Storage y asociados a esta apertura.</p>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label v-for="category in supportCategories" :key="category.key" class="flex min-h-[68px] cursor-pointer items-center justify-center gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-4 text-center text-xs font-black transition-all hover:border-[var(--dh-primary)] hover:bg-[rgb(var(--dh-primary-rgb)/0.07)]">
                <FileUp class="h-4 w-4" />{{ uploadingSupport === category.key ? 'Subiendo…' : category.label }}
                <input class="hidden" type="file" :accept="supportAccept" :disabled="Boolean(uploadingSupport)" @change="uploadDocument(category.key, category.label, $event)" />
              </label>
            </div>
            <div v-if="form.supportDocuments.length" class="grid gap-2 md:grid-cols-2">
              <div v-for="document in form.supportDocuments" :key="document.id" class="flex items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] p-3 text-xs">
                <div class="min-w-0"><p class="font-black">{{ document.categoryLabel }}</p><p class="truncate text-[var(--dh-text-muted)]">{{ document.fileName }}</p></div>
                <button type="button" class="font-black text-red-500" @click="removeDocument(document.id)">Eliminar</button>
              </div>
            </div>
          </div>
        </div>

        <div v-show="activeStep === 3" class="space-y-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 class="text-lg font-black">Revisión de apertura</h4>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Confirma el expediente y selecciona el equipo de Aperturas que realizará la doble validación.</p>
            </div>
            <DhBadge :variant="blockers.length ? 'warning' : 'success'">
              {{ blockers.length ? blockers.length + ' datos por completar' : 'Información completa' }}
            </DhBadge>
          </div>
          <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)]/30 px-4 py-3">
            <span class="text-[11px] font-black uppercase tracking-wide text-[var(--dh-text-muted)]">Apertura manual</span>
            <span class="text-[var(--dh-text-muted)]">·</span>
            <strong class="text-sm">{{ form.transportType === 'MARITIME' ? 'Marítimo' : form.transportType === 'ROAD' ? 'Terrestre' : form.transportType === 'AIR' ? 'Aéreo' : 'Transporte pendiente' }}</strong>
            <DhBadge v-if="effectiveShipment" variant="primary">{{ effectiveShipment }}</DhBadge>
            <span class="ml-auto text-xs text-[var(--dh-text-muted)]">IDTRA consecutivo al confirmar</span>
          </div>
          <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div class="space-y-4">
              <section class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
                <div class="mb-4 flex items-center gap-2"><UserRound class="h-4 w-4 text-[var(--dh-primary)]" /><h5 class="text-sm font-black">Cliente y responsable</h5></div>
                <p class="text-lg font-black">{{ selectedClientName || 'Cliente por seleccionar' }}</p>
                <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Ejecutivo comercial: <strong class="text-[var(--dh-text)]">{{ executiveLabel }}</strong></p>
                <div class="mt-4 grid gap-3 border-t border-[var(--dh-border)] pt-3 sm:grid-cols-2">
                  <div><p class="text-[10px] font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">Procedencia</p><p class="mt-1 text-sm font-semibold">{{ originOptions.find(x => x.value === form.provenance)?.label || '—' }}</p></div>
                  <div><p class="text-[10px] font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">PO / referencia</p><p class="mt-1 break-words text-sm font-semibold">{{ form.clientPoReference || 'Sin referencia' }}</p></div>
                </div>
                <div v-if="selectedOperationalContacts.length" class="mt-3 border-t border-[var(--dh-border)] pt-3">
                  <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">Contactos de operaciones</p>
                  <div class="flex flex-wrap gap-2"><span v-for="contact in selectedOperationalContacts" :key="contact.id" class="rounded-lg bg-[var(--dh-input)] px-2.5 py-1.5 text-xs font-semibold">{{ contact.name }}</span></div>
                </div>
              </section>
              <section class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
                <div class="mb-4 flex items-center gap-2"><Route class="h-4 w-4 text-[var(--dh-primary)]" /><h5 class="text-sm font-black">Ruta e itinerario</h5></div>
                <div class="grid gap-3 sm:grid-cols-3">
                  <div v-for="stop in [{ name: 'Origen · POL', value: form.pol }, { name: 'Entrada · POE', value: form.poe }, { name: 'Destino · POD', value: form.pod }]" :key="stop.name" class="min-w-0 border-l-2 border-[var(--dh-primary)]/35 pl-3">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">{{ stop.name }}</p>
                    <p class="mt-1 break-words text-sm font-black">{{ stop.value || 'Pendiente' }}</p>
                  </div>
                </div>
                <div class="mt-4 flex flex-wrap gap-5 border-t border-[var(--dh-border)] pt-3 text-xs">
                  <span><span class="text-[var(--dh-text-muted)]">Incoterm:</span> <strong>{{ form.incoterm || 'Pendiente' }}</strong></span>
                  <span><span class="text-[var(--dh-text-muted)]">ETD:</span> <strong>{{ form.etm || 'Por confirmar' }}</strong></span>
                  <span><span class="text-[var(--dh-text-muted)]">ETA:</span> <strong>{{ form.eta || 'Por confirmar' }}</strong></span>
                </div>
              </section>
              <section class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
                <div class="mb-3 flex items-center gap-2"><Package class="h-4 w-4 text-[var(--dh-primary)]" /><h5 class="text-sm font-black">Mercancía y equipos</h5></div>
                <p class="text-sm font-semibold">{{ form.cargoDescription || 'Descripción pendiente' }}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span v-if="form.cabysCode" class="rounded-lg bg-[var(--dh-input)] px-3 py-1.5 text-xs font-bold">CABYS {{ form.cabysCode }}</span>
                  <span v-if="form.packageCount" class="rounded-lg bg-[var(--dh-input)] px-3 py-1.5 text-xs font-bold">{{ form.packageCount }} {{ form.packageType || 'bultos' }}</span>
                  <span v-if="form.volumeValue" class="rounded-lg bg-[var(--dh-input)] px-3 py-1.5 text-xs font-bold">{{ form.volumeValue }} {{ form.volumeUnit }}</span>
                  <span v-for="(item, i) in form.equipment.filter(x => x.equipmentType)" :key="i" class="rounded-lg border border-[var(--dh-primary)]/20 px-3 py-1.5 text-xs font-bold">{{ item.quantity }} × {{ item.equipmentType }}</span>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                  <DhBadge v-if="form.isImo" variant="warning">IMO / peligrosa</DhBadge>
                  <DhBadge v-if="['LCL','LTL'].includes(effectiveShipment)" variant="neutral">{{ form.stackable ? 'Estibable' : 'No estibable' }}</DhBadge>
                  <DhBadge v-if="form.overweight" variant="warning">Sobrepeso</DhBadge>
                  <DhBadge v-if="form.portHandlingMode" variant="neutral">{{ form.portHandlingMode }}</DhBadge>
                  <DhBadge v-if="form.cargoNature" variant="neutral">{{ form.cargoNature }}</DhBadge>
                </div>
                <div class="mt-4 border-t border-[var(--dh-border)] pt-3">
                  <p class="text-xs font-bold">Documentos: {{ form.supportDocuments.length }}</p>
                  <p v-if="form.supportDocuments.length" class="mt-1 break-words text-xs text-[var(--dh-text-muted)]">{{ form.supportDocuments.map(x => x.fileName).join(' · ') }}</p>
                  <p v-else class="mt-1 text-xs text-[var(--dh-text-muted)]">Sin documentos adjuntos.</p>
                </div>
              </section>
            </div>
            <div class="space-y-4">
              <section class="rounded-[20px] border border-[var(--dh-primary)]/30 bg-[rgb(var(--dh-primary-rgb)/0.04)] p-4 sm:p-5">
                <div class="flex items-center gap-2"><UsersRound class="h-5 w-5 text-[var(--dh-primary)]" /><h5 class="text-base font-black">Equipo de Aperturas</h5></div>
                <p class="mt-2 text-xs text-[var(--dh-text-muted)]">Elige el equipo antes de crear el expediente. Dos validadores diferentes revisarán la apertura.</p>
                <div v-if="editingId" class="mt-4 text-sm font-semibold">La asignación existente se mantiene al editar el trámite.</div>
                <template v-else>
                  <DhSelect v-model="assignedTeamId" class="mt-4" label="Asignar al equipo" :options="assignmentTeamOptions"
                    :disabled="assignmentTeamsLoading" placeholder="Seleccionar equipo de Aperturas" />
                  <div v-if="selectedOpeningTeam" class="mt-3 rounded-xl border p-3"
                    :class="selectedOpeningTeam.canAssign ? 'border-[var(--dh-primary)]/30' : 'border-amber-500/40'">
                    <p class="text-sm font-black">{{ selectedOpeningTeam.name }}</p>
                    <p class="mt-1 text-xs" :class="selectedOpeningTeam.canAssign ? 'text-[var(--dh-text-muted)]' : 'text-amber-500'">
                      {{ selectedOpeningTeam.availableReviewers }} colaboradores disponibles · {{ selectedOpeningTeam.canAssign ? 'Cumple el mínimo de 2 validadores configurados (sujeto a validación de Auth)' : 'Se requieren 2 usuarios disponibles y autorizados' }}
                    </p>
                  </div>
                  <p v-else-if="!assignmentTeamsLoading && !availableTeams.length" class="mt-3 text-xs font-semibold text-amber-500">
                    No hay equipos de Aperturas activos. Configura uno con dos validadores en Operaciones → Equipos.
                  </p>
                  <p v-if="assignmentTeamsError" role="alert" class="mt-2 text-xs text-amber-500">{{ assignmentTeamsError }}</p>
                  <DhButton variant="secondary" :icon="RefreshCw" size="sm" label="Actualizar equipos" class="mt-3"
                    :loading="assignmentTeamsLoading" @click="loadAssignmentTeams" />
                </template>
              </section>
              <section class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
                <div class="flex items-center justify-between gap-2"><h5 class="text-sm font-black">Completitud</h5><DhBadge :variant="blockers.length ? 'warning' : 'success'">{{ blockers.length ? blockers.length + ' pendientes' : 'Lista' }}</DhBadge></div>
                <p v-if="!blockers.length" class="mt-3 text-xs text-[var(--dh-text-muted)]">Información mínima lista. La asignación será confirmada por Operations y registrada en el expediente.</p>
                <ul v-else class="mt-3 space-y-2">
                  <li v-for="item in blockers" :key="item" class="flex gap-2 text-xs font-semibold text-amber-500"><CircleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />{{ item }}</li>
                </ul>
                <p class="mt-4 border-t border-[var(--dh-border)] pt-3 text-xs text-[var(--dh-text-muted)]">
                  {{ assignmentPendingId ? 'Este IDTRA ya existe. Reintentar la asignación no crea otro expediente.' : 'La creación no modifica QUOs ni costos comerciales. El IDTRA se asigna al confirmar.' }}
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="sticky bottom-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-[23px] border border-[var(--dh-border)] bg-[var(--dh-card-solid,var(--dh-card))] p-3 shadow-xl sm:p-4">
      <DhButton variant="secondary" :icon="ChevronLeft" label="Anterior" :disabled="activeStep <= 1" @click="goToStep(activeStep - 1)" />
      <div class="hidden text-center sm:block">
        <p class="text-xs font-black">{{ activeStepMeta.label }}</p>
        <p class="text-[11px] text-[var(--dh-text-muted)]">Paso {{ activeStep }} / {{ wizardSteps.length }}</p>
      </div>
      <div class="flex items-center gap-2">
        <DhButton v-if="activeStep < wizardSteps.length" :icon="ChevronRight" label="Siguiente" @click="goToStep(activeStep + 1)" />
        <DhButton v-else :icon="editingId ? Save : FolderPlus"
          :label="editingId ? 'Guardar modificaciones' : assignmentPendingId ? 'Reintentar asignación' : 'Crear y asignar a equipo'"
          :disabled="loading || saving || (!valid && !assignmentPendingId) || (!editingId && blockers.length > 0 && !assignmentPendingId)" :loading="saving" @click="save" />
      </div>
    </footer>
  </div>
</template>

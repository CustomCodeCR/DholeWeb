<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Package, Plus, Trash2, Save, FolderPlus, Route, Users, Truck, Layers3 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhSearchInput } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { operationsApi, type CrmAccountOption } from '../services/operationsApi'
import PricingCrystalMultiSelect from '@/modules/pricing/components/PricingCrystalMultiSelect.vue'
import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'
import PricingWizardStepper from '@/modules/pricing/components/PricingWizardStepper.vue'
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
const accountSearch = ref('')
const accounts = ref<CrmAccountOption[]>([])
const loadingAccounts = ref(false)
const modality = ref('')
const priority = ref(1)
const complexity = ref(1)
const saving = ref(false)
const activeStep = ref(1)
const wizardSteps = [
  { id: 1, label: 'Cliente', hint: 'Cuenta CRM y referencias' },
  { id: 2, label: 'Ruta', hint: 'Modalidad, Incoterm y terminales' },
  { id: 3, label: 'Carga', hint: 'Mercancía, pesos y equipos' },
  { id: 4, label: 'Servicios', hint: 'Recolección, entrega y coordinación' },
  { id: 5, label: 'Revisión', hint: 'Resumen y guardado del borrador' },
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
const agentChoices = computed(() => catalogChoices('agents'))
const carrierChoices = computed(() => catalogChoices('carriers'))
const equipmentChoices = computed(() => {
  const type = modality.value === 'FTL' ? 'land-equipment-sizes' : 'container-types'
  return [{ label: 'Seleccionar equipo', value: '' }, ...catalogChoices(type)]
})
function asChoices(key: string, saved: string) {
  const options = catalogChoices(key)
  return saved && !options.some(x => x.value === saved) ? [{ label: saved, value: saved }, ...options] : options
}
const incotermChoices = computed(() => {
  const items = catalogChoices('incoterms')
  const values = items.length ? items : incoterms.map(value => ({ label: value, value }))
  return values.filter(item => isMaritime.value || !['FAS','FOB','CFR','CIF'].includes(item.value.toUpperCase()))
})
const serviceChoices = computed(() => {
  const items = currentCatalog('pricing-services').filter(x => x.isActive).map(x => ({value: x.id, label: optionText(x)}))
  const legacy = serviceCatalog.map(([value, label]) => ({ value, label }))
  const combined = items.length ? [...items, ...legacy.filter(x => form.value.services.includes(x.value))] : legacy
  for (const selected of form.value.services) {
    if (!combined.some(x => x.value === selected)) combined.push({ value: selected, label: selected })
  }
  return combined
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
    const names = ['pol','poe','pod','incoterms','container-types','land-equipment-sizes','agents','carriers','pricing-services']
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
const fieldTitle = (label: string, value: unknown) => ({ label, value: value == null || value === '' ? 'Pendiente' : String(value) })
const summaryFields = computed(() => [
  fieldTitle('Cliente', accounts.value.find(x => x.id === accountId.value)?.displayName || accountId.value),
  fieldTitle('Modalidad', modality.value), fieldTitle('Transporte', form.value.transportType),
  fieldTitle('Incoterm', form.value.incoterm), fieldTitle('Origen / POL', form.value.pol),
  fieldTitle('Salida / POE', form.value.poe), fieldTitle('Destino / POD', form.value.pod),
  fieldTitle('Mercancía', form.value.cargoDescription),
  fieldTitle('Bultos', form.value.packageCount),
  fieldTitle('Peso', form.value.weightValue ? form.value.weightValue + ' ' + form.value.weightUnit : ''),
  fieldTitle('Volumen', form.value.volumeValue ? form.value.volumeValue + ' ' + form.value.volumeUnit : ''),
  fieldTitle('Equipos', form.value.equipment.map(item => item.quantity + ' × ' + item.equipmentType).join(', ')),
  fieldTitle('Servicios', form.value.services.map(v => serviceChoices.value.find(x => x.value === v)?.label || v).join(', ')),
])
const loading = ref(true)
const error = ref('')
const form = ref({
  provenance: 'CLIENT', clientPoReference: '', crmDivisionId: '',
  shipmentType: '', transportType: '', incoterm: '',
  pol: '', poe: '', pod: '', pickupAddress: '', pickupContact: '',
  pickupWindow: '', requiresPickup: false, whsName: '',
  destinationAddress: '', cargoDescription: '', packageCount: '',
  packageType: '', weightValue: '', weightUnit: 'KG',
  volumeValue: '', volumeUnit: 'CBM', consolidationReference: '',
  isImo: false, imoClass: '', unNumber: '', stackable: true,
  overweight: false, overweightNotes: '', carrierReference: '',
  agentReference: '', merchantReference: '', etm: '', eta: '',
  services: [] as string[], observations: '',
  contactReferences: '', commercialReviewRequested: false,
  equipment: [] as Array<{ equipmentType: string; quantity: number }>,
  originCountryCode: '', destinationCountryCode: '',
})
const modalOptions = [
  { label: 'FCL', value: 'FCL' }, { label: 'LCL', value: 'LCL' },
  { label: 'FTL', value: 'FTL' }, { label: 'LTL', value: 'LTL' },
  { label: 'Aéreo', value: 'AIR' }, { label: 'Multimodal', value: 'MULTIMODAL' },
]
const transportOptions = [
  { label: 'Marítimo', value: 'MARITIME' }, { label: 'Terrestre', value: 'ROAD' },
  { label: 'Aéreo', value: 'AIR' }, { label: 'Multimodal', value: 'MULTIMODAL' },
]
const originOptions = [
  { label: 'Cliente', value: 'CLIENT' }, { label: 'Proveedor', value: 'SUPPLIER' },
  { label: 'Agente', value: 'AGENT' }, { label: 'Oficina de origen', value: 'ORIGIN_OFFICE' },
]
const incoterms = ['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP']
const serviceCatalog: Array<[string, string]> = [
  ['INTERNATIONAL_FREIGHT','Transporte internacional'],
  ['PICKUP','Recolecta'],['ORIGIN_CHARGES','Cargos en origen'],
  ['DESTINATION_CHARGES','Cargos en destino'],
  ['INLAND','Inland'],['CUSTOMS','Agenciamiento aduanal'],
  ['CARGO_INSURANCE','Seguro de carga'],['DELIVERY','Entrega'],
  ['WAREHOUSE','Almacenaje'],['DOCUMENTATION','Documentación'],
  ['OTHER','Otros servicios'],
]
const isMaritime = computed(() => ['MARITIME','MULTIMODAL'].includes(form.value.transportType))
const needsEquipment = computed(() => modality.value === 'FCL' || modality.value === 'FTL' || modality.value === 'MULTIMODAL')
const requiresWarehouse = computed(() => form.value.incoterm === 'FCA' && ['LCL','LTL'].includes(modality.value))
const accountOptions = computed(() => [
  { label: 'Seleccionar cuenta CRM', value: '' },
  ...accounts.value.map(a => ({ label: a.displayName || a.legalName || a.id, value: a.id })),
])
const valid = computed(() =>
  (editingId.value ? canEdit.value : /^[0-9a-f-]{36}$/i.test(companyId.value)) &&
  modalOptions.some(x => x.value === modality.value) &&
  /^[0-9a-f-]{36}$/i.test(accountId.value) &&
  priority.value >= 1 && priority.value <= 5 && complexity.value > 0 &&
  (!form.value.originCountryCode || /^[A-Za-z]{2}$/.test(form.value.originCountryCode)) &&
  (!form.value.destinationCountryCode || /^[A-Za-z]{2}$/.test(form.value.destinationCountryCode)) &&
  form.value.equipment.every(x => Number.isInteger(x.quantity) && x.quantity > 0))
const blockers = computed(() => {
  const result: string[] = []
  if (!accountId.value) result.push('Cliente CRM')
  if (!form.value.cargoDescription.trim()) result.push('Descripción de la carga')
  if (!form.value.pol.trim()) result.push('POL / lugar de origen')
  if (!form.value.pod.trim()) result.push('POD / lugar de destino')
  if (!form.value.incoterm.trim()) result.push('Incoterm')
  if (needsEquipment.value && !form.value.equipment.length) result.push('Equipos')
  if (requiresWarehouse.value && !form.value.whsName.trim()) result.push('Nombre WHS (FCA + LCL/LTL)')
  if (form.value.isImo && (!form.value.imoClass || !form.value.unNumber)) result.push('Clase IMO / número UN')
  if (form.value.overweight && !form.value.overweightNotes.trim()) result.push('Observaciones de sobrepeso')
  if (form.value.requiresPickup && !form.value.pickupAddress.trim()) result.push('Dirección de recolecta')
  return result
})
function addEquipment() { form.value.equipment.push({ equipmentType: '40HC', quantity: 1 }) }
async function loadAccounts() {
  loadingAccounts.value = true
  try { accounts.value = (await operationsApi.crmAccounts(accountSearch.value)).items }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'No fue posible cargar cuentas CRM.' }
  finally { loadingAccounts.value = false }
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
async function save() {
  if (!valid.value || saving.value || (editingId.value ? !canEdit.value : !auth.hasScope('operations.case.create'))) return
  saving.value = true
  error.value = ''
  try {
    const openingData = {
      ...form.value,
      weightKg: form.value.weightValue ? Number(form.value.weightValue) *
        (form.value.weightUnit === 'LB' ? 0.45359237 : 1) : null,
      volumeCbm: form.value.volumeValue ? Number(form.value.volumeValue) *
        (form.value.volumeUnit === 'CFT' ? 0.028316846592 : 1) : null,
      equipment: form.value.equipment.map(item => ({
        equipmentType: item.equipmentType, quantity: Number(item.quantity),
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
    await router.push({ name: 'operations-case-detail', params: { id: result.id } })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la apertura.'
  } finally { saving.value = false }
}
let accountTimer: ReturnType<typeof setTimeout> | undefined
watch(accountSearch, () => {
  clearTimeout(accountTimer)
  accountTimer = setTimeout(() => { void loadAccounts() }, 250)
})
watch(modality, value => {
  if (restoringOpening) return
  form.value.transportType = value === 'AIR' ? 'AIR' :
    ['FTL','LTL'].includes(value) ? 'ROAD' : value === 'MULTIMODAL' ? 'MULTIMODAL' : 'MARITIME'
})
watch(selectedPol, id => { const label = lookupLabel('pol', id); if (label) form.value.pol = label })
watch(selectedPoe, id => { const label = lookupLabel('poe', id); if (label) form.value.poe = label })
watch(selectedPod, id => { const label = lookupLabel('pod', id); if (label) form.value.pod = label })
watch(selectedWarehouse, id => { const label = lookupLabel('warehouses', id); if (label) form.value.whsName = label })
onMounted(async () => {
  await Promise.all([loadContext(), loadAccounts(), loadPricingCatalogs()])
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
      companyId.value = detail.companyId
      modality.value = detail.modalityCode
      priority.value = detail.priority
      complexity.value = detail.complexityPoints
      const parsed = JSON.parse(detail.openingDataJson || '{}') as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        form.value = { ...form.value, ...parsed } as typeof form.value
      }
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
onUnmounted(() => { clearTimeout(accountTimer) })
</script>

<template>
  <div class="mx-auto w-full max-w-[1480px] space-y-5 px-4 py-6 sm:px-7">
    <RouterLink to="/operations/cases" class="inline-flex items-center gap-2 text-sm font-semibold text-[var(--dh-primary)]">
      <ArrowLeft class="h-4 w-4" /> Volver a Trámites
    </RouterLink>
    <DhPageHeader :title="editingId ? 'Modificar apertura' : 'Nueva apertura manual'" subtitle="Expediente operativo con la misma estructura de datos que una apertura desde Pricing." :icon="FolderPlus" :hide-excel-export="true">
      <template #actions>
        <DhButton :icon="Save" :label="editingId ? 'Guardar modificaciones' : 'Guardar apertura'" :loading="saving" :disabled="loading || !valid" @click="save" />
      </template>
    </DhPageHeader>
    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{{ error }}</div>
    <DhCard v-if="!companyId && canInitialize && !editingId" title="Configuración inicial de Operaciones" subtitle="Solo para administradores autorizados.">
      <p class="mb-3 text-sm text-[var(--dh-text-muted)]">No se ha resuelto la empresa operativa. Puede inicializar el catálogo de equipos existente sin crear usuarios ni permisos adicionales.</p>
      <DhButton variant="secondary" label="Inicializar equipos" :loading="initializing" @click="initializeWorkspace" />
    </DhCard>
    <DhCard title="Identificación y cliente" subtitle="El consecutivo IDTRA se asigna automáticamente desde PostgreSQL. No se captura ni configura en el navegador.">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div class="space-y-2 lg:col-span-2">
          <label class="text-xs font-semibold">Buscar cuenta en CRM</label>
          <DhSearchInput v-model="accountSearch" placeholder="Nombre o cédula de la cuenta…" />
          <DhSelect v-model="accountId" :options="accountOptions" label="Cliente" :disabled="loadingAccounts || Boolean(editingId)" />
        </div>
        <DhSelect v-model="form.provenance" label="Asignación recibida desde" :options="originOptions" />
        <DhInput v-model="form.clientPoReference" label="PO / Referencia cliente" />
        <DhInput v-model="form.crmDivisionId" label="ID división CRM (opcional)" placeholder="Referencia de división" />
        <DhInput v-model="form.contactReferences" label="Contactos de notificación" placeholder="Referencias de contactos CRM" />
      </div>
      <p class="mt-3 text-xs text-[var(--dh-text-muted)]">El ejecutivo comercial responsable se resuelve desde CRM. Una QUO no es obligatoria para una apertura manual.</p>
    </DhCard>

    <DhCard title="Modalidad y condiciones de transporte" subtitle="Solo se solicitarán los datos aplicables al tipo de embarque.">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DhSelect v-model="modality" label="Modalidad" :options="modalOptions" />
        <DhSelect v-model="form.transportType" label="Tipo de transporte" :options="transportOptions" />
        <DhInput v-model="form.shipmentType" label="Tipo de embarque" placeholder="Carga general, consolidada…" />
        <DhSelect v-model="form.incoterm" label="Incoterm" :options="incoterms.filter(v => isMaritime || !['FAS','FOB','CFR','CIF'].includes(v)).map(value => ({ label: value, value }))" />
        <DhInput v-model="form.originCountryCode" label="País de origen · ISO" placeholder="CN" />
        <DhInput v-model="form.destinationCountryCode" label="País destino · ISO" placeholder="CR" />
        <DhInput v-model="form.pol" label="POL / lugar de origen" />
        <DhInput v-model="form.poe" label="POE / punto de salida" />
        <DhInput v-model="form.pod" label="POD / destino" />
        <DhInput v-model="form.etm" label="ETD estimada" type="date" />
        <DhInput v-model="form.eta" label="ETA estimada" type="date" />
      </div>
    </DhCard>

    <DhCard title="Carga, peso y volumen" subtitle="Las unidades originales se conservan; los valores equivalentes se normalizan para Operations.">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div class="md:col-span-2 lg:col-span-3">
          <DhTextarea v-model="form.cargoDescription" label="Descripción de la mercancía" :rows="3" />
        </div>
        <DhInput v-model="form.packageCount" label="Cantidad de bultos" type="number" :min="0" />
        <DhInput v-model="form.packageType" label="Tipo de bulto" />
        <DhInput v-model="form.consolidationReference" label="Consolidado (si aplica)" />
        <DhInput v-model="form.weightValue" label="Peso bruto" type="number" :min="0" />
        <DhSelect v-model="form.weightUnit" label="Unidad peso" :options="[{label:'Kilogramos',value:'KG'},{label:'Libras',value:'LB'}]" />
        <DhInput v-model="form.volumeValue" label="Volumen" type="number" :min="0" />
        <DhSelect v-model="form.volumeUnit" label="Unidad volumen" :options="[{label:'CBM',value:'CBM'},{label:'CFT',value:'CFT'}]" />
      </div>
      <div class="mt-5 grid gap-4 md:grid-cols-3">
        <label class="flex items-center gap-2"><input v-model="form.isImo" type="checkbox" /> Mercancía IMO</label>
        <label class="flex items-center gap-2"><input v-model="form.stackable" type="checkbox" /> Estibable</label>
        <label class="flex items-center gap-2"><input v-model="form.overweight" type="checkbox" /> Sobrepeso</label>
        <DhInput v-if="form.isImo" v-model="form.imoClass" label="Clase IMO" />
        <DhInput v-if="form.isImo" v-model="form.unNumber" label="Número UN" />
        <DhInput v-if="form.overweight" v-model="form.overweightNotes" label="Requerimientos por sobrepeso" />
      </div>
    </DhCard>

    <DhCard v-if="needsEquipment" title="Equipos" subtitle="Se pueden incluir múltiples tipos y cantidades en un mismo expediente.">
      <div v-for="(item, index) in form.equipment" :key="index" class="mb-3 flex flex-wrap items-end gap-3">
        <div class="min-w-[180px] flex-1">
          <DhInput v-model="item.equipmentType" label="Tipo / tamaño" placeholder="40HC, 20GP, 53 FT…" />
        </div>
        <div class="w-36">
          <DhInput :model-value="item.quantity" label="Cantidad" type="number" :min="1" :step="1" @update:model-value="item.quantity = Number($event)" />
        </div>
        <DhButton variant="secondary" :icon="Trash2" label="Eliminar" @click="form.equipment.splice(index, 1)" />
      </div>
      <DhButton variant="secondary" :icon="Plus" label="Agregar equipo" @click="addEquipment" />
    </DhCard>

    <DhCard title="Servicios y coordinación" subtitle="Agregar servicios operativos no crea cargos ni altera cotizaciones de Pricing.">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label v-for="item in serviceCatalog" :key="item[0]" class="flex items-center gap-2 rounded-lg border border-[var(--dh-border)] p-3 text-sm">
          <input type="checkbox" :checked="form.services.includes(item[0])" @change="toggleService(item[0])" />
          {{ item[1] }}
        </label>
      </div>
      <div class="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label class="flex items-center gap-2"><input v-model="form.requiresPickup" type="checkbox" /> Requiere recolecta</label>
        <DhInput v-if="form.requiresPickup" v-model="form.pickupAddress" label="Dirección de recolecta" />
        <DhInput v-if="form.requiresPickup" v-model="form.pickupContact" label="Contacto de recolecta" />
        <DhInput v-if="form.requiresPickup" v-model="form.pickupWindow" label="Horario de recolecta" />
        <DhInput v-if="requiresWarehouse || modality === 'LCL' || modality === 'LTL'" v-model="form.whsName" label="Nombre WHS" />
        <DhInput v-model="form.destinationAddress" label="Dirección de entrega" />
        <DhInput v-if="isMaritime" v-model="form.carrierReference" label="Naviera (referencia SRM)" />
        <DhInput v-model="form.agentReference" label="Agente / oficina de origen" />
        <DhInput v-if="isMaritime" v-model="form.merchantReference" label="Merchant" />
        <DhInput :model-value="priority" label="Prioridad" type="number" :min="1" :max="5" :step="1" @update:model-value="priority = Number($event)" />
        <DhInput :model-value="complexity" label="Complejidad" type="number" :min="0.5" :max="1000" :step="0.5" @update:model-value="complexity = Number($event)" />
      </div>
      <div class="mt-4"><DhTextarea v-model="form.observations" label="Observaciones e instrucciones" :rows="4" /></div>
      <label class="mt-3 flex items-center gap-2 text-sm">
        <input v-model="form.commercialReviewRequested" type="checkbox" />
        Solicitar revisión comercial a Pricing (pendiente de integración)
      </label>
    </DhCard>

    <DhCard title="Completitud del borrador" subtitle="Los datos críticos faltantes no impiden guardar; deberán corregirse antes de validar y asignar a Origen.">
      <p v-if="!blockers.length" class="text-sm text-[var(--dh-text)]">No se detectaron campos críticos pendientes en la captura básica.</p>
      <ul v-else class="list-disc space-y-1 pl-5 text-sm text-amber-400">
        <li v-for="item in blockers" :key="item">{{ item }}</li>
      </ul>
      <div class="mt-5 flex justify-end gap-3">
        <RouterLink to="/operations/cases"><DhButton variant="secondary" label="Cancelar" /></RouterLink>
        <DhButton :icon="Save" :label="editingId ? 'Guardar modificaciones' : 'Guardar apertura manual'" :disabled="!valid || loading" :loading="saving" @click="save" />
      </div>
    </DhCard>
  </div>
</template>
